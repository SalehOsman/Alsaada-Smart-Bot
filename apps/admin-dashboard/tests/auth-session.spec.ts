import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import {
  generateOpaqueSessionToken,
  hashSessionToken,
  isValidOpaqueTokenFormat,
} from '../src/lib/session';
import { middleware } from '../src/middleware';

describe('Admin Dashboard Session & Auth Token Security', () => {
  it('generates a 64-character unguessable hex opaque session token and SHA-256 hash', async () => {
    const { rawToken, tokenHash } = await generateOpaqueSessionToken();
    expect(rawToken).toBeDefined();
    expect(rawToken).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/i.test(rawToken)).toBe(true);
    expect(tokenHash).toBeDefined();
    expect(tokenHash).toHaveLength(64);

    const recomputedHash = await hashSessionToken(rawToken);
    expect(recomputedHash).toBe(tokenHash);
  });

  it('isValidOpaqueTokenFormat strictly validates 64-hex opaque tokens and rejects invalid formats', () => {
    expect(isValidOpaqueTokenFormat('a'.repeat(64))).toBe(true);
    expect(isValidOpaqueTokenFormat('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef')).toBe(true);

    // Rejects empty, null, undefined
    expect(isValidOpaqueTokenFormat('')).toBe(false);
    expect(isValidOpaqueTokenFormat(null)).toBe(false);
    expect(isValidOpaqueTokenFormat(undefined)).toBe(false);

    // Rejects non-hex characters
    expect(isValidOpaqueTokenFormat('z'.repeat(64))).toBe(false);

    // Rejects legacy HMAC tokens with '.'
    expect(isValidOpaqueTokenFormat('eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIxMjMifQ.signature')).toBe(false);

    // Rejects incorrect length
    expect(isValidOpaqueTokenFormat('a'.repeat(63))).toBe(false);
    expect(isValidOpaqueTokenFormat('a'.repeat(65))).toBe(false);
  });

  it('middleware strictly redirects unauthenticated requests on /admin routes to bot deep-link', async () => {
    const req = new NextRequest('http://localhost:3000/admin/workforce');
    const res = await middleware(req);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('start=dashboard_access');
  });

  it('middleware rejects plain simulation cookie (alsaada_admin_role) without valid session', async () => {
    const req = new NextRequest('http://localhost:3000/admin', {
      headers: {
        cookie: 'alsaada_admin_role=superadmin',
      },
    });
    const res = await middleware(req);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('start=dashboard_access');
  });

  it('middleware strictly rejects legacy HMAC tokens and clears the cookie', async () => {
    const legacyToken = 'eyJkYXRhIjoiMTIzIn0.signature_part';
    const req = new NextRequest('http://localhost:3000/admin', {
      headers: {
        cookie: `alsaada_session=${legacyToken}`,
      },
    });
    const res = await middleware(req);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('start=dashboard_access');
    const clearedCookie = res.cookies.get('alsaada_session');
    expect(clearedCookie).toBeDefined();
    expect(clearedCookie?.maxAge).toBe(0);
  });

  it('middleware allows access when valid opaque 64-hex session token is provided', async () => {
    const { rawToken } = await generateOpaqueSessionToken();
    const req = new NextRequest('http://localhost:3000/admin', {
      headers: {
        cookie: `alsaada_session=${rawToken}`,
      },
    });
    const res = await middleware(req);
    expect(res.headers.get('location')).toBeNull();
  });
});

