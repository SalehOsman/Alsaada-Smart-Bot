import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@alsaada/database';
import { GET, POST } from '../src/app/api/auth/claim/route';

describe('Dashboard Auth Claim API Route (/api/auth/claim)', () => {
  const testTelegramId = 9988776655n;
  let testUserId: string;

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

  beforeEach(async () => {
    await prisma.dashboardSession.deleteMany({ where: { actorTelegramId: testTelegramId } });
    await prisma.dashboardAuthLink.deleteMany({ where: { actorTelegramId: testTelegramId } });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.dashboardSession.deleteMany({ where: { actorTelegramId: testTelegramId } });
    await prisma.dashboardAuthLink.deleteMany({ where: { actorTelegramId: testTelegramId } });
    await prisma.user.deleteMany({ where: { telegramId: testTelegramId } });
  });

  it('strictly rejects POST requests with 405 Method Not Allowed', async () => {
    const res = await POST();
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('GET');
    const data = await res.json();
    expect(data.error).toBe('METHOD_NOT_ALLOWED');
  });

  it('rejects claim request when token is missing', async () => {
    const req = new NextRequest('http://localtest.me:3002/api/auth/claim', {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('TOKEN_MISSING');
  });

  it('rejects claim request when token does not exist', async () => {
    const fakeToken = randomBytes(32).toString('hex');
    const req = new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${fakeToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('TOKEN_NOT_FOUND');
  });

  it('successfully claims a valid token, creates 8-hour DB session, and sets 16h cookie', async () => {
    const rawToken = randomBytes(32).toString('hex');
    const jtiHash = createHash('sha256').update(rawToken).digest('hex');
    const groupId = randomUUID();

    await prisma.dashboardAuthLink.create({
      data: {
        groupId,
        originKind: 'LOCAL',
        targetOrigin: 'http://localtest.me:3002',
        jtiHash,
        actorTelegramId: testTelegramId,
        expiresAt: new Date(Date.now() + 300_000), // 5 min
      },
    });

    const req = new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${rawToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);

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
    const rawToken = randomBytes(32).toString('hex');
    const jtiHash = createHash('sha256').update(rawToken).digest('hex');
    const groupId = randomUUID();

    await prisma.dashboardAuthLink.create({
      data: {
        groupId,
        originKind: 'TUNNEL',
        targetOrigin: 'https://alsaada-tunnel.ngrok-free.app',
        jtiHash,
        actorTelegramId: testTelegramId,
        expiresAt: new Date(Date.now() + 300_000),
      },
    });

    // Request comes from localhost instead of the tunnel targetOrigin
    const req = new NextRequest(`http://localhost:3002/api/auth/claim?token=${rawToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const res = await GET(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe('ORIGIN_MISMATCH');
  });

  it('strictly denies second claim attempt with the same token (single-use atomic)', async () => {
    const rawToken = randomBytes(32).toString('hex');
    const jtiHash = createHash('sha256').update(rawToken).digest('hex');
    const groupId = randomUUID();

    await prisma.dashboardAuthLink.create({
      data: {
        groupId,
        originKind: 'LOCAL',
        targetOrigin: 'http://localtest.me:3002',
        jtiHash,
        actorTelegramId: testTelegramId,
        expiresAt: new Date(Date.now() + 300_000),
      },
    });

    // First claim: must succeed
    const req1 = new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${rawToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const res1 = await GET(req1);
    expect(res1.status).toBe(200);

    // Second claim: must fail with 401 Unauthorized (TOKEN_ALREADY_CLAIMED)
    const req2 = new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${rawToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const res2 = await GET(req2);
    expect(res2.status).toBe(401);
    const data2 = await res2.json();
    expect(data2.error).toBe('TOKEN_ALREADY_CLAIMED');
  });

  it('rejects expired token', async () => {
    const rawToken = randomBytes(32).toString('hex');
    const jtiHash = createHash('sha256').update(rawToken).digest('hex');
    const groupId = randomUUID();

    await prisma.dashboardAuthLink.create({
      data: {
        groupId,
        originKind: 'LOCAL',
        targetOrigin: 'http://localtest.me:3002',
        jtiHash,
        actorTelegramId: testTelegramId,
        expiresAt: new Date(Date.now() - 10_000), // Expired 10s ago
      },
    });

    const req = new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${rawToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('TOKEN_EXPIRED');
  });

  it('denies claim if user role is unauthorized for dashboard (e.g. WORKER)', async () => {
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

    const rawToken = randomBytes(32).toString('hex');
    const jtiHash = createHash('sha256').update(rawToken).digest('hex');
    const groupId = randomUUID();

    await prisma.dashboardAuthLink.create({
      data: {
        groupId,
        originKind: 'LOCAL',
        targetOrigin: 'http://localtest.me:3002',
        jtiHash,
        actorTelegramId: workerTelegramId,
        expiresAt: new Date(Date.now() + 300_000),
      },
    });

    const req = new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${rawToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const res = await GET(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe('ROLE_UNAUTHORIZED');

    // Cleanup worker
    await prisma.user.delete({ where: { id: workerUser.id } });
    await prisma.dashboardAuthLink.deleteMany({ where: { actorTelegramId: workerTelegramId } });
  });

  it('performs direct browser redirect (302) to /admin on targetOrigin and sets cookie', async () => {
    const rawToken = randomBytes(32).toString('hex');
    const jtiHash = createHash('sha256').update(rawToken).digest('hex');
    const groupId = randomUUID();

    await prisma.dashboardAuthLink.create({
      data: {
        groupId,
        originKind: 'LOCAL',
        targetOrigin: 'http://localtest.me:3002',
        jtiHash,
        actorTelegramId: testTelegramId,
        expiresAt: new Date(Date.now() + 300_000),
      },
    });

    const req = new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${rawToken}`, {
      method: 'GET',
    });
    const res = await GET(req);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('http://localtest.me:3002/admin');
    expect(res.cookies.get('alsaada_session')?.value).toBeDefined();
    expect(res.cookies.get('alsaada_session')?.maxAge).toBe(16 * 3600);
  });

  it('atomically invalidates sibling link sharing the same groupId upon claiming', async () => {
    // Clear sessions before testing sibling claim
    await prisma.dashboardSession.deleteMany({ where: { actorTelegramId: testTelegramId } });

    const groupId = randomUUID();
    const localToken = randomBytes(32).toString('hex');
    const localJtiHash = createHash('sha256').update(localToken).digest('hex');

    const tunnelToken = randomBytes(32).toString('hex');
    const tunnelJtiHash = createHash('sha256').update(tunnelToken).digest('hex');

    await prisma.dashboardAuthLink.createMany({
      data: [
        {
          jtiHash: localJtiHash,
          groupId,
          originKind: 'LOCAL',
          targetOrigin: 'http://localtest.me:3002',
          actorTelegramId: testTelegramId,
          expiresAt: new Date(Date.now() + 300_000),
        },
        {
          jtiHash: tunnelJtiHash,
          groupId,
          originKind: 'TUNNEL',
          targetOrigin: 'http://localtest.me:3002',
          actorTelegramId: testTelegramId,
          expiresAt: new Date(Date.now() + 300_000),
        },
      ],
    });

    // Claim local link: must succeed
    const localReq = new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${localToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const localRes = await GET(localReq);
    expect(localRes.status).toBe(200);

    // Attempt to claim sibling tunnel link: must fail with 401 TOKEN_ALREADY_CLAIMED
    const tunnelReq = new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${tunnelToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const tunnelRes = await GET(tunnelReq);
    expect(tunnelRes.status).toBe(401);
    const tunnelData = await tunnelRes.json();
    expect(tunnelData.error).toBe('TOKEN_ALREADY_CLAIMED');

    // Sibling record in DB must be marked claimed with claim trace
    const dbSibling = await prisma.dashboardAuthLink.findUnique({
      where: { jtiHash: tunnelJtiHash },
    });
    expect(dbSibling?.claimedAt).not.toBeNull();
    expect(dbSibling?.claimTraceId).toBeDefined();
    expect(dbSibling?.claimTraceId?.length).toBeGreaterThan(0);
  });

  it('strictly rejects claim and returns 429 when user already has 3 active concurrent sessions', async () => {
    // Ensure user already has exactly 3 active sessions
    await prisma.dashboardSession.deleteMany({ where: { actorTelegramId: testTelegramId } });
    for (let i = 0; i < 3; i++) {
      const { tokenHash } = await (await import('../src/lib/session')).generateOpaqueSessionToken();
      await prisma.dashboardSession.create({
        data: {
          sessionHash: tokenHash,
          userId: testUserId,
          actorTelegramId: testTelegramId,
          originKind: 'LOCAL',
          expiresAt: new Date(Date.now() + 8 * 3600 * 1000),
          maxExpiresAt: new Date(Date.now() + 16 * 3600 * 1000),
          extensionCount: 0,
        },
      });
    }

    const fourthToken = randomBytes(32).toString('hex');
    const fourthJtiHash = createHash('sha256').update(fourthToken).digest('hex');
    const groupId = randomUUID();

    await prisma.dashboardAuthLink.create({
      data: {
        groupId,
        originKind: 'LOCAL',
        targetOrigin: 'http://localtest.me:3002',
        jtiHash: fourthJtiHash,
        actorTelegramId: testTelegramId,
        expiresAt: new Date(Date.now() + 300_000),
      },
    });

    const fourthReq = new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${fourthToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const fourthRes = await GET(fourthReq);
    expect(fourthRes.status).toBe(429);
    const fourthData = await fourthRes.json();
    expect(fourthData.error).toBe('MAX_SESSIONS_EXCEEDED');
  });

  describe('R1C-03: Reflected XSS Elimination, Security Headers & HTTP Status Matrix', () => {
    it('strictly prevents Reflected XSS and does not reflect <script>alert(1)</script> raw in HTML (400 on malformed token)', async () => {
      const maliciousPayload = '<script>alert(1)</script>';
      const req = new NextRequest(
        `http://localtest.me:3002/api/auth/claim?token=malformed-token&traceId=${encodeURIComponent(maliciousPayload)}`,
        { method: 'GET' }
      );
      const res = await GET(req);

      // Status must reflect failure: 400 Bad Request for malformed token
      expect(res.status).toBe(400);

      // Security headers must be present
      expect(res.headers.get('content-security-policy')).toBe(
        "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none';"
      );
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('DENY');

      const body = await res.text();
      expect(body).not.toContain('<script>alert(1)</script>');
    });

    it('strictly prevents Reflected XSS with img onerror payload (401 on valid-format nonexistent token)', async () => {
      const imgPayload = '"><img src=x onerror=alert(1)>';
      const fakeValidToken = randomBytes(32).toString('hex');
      const req = new NextRequest(
        `http://localtest.me:3002/api/auth/claim?token=${fakeValidToken}&traceId=${encodeURIComponent(imgPayload)}`,
        { method: 'GET' }
      );
      const res = await GET(req);

      // Status must reflect 401 Unauthorized for nonexistent token
      expect(res.status).toBe(401);
      const body = await res.text();
      expect(body).not.toContain('"><img src=x onerror=alert(1)>');
    });

    it('returns appropriate HTTP status codes in HTML failure mode (401, 403)', async () => {
      // 1. Origin mismatch returns 403 in HTML mode
      const rawToken = randomBytes(32).toString('hex');
      const jtiHash = createHash('sha256').update(rawToken).digest('hex');
      const groupId = randomUUID();

      await prisma.dashboardAuthLink.create({
        data: {
          groupId,
          originKind: 'TUNNEL',
          targetOrigin: 'https://tunnel.alsaada.com',
          jtiHash,
          actorTelegramId: testTelegramId,
          expiresAt: new Date(Date.now() + 300_000),
        },
      });

      const mismatchReq = new NextRequest(
        `http://localtest.me:3002/api/auth/claim?token=${rawToken}`,
        { method: 'GET' }
      );
      const mismatchRes = await GET(mismatchReq);
      expect(mismatchRes.status).toBe(403);
      expect(mismatchRes.headers.get('content-security-policy')).toBeDefined();
    });

    it('verifies standard localtest.me local origin against localhost mismatch', async () => {
      const rawToken = randomBytes(32).toString('hex');
      const jtiHash = createHash('sha256').update(rawToken).digest('hex');
      const groupId = randomUUID();

      // Stored with standard local origin http://localtest.me:3002
      await prisma.dashboardAuthLink.create({
        data: {
          groupId,
          originKind: 'LOCAL',
          targetOrigin: 'http://localtest.me:3002',
          jtiHash,
          actorTelegramId: testTelegramId,
          expiresAt: new Date(Date.now() + 300_000),
        },
      });

      // Request from localhost:3002 must be rejected with 403 ORIGIN_MISMATCH
      const localhostReq = new NextRequest(
        `http://localhost:3002/api/auth/claim?token=${rawToken}`,
        { method: 'GET', headers: { accept: 'application/json' } }
      );
      const localhostRes = await GET(localhostReq);
      expect(localhostRes.status).toBe(403);
      const data = await localhostRes.json();
      expect(data.error).toBe('ORIGIN_MISMATCH');
    });

    it('successfully claims tunnel token when forwarded reverse-proxy headers match DASHBOARD_TUNNEL_URL', async () => {
      const { envConfig } = await import('../src/lib/env');
      const tunnelTargetOrigin = envConfig.DASHBOARD_TUNNEL_URL;
      const parsedTunnel = new URL(tunnelTargetOrigin);

      const rawToken = randomBytes(32).toString('hex');
      const jtiHash = createHash('sha256').update(rawToken).digest('hex');
      const groupId = randomUUID();

      await prisma.dashboardAuthLink.create({
        data: {
          groupId,
          originKind: 'TUNNEL',
          targetOrigin: tunnelTargetOrigin,
          jtiHash,
          actorTelegramId: testTelegramId,
          expiresAt: new Date(Date.now() + 300_000),
        },
      });

      // Simulates Next.js Node server receiving request via ngrok / reverse proxy
      // nextUrl.origin is internal localhost:3002, but forwarded headers match tunnelTargetOrigin
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

      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user.id).toBe(testUserId);
    });

    it('successfully claims local token when browser Host header matches DASHBOARD_LOCAL_URL', async () => {
      const { envConfig } = await import('../src/lib/env');
      const localTargetOrigin = envConfig.DASHBOARD_LOCAL_URL;
      const parsedLocal = new URL(localTargetOrigin);

      const rawToken = randomBytes(32).toString('hex');
      const jtiHash = createHash('sha256').update(rawToken).digest('hex');
      const groupId = randomUUID();

      await prisma.dashboardAuthLink.create({
        data: {
          groupId,
          originKind: 'LOCAL',
          targetOrigin: localTargetOrigin,
          jtiHash,
          actorTelegramId: testTelegramId,
          expiresAt: new Date(Date.now() + 300_000),
        },
      });

      // Simulates Next.js Node server receiving request where nextUrl.origin is localhost:3002
      // but browser Host header is localtest.me:3002
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

      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user.id).toBe(testUserId);
    });

    it('strictly rejects claim when forwarded reverse-proxy host is spoofed (evil.com)', async () => {
      const { envConfig } = await import('../src/lib/env');
      const tunnelTargetOrigin = envConfig.DASHBOARD_TUNNEL_URL;

      const rawToken = randomBytes(32).toString('hex');
      const jtiHash = createHash('sha256').update(rawToken).digest('hex');
      const groupId = randomUUID();

      await prisma.dashboardAuthLink.create({
        data: {
          groupId,
          originKind: 'TUNNEL',
          targetOrigin: tunnelTargetOrigin,
          jtiHash,
          actorTelegramId: testTelegramId,
          expiresAt: new Date(Date.now() + 300_000),
        },
      });

      // Attacker attempts Host header spoofing to bypass origin check
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

      const res = await GET(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('ORIGIN_MISMATCH');
    });
  });
});

