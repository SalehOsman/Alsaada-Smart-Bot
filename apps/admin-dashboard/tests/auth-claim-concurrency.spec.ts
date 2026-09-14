import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@alsaada/database';
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

  afterAll(async () => {
    await prisma.dashboardSession.deleteMany({ where: { actorTelegramId: testTelegramId } });
    await prisma.dashboardAuthLink.deleteMany({ where: { actorTelegramId: testTelegramId } });
    await prisma.user.deleteMany({ where: { telegramId: testTelegramId } });
  });

  it('ensures exactly one request succeeds and all others fail under high concurrency race condition', async () => {
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

    // Launch 10 simultaneous claim requests with the identical token
    const concurrency = 10;
    const promises = Array.from({ length: concurrency }).map(() => {
      const req = new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${rawToken}`, {
        method: 'GET',
        headers: { accept: 'application/json' },
      });
      return GET(req);
    });

    const responses = await Promise.all(promises);
    const statuses = responses.map((r) => r.status);

    // Exactly 1 must be 200 OK
    const successCount = statuses.filter((s) => s === 200).length;
    // Exactly (concurrency - 1) must fail with 401 (TOKEN_ALREADY_CLAIMED)
    const conflictCount = statuses.filter((s) => s === 401).length;

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(concurrency - 1);

    // Verify exactly ONE session exists in DB for this claim
    const sessions = await prisma.dashboardSession.findMany({
      where: { actorTelegramId: testTelegramId },
    });
    expect(sessions.length).toBe(1);
  });
});
