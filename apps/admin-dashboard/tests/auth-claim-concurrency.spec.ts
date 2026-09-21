import { createHash } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@alsaada/database';
import { PINNED_BASE_TIME } from '@alsaada/shared/testing';
import { GET } from '../src/app/api/auth/claim/route';

describe('Auth Claim Concurrency & Anti-Race Safety Gate', () => {
  const testTelegramId = 5544332211n;

  beforeAll(async () => {
    await prisma.user.upsert({
      where: { telegramId: testTelegramId },
      update: { role: 'GENERAL_ADMIN', isActive: true, isBanned: false },
      create: {
        telegramId: testTelegramId,
        fullName: 'Test General Admin Concurrent',
        role: 'GENERAL_ADMIN',
        isActive: true,
        isBanned: false,
      },
    });
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

  it('ensures exactly one request succeeds and all other parallel requests fail with TOKEN_ALREADY_CLAIMED under high concurrency race condition', async () => {
    // Arrange
    const rawToken = createHash('sha256').update('concurrency-test-token-seed-01').digest('hex');
    const jtiHash = createHash('sha256').update(rawToken).digest('hex');
    const groupId = 'cc000000-0000-0000-0000-000000000001';

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

    const concurrency = 10;
    const requests = Array.from({ length: concurrency }).map(() => {
      return new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${rawToken}`, {
        method: 'GET',
        headers: { accept: 'application/json' },
      });
    });

    // Act
    const responses = await Promise.all(requests.map((req) => GET(req)));
    const statuses = responses.map((r) => r.status);
    const successCount = statuses.filter((s) => s === 200).length;
    const conflictCount = statuses.filter((s) => s === 401).length;

    // Assert: HTTP Status Distribution
    expect(successCount).toBe(1);
    expect(successCount).not.toBeGreaterThan(1);
    expect(conflictCount).toBe(concurrency - 1);
    expect(conflictCount).not.toBe(0);

    // Assert: Successful response content and cookies
    const successRes = responses.find((r) => r.status === 200);
    expect(successRes).toBeDefined();
    const successBody = await successRes!.json();
    expect(successBody.success).toBe(true);
    expect(successBody.user).toBeDefined();
    expect(successBody.user.role).toBe('GENERAL_ADMIN');
    expect(successRes!.headers.get('set-cookie')).toContain('alsaada_session=');

    // Assert: Failed responses content and lack of session cookies
    const failedResponses = responses.filter((r) => r.status === 401);
    expect(failedResponses).toHaveLength(concurrency - 1);
    for (const failedRes of failedResponses) {
      const failedBody = await failedRes.json();
      expect(failedBody.success).toBe(false);
      expect(failedBody.error).toBe('TOKEN_ALREADY_CLAIMED');
      const setCookie = failedRes.headers.get('set-cookie');
      if (setCookie) {
        expect(setCookie).not.toContain('alsaada_session=');
      }
    }

    // Assert: Database state consistency
    const sessions = await prisma.dashboardSession.findMany({
      where: { actorTelegramId: testTelegramId },
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.actorTelegramId).toBe(testTelegramId);
    expect(sessions[0]?.revokedAt).toBeNull();
    expect(sessions[0]?.sessionHash).toBeDefined();
    expect(sessions[0]?.userId).toBeDefined();
    expect(sessions[0]?.expiresAt).toBeInstanceOf(Date);

    const updatedLink = await prisma.dashboardAuthLink.findUnique({
      where: { jtiHash },
    });
    expect(updatedLink).toBeDefined();
    expect(updatedLink?.claimedAt).not.toBeNull();
    expect(updatedLink?.claimedAt).toBeInstanceOf(Date);
  });

  it('strictly rejects subsequent sequential claim attempts once token has been consumed', async () => {
    // Arrange
    const rawToken = createHash('sha256').update('concurrency-test-token-seed-02').digest('hex');
    const jtiHash = createHash('sha256').update(rawToken).digest('hex');
    const groupId = 'cc000000-0000-0000-0000-000000000002';

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

    const firstReq = new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${rawToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });

    // Act 1: First claim succeeds
    const firstRes = await GET(firstReq);
    expect(firstRes.status).toBe(200);

    // Act 2: Replay attempt with the exact same token
    const replayReq = new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${rawToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const replayRes = await GET(replayReq);
    const replayBody = await replayRes.json();

    // Assert
    expect(replayRes.status).toBe(401);
    expect(replayRes.status).not.toBe(200);
    expect(replayBody.success).toBe(false);
    expect(replayBody.error).toBe('TOKEN_ALREADY_CLAIMED');
    expect(replayRes.headers.get('set-cookie')).toBeNull();

    const sessions = await prisma.dashboardSession.findMany({
      where: { actorTelegramId: testTelegramId },
    });
    expect(sessions).toHaveLength(1);
  });

  it('rejects all concurrent claim requests when token is expired and creates zero sessions', async () => {
    // Arrange
    const expiredRawToken = createHash('sha256').update('concurrency-test-token-seed-expired').digest('hex');
    const jtiHash = createHash('sha256').update(expiredRawToken).digest('hex');
    const groupId = 'cc000000-0000-0000-0000-000000000003';

    await prisma.dashboardAuthLink.create({
      data: {
        groupId,
        originKind: 'LOCAL',
        targetOrigin: 'http://localtest.me:3002',
        jtiHash,
        actorTelegramId: testTelegramId,
        expiresAt: new Date(PINNED_BASE_TIME.getTime() - 10_000), // Expired in past
      },
    });

    const concurrency = 5;
    const requests = Array.from({ length: concurrency }).map(() => {
      return new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${expiredRawToken}`, {
        method: 'GET',
        headers: { accept: 'application/json' },
      });
    });

    // Act
    const responses = await Promise.all(requests.map((req) => GET(req)));
    const statuses = responses.map((r) => r.status);
    const expiredCount = statuses.filter((s) => s === 401).length;

    // Assert
    expect(expiredCount).toBe(concurrency);
    expect(statuses).not.toContain(200);

    for (const res of responses) {
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('TOKEN_EXPIRED');
    }

    const sessions = await prisma.dashboardSession.findMany({
      where: { actorTelegramId: testTelegramId },
    });
    expect(sessions).toHaveLength(0);
    expect(sessions).not.toHaveLength(1);

    const link = await prisma.dashboardAuthLink.findUnique({
      where: { jtiHash },
    });
    expect(link).toBeDefined();
    expect(link?.claimedAt).toBeNull();
    expect(link?.claimTraceId).toBeNull();
  });

  it('rejects unrecorded token with TOKEN_NOT_FOUND error and creates zero sessions', async () => {
    // Arrange
    const unrecordedToken = 'f'.repeat(64);
    const req = new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${unrecordedToken}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });

    // Act
    const res = await GET(req);
    const body = await res.json();

    // Assert
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(200);
    expect(body.success).toBe(false);
    expect(body.error).toBe('TOKEN_NOT_FOUND');
    expect(res.headers.get('set-cookie')).toBeNull();

    const sessions = await prisma.dashboardSession.findMany({
      where: { actorTelegramId: testTelegramId },
    });
    expect(sessions).toHaveLength(0);
  });
});
