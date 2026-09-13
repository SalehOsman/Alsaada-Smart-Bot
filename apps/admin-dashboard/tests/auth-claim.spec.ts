import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@alsaada/database';
import { GET, POST } from '../src/app/api/auth/claim/route';
import { verifySessionToken } from '../src/lib/session';

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

  afterAll(async () => {
    // Cleanup
    await prisma.dashboardSession.deleteMany({ where: { actorTelegramId: testTelegramId } });
    await prisma.dashboardAuthLink.deleteMany({ where: { actorTelegramId: testTelegramId } });
    await prisma.user.deleteMany({ where: { telegramId: testTelegramId } });
  });

  it('rejects claim request when token is missing', async () => {
    const req = new NextRequest('http://localhost:3002/api/auth/claim', {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('TOKEN_REQUIRED');
  });

  it('rejects claim request when token does not exist', async () => {
    const fakeToken = randomBytes(32).toString('hex');
    const req = new NextRequest(`http://localhost:3002/api/auth/claim?token=${fakeToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('INVALID_OR_EXPIRED_TOKEN');
  });

  it('successfully claims a valid token, creates 8-hour DB session, and sets cookie', async () => {
    const rawToken = randomBytes(32).toString('hex');
    const jtiHash = createHash('sha256').update(rawToken).digest('hex');

    await prisma.dashboardAuthLink.create({
      data: {
        jtiHash,
        actorTelegramId: testTelegramId,
        targetOrigin: 'LOCAL',
        expiresAt: new Date(Date.now() + 300_000), // 5 min
      },
    });

    const req = new NextRequest(`http://localhost:3002/api/auth/claim?token=${rawToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user.id).toBe(testUserId);
    expect(data.user.role).toBe('SUPER_ADMIN');

    // Verify cookie was set
    const setCookie = res.cookies.get('alsaada_session');
    expect(setCookie).toBeDefined();
    expect(setCookie?.value).toBeDefined();

    // Verify link is marked claimed in DB
    const updatedLink = await prisma.dashboardAuthLink.findUnique({
      where: { jtiHash },
    });
    expect(updatedLink?.claimedAt).not.toBeNull();

    // Verify session was created in DB
    const sessionTokenPayload = await verifySessionToken(setCookie!.value);
    expect(sessionTokenPayload).not.toBeNull();
    expect(sessionTokenPayload?.sessionId).toBeDefined();

    const sessionHash = createHash('sha256').update(sessionTokenPayload!.sessionId!).digest('hex');
    const dbSession = await prisma.dashboardSession.findUnique({
      where: { sessionHash },
    });
    expect(dbSession).toBeDefined();
    expect(dbSession?.userId).toBe(testUserId);
    expect(dbSession?.revokedAt).toBeNull();
  });

  it('strictly denies second claim attempt with the same token (single-use atomic)', async () => {
    const rawToken = randomBytes(32).toString('hex');
    const jtiHash = createHash('sha256').update(rawToken).digest('hex');

    await prisma.dashboardAuthLink.create({
      data: {
        jtiHash,
        actorTelegramId: testTelegramId,
        targetOrigin: 'LOCAL',
        expiresAt: new Date(Date.now() + 300_000),
      },
    });

    // First claim: must succeed
    const req1 = new NextRequest(`http://localhost:3002/api/auth/claim?token=${rawToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const res1 = await GET(req1);
    expect(res1.status).toBe(200);

    // Second claim: must fail with 409 Conflict
    const req2 = new NextRequest(`http://localhost:3002/api/auth/claim?token=${rawToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const res2 = await GET(req2);
    expect(res2.status).toBe(409);
    const data2 = await res2.json();
    expect(data2.error).toBe('TOKEN_ALREADY_CLAIMED');
  });

  it('rejects expired token', async () => {
    const rawToken = randomBytes(32).toString('hex');
    const jtiHash = createHash('sha256').update(rawToken).digest('hex');

    await prisma.dashboardAuthLink.create({
      data: {
        jtiHash,
        actorTelegramId: testTelegramId,
        targetOrigin: 'LOCAL',
        expiresAt: new Date(Date.now() - 10_000), // Expired 10s ago
      },
    });

    const req = new NextRequest(`http://localhost:3002/api/auth/claim?token=${rawToken}`, {
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

    await prisma.dashboardAuthLink.create({
      data: {
        jtiHash,
        actorTelegramId: workerTelegramId,
        targetOrigin: 'LOCAL',
        expiresAt: new Date(Date.now() + 300_000),
      },
    });

    const req = new NextRequest(`http://localhost:3002/api/auth/claim?token=${rawToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const res = await GET(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe('FORBIDDEN_ROLE_OR_STATUS');

    // Cleanup worker
    await prisma.user.delete({ where: { id: workerUser.id } });
    await prisma.dashboardAuthLink.deleteMany({ where: { actorTelegramId: workerTelegramId } });
  });

  it('performs direct browser redirect (302) to /admin on trusted local origin and sets cookie', async () => {
    const rawToken = randomBytes(32).toString('hex');
    const jtiHash = createHash('sha256').update(rawToken).digest('hex');

    await prisma.dashboardAuthLink.create({
      data: {
        jtiHash,
        actorTelegramId: testTelegramId,
        targetOrigin: 'LOCAL',
        expiresAt: new Date(Date.now() + 300_000),
      },
    });

    const req = new NextRequest(`http://localhost:3002/api/auth/claim?token=${rawToken}`, {
      method: 'GET',
    });
    const res = await GET(req);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('http://localhost:3002/admin');
    expect(res.cookies.get('alsaada_session')?.value).toBeDefined();
  });

  it('performs direct browser redirect (302) to /admin on trusted tunnel origin and prevents host header injection', async () => {
    const rawToken = randomBytes(32).toString('hex');
    const jtiHash = createHash('sha256').update(rawToken).digest('hex');

    // Clean up sessions before tunnel test to stay below 3-session limit
    await prisma.dashboardSession.deleteMany({ where: { actorTelegramId: testTelegramId } });

    await prisma.dashboardAuthLink.create({
      data: {
        jtiHash,
        actorTelegramId: testTelegramId,
        targetOrigin: 'TUNNEL',
        expiresAt: new Date(Date.now() + 300_000),
      },
    });

    // Adversarial: simulate attacker injecting Host: evil.attacker.com
    const req = new NextRequest(`https://evil.attacker.com/api/auth/claim?token=${rawToken}`, {
      method: 'GET',
      headers: { host: 'evil.attacker.com' },
    });
    const res = await GET(req);
    expect(res.status).toBe(302);
    const location = res.headers.get('location');
    // Location must redirect to trusted tunnel origin, NEVER to evil.attacker.com
    expect(location).toContain('/admin');
    expect(location).not.toContain('evil.attacker.com');
  });

  it('atomically invalidates sibling link sharing the same groupId upon claiming', async () => {
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
          actorTelegramId: testTelegramId,
          targetOrigin: 'LOCAL',
          expiresAt: new Date(Date.now() + 300_000),
        },
        {
          jtiHash: tunnelJtiHash,
          groupId,
          actorTelegramId: testTelegramId,
          targetOrigin: 'TUNNEL',
          expiresAt: new Date(Date.now() + 300_000),
        },
      ],
    });

    // Claim local link: must succeed
    const localReq = new NextRequest(`http://localhost:3002/api/auth/claim?token=${localToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const localRes = await GET(localReq);
    expect(localRes.status).toBe(200);

    // Attempt to claim sibling tunnel link: must fail with 409 TOKEN_ALREADY_CLAIMED
    const tunnelReq = new NextRequest(`http://localhost:3002/api/auth/claim?token=${tunnelToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const tunnelRes = await GET(tunnelReq);
    expect(tunnelRes.status).toBe(409);
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
      const { tokenHash } = (await import('../src/lib/session')).generateOpaqueSessionToken();
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

    await prisma.dashboardAuthLink.create({
      data: {
        jtiHash: fourthJtiHash,
        actorTelegramId: testTelegramId,
        targetOrigin: 'LOCAL',
        expiresAt: new Date(Date.now() + 300_000),
      },
    });

    const fourthReq = new NextRequest(`http://localhost:3002/api/auth/claim?token=${fourthToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const fourthRes = await GET(fourthReq);
    expect(fourthRes.status).toBe(429);
    const fourthData = await fourthRes.json();
    expect(fourthData.error).toBe('MAX_CONCURRENT_SESSIONS_REACHED');
  });

  it('strictly enforces 8-hour session TTL (rejects sessions older than 8 hours)', async () => {
    const valid8hToken = await (await import('../src/lib/session')).createSessionToken({
      userId: testUserId,
      telegramId: testTelegramId.toString(),
      role: 'SUPER_ADMIN',
      name: 'Super Admin',
      createdAt: Date.now() - 7 * 3600 * 1000, // 7 hours ago (still valid < 8h)
    });
    const validResult = await verifySessionToken(valid8hToken);
    expect(validResult).not.toBeNull();

    const expired8hToken = await (await import('../src/lib/session')).createSessionToken({
      userId: testUserId,
      telegramId: testTelegramId.toString(),
      role: 'SUPER_ADMIN',
      name: 'Super Admin',
      createdAt: Date.now() - (8 * 3600 * 1000 + 1000), // 8 hours + 1s ago (expired)
    });
    const expiredResult = await verifySessionToken(expired8hToken);
    expect(expiredResult).toBeNull();
  });
});
