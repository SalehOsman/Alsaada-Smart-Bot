import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../src/middleware';
import { createSessionToken } from '../src/lib/session';
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

  it('permits authorized roles (SUPER_ADMIN, GENERAL_ADMIN, FIELD_ADMIN) with valid session cookie', async () => {
    const authorizedRoles = ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'] as const;

    for (const role of authorizedRoles) {
      const token = await createSessionToken({
        userId: `usr-${role.toLowerCase()}`,
        telegramId: '123456789',
        role,
        name: `Test ${role}`,
        createdAt: Date.now(),
      });

      const req = new NextRequest('http://localhost:3002/admin', {
        headers: {
          cookie: `alsaada_session=${token}`,
        },
      });

      const res = await middleware(req);
      // NextResponse.next() passes through (status 200 or no redirect location)
      expect(res.headers.get('location')).toBeNull();
    }
  });

  it('strictly redirects unauthorized roles (e.g. WORKER, SUPPLIER, GUEST) to bot deep-link', async () => {
    const unauthorizedRoles = ['WORKER', 'WORKER_SUPERVISOR', 'SUPPLIER', 'GUEST', 'EXECUTIVE'];

    for (const role of unauthorizedRoles) {
      const token = await createSessionToken({
        userId: `usr-${role.toLowerCase()}`,
        telegramId: '123456789',
        role: role as any,
        name: `Test ${role}`,
        createdAt: Date.now(),
      });

      const req = new NextRequest('http://localhost:3002/admin', {
        headers: {
          cookie: `alsaada_session=${token}`,
        },
      });

      const res = await middleware(req);
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe(expectedBotRedirect);
    }
  });

  it('attaches traceId header to all requests', async () => {
    const req = new NextRequest('http://localhost:3002/admin');
    const res = await middleware(req);

    const traceId = res.headers.get('x-trace-id');
    expect(traceId).toBeDefined();
    expect(traceId?.length).toBeGreaterThan(0);
  });
});
