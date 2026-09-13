import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { extractTraceId, createTraceHeaders } from '@alsaada/telemetry';
import { isValidOpaqueTokenFormat } from './lib/session';
import { envConfig } from './lib/env';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl?.pathname || new URL(request.url).pathname;

  const traceId = extractTraceId(request);
  const traceHeaders = createTraceHeaders(traceId);

  const botUsername = envConfig.TELEGRAM_BOT_USERNAME || 'Al_Saada_smart_bot';
  const botRedirectUrl = `https://t.me/${botUsername}?start=dashboard_access`;

  // Protect /admin routes
  if (pathname.startsWith('/admin')) {
    const sessionCookie = request.cookies.get('alsaada_session')?.value;

    // Reject missing, non-opaque, or legacy HMAC tokens immediately at the Edge boundary
    if (!sessionCookie || !isValidOpaqueTokenFormat(sessionCookie)) {
      const redirectResponse = NextResponse.redirect(botRedirectUrl, { status: 302 });
      if (sessionCookie) {
        redirectResponse.cookies.set('alsaada_session', '', {
          path: '/',
          maxAge: 0,
          expires: new Date(0),
          httpOnly: true,
          sameSite: 'lax',
        });
      }
      for (const [key, value] of Object.entries(traceHeaders)) {
        redirectResponse.headers.set(key, value);
      }
      return redirectResponse;
    }
  }

  const requestHeaders = new Headers(request.headers);
  for (const [key, value] of Object.entries(traceHeaders)) {
    requestHeaders.set(key, value);
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  for (const [key, value] of Object.entries(traceHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*'],
};
