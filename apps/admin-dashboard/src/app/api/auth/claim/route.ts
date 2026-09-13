import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { prisma } from '@alsaada/database';
import { canAccessDashboard, type CanonicalRole } from '@alsaada/rbac';
import { createSessionToken } from '../../../../lib/session';
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

      if (candidate.claimedAt) {
        throw new Error('TOKEN_ALREADY_CLAIMED');
      }

      const now = new Date();
      if (candidate.expiresAt < now) {
        throw new Error('TOKEN_EXPIRED');
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
      return NextResponse.redirect(botFallbackUrl, { status: 302 });
    }

    // 3. Create durable 8-hour session in database
    const sessionId = crypto.randomUUID();
    const sessionHash = crypto.createHash('sha256').update(sessionId).digest('hex');
    const sessionTtlHours = envConfig.DASHBOARD_SESSION_TTL_HOURS || 8;
    const expiresAt = new Date(Date.now() + sessionTtlHours * 3600 * 1000);

    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const userAgentHash = crypto.createHash('sha256').update(userAgent).digest('hex');

    await prisma.dashboardSession.create({
      data: {
        sessionHash,
        userId: user.id,
        actorTelegramId: user.telegramId,
        originKind: link.targetOrigin,
        deviceSummary: userAgent.slice(0, 255),
        userAgentHash,
        expiresAt,
      },
    });

    // 4. Generate signed session token
    const sessionToken = await createSessionToken({
      userId: user.id,
      telegramId: user.telegramId.toString(),
      role: user.role,
      name: user.fullName,
      sessionId,
      assignedSiteId: user.assignedSiteId || null,
      assignedSiteName: user.assignedSite?.name || null,
      isRealSuperAdmin: user.role === 'SUPER_ADMIN',
      createdAt: Date.now(),
    });

    // 5. Record forensic audit log
    await prisma.auditLog.create({
      data: {
        actorTelegramId: user.telegramId,
        action: 'DASHBOARD_AUTH_CLAIMED_SUCCESS',
        entityType: 'DashboardSession',
        entityId: sessionId,
        afterPayload: {
          traceId,
          userId: user.id,
          role: user.role,
          originKind: link.targetOrigin,
          expiresAt: expiresAt.toISOString(),
        },
      },
    });

    // 6. Build response with secure cookie
    const isSecure = link.targetOrigin === 'TUNNEL' || process.env.NODE_ENV === 'production';
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

    // Direct browser redirect to /admin using trusted origin base (strictly prevents Open Redirect & Host header poisoning)
    const trustedBase = link.targetOrigin === 'TUNNEL'
      ? envConfig.DASHBOARD_TUNNEL_URL
      : envConfig.DASHBOARD_LOCAL_URL;
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
      return NextResponse.redirect(botFallbackUrl, { status: 302 });
    }

    if (errorMsg === 'TOKEN_EXPIRED') {
      if (isApiRequest) {
        return NextResponse.json(
          { success: false, error: 'TOKEN_EXPIRED', traceId },
          { status: 401 }
        );
      }
      return NextResponse.redirect(botFallbackUrl, { status: 302 });
    }

    if (isApiRequest) {
      return NextResponse.json(
        { success: false, error: 'INVALID_OR_EXPIRED_TOKEN', traceId },
        { status: 401 }
      );
    }

    return NextResponse.redirect(botFallbackUrl, { status: 302 });
  }
}
