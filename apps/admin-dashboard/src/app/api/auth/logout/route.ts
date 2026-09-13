import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { prisma } from '@alsaada/database';
import { envConfig } from '../../../../lib/env';
import { extractTraceId } from '@alsaada/telemetry';

function clearAuthCookies(response: NextResponse): void {
  response.cookies.set('alsaada_session', '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    httpOnly: true,
    sameSite: 'lax',
  });

  response.cookies.set('alsaada_admin_role', '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    sameSite: 'lax',
  });
}

async function revokeSessionFromDb(req?: NextRequest, traceId?: string): Promise<void> {
  if (!req?.cookies) return;
  const sessionCookie = req.cookies.get('alsaada_session')?.value;
  if (!sessionCookie) return;

  try {
    const sessionHash = crypto.createHash('sha256').update(sessionCookie.trim()).digest('hex');
    const session = await prisma.dashboardSession.findUnique({
      where: { sessionHash },
    });

    if (session) {
      await prisma.dashboardSession.update({
        where: { id: session.id },
        data: {
          revokedAt: new Date(),
          revocationReason: 'USER_LOGOUT',
        },
      });

      try {
        await prisma.auditLog.create({
          data: {
            actorTelegramId: session.actorTelegramId,
            action: 'USER_LOGOUT',
            entityType: 'DashboardSession',
            entityId: session.id,
            afterPayload: {
              traceId: traceId || 'logout-trace',
              source: 'api/auth/logout',
            },
          },
        });
      } catch (auditErr) {
        console.warn(`[LogoutAuditError] traceId=${traceId}:`, auditErr);
      }
    }
  } catch (err) {
    console.warn(`[LogoutRevokeError] traceId=${traceId}:`, err);
  }
}


export async function POST(req: NextRequest): Promise<NextResponse> {
  const traceId = extractTraceId(req);
  await revokeSessionFromDb(req, traceId);

  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully',
    traceId,
  });

  response.headers.set('X-Trace-Id', traceId);
  clearAuthCookies(response);
  return response;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const traceId = extractTraceId(req);
  await revokeSessionFromDb(req, traceId);

  const botUsername = envConfig.TELEGRAM_BOT_USERNAME || 'Al_Saada_smart_bot';
  const botFallbackUrl = `https://t.me/${botUsername}?start=dashboard_access`;

  const response = NextResponse.redirect(botFallbackUrl, { status: 302 });
  response.headers.set('X-Trace-Id', traceId);
  clearAuthCookies(response);
  return response;
}
