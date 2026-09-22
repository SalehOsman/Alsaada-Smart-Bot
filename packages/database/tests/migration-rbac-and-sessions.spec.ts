import { createHash } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma, disconnectDatabase } from '../src/client.js';

const PINNED_BASE_TIME = new Date('2026-09-11T12:00:00.000Z');

let uuidCounter = 0;
function deterministicUuid(): string {
  uuidCounter++;
  return `00000000-0000-4000-8000-${String(uuidCounter).padStart(12, '0')}`;
}

const canConnect = async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    return true;
  } catch {
    return false;
  }
};

describe('Database RBAC, Sessions & Delegation Schema Contract', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('verifies the existence of new migration tables in postgres', async () => {
    // Arrange
    const isConnected = await canConnect();
    if (!isConnected) {
      return;
    }

    // Act
    type TableRow = { table_name: string };
    const tables = await prisma.$queryRawUnsafe<TableRow[]>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('dashboard_auth_links', 'dashboard_sessions', 'worker_delegations')"
    );
    const tableNames = new Set(tables.map((t) => t.table_name));

    // Assert
    expect(tableNames.has('dashboard_auth_links')).toBe(true);
    expect(tableNames.has('dashboard_sessions')).toBe(true);
    expect(tableNames.has('worker_delegations')).toBe(true);
  });

  it('creates a dashboard auth link and enforces unique jtiHash constraint', async () => {
    // Arrange
    const isConnected = await canConnect();
    if (!isConnected) return;

    const jti = deterministicUuid();
    const jtiHash = createHash('sha256').update(jti).digest('hex');
    const testTelegramId = 888777666n;

    // Clean up if existing
    await prisma.dashboardAuthLink.deleteMany({ where: { jtiHash } });

    const groupId = deterministicUuid();
    const link = await prisma.dashboardAuthLink.create({
      data: {
        groupId,
        originKind: 'LOCAL',
        targetOrigin: 'http://localhost:3002',
        jtiHash,
        actorTelegramId: testTelegramId,
        expiresAt: new Date(PINNED_BASE_TIME.getTime() + 300_000),
      },
    });

    // Act
    const duplicateJtiPromise = prisma.dashboardAuthLink.create({
      data: {
        groupId: deterministicUuid(),
        originKind: 'LOCAL',
        targetOrigin: 'http://localhost:3002',
        jtiHash,
        actorTelegramId: testTelegramId,
        expiresAt: new Date(PINNED_BASE_TIME.getTime() + 300_000),
      },
    });

    const secondJti = createHash('sha256').update(deterministicUuid()).digest('hex');
    const duplicateGroupOriginPromise = prisma.dashboardAuthLink.create({
      data: {
        groupId,
        originKind: 'LOCAL',
        targetOrigin: 'http://localhost:3002',
        jtiHash: secondJti,
        actorTelegramId: testTelegramId,
        expiresAt: new Date(PINNED_BASE_TIME.getTime() + 300_000),
      },
    });

    // Assert
    expect(link.id).toBeDefined();
    expect(link.groupId).toBe(groupId);
    expect(link.originKind).toBe('LOCAL');
    expect(link.targetOrigin).toBe('http://localhost:3002');
    expect(link.jtiHash).toBe(jtiHash);
    expect(link.claimedAt).toBeNull();
    await expect(duplicateJtiPromise).rejects.toThrow();
    await expect(duplicateGroupOriginPromise).rejects.toThrow();

    // Cleanup
    await prisma.dashboardAuthLink.delete({ where: { id: link.id } });
  });

  it('persists a durable 8-hour dashboard session and allows atomic revocation', async () => {
    // Arrange
    const isConnected = await canConnect();
    if (!isConnected) return;

    const sessionRaw = deterministicUuid();
    const sessionHash = createHash('sha256').update(sessionRaw).digest('hex');
    const testTelegramId = 999111222n;

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
        expiresAt: new Date(PINNED_BASE_TIME.getTime() + 8 * 3600 * 1000),
        maxExpiresAt: new Date(PINNED_BASE_TIME.getTime() + 16 * 3600 * 1000),
        extensionCount: 0,
      },
    });

    // Act
    const revoked = await prisma.dashboardSession.update({
      where: { sessionHash },
      data: {
        revokedAt: new Date(PINNED_BASE_TIME.getTime() + 1000),
        revocationReason: 'USER_LOGOUT',
      },
    });

    // Assert
    expect(session.id).toBeDefined();
    expect(session.revokedAt).toBeNull();
    expect(session.maxExpiresAt).toBeDefined();
    expect(revoked.revokedAt).not.toBeNull();
    expect(revoked.revocationReason).toBe('USER_LOGOUT');

    // Cleanup
    await prisma.dashboardSession.delete({ where: { id: session.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
  });
});
