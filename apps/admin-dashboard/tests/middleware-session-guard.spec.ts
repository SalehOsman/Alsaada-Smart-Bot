import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../src/middleware';
import { envConfig } from '../src/lib/env';
import { PINNED_BASE_TIME } from '@alsaada/shared/testing';

describe('Middleware Session Guard & Bot Redirect Gate', () => {
  const botUsername = envConfig.TELEGRAM_BOT_USERNAME || 'Al_Saada_smart_bot';
  const expectedBotRedirect = `https://t.me/${botUsername}?start=dashboard_access`;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('redirects unauthenticated requests from /admin to bot deep-link (NEVER /login)', async () => {
    // Arrange
    const req = new NextRequest('http://localhost:3002/admin');

    // Act
    const res = await middleware(req);

    // Assert
    expect(res.status).toBe(302);
    const location = res.headers.get('location');
    expect(location).toBe(expectedBotRedirect);
    expect(location).not.toContain('/login');
    expect(location).not.toBeNull();
  });

  it('permits valid 64-hex opaque session cookie to pass through to Server Component', async () => {
    // Arrange
    const validOpaqueToken = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
    const req = new NextRequest('http://localhost:3002/admin', {
      headers: {
        cookie: `alsaada_session=${validOpaqueToken}`,
      },
    });

    // Act
    const res = await middleware(req);

    // Assert
    expect(res.headers.get('location')).toBeNull();
    expect(res.status).not.toBe(302);
    expect(res.status).toBe(200);
  });

  it('strictly rejects invalid, non-hex, or legacy HMAC token formats at Edge boundary', async () => {
    // Arrange
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

      // Act
      const res = await middleware(req);

      // Assert
      expect(res.status).toBe(302);
      expect(res.status).not.toBe(200);
      expect(res.headers.get('location')).toBe(expectedBotRedirect);
      expect(res.headers.get('location')).not.toContain('/login');
      expect(res.cookies.get('alsaada_session')?.maxAge).toBe(0);
    }
  });

  it('strictly redirects requests with empty or malformed boundary cookies', async () => {
    // Arrange
    const boundaryTokens = [
      '',
      '   ',
      'a'.repeat(63), // 63 chars (too short)
      'a'.repeat(65), // 65 chars (too long)
    ];

    for (const token of boundaryTokens) {
      const req = new NextRequest('http://localhost:3002/admin', {
        headers: {
          cookie: `alsaada_session=${token}`,
        },
      });

      // Act
      const res = await middleware(req);

      // Assert
      expect(res.status).toBe(302);
      expect(res.status).not.toBe(200);
      expect(res.headers.get('location')).toBe(expectedBotRedirect);
      expect(res.headers.get('location')).not.toBeNull();
    }
  });

  it('attaches traceId header to all requests', async () => {
    // Arrange
    const req = new NextRequest('http://localhost:3002/admin');

    // Act
    const res = await middleware(req);

    // Assert
    const traceId = res.headers.get('x-trace-id');
    expect(traceId).toBeDefined();
    expect(traceId?.length).toBeGreaterThan(0);
    expect(traceId).not.toBeNull();
  });

  it('strictly protects /api/:path* routes returning 401 UNAUTHORIZED at Edge boundary when session missing', async () => {
    // Arrange
    const apiPaths = [
      'http://localhost:3002/api/workers/worker-123',
      'http://localhost:3002/api/settings/telegram-groups',
      'http://localhost:3002/api/canteen/transactions',
      'http://localhost:3002/api/custom-endpoint/test',
    ];

    for (const url of apiPaths) {
      const req = new NextRequest(url);

      // Act
      const res = await middleware(req);

      // Assert
      expect(res.status).toBe(401);
      expect(res.status).not.toBe(200);
      const body = await res.json();
      expect(body.error).toBe('UNAUTHORIZED');
      expect(res.headers.get('x-trace-id')).toBeDefined();
      expect(res.headers.get('location')).toBeNull();
    }
  });

  it('permits public /api/auth and /api/health routes without session requirement', async () => {
    // Arrange
    const publicPaths = [
      'http://localhost:3002/api/auth/claim',
      'http://localhost:3002/api/health',
    ];

    for (const url of publicPaths) {
      const req = new NextRequest(url);

      // Act
      const res = await middleware(req);

      // Assert
      expect(res.status).toBe(200);
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(302);
      expect(res.headers.get('location')).toBeNull();
    }
  });
});
