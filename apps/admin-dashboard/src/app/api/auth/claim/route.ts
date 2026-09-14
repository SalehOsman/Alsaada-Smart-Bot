import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { prisma, Prisma } from '@alsaada/database';
import {
  canAccessDashboardRole,
  normalizeOrigin,
  isExactOriginMatch,
  isValidOpaqueTokenFormat,
  resolveEffectiveRequestOrigin,
  CLAIM_FAILURE_HTTP_STATUS_MAP,
  type DashboardClaimFailureCode,
  type DashboardAuthOrigins,
  type CanonicalRole,
} from '@alsaada/rbac';
import { envConfig, validateDashboardAuthEnv } from '../../../../lib/env';
import { extractTraceId, TelemetryLogger } from '@alsaada/telemetry';

const logger = new TelemetryLogger({
  service: 'admin-dashboard',
  defaultComponent: 'auth-claim',
});

const PRISMA_CONNECTION_ERROR_CODES = new Set([
  'P1000',
  'P1001',
  'P1002',
  'P1003',
  'P1008',
  'P1017',
]);

type ClaimTransactionResult =
  | {
      ok: true;
      sessionToken: string;
      sessionId: string;
      targetOrigin: string;
      expiresAt: Date;
      user: {
        id: string;
        telegramId: string;
        name: string;
        role: CanonicalRole;
      };
    }
  | {
      ok: false;
      code: DashboardClaimFailureCode;
    };

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleClaim(request);
}

export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    { success: false, error: 'METHOD_NOT_ALLOWED' },
    { status: 405, headers: { Allow: 'GET' } }
  );
}

