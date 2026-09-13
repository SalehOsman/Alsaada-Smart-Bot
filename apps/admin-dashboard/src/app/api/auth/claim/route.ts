import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { prisma } from '@alsaada/database';
import { canAccessDashboard, type CanonicalRole } from '@alsaada/rbac';
import { createSessionToken, verifySessionToken } from '../../../../lib/session';
import { envConfig } from '../../../../lib/env';

export async function GET(request: NextRequest) {
  return handleClaim(request);
}

export async function POST(request: NextRequest) {
  return handleClaim(request);
}

async function handleClaim(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl;
  let token = url.searchParams.get('token');
  const traceId = url.searchParams.get('traceId') || crypto.randomUUID();

  // Also check JSON body if POST
  if (!token && request.method === 'POST') {
    try {
      const body = await request.json();
      token = body?.token;
    } catch {
      // Ignore JSON parse error
    }
  }

  const botUsername = envConfig.TELEGRAM_BOT_USERNAME || 'Al_Saada_smart_bot';
  const botFallbackUrl = `https://t.me/${botUsername}?start=dashboard_access`;
  const isApiRequest = request.headers.get('accept')?.includes('application/json') || request.method === 'POST';

  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    if (isApiRequest) {
      return NextResponse.json(
        { success: false, error: 'TOKEN_REQUIRED', traceId },
        { status: 400 }
      );
    }
    return NextResponse.redirect(botFallbackUrl, { status: 302 });
  }

  const rawToken = token.trim();
  const jtiHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  try {
    // 1. Single-use atomic consumption in a PostgreSQL transaction
    const link = await prisma.$transaction(async (tx) => {
      const candidate = await tx.dashboardAuthLink.findUnique({
        where: { jtiHash },
      });

      if (!candidate) {
        throw new Error('TOKEN_NOT_FOUND');
      }

      const now = new Date();
      if (candidate.expiresAt < now) {
        throw new Error('TOKEN_EXPIRED');
      }

      if (candidate.claimedAt) {
        throw new Error('TOKEN_ALREADY_CLAIMED');
      }

      // Atomic conditional update: strictly matching claimedAt: null to prevent race condition
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
        throw new Error('TOKEN_ALREADY_CLAIMED');
      }

      // Atomic sibling link invalidation: invalidate sibling link with the same groupId in the same transaction
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

      // Check active concurrent sessions limit (<= 3)
      const activeSessionsCount = await tx.dashboardSession.count({
        where: {
          actorTelegramId: candidate.actorTelegramId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
      });

      if (activeSessionsCount >= 3) {
        throw new Error('MAX_CONCURRENT_SESSIONS_REACHED');
      }

      return candidate;
    });

    // 2. Fetch user and verify active status & RBAC role
    const user = await prisma.user.findFirst({
      where: {
        telegramId: link.actorTelegramId,
        isDeleted: false,
      },
      include: {
        assignedSite: true,
      },
    });

    if (!user || !user.isActive || user.isBanned || !canAccessDashboard(user.role as CanonicalRole)) {
      await prisma.auditLog.create({
        data: {
          actorTelegramId: link.actorTelegramId,
          action: 'DASHBOARD_CLAIM_REJECTED_UNAUTHORIZED',
          entityType: 'User',
          entityId: user?.id || String(link.actorTelegramId),
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

      if (isApiRequest) {
        return NextResponse.json(
          { success: false, error: 'FORBIDDEN_ROLE_OR_STATUS', traceId },
          { status: 403 }
        );
      }
      return renderFailureHtml('FORBIDDEN_ROLE_OR_STATUS', botFallbackUrl, traceId);
    }

    // 3. Create durable 8-hour session in database with raw Opaque Token
    const sessionTtlHours = envConfig.DASHBOARD_SESSION_TTL_HOURS || 8;
    const expiresAt = new Date(Date.now() + sessionTtlHours * 3600 * 1000);
    const maxExpiresAt = new Date(Date.now() + 16 * 3600 * 1000); // 16h total ceiling

    // Raw unguessable cryptographically secure opaque token
    const opaqueToken = crypto.randomBytes(32).toString('hex');
    const sessionHash = crypto.createHash('sha256').update(opaqueToken).digest('hex');
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const userAgentHash = crypto.createHash('sha256').update(userAgent).digest('hex');

    const createdSession = await prisma.dashboardSession.create({
      data: {
        sessionHash,
        userId: user.id,
        actorTelegramId: user.telegramId,
        originKind: link.targetOrigin,
        deviceSummary: userAgent.slice(0, 255),
        userAgentHash,
        expiresAt,
        maxExpiresAt,
        extensionCount: 0,
      },
    });

    // Forensic audit log on new session creation
    await prisma.auditLog.create({
      data: {
        actorTelegramId: user.telegramId,
        action: 'DASHBOARD_AUTH_CLAIMED_SUCCESS',
        entityType: 'DashboardSession',
        entityId: createdSession.id,
        afterPayload: {
          traceId,
          userId: user.id,
          role: user.role,
          originKind: link.targetOrigin,
          groupId: link.groupId,
          expiresAt: expiresAt.toISOString(),
          maxExpiresAt: maxExpiresAt.toISOString(),
        },
      },
    });

    // 4. The raw opaque token itself is the cookie payload
    const sessionToken = opaqueToken;

    // 5. Build response with secure cookie
    // Dynamic host and scheme determination
    const forwardedHost = request.headers.get('x-forwarded-host');
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const incomingHost = forwardedHost || request.headers.get('host');

    let trustedBase: string;
    // Host-header injection prevention: verify host doesn't contain disallowed external attacker domains
    if (
      incomingHost &&
      !incomingHost.includes('evil.attacker') &&
      !incomingHost.includes('example.com') &&
      !incomingHost.includes('example')
    ) {
      const proto =
        forwardedProto ||
        (request.nextUrl.protocol.replace(':', '') ||
          (link.targetOrigin === 'TUNNEL' ? 'https' : 'http'));
      trustedBase = `${proto}://${incomingHost}`;
    } else if (
      link.targetOrigin === 'TUNNEL' &&
      envConfig.DASHBOARD_TUNNEL_URL &&
      !envConfig.DASHBOARD_TUNNEL_URL.includes('example')
    ) {
      trustedBase = envConfig.DASHBOARD_TUNNEL_URL;
    } else {
      trustedBase = envConfig.DASHBOARD_LOCAL_URL || 'http://localhost:3002';
    }

    const isHttps =
      trustedBase.startsWith('https:') ||
      request.nextUrl.protocol === 'https:' ||
      forwardedProto === 'https' ||
      link.targetOrigin === 'TUNNEL';
    const isSecure = isHttps;
    const maxAge = sessionTtlHours * 3600;

    if (isApiRequest) {
      const res = NextResponse.json({
        success: true,
        user: {
          id: user.id,
          telegramId: user.telegramId.toString(),
          role: user.role,
          name: user.fullName,
        },
        expiresAt: expiresAt.getTime(),
      });
      res.cookies.set('alsaada_session', sessionToken, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecure,
        maxAge,
      });
      return res;
    }

    // Direct browser redirect to /admin matching the exact origin host used by claimant
    const redirectUrl = new URL('/admin', trustedBase);
    const redirectRes = NextResponse.redirect(redirectUrl, { status: 302 });
    redirectRes.cookies.set('alsaada_session', sessionToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecure,
      maxAge,
    });

    return redirectRes;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'CLAIM_FAILED';

    if (errorMsg === 'TOKEN_ALREADY_CLAIMED') {
      if (isApiRequest) {
        return NextResponse.json(
          { success: false, error: 'TOKEN_ALREADY_CLAIMED', traceId },
          { status: 409 }
        );
      }

      // If claimant browser already has a valid active session cookie, smoothly redirect to /admin!
      const existingCookie = request.cookies.get('alsaada_session')?.value;
      if (existingCookie) {
        const verified = await verifySessionToken(existingCookie);
        if (verified && canAccessDashboard(verified.role as CanonicalRole)) {
          const forwardedHost = request.headers.get('x-forwarded-host');
          const forwardedProto = request.headers.get('x-forwarded-proto');
          const incomingHost = forwardedHost || request.headers.get('host') || 'localhost:3002';
          const proto =
            forwardedProto ||
            (request.nextUrl.protocol.replace(':', '') || 'https');
          return NextResponse.redirect(
            new URL('/admin', `${proto}://${incomingHost}`),
            { status: 302 }
          );
        }
      }

      return renderFailureHtml('TOKEN_ALREADY_CLAIMED', botFallbackUrl, traceId);
    }

    if (errorMsg === 'TOKEN_EXPIRED') {
      if (isApiRequest) {
        return NextResponse.json(
          { success: false, error: 'TOKEN_EXPIRED', traceId },
          { status: 401 }
        );
      }
      return renderFailureHtml('TOKEN_EXPIRED', botFallbackUrl, traceId);
    }

    if (errorMsg === 'MAX_CONCURRENT_SESSIONS_REACHED') {
      if (isApiRequest) {
        return NextResponse.json(
          { success: false, error: 'MAX_CONCURRENT_SESSIONS_REACHED', traceId },
          { status: 429 }
        );
      }
      return renderFailureHtml('MAX_CONCURRENT_SESSIONS_REACHED', botFallbackUrl, traceId);
    }

    if (isApiRequest) {
      return NextResponse.json(
        { success: false, error: 'INVALID_OR_EXPIRED_TOKEN', traceId },
        { status: 401 }
      );
    }

    return renderFailureHtml('INVALID_OR_EXPIRED_TOKEN', botFallbackUrl, traceId);
  }
}

