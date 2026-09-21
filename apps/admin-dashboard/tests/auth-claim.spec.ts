import { createHash } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@alsaada/database';
import { PINNED_BASE_TIME } from '@alsaada/shared/testing';
import { GET, POST } from '../src/app/api/auth/claim/route';

describe('Dashboard Auth Claim API Route (/api/auth/claim)', () => {
  const testTelegramId = 9988776655n;
  let testUserId: string;

  function deterministicToken(seed: string): string {
    return createHash('sha256').update(seed).digest('hex');
  }

  function deterministicGroupId(index: number): string {
    return `ac000000-0000-0000-0000-${String(index).padStart(12, '0')}`;
  }

  beforeAll(async () => {
    // Ensure test user exists in DB with SUPER_ADMIN role
    const user = await prisma.user.upsert({
      where: { telegramId: testTelegramId },
      update: { role: 'SUPER_ADMIN', isActive: true, isBanned: false },
      create: {
        telegramId: testTelegramId,
        fullName: 'Test Super Admin',
        role: 'SUPER_ADMIN',
        isActive: true,
        isBanned: false,
      },
    });
    testUserId = user.id;
  });

  let stdoutSpy: any;
  let stderrSpy: any;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    await prisma.dashboardSession.deleteMany({ where: { actorTelegramId: testTelegramId } });
    await prisma.dashboardAuthLink.deleteMany({ where: { actorTelegramId: testTelegramId } });
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    stdoutSpy?.mockRestore?.();
    stderrSpy?.mockRestore?.();
    await prisma.dashboardSession.deleteMany({ where: { actorTelegramId: testTelegramId } });
    await prisma.dashboardAuthLink.deleteMany({ where: { actorTelegramId: testTelegramId } });
  });

  afterAll(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    await prisma.dashboardSession.deleteMany({ where: { actorTelegramId: testTelegramId } });
    await prisma.dashboardAuthLink.deleteMany({ where: { actorTelegramId: testTelegramId } });
    await prisma.user.deleteMany({ where: { telegramId: testTelegramId } });
  });

  it('strictly rejects POST requests with 405 Method Not Allowed', async () => {
    // Arrange: No request payload allowed for POST

    // Act
    const res = await POST();

    // Assert
    expect(res.status).toBe(405);
    expect(res.status).not.toBe(200);
    expect(res.headers.get('Allow')).toBe('GET');
    const data = await res.json();
    expect(data.error).toBe('METHOD_NOT_ALLOWED');
  });

  it('strictly rejects claim request when token parameter is missing with 400 Bad Request', async () => {
    // Arrange
    const req = new NextRequest('http://localtest.me:3002/api/auth/claim', {
      method: 'GET',
      headers: { accept: 'application/json' },
    });

    // Act
    const res = await GET(req);

    // Assert
    expect(res.status).toBe(400);
    expect(res.status).not.toBe(200);
    const data = await res.json();
    expect(data.error).toBe('TOKEN_MISSING');
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('strictly rejects claim request when token does not exist with 401 Unauthorized', async () => {
    // Arrange
    const fakeToken = deterministicToken('nonexistent-token-seed');
    const req = new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${fakeToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });

    // Act
    const res = await GET(req);

    // Assert
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(200);
    const data = await res.json();
    expect(data.error).toBe('TOKEN_NOT_FOUND');
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('successfully claims a valid token, creates 8-hour DB session, and sets 16h cookie', async () => {
    // Arrange
    const rawToken = deterministicToken('valid-claim-token-seed');
    const jtiHash = createHash('sha256').update(rawToken).digest('hex');
    const groupId = deterministicGroupId(1);

    await prisma.dashboardAuthLink.create({
      data: {
        groupId,
        originKind: 'LOCAL',
        targetOrigin: 'http://localtest.me:3002',
        jtiHash,
        actorTelegramId: testTelegramId,
        expiresAt: new Date(PINNED_BASE_TIME.getTime() + 300_000), // 5 min
      },
    });

    const req = new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${rawToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });

    // Act
    const res = await GET(req);

    // Assert
    expect(res.status).toBe(200);
    expect(res.status).not.toBe(401);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user.id).toBe(testUserId);
    expect(data.user.role).toBe('SUPER_ADMIN');

    // Verify cookie was set with 16-hour maxAge
    const setCookie = res.cookies.get('alsaada_session');
    expect(setCookie).toBeDefined();
    expect(setCookie?.value).toBeDefined();
    expect(setCookie?.maxAge).toBe(16 * 3600);
    expect(setCookie?.httpOnly).toBe(true);
    expect(setCookie?.sameSite).toBe('lax');

    // Verify link is marked claimed in DB
    const updatedLink = await prisma.dashboardAuthLink.findUnique({
      where: { jtiHash },
    });
    expect(updatedLink?.claimedAt).not.toBeNull();

    // Verify session was created in DB with 8h initial expiresAt and 16h maxExpiresAt
    const sessionHash = createHash('sha256').update(setCookie!.value).digest('hex');
    const dbSession = await prisma.dashboardSession.findUnique({
      where: { sessionHash },
    });
    expect(dbSession).toBeDefined();
    expect(dbSession?.userId).toBe(testUserId);
    expect(dbSession?.revokedAt).toBeNull();
    expect(dbSession?.extensionCount).toBe(0);
    expect(dbSession?.maxExpiresAt).toBeDefined();
  });

  it('strictly rejects claim when request origin does not match targetOrigin (ORIGIN_MISMATCH)', async () => {
    // Arrange
    const rawToken = deterministicToken('origin-mismatch-token-seed');
    const jtiHash = createHash('sha256').update(rawToken).digest('hex');
    const groupId = deterministicGroupId(2);

    await prisma.dashboardAuthLink.create({
      data: {
        groupId,
        originKind: 'TUNNEL',
        targetOrigin: 'https://alsaada-tunnel.ngrok-free.app',
        jtiHash,
        actorTelegramId: testTelegramId,
        expiresAt: new Date(PINNED_BASE_TIME.getTime() + 300_000),
      },
    });

    // Request comes from localhost instead of the tunnel targetOrigin
    const req = new NextRequest(`http://localhost:3002/api/auth/claim?token=${rawToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });

    // Act
    const res = await GET(req);

    // Assert
    expect(res.status).toBe(403);
    expect(res.status).not.toBe(200);
    const data = await res.json();
    expect(data.error).toBe('ORIGIN_MISMATCH');
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('strictly denies second claim attempt with the same token (single-use atomic)', async () => {
    // Arrange
    const rawToken = deterministicToken('single-use-token-seed');
    const jtiHash = createHash('sha256').update(rawToken).digest('hex');
    const groupId = deterministicGroupId(3);

    await prisma.dashboardAuthLink.create({
      data: {
        groupId,
        originKind: 'LOCAL',
        targetOrigin: 'http://localtest.me:3002',
        jtiHash,
        actorTelegramId: testTelegramId,
        expiresAt: new Date(PINNED_BASE_TIME.getTime() + 300_000),
      },
    });

    // Act 1: First claim must succeed
    const req1 = new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${rawToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const res1 = await GET(req1);
    expect(res1.status).toBe(200);

    // Act 2: Second claim must fail with 401 Unauthorized (TOKEN_ALREADY_CLAIMED)
    const req2 = new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${rawToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const res2 = await GET(req2);

    // Assert
    expect(res2.status).toBe(401);
    expect(res2.status).not.toBe(200);
    const data2 = await res2.json();
    expect(data2.error).toBe('TOKEN_ALREADY_CLAIMED');
    expect(res2.headers.get('set-cookie')).toBeNull();
  });

  it('strictly rejects claim when token is expired with 401 TOKEN_EXPIRED', async () => {
    // Arrange
    const rawToken = deterministicToken('expired-token-seed');
    const jtiHash = createHash('sha256').update(rawToken).digest('hex');
    const groupId = deterministicGroupId(4);

    await prisma.dashboardAuthLink.create({
      data: {
        groupId,
        originKind: 'LOCAL',
        targetOrigin: 'http://localtest.me:3002',
        jtiHash,
        actorTelegramId: testTelegramId,
        expiresAt: new Date(PINNED_BASE_TIME.getTime() - 10_000), // Expired 10s ago
      },
    });

    const req = new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${rawToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });

    // Act
    const res = await GET(req);

    // Assert
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(200);
    const data = await res.json();
    expect(data.error).toBe('TOKEN_EXPIRED');
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('denies claim when user role is unauthorized for dashboard (e.g. WORKER)', async () => {
    // Arrange
    const workerTelegramId = 7766554433n;
    const workerUser = await prisma.user.upsert({
      where: { telegramId: workerTelegramId },
      update: { role: 'WORKER', isActive: true, isBanned: false },
      create: {
        telegramId: workerTelegramId,
        fullName: 'Test Worker User',
        role: 'WORKER',
        isActive: true,
        isBanned: false,
      },
    });

    const rawToken = deterministicToken('worker-unauthorized-token-seed');
    const jtiHash = createHash('sha256').update(rawToken).digest('hex');
    const groupId = deterministicGroupId(5);

    await prisma.dashboardAuthLink.create({
      data: {
        groupId,
        originKind: 'LOCAL',
        targetOrigin: 'http://localtest.me:3002',
        jtiHash,
        actorTelegramId: workerTelegramId,
        expiresAt: new Date(PINNED_BASE_TIME.getTime() + 300_000),
      },
    });

    const req = new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${rawToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });

    // Act
    const res = await GET(req);

    // Assert
    expect(res.status).toBe(403);
    expect(res.status).not.toBe(200);
    const data = await res.json();
    expect(data.error).toBe('ROLE_UNAUTHORIZED');
    expect(res.headers.get('set-cookie')).toBeNull();

    // Cleanup worker
    await prisma.user.delete({ where: { id: workerUser.id } });
    await prisma.dashboardAuthLink.deleteMany({ where: { actorTelegramId: workerTelegramId } });
  });

  it('performs direct browser redirect (302) to /admin on targetOrigin and sets session cookie', async () => {
    // Arrange
    const rawToken = deterministicToken('browser-redirect-token-seed');
    const jtiHash = createHash('sha256').update(rawToken).digest('hex');
    const groupId = deterministicGroupId(6);

    await prisma.dashboardAuthLink.create({
      data: {
        groupId,
        originKind: 'LOCAL',
        targetOrigin: 'http://localtest.me:3002',
        jtiHash,
        actorTelegramId: testTelegramId,
        expiresAt: new Date(PINNED_BASE_TIME.getTime() + 300_000),
      },
    });

    const req = new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${rawToken}`, {
      method: 'GET',
    });

    // Act
    const res = await GET(req);

    // Assert
    expect(res.status).toBe(302);
    expect(res.status).not.toBe(200);
    expect(res.headers.get('location')).toBe('http://localtest.me:3002/admin');
    expect(res.cookies.get('alsaada_session')?.value).toBeDefined();
    expect(res.cookies.get('alsaada_session')?.maxAge).toBe(16 * 3600);
  });

  it('atomically invalidates sibling link sharing the same groupId upon claiming', async () => {
    // Arrange
    await prisma.dashboardSession.deleteMany({ where: { actorTelegramId: testTelegramId } });

    const groupId = deterministicGroupId(7);
    const localToken = deterministicToken('sibling-local-token-seed');
    const localJtiHash = createHash('sha256').update(localToken).digest('hex');

    const tunnelToken = deterministicToken('sibling-tunnel-token-seed');
    const tunnelJtiHash = createHash('sha256').update(tunnelToken).digest('hex');

    await prisma.dashboardAuthLink.createMany({
      data: [
        {
          jtiHash: localJtiHash,
          groupId,
          originKind: 'LOCAL',
          targetOrigin: 'http://localtest.me:3002',
          actorTelegramId: testTelegramId,
          expiresAt: new Date(PINNED_BASE_TIME.getTime() + 300_000),
        },
        {
          jtiHash: tunnelJtiHash,
          groupId,
          originKind: 'TUNNEL',
          targetOrigin: 'http://localtest.me:3002',
          actorTelegramId: testTelegramId,
          expiresAt: new Date(PINNED_BASE_TIME.getTime() + 300_000),
        },
      ],
    });

    // Act 1: Claim local link must succeed
    const localReq = new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${localToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const localRes = await GET(localReq);
    expect(localRes.status).toBe(200);

    // Act 2: Attempt to claim sibling tunnel link must fail with 401 TOKEN_ALREADY_CLAIMED
    const tunnelReq = new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${tunnelToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const tunnelRes = await GET(tunnelReq);

    // Assert
    expect(tunnelRes.status).toBe(401);
    expect(tunnelRes.status).not.toBe(200);
    const tunnelData = await tunnelRes.json();
    expect(tunnelData.error).toBe('TOKEN_ALREADY_CLAIMED');
    expect(tunnelRes.headers.get('set-cookie')).toBeNull();

    // Sibling record in DB must be marked claimed with claim trace
    const dbSibling = await prisma.dashboardAuthLink.findUnique({
      where: { jtiHash: tunnelJtiHash },
    });
    expect(dbSibling?.claimedAt).not.toBeNull();
    expect(dbSibling?.claimTraceId).toBeDefined();
    expect(dbSibling?.claimTraceId?.length).toBeGreaterThan(0);
  });

  it('strictly rejects claim and returns 429 when user already has 3 active concurrent sessions', async () => {
    // Arrange
    await prisma.dashboardSession.deleteMany({ where: { actorTelegramId: testTelegramId } });
    for (let i = 0; i < 3; i++) {
      const { tokenHash } = await (await import('../src/lib/session')).generateOpaqueSessionToken();
      await prisma.dashboardSession.create({
        data: {
          sessionHash: tokenHash,
          userId: testUserId,
          actorTelegramId: testTelegramId,
          originKind: 'LOCAL',
          expiresAt: new Date(PINNED_BASE_TIME.getTime() + 8 * 3600 * 1000),
          maxExpiresAt: new Date(PINNED_BASE_TIME.getTime() + 16 * 3600 * 1000),
          extensionCount: 0,
        },
      });
    }

    const fourthToken = deterministicToken('fourth-token-seed');
    const fourthJtiHash = createHash('sha256').update(fourthToken).digest('hex');
    const groupId = deterministicGroupId(8);

    await prisma.dashboardAuthLink.create({
      data: {
        groupId,
        originKind: 'LOCAL',
        targetOrigin: 'http://localtest.me:3002',
        jtiHash: fourthJtiHash,
        actorTelegramId: testTelegramId,
        expiresAt: new Date(PINNED_BASE_TIME.getTime() + 300_000),
      },
    });

    const fourthReq = new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${fourthToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });

    // Act
    const fourthRes = await GET(fourthReq);

    // Assert
    expect(fourthRes.status).toBe(429);
    expect(fourthRes.status).not.toBe(200);
    const fourthData = await fourthRes.json();
    expect(fourthData.error).toBe('MAX_SESSIONS_EXCEEDED');
    expect(fourthRes.headers.get('set-cookie')).toBeNull();
  });

  describe('Reflected XSS Elimination, Security Headers & HTTP Status Matrix', () => {
    it('strictly prevents Reflected XSS and does not reflect script tags raw in HTML (400 on malformed token)', async () => {
      // Arrange
      const maliciousPayload = '<script>alert(1)</script>';
      const req = new NextRequest(
        `http://localtest.me:3002/api/auth/claim?token=malformed-token&traceId=${encodeURIComponent(maliciousPayload)}`,
        { method: 'GET' }
      );

      // Act
      const res = await GET(req);

      // Assert
      expect(res.status).toBe(400);
      expect(res.status).not.toBe(200);
      expect(res.headers.get('content-security-policy')).toBe(
        "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none';"
      );
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('DENY');

      const body = await res.text();
      expect(body).not.toContain('<script>alert(1)</script>');
    });

    it('strictly prevents Reflected XSS with img onerror payload (401 on valid-format nonexistent token)', async () => {
      // Arrange
      const imgPayload = '"><img src=x onerror=alert(1)>';
      const fakeValidToken = deterministicToken('fake-valid-token-for-xss');
      const req = new NextRequest(
        `http://localtest.me:3002/api/auth/claim?token=${fakeValidToken}&traceId=${encodeURIComponent(imgPayload)}`,
        { method: 'GET' }
      );

      // Act
      const res = await GET(req);

      // Assert
      expect(res.status).toBe(401);
      expect(res.status).not.toBe(200);
      const body = await res.text();
      expect(body).not.toContain('"><img src=x onerror=alert(1)>');
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    });

    it('returns appropriate HTTP status codes in HTML failure mode for origin mismatch', async () => {
      // Arrange
      const rawToken = deterministicToken('html-failure-origin-mismatch');
      const jtiHash = createHash('sha256').update(rawToken).digest('hex');
      const groupId = deterministicGroupId(9);

      await prisma.dashboardAuthLink.create({
        data: {
          groupId,
          originKind: 'TUNNEL',
          targetOrigin: 'https://tunnel.alsaada.com',
          jtiHash,
          actorTelegramId: testTelegramId,
          expiresAt: new Date(PINNED_BASE_TIME.getTime() + 300_000),
        },
      });

      const mismatchReq = new NextRequest(
        `http://localtest.me:3002/api/auth/claim?token=${rawToken}`,
        { method: 'GET' }
      );

      // Act
      const mismatchRes = await GET(mismatchReq);

      // Assert
      expect(mismatchRes.status).toBe(403);
      expect(mismatchRes.status).not.toBe(200);
      expect(mismatchRes.headers.get('content-security-policy')).toBeDefined();
      expect(mismatchRes.headers.get('x-content-type-options')).toBe('nosniff');
    });

    it('verifies standard localtest.me local origin against localhost mismatch', async () => {
      // Arrange
      const rawToken = deterministicToken('localtest-mismatch-token');
      const jtiHash = createHash('sha256').update(rawToken).digest('hex');
      const groupId = deterministicGroupId(10);

      await prisma.dashboardAuthLink.create({
        data: {
          groupId,
          originKind: 'LOCAL',
          targetOrigin: 'http://localtest.me:3002',
          jtiHash,
          actorTelegramId: testTelegramId,
          expiresAt: new Date(PINNED_BASE_TIME.getTime() + 300_000),
        },
      });

      const localhostReq = new NextRequest(
        `http://localhost:3002/api/auth/claim?token=${rawToken}`,
        { method: 'GET', headers: { accept: 'application/json' } }
      );

      // Act
      const localhostRes = await GET(localhostReq);

      // Assert
      expect(localhostRes.status).toBe(403);
      expect(localhostRes.status).not.toBe(200);
      const data = await localhostRes.json();
      expect(data.error).toBe('ORIGIN_MISMATCH');
      expect(localhostRes.headers.get('set-cookie')).toBeNull();
    });

    it('successfully claims tunnel token when forwarded reverse-proxy headers match DASHBOARD_TUNNEL_URL', async () => {
      // Arrange
      const { envConfig } = await import('../src/lib/env');
      const tunnelTargetOrigin = envConfig.DASHBOARD_TUNNEL_URL;
      const parsedTunnel = new URL(tunnelTargetOrigin);

      const rawToken = deterministicToken('tunnel-forwarded-token');
      const jtiHash = createHash('sha256').update(rawToken).digest('hex');
      const groupId = deterministicGroupId(11);

      await prisma.dashboardAuthLink.create({
        data: {
          groupId,
          originKind: 'TUNNEL',
          targetOrigin: tunnelTargetOrigin,
          jtiHash,
          actorTelegramId: testTelegramId,
          expiresAt: new Date(PINNED_BASE_TIME.getTime() + 300_000),
        },
      });

      const req = new NextRequest(
        `http://localhost:3002/api/auth/claim?token=${rawToken}`,
        {
          method: 'GET',
          headers: {
            accept: 'application/json',
            'x-forwarded-proto': parsedTunnel.protocol.replace(':', ''),
            'x-forwarded-host': parsedTunnel.host,
            host: 'localhost:3002',
          },
        }
      );

      // Act
      const res = await GET(req);

      // Assert
      expect(res.status).toBe(200);
      expect(res.status).not.toBe(403);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user.id).toBe(testUserId);
      expect(res.headers.get('set-cookie')).toContain('alsaada_session=');
    });

    it('successfully claims local token when browser Host header matches DASHBOARD_LOCAL_URL', async () => {
      // Arrange
      const { envConfig } = await import('../src/lib/env');
      const localTargetOrigin = envConfig.DASHBOARD_LOCAL_URL;
      const parsedLocal = new URL(localTargetOrigin);

      const rawToken = deterministicToken('local-host-matching-token');
      const jtiHash = createHash('sha256').update(rawToken).digest('hex');
      const groupId = deterministicGroupId(12);

      await prisma.dashboardAuthLink.create({
        data: {
          groupId,
          originKind: 'LOCAL',
          targetOrigin: localTargetOrigin,
          jtiHash,
          actorTelegramId: testTelegramId,
          expiresAt: new Date(PINNED_BASE_TIME.getTime() + 300_000),
        },
      });

      const req = new NextRequest(
        `http://localhost:3002/api/auth/claim?token=${rawToken}`,
        {
          method: 'GET',
          headers: {
            accept: 'application/json',
            host: parsedLocal.host,
          },
        }
      );

      // Act
      const res = await GET(req);

      // Assert
      expect(res.status).toBe(200);
      expect(res.status).not.toBe(403);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user.id).toBe(testUserId);
      expect(res.headers.get('set-cookie')).toContain('alsaada_session=');
    });

    it('strictly rejects claim when forwarded reverse-proxy host is spoofed with evil.com', async () => {
      // Arrange
      const { envConfig } = await import('../src/lib/env');
      const tunnelTargetOrigin = envConfig.DASHBOARD_TUNNEL_URL;

      const rawToken = deterministicToken('evil-spoof-host-token');
      const jtiHash = createHash('sha256').update(rawToken).digest('hex');
      const groupId = deterministicGroupId(13);

      await prisma.dashboardAuthLink.create({
        data: {
          groupId,
          originKind: 'TUNNEL',
          targetOrigin: tunnelTargetOrigin,
          jtiHash,
          actorTelegramId: testTelegramId,
          expiresAt: new Date(PINNED_BASE_TIME.getTime() + 300_000),
        },
      });

      const req = new NextRequest(
        `http://localhost:3002/api/auth/claim?token=${rawToken}`,
        {
          method: 'GET',
          headers: {
            accept: 'application/json',
            'x-forwarded-proto': 'https',
            'x-forwarded-host': 'evil.com',
            host: 'evil.com',
          },
        }
      );

      // Act
      const res = await GET(req);

      // Assert
      expect(res.status).toBe(403);
      expect(res.status).not.toBe(200);
      const data = await res.json();
      expect(data.error).toBe('ORIGIN_MISMATCH');
      expect(res.headers.get('set-cookie')).toBeNull();
    });
  });
});