async function handleClaim(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl;
  const token = url.searchParams.get('token');
  const traceId = extractTraceId(request);

  const botUsername = envConfig.TELEGRAM_BOT_USERNAME || 'Al_Saada_smart_bot';
  const botFallbackUrl = `https://t.me/${botUsername}?start=dashboard_access`;
  const isApiRequest = request.headers.get('accept')?.includes('application/json');

  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    const code: DashboardClaimFailureCode = 'TOKEN_MISSING';
    const status = CLAIM_FAILURE_HTTP_STATUS_MAP[code];
    if (isApiRequest) {
      return NextResponse.json(
        { success: false, error: code, traceId },
        { status }
      );
    }
    return NextResponse.redirect(botFallbackUrl, { status: 302 });
  }

  const rawToken = token.trim();

  if (!isValidOpaqueTokenFormat(rawToken)) {
    const code: DashboardClaimFailureCode = 'TOKEN_MALFORMED';
    const status = CLAIM_FAILURE_HTTP_STATUS_MAP[code];
    if (isApiRequest) {
      return NextResponse.json(
        { success: false, error: code, traceId },
        { status }
      );
    }
    return renderFailureHtml(code, botFallbackUrl, traceId);
  }

  const jtiHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  try {
    const claimResult: ClaimTransactionResult = await prisma.$transaction(async (tx) => {
      const candidate = await tx.dashboardAuthLink.findUnique({
        where: { jtiHash },
      });

      if (!candidate) {
        return { ok: false, code: 'TOKEN_NOT_FOUND' };
      }

      const now = new Date();
      if (candidate.expiresAt < now) {
        return { ok: false, code: 'TOKEN_EXPIRED' };
      }

      if (candidate.claimedAt) {
        return { ok: false, code: 'TOKEN_ALREADY_CLAIMED' };
      }

      let trustedOrigins: DashboardAuthOrigins;
      try {
        trustedOrigins = validateDashboardAuthEnv();
      } catch (configErr) {
        logger.error('Invalid dashboard origins configuration during claim', {
          traceId,
          action: 'auth.claim.config-error',
          error: configErr instanceof Error ? configErr.message : String(configErr),
        });
        return { ok: false, code: 'CONFIG_ERROR' };
      }

      const requestOrigin = resolveEffectiveRequestOrigin(
        request.nextUrl.origin,
        request.headers,
        trustedOrigins
      );

      if (!isExactOriginMatch(requestOrigin, candidate.targetOrigin)) {
        logger.warn('Dashboard claim origin mismatch detected', {
          traceId,
          action: 'auth.claim.origin-mismatch',
          payload: {
            requestOrigin,
            candidateTargetOrigin: candidate.targetOrigin,
          },
        });
        return { ok: false, code: 'ORIGIN_MISMATCH' };
      }

      await tx.$queryRaw`SELECT id FROM "users" WHERE "telegramId" = ${candidate.actorTelegramId} FOR UPDATE`;

      const user = await tx.user.findFirst({
        where: {
          telegramId: candidate.actorTelegramId,
          isDeleted: false,
        },
        include: {
          assignedSite: true,
        },
      });

      if (!user || !user.isActive || user.isBanned || !canAccessDashboardRole(user.role)) {
        await tx.auditLog.create({
          data: {
            actorTelegramId: candidate.actorTelegramId,
            action: 'DASHBOARD_CLAIM_REJECTED_UNAUTHORIZED',
            entityType: 'User',
            entityId: user?.id || String(candidate.actorTelegramId),
            afterPayload: {
              traceId,
              reason: !user
                ? 'USER_NOT_FOUND'
                : !user.isActive
                ? 'ACCOUNT_INACTIVE'
                : user.isBanned
                ? 'ACCOUNT_BANNED'
                : 'UNAUTHORIZED_ROLE',
              role: user?.role || 'NONE',
            },
          },
        });
        return { ok: false, code: 'ROLE_UNAUTHORIZED' };
      }

      const activeSessionsCount = await tx.dashboardSession.count({
        where: {
          actorTelegramId: candidate.actorTelegramId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
      });

      if (activeSessionsCount >= 3) {
        return { ok: false, code: 'MAX_SESSIONS_EXCEEDED' };
      }

      const updateResult = await tx.dashboardAuthLink.updateMany({
        where: {
          id: candidate.id,
          claimedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          claimedAt: now,
          claimTraceId: traceId,
        },
      });

      if (updateResult.count === 0) {
        return { ok: false, code: 'TOKEN_ALREADY_CLAIMED' };
      }

      if (candidate.groupId) {
        await tx.dashboardAuthLink.updateMany({
          where: {
            groupId: candidate.groupId,
            id: { not: candidate.id },
            claimedAt: null,
          },
          data: {
            claimedAt: now,
            claimTraceId: traceId.slice(0, 36),
          },
        });
      }

      const sessionTtlHours = envConfig.DASHBOARD_SESSION_TTL_HOURS || 8;
      const expiresAt = new Date(Date.now() + sessionTtlHours * 3600 * 1000);
      const maxExpiresAt = new Date(Date.now() + 16 * 3600 * 1000);

      const sessionToken = crypto.randomBytes(32).toString('hex');
      const sessionHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
      const userAgent = request.headers.get('user-agent') || 'Unknown';
      const userAgentHash = crypto.createHash('sha256').update(userAgent).digest('hex');

      const createdSession = await tx.dashboardSession.create({
        data: {
          sessionHash,
          userId: user.id,
          actorTelegramId: user.telegramId,
          originKind: candidate.originKind,
          deviceSummary: userAgent.slice(0, 255),
          userAgentHash,
          expiresAt,
          maxExpiresAt,
          extensionCount: 0,
        },
      });

      await tx.auditLog.create({
        data: {
          actorTelegramId: user.telegramId,
          action: 'DASHBOARD_AUTH_CLAIMED_SUCCESS',
          entityType: 'DashboardSession',
          entityId: createdSession.id,
          afterPayload: {
            traceId,
            userId: user.id,
            role: user.role,
            originKind: candidate.originKind,
            targetOrigin: candidate.targetOrigin,
            groupId: candidate.groupId,
            expiresAt: expiresAt.toISOString(),
            maxExpiresAt: maxExpiresAt.toISOString(),
          },
        },
      });

      return {
        ok: true,
        sessionToken,
        sessionId: createdSession.id,
        targetOrigin: candidate.targetOrigin,
        expiresAt,
        user: {
          id: user.id,
          telegramId: user.telegramId.toString(),
          role: user.role as CanonicalRole,
          name: user.fullName,
        },
      };
    });

    if (!claimResult.ok) {
      const status = CLAIM_FAILURE_HTTP_STATUS_MAP[claimResult.code];
      if (isApiRequest) {
        return NextResponse.json(
          { success: false, error: claimResult.code, traceId },
          { status }
        );
      }
      return renderFailureHtml(claimResult.code, botFallbackUrl, traceId);
    }

    const isHttps = new URL(claimResult.targetOrigin).protocol === 'https:';
    const cookieMaxAge = 16 * 3600;

    if (isApiRequest) {
      const res = NextResponse.json({
        success: true,
        user: claimResult.user,
        expiresAt: claimResult.expiresAt.getTime(),
      });
      res.cookies.set('alsaada_session', claimResult.sessionToken, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: isHttps,
        maxAge: cookieMaxAge,
      });
      return res;
    }

    const redirectUrl = new URL('/admin', claimResult.targetOrigin);
    const redirectRes = NextResponse.redirect(redirectUrl, { status: 302 });
    redirectRes.cookies.set('alsaada_session', claimResult.sessionToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: isHttps,
      maxAge: cookieMaxAge,
    });

    return redirectRes;
  } catch (err: unknown) {
    let failureCode: DashboardClaimFailureCode = 'INTERNAL_ERROR';

    if (
      err instanceof Prisma.PrismaClientInitializationError ||
      err instanceof Prisma.PrismaClientRustPanicError
    ) {
      failureCode = 'DATABASE_ERROR';
    } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (PRISMA_CONNECTION_ERROR_CODES.has(err.code)) {
        failureCode = 'DATABASE_ERROR';
      } else {
        failureCode = 'INTERNAL_ERROR';
      }
    }

    const status = CLAIM_FAILURE_HTTP_STATUS_MAP[failureCode];
    logger.error('Infrastructure or unexpected error during dashboard auth claim', {
      traceId,
      action: 'auth.claim.infrastructure-error',
      payload: { failureCode },
      error: err instanceof Error ? err.message : String(err),
    });

    if (isApiRequest) {
      return NextResponse.json(
        { success: false, error: failureCode, traceId },
        { status }
      );
    }
    return renderFailureHtml(failureCode, botFallbackUrl, traceId);
  }
}

