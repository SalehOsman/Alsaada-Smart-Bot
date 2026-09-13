import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { createSessionToken, verifySessionToken, type SessionPayload } from '../src/lib/session';
import { middleware } from '../src/middleware';

describe('Admin Dashboard Session & Auth Token Security', () => {
  const samplePayload: SessionPayload = {
    userId: 'usr-super-admin-001',
    telegramId: '123456789',
    role: 'SUPER_ADMIN',
    name: 'المهندس صالح عثمان',
    isRealSuperAdmin: true,
    createdAt: Date.now(),
  };

  it('creates and verifies a valid cryptographic HMAC-SHA256 session token', async () => {
    const token = await createSessionToken(samplePayload);
    expect(token).toBeDefined();
    expect(token).toContain('.');

    const verified = await verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe(samplePayload.userId);
    expect(verified?.role).toBe('SUPER_ADMIN');
    expect(verified?.name).toBe(samplePayload.name);
    expect(verified?.isRealSuperAdmin).toBe(true);
  });

  it('rejects tampered or forged tokens with invalid HMAC signatures', async () => {
    const token = await createSessionToken(samplePayload);
    const [dataB64, signature] = token.split('.');

    // Tamper with data payload
    const tamperedPayload = { ...samplePayload, role: 'ATTACKER' };
    const tamperedB64 = Buffer.from(JSON.stringify(tamperedPayload)).toString('base64url');
    const forgedToken = `${tamperedB64}.${signature}`;

    expect(await verifySessionToken(forgedToken)).toBeNull();
  });

  it('rejects corrupted or malformed tokens', async () => {
    expect(await verifySessionToken('')).toBeNull();
    expect(await verifySessionToken('invalid-token')).toBeNull();
    expect(await verifySessionToken('a.b.c')).toBeNull();
  });

  it('rejects expired session tokens older than 7 days', async () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const expiredPayload: SessionPayload = {
      ...samplePayload,
      createdAt: eightDaysAgo,
    };

    const expiredToken = await createSessionToken(expiredPayload);
    expect(await verifySessionToken(expiredToken)).toBeNull();
  });

  it('middleware strictly redirects unauthenticated requests on /admin routes to bot deep-link', async () => {
    const req = new NextRequest('http://localhost:3000/admin/workforce');
    const res = await middleware(req);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('start=dashboard_access');
  });

  it('middleware rejects plain simulation cookie (alsaada_admin_role) without valid cryptographic session', async () => {
    const req = new NextRequest('http://localhost:3000/admin', {
      headers: {
        cookie: 'alsaada_admin_role=superadmin',
      },
    });
    const res = await middleware(req);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('start=dashboard_access');
  });

  it('middleware allows access when valid cryptographic session token is provided', async () => {
    const token = await createSessionToken(samplePayload);
    const req = new NextRequest('http://localhost:3000/admin', {
      headers: {
        cookie: `alsaada_session=${token}`,
      },
    });
    const res = await middleware(req);
    expect(res.headers.get('location')).toBeNull();
  });
});