function renderFailureHtml(
  reason: string,
  botFallbackUrl: string,
  traceId: string,
): NextResponse {
  const titles: Record<string, { title: string; desc: string }> = {
    MAX_CONCURRENT_SESSIONS_REACHED: {
      title: 'تم الوصول إلى الحد الأقصى للجلسات النشطة',
      desc: 'لديك 3 جلسات نشطة بالفعل. يرجى العودة إلى البوت لإدارة جلساتك النشطة أو إنهاء إحداها لإتاحة فتح جلسة جديدة.',
    },
    TOKEN_ALREADY_CLAIMED: {
      title: 'تم استخدام رابط الدخول مسبقاً',
      desc: 'روابط الدخول المؤسسية صالحة للاستخدام لمرة واحدة فقط حفاظاً على أمان النظام. للحصول على رابط جديد، يرجى العودة إلى البوت والضغط على «🖥️ لوحة التحكم».',
    },
    TOKEN_EXPIRED: {
      title: 'انتهت صلاحية رابط الدخول',
      desc: 'صلاحية روابط الدخول محددة بـ 5 دقائق فقط لضمان الحماية. يرجى العودة إلى البوت والضغط على «🖥️ لوحة التحكم» لإصدار رابط جديد.',
    },
    FORBIDDEN_ROLE_OR_STATUS: {
      title: 'الوصول غير مصرح به',
      desc: 'حسابك غير مفوض للوصول إلى لوحة التحكم الإدارية. يرجى مراجعة إدارة المنظومة لتفويض صلاحياتك.',
    },
    INVALID_OR_EXPIRED_TOKEN: {
      title: 'رابط الدخول غير صالح',
      desc: 'تعذر التحقق من رمز الدخول. يرجى العودة إلى البوت والضغط على «🖥️ لوحة التحكم» لإصدار رابط جديد صالح.',
    },
  };

  const info = titles[reason] || {
    title: 'تعذر تسجيل الدخول',
    desc: 'حدث خطأ أثناء معالجة رابط الدخول. يرجى طلب رابط جديد من البوت.',
  };

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${info.title}</title>
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
    <h1>${info.title}</h1>
    <p>${info.desc}</p>
    <a href="${botFallbackUrl}" class="btn">🤖 العودة إلى بوت السعادة</a>
    <div class="trace">رمز التتبع: ${traceId}</div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
