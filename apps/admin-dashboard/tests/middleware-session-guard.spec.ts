import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../src/middleware';
import { envConfig } from '../src/lib/env';

describe('Middleware Session Guard & Bot Redirect Gate', () => {
  const botUsername = envConfig.TELEGRAM_BOT_USERNAME || 'Al_Saada_smart_bot';
  const expectedBotRedirect = `https://t.me/${botUsername}?start=dashboard_access`;

  it('redirects unauthenticated requests from /admin to bot deep-link (NEVER /login)', async () => {
    const req = new NextRequest('http://localhost:3002/admin');
    const res = await middleware(req);

    expect(res.status).toBe(302);
    const location = res.headers.get('location');
    expect(location).toBe(expectedBotRedirect);
    expect(location).not.toContain('/login');
  });

  it('permits valid 64-hex opaque session cookie to pass through to Server Component', async () => {
    const validOpaqueToken = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

    const req = new NextRequest('http://localhost:3002/admin', {
      headers: {
        cookie: `alsaada_session=${validOpaqueToken}`,
      },
    });

    const res = await middleware(req);
    // NextResponse.next() passes through (no redirect location)
    expect(res.headers.get('location')).toBeNull();
  });

  it('strictly rejects invalid, non-hex, or legacy HMAC token formats at Edge boundary', async () => {
    const invalidTokens = [
      'invalid-short-token',
      'z'.repeat(64), // non-hex
      'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIxMjMifQ.signature', // legacy HMAC
      '12345',
    ];

    for (const token of invalidTokens) {
      const req = new NextRequest('http://localhost:3002/admin', {
        headers: {
          cookie: `alsaada_session=${token}`,
        },
      });

      const res = await middleware(req);
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe(expectedBotRedirect);
      expect(res.cookies.get('alsaada_session')?.maxAge).toBe(0);
    }
  });


  it('attaches traceId header to all requests', async () => {
    const req = new NextRequest('http://localhost:3002/admin');
    const res = await middleware(req);

    const traceId = res.headers.get('x-trace-id');
    expect(traceId).toBeDefined();
    expect(traceId?.length).toBeGreaterThan(0);
  });

  it('strictly protects /api/:path* routes returning 401 UNAUTHORIZED at Edge boundary when session missing', async () => {
    const apiPaths = [
      'http://localhost:3002/api/workers/worker-123',
      'http://localhost:3002/api/settings/telegram-groups',
      'http://localhost:3002/api/canteen/transactions',
      'http://localhost:3002/api/custom-endpoint/test',
    ];

    for (const url of apiPaths) {
      const req = new NextRequest(url);
      const res = await middleware(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('UNAUTHORIZED');
      expect(res.headers.get('x-trace-id')).toBeDefined();
    }
  });

  it('permits public /api/auth and /api/health routes without session requirement', async () => {
    const publicPaths = [
      'http://localhost:3002/api/auth/claim',
      'http://localhost:3002/api/health',
    ];

    for (const url of publicPaths) {
      const req = new NextRequest(url);
      const res = await middleware(req);

      // Should not be 401 and should not redirect
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    }
  });
});
