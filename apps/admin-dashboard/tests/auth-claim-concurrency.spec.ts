import { createHash, randomBytes } from 'node:crypto';
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

    await prisma.dashboardAuthLink.create({
      data: {
        jtiHash,
        actorTelegramId: testTelegramId,
        targetOrigin: 'TUNNEL',
        expiresAt: new Date(Date.now() + 300_000),
      },
    });

    // Launch 10 simultaneous claim requests with the identical token
    const concurrency = 10;
    const promises = Array.from({ length: concurrency }).map(() => {
      const req = new NextRequest(`http://localhost:3002/api/auth/claim?token=${rawToken}`, {
        method: 'GET',
        headers: { accept: 'application/json' },
      });
      return GET(req);
    });

    const responses = await Promise.all(promises);
    const statuses = responses.map((r) => r.status);

    // Exactly 1 must be 200 OK
    const successCount = statuses.filter((s) => s === 200).length;
    // Exactly (concurrency - 1) must fail with 409 Conflict or 401
    const conflictCount = statuses.filter((s) => s === 409 || s === 401).length;

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(concurrency - 1);

    // Verify exactly ONE session exists in DB for this claim
    const sessions = await prisma.dashboardSession.findMany({
      where: { actorTelegramId: testTelegramId },
    });
    expect(sessions.length).toBe(1);
  });
});