function renderFailureHtml(
  reason: DashboardClaimFailureCode,
  botFallbackUrl: string,
  traceId: string,
): NextResponse {
  const titles: Record<DashboardClaimFailureCode, { title: string; desc: string }> = {
    TOKEN_MISSING: {
      title: 'رابط الدخول غير مكتمل',
      desc: 'لم يتم توفير رمز الدخول المطلوب. يرجى طلب رابط جديد من البوت.',
    },
    TOKEN_MALFORMED: {
      title: 'رمز الدخول غير صالح',
      desc: 'تنسيق رمز الدخول غير صحيح أو تالف. يرجى طلب رابط جديد من البوت.',
    },
    TOKEN_NOT_FOUND: {
      title: 'رابط الدخول غير صالح',
      desc: 'تعذر التحقق من رمز الدخول. يرجى العودة إلى البوت والضغط على «🖥️ فتح لوحة التحكم» لإصدار رابط جديد صالح.',
    },
    TOKEN_EXPIRED: {
      title: 'انتهت صلاحية رابط الدخول',
      desc: 'صلاحية روابط الدخول محددة بـ 5 دقائق فقط لضمان الحماية. يرجى العودة إلى البوت والضغط على «🖥️ فتح لوحة التحكم» لإصدار رابط جديد.',
    },
    TOKEN_ALREADY_CLAIMED: {
      title: 'تم استخدام رابط الدخول مسبقاً',
      desc: 'روابط الدخول المؤسسية صالحة للاستخدام لمرة واحدة فقط حفاظاً على أمان النظام. للحصول على رابط جديد، يرجى العودة إلى البوت والضغط على «🖥️ فتح لوحة التحكم».',
    },
    ORIGIN_MISMATCH: {
      title: 'رابط الدخول غير مخصص لهذا النطاق',
      desc: 'تم استخدام رابط مخصص لنطاق وصول آخر (محلي أو عبر النفق). يرجى التأكد من الدخول عبر الرابط المطابق للعنوان المفتوح.',
    },
    ROLE_UNAUTHORIZED: {
      title: 'الوصول غير مصرح به',
      desc: 'حسابك غير مفوض للوصول إلى لوحة التحكم الإدارية. يرجى مراجعة إدارة المنظومة لتفويض صلاحياتك.',
    },
    MAX_SESSIONS_EXCEEDED: {
      title: 'تم الوصول إلى الحد الأقصى للجلسات النشطة',
      desc: 'لديك 3 جلسات نشطة بالفعل. يرجى العودة إلى البوت لإدارة جلساتك النشطة أو إنهاء إحداها لإتاحة فتح جلسة جديدة.',
    },
    CONFIG_ERROR: {
      title: 'خطأ في إعدادات الاتصال',
      desc: 'حدث خلل في إعدادات اتصال لوحة التحكم بالنظام. يرجى مراجعة المسؤول أو إعادة المحاولة لاحقاً.',
    },
    DATABASE_ERROR: {
      title: 'الخدمة غير متاحة مؤقتاً',
      desc: 'تعذر الاتصال بقاعدة البيانات للتحقق من الجلسة. يرجى إعادة المحاولة لاحقاً أو مراجعة الدعم الفني.',
    },
    INTERNAL_ERROR: {
      title: 'خطأ غير متوقع',
      desc: 'حدث خطأ غير متوقع أثناء معالجة رابط الدخول. يرجى طلب رابط جديد من البوت.',
    },
  };

  const info = titles[reason] || {
    title: 'تعذر تسجيل الدخول',
    desc: 'حدث خطأ أثناء معالجة رابط الدخول. يرجى طلب رابط جديد من البوت.',
  };

  const safeTitle = escapeHtml(info.title);
  const safeDesc = escapeHtml(info.desc);
  const safeBotUrl = escapeHtml(botFallbackUrl);
  const safeTraceId = escapeHtml(traceId);

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 36px 32px; max-width: 460px; width: 100%; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6); }
    .icon { font-size: 52px; margin-bottom: 16px; line-height: 1; }
    h1 { font-size: 20px; font-weight: 700; margin: 0 0 12px; color: #f1f5f9; }
    p { font-size: 14px; color: #94a3b8; line-height: 1.7; margin: 0 0 28px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; font-size: 14px; transition: background 0.15s; }
    .btn:hover { background: #1d4ed8; }
    .trace { font-size: 11px; color: #475569; margin-top: 24px; word-break: break-all; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚠️</div>
    <h1>${safeTitle}</h1>
    <p>${safeDesc}</p>
    <a href="${safeBotUrl}" class="btn">🤖 العودة إلى بوت السعادة</a>
    <div class="trace">رمز التتبع: ${safeTraceId}</div>
  </div>
</body>
</html>`;

  const status = CLAIM_FAILURE_HTTP_STATUS_MAP[reason] || 500;
  const responseHeaders = new Headers();
  responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
  responseHeaders.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none';");
  responseHeaders.set('X-Content-Type-Options', 'nosniff');
  responseHeaders.set('X-Frame-Options', 'DENY');
  responseHeaders.set('X-Trace-Id', traceId);

  return new NextResponse(html, {
    status,
    headers: responseHeaders,
  });
}

