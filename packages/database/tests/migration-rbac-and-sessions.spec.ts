import { createHash, randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma, disconnectDatabase } from '../src/client.js';

const canConnect = async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    return true;
  } catch {
    return false;
  }
};

describe('Database RBAC, Sessions & Delegation Schema Contract', () => {
  afterAll(async () => {
    await disconnectDatabase();
  });

  it('verifies the existence of new migration tables in postgres', async () => {
    const isConnected = await canConnect();
    if (!isConnected) {
      console.warn('Postgres not connected, skipping live DB query test');
      return;
    }

    type TableRow = { table_name: string };
    const tables = await prisma.$queryRawUnsafe<TableRow[]>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('dashboard_auth_links', 'dashboard_sessions', 'worker_delegations')"
    );

    const tableNames = new Set(tables.map((t) => t.table_name));
    expect(tableNames.has('dashboard_auth_links')).toBe(true);
    expect(tableNames.has('dashboard_sessions')).toBe(true);
    expect(tableNames.has('worker_delegations')).toBe(true);
  });

  it('creates a dashboard auth link and enforces unique jtiHash constraint', async () => {
    const isConnected = await canConnect();
    if (!isConnected) return;

    const jti = randomUUID();
    const jtiHash = createHash('sha256').update(jti).digest('hex');
    const testTelegramId = 888777666n;

    // Clean up if existing
    await prisma.dashboardAuthLink.deleteMany({ where: { jtiHash } });

    const groupId = randomUUID();
    const link = await prisma.dashboardAuthLink.create({
      data: {
        groupId,
        originKind: 'LOCAL',
        targetOrigin: 'http://localhost:3002',
        jtiHash,
        actorTelegramId: testTelegramId,
        expiresAt: new Date(Date.now() + 300_000),
      },
    });

    expect(link.id).toBeDefined();
    expect(link.groupId).toBe(groupId);
    expect(link.originKind).toBe('LOCAL');
    expect(link.targetOrigin).toBe('http://localhost:3002');
    expect(link.jtiHash).toBe(jtiHash);
    expect(link.claimedAt).toBeNull();

    // Duplicate creation with same jtiHash must fail
    await expect(
      prisma.dashboardAuthLink.create({
        data: {
          groupId: randomUUID(),
          originKind: 'LOCAL',
          targetOrigin: 'http://localhost:3002',
          jtiHash,
          actorTelegramId: testTelegramId,
          expiresAt: new Date(Date.now() + 300_000),
        },
      })
    ).rejects.toThrow();

    // Duplicate creation with same groupId and originKind must fail (unique [groupId, originKind])
    const secondJti = createHash('sha256').update(randomUUID()).digest('hex');
    await expect(
      prisma.dashboardAuthLink.create({
        data: {
          groupId,
          originKind: 'LOCAL', // Duplicate originKind in same group!
          targetOrigin: 'http://localhost:3002',
          jtiHash: secondJti,
          actorTelegramId: testTelegramId,
          expiresAt: new Date(Date.now() + 300_000),
        },
      })
    ).rejects.toThrow();

    // Cleanup
    await prisma.dashboardAuthLink.delete({ where: { id: link.id } });
  });

  it('persists a durable 8-hour dashboard session and allows atomic revocation', async () => {
    const isConnected = await canConnect();
    if (!isConnected) return;

    const sessionRaw = randomUUID();
    const sessionHash = createHash('sha256').update(sessionRaw).digest('hex');
    const testTelegramId = 999111222n;

    // Ensure a test user exists
    let testUser = await prisma.user.findFirst({ where: { telegramId: testTelegramId } });
    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          telegramId: testTelegramId,
          fullName: 'Test Dashboard Session User',
          role: 'SUPER_ADMIN',
          isActive: true,
        },
      });
    }

    const session = await prisma.dashboardSession.create({
      data: {
        sessionHash,
        userId: testUser.id,
        actorTelegramId: testTelegramId,
        originKind: 'TUNNEL',
        deviceSummary: 'Mozilla/5.0 Windows NT 10.0',
        expiresAt: new Date(Date.now() + 8 * 3600 * 1000),
        maxExpiresAt: new Date(Date.now() + 16 * 3600 * 1000),
        extensionCount: 0,
      },
    });

    expect(session.id).toBeDefined();
    expect(session.revokedAt).toBeNull();
    expect(session.maxExpiresAt).toBeDefined();

    const revoked = await prisma.dashboardSession.update({
      where: { sessionHash },
      data: {
        revokedAt: new Date(),
        revocationReason: 'USER_LOGOUT',
      },
    });

    expect(revoked.revokedAt).not.toBeNull();
    expect(revoked.revocationReason).toBe('USER_LOGOUT');

    // Cleanup
    await prisma.dashboardSession.delete({ where: { id: session.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
  });
});
