import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PINNED_BASE_TIME } from '@alsaada/shared/testing';
import {
  generateOpaqueSessionToken,
  hashSessionToken,
  isValidOpaqueTokenFormat,
} from '../src/lib/session';
import { middleware } from '../src/middleware';

describe('Admin Dashboard Session & Auth Token Security', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('generates a 64-character unguessable hex opaque session token and matching SHA-256 hash', async () => {
    // Arrange: No special preconditions required for generation

    // Act
    const { rawToken, tokenHash } = await generateOpaqueSessionToken();
    const recomputedHash = await hashSessionToken(rawToken);

    // Assert
    expect(rawToken).toBeDefined();
    expect(rawToken).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/i.test(rawToken)).toBe(true);
    expect(rawToken).not.toContain('.');
    expect(tokenHash).toBeDefined();
    expect(tokenHash).toHaveLength(64);
    expect(recomputedHash).toBe(tokenHash);
    expect(recomputedHash).not.toBe(rawToken);
  });

  it('produces distinct, collision-resistant tokens across repeated consecutive invocations', async () => {
    // Arrange: Generate two tokens consecutively
    
    // Act
    const first = await generateOpaqueSessionToken();
    const second = await generateOpaqueSessionToken();

    // Assert
    expect(first.rawToken).not.toBe(second.rawToken);
    expect(first.tokenHash).not.toBe(second.tokenHash);
    expect(first.rawToken).toHaveLength(64);
    expect(second.rawToken).toHaveLength(64);
  });

  it('validates 64-hex opaque tokens strictly and rejects invalid formats and lengths', () => {
    // Arrange: Test candidate strings representing valid and malformed structures
    const validHex64 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const validRepeatedA = 'a'.repeat(64);
    const shortToken = 'a'.repeat(63);
    const longToken = 'a'.repeat(65);
    const nonHexToken = 'z'.repeat(64);
    const jwtToken = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIxMjMifQ.signature';
    const spacedToken = ' ' + 'a'.repeat(63);

    // Act & Assert
    expect(isValidOpaqueTokenFormat(validHex64)).toBe(true);
    expect(isValidOpaqueTokenFormat(validRepeatedA)).toBe(true);
    expect(isValidOpaqueTokenFormat(shortToken)).toBe(false);
    expect(isValidOpaqueTokenFormat(longToken)).toBe(false);
    expect(isValidOpaqueTokenFormat(nonHexToken)).toBe(false);
    expect(isValidOpaqueTokenFormat(jwtToken)).toBe(false);
    expect(isValidOpaqueTokenFormat(spacedToken)).toBe(false);
    expect(isValidOpaqueTokenFormat('')).toBe(false);
    expect(isValidOpaqueTokenFormat(null)).toBe(false);
    expect(isValidOpaqueTokenFormat(undefined)).toBe(false);
  });

  it('redirects unauthenticated requests on /admin routes to bot deep-link with HTTP 302', async () => {
    // Arrange
    const req = new NextRequest('http://localhost:3000/admin/workforce');

    // Act
    const res = await middleware(req);

    // Assert
    expect(res.status).toBe(302);
    expect(res.status).not.toBe(200);
    const location = res.headers.get('location');
    expect(location).toContain('start=dashboard_access');
    expect(location).not.toContain('/admin/workforce');
  });

  it('rejects plain simulation cookie without valid cryptographic session and redirects', async () => {
    // Arrange: Cookie attempt with simulated superadmin role but missing session token
    const req = new NextRequest('http://localhost:3000/admin', {
      headers: {
        cookie: 'alsaada_admin_role=superadmin',
      },
    });

    // Act
    const res = await middleware(req);

    // Assert
    expect(res.status).toBe(302);
    expect(res.status).not.toBe(200);
    const location = res.headers.get('location');
    expect(location).toContain('start=dashboard_access');
    expect(location).not.toBeNull();
  });

  it('rejects legacy HMAC tokens containing dot separators, redirects, and evicts cookie', async () => {
    // Arrange: Legacy JWT/HMAC token with signature dot
    const legacyToken = 'eyJkYXRhIjoiMTIzIn0.signature_part';
    const req = new NextRequest('http://localhost:3000/admin', {
      headers: {
        cookie: `alsaada_session=${legacyToken}`,
      },
    });

    // Act
    const res = await middleware(req);

    // Assert
    expect(res.status).toBe(302);
    expect(res.status).not.toBe(200);
    expect(res.headers.get('location')).toContain('start=dashboard_access');
    const clearedCookie = res.cookies.get('alsaada_session');
    expect(clearedCookie).toBeDefined();
    expect(clearedCookie?.maxAge).toBe(0);
    expect(clearedCookie?.value).toBe('');
  });

  it('rejects malformed non-hex session cookies and enforces eviction', async () => {
    // Arrange: Malformed session cookie with invalid characters
    const req = new NextRequest('http://localhost:3000/admin', {
      headers: {
        cookie: 'alsaada_session=invalid-format-session-token-xyz',
      },
    });

    // Act
    const res = await middleware(req);

    // Assert
    expect(res.status).toBe(302);
    expect(res.status).not.toBe(200);
    expect(res.headers.get('location')).toContain('start=dashboard_access');
    const clearedCookie = res.cookies.get('alsaada_session');
    expect(clearedCookie).toBeDefined();
    expect(clearedCookie?.maxAge).toBe(0);
    expect(clearedCookie?.value).toBe('');
  });

  it('permits route access when valid opaque 64-hex session token is supplied', async () => {
    // Arrange: Generate authentic 64-hex token
    const { rawToken } = await generateOpaqueSessionToken();
    const req = new NextRequest('http://localhost:3000/admin', {
      headers: {
        cookie: `alsaada_session=${rawToken}`,
      },
    });

    // Act
    const res = await middleware(req);

    // Assert
    expect(res.headers.get('location')).toBeNull();
    expect(res.status).toBe(200);
    expect(res.status).not.toBe(302);
  });

  it('allows public routes to pass through unredirected without session token', async () => {
    // Arrange: Public / healthcheck route
    const req = new NextRequest('http://localhost:3000/api/health');

    // Act
    const res = await middleware(req);

    // Assert
    expect(res.headers.get('location')).toBeNull();
    expect(res.status).toBe(200);
    expect(res.status).not.toBe(302);
  });
});
