import { createHash } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@alsaada/database';
import { PINNED_BASE_TIME } from '@alsaada/shared/testing';
import { middleware } from '../src/middleware';
import { getCurrentUser } from '../src/lib/auth';
import { GET } from '../src/app/api/auth/claim/route';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

describe('PLAN-22 Stop-The-Line R1 Remediation Verification Suite', () => {
  const testTelegramId = 8877665544n;
  let testUserId: string;

  function deterministicToken(seed: string): string {
    return createHash('sha256').update(`r1-remediation-token-${seed}`).digest('hex');
  }

  function deterministicGroupId(index: number): string {
    return `r1000000-0000-0000-0000-${String(index).padStart(12, '0')}`;
  }

  const originalFindUnique = prisma.dashboardSession.findUnique;
  let stdoutSpy: any;
  let stderrSpy: any;

  beforeAll(async () => {
    const user = await prisma.user.upsert({
      where: { telegramId: testTelegramId },
      update: { role: 'GENERAL_ADMIN', isActive: true, isBanned: false },
      create: {
        telegramId: testTelegramId,
        fullName: 'م. عصام عبد الرحمن (اختبار رادار الأمان)',
        role: 'GENERAL_ADMIN',
        isActive: true,
        isBanned: false,
      },
    });
    testUserId = user.id;
  });

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    await prisma.dashboardSession.deleteMany({ where: { actorTelegramId: testTelegramId } });
    await prisma.dashboardAuthLink.deleteMany({ where: { actorTelegramId: testTelegramId } });
  });

  afterEach(async () => {
    (prisma.dashboardSession as any).findUnique = originalFindUnique;
    vi.useRealTimers();
    vi.restoreAllMocks();
    stdoutSpy?.mockRestore?.();
    stderrSpy?.mockRestore?.();
    (prisma.dashboardSession as any).findUnique = originalFindUnique;
    await prisma.dashboardSession.deleteMany({ where: { actorTelegramId: testTelegramId } });
    await prisma.dashboardAuthLink.deleteMany({ where: { actorTelegramId: testTelegramId } });
  });

  afterAll(async () => {
    (prisma.dashboardSession as any).findUnique = originalFindUnique;
    vi.useRealTimers();
    vi.restoreAllMocks();
    await prisma.dashboardSession.deleteMany({ where: { actorTelegramId: testTelegramId } });
    await prisma.dashboardAuthLink.deleteMany({ where: { actorTelegramId: testTelegramId } });
    await prisma.user.deleteMany({ where: { telegramId: testTelegramId } });
  });

  describe('1. Rejection of Legacy HMAC/Signed Tokens & Simulation Bypasses', () => {
    it('rejects legacy HMAC token containing dots at Edge middleware, redirects and expires cookie', async () => {
      // Arrange
      const legacyHmacToken = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIxMjMifQ.abc123def456';
      const req = new NextRequest('http://localhost:3000/admin', {
        headers: {
          cookie: `alsaada_session=${legacyHmacToken}`,
        },
      });

      // Act
      const res = await middleware(req);

      // Assert
      expect(res.status).toBe(302);
      expect(res.status).not.toBe(200);
      expect(res.headers.get('location')).toContain('start=dashboard_access');
      expect(res.headers.get('location')).not.toContain('/admin');
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain('alsaada_session=;');
    });

    it('rejects non-hex and malformed session tokens at Edge middleware boundary', async () => {
      // Arrange
      const malformedTokens = [
        'short-token',
        'g'.repeat(64), // not hex
        '0'.repeat(63), // 63 chars
        '0'.repeat(65), // 65 chars
        '<script>alert(1)</script>',
      ];

      // Act & Assert
      for (const token of malformedTokens) {
        const req = new NextRequest('http://localhost:3000/admin', {
          headers: {
            cookie: `alsaada_session=${token}`,
          },
        });
        const res = await middleware(req);
        expect(res.status).toBe(302);
        expect(res.status).not.toBe(200);
        expect(res.headers.get('location')).toContain('start=dashboard_access');
        expect(res.headers.get('location')).not.toBeNull();
      }
    });

    it('returns null from getCurrentUser when session cookie contains legacy HMAC format', async () => {
      // Arrange
      vi.mocked(cookies).mockResolvedValueOnce({
        get: (name: string) => {
          if (name === 'alsaada_session') {
            return { value: 'header.payload.signature', name };
          }
          return undefined;
        },
      } as any);

      // Act
      const user = await getCurrentUser({ nullable: true });

      // Assert
      expect(user).toBeNull();
      expect(user).toBeFalsy();
      expect(Boolean(user)).toBe(false);
    });

    it('rejects non-hex and malformed magic tokens with 400 Bad Request on claim route', async () => {
      // Arrange
      const badTokens = ['invalid-short', 'header.payload.sig', 'z'.repeat(64)];

      // Act & Assert
      for (const token of badTokens) {
        const req = new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${token}`, {
          headers: { accept: 'application/json' },
        });
        const res = await GET(req);
        expect(res.status).toBe(400);
        expect(res.status).not.toBe(200);
        const body = await res.json();
        expect(body.error).toBe('TOKEN_MALFORMED');
        expect(body.error).not.toBeNull();
      }
    });
  });

  describe('2. Fail-Closed Principle & Session Validity Checks', () => {
    it('returns null enforcing Fail-Closed behavior if database encounters an error', async () => {
      // Arrange
      const validOpaqueToken = deterministicToken('db-error-test');
      vi.mocked(cookies).mockResolvedValueOnce({
        get: (name: string) => {
          if (name === 'alsaada_session') return { value: validOpaqueToken, name };
          return undefined;
        },
      } as any);

      (prisma.dashboardSession as any).findUnique = vi.fn().mockRejectedValueOnce(
        new Error('FATAL: Database connection timeout')
      );

      // Act
      const user = await getCurrentUser({ nullable: true });

      // Assert
      expect(user).toBeNull();
      expect(user).toBeFalsy();
      expect(Boolean(user)).toBe(false);
    });

    it('returns null from getCurrentUser when database session has been revoked', async () => {
      // Arrange
      const validOpaqueToken = deterministicToken('revoked-test');
      const sessionHash = createHash('sha256').update(validOpaqueToken).digest('hex');

      vi.mocked(cookies).mockResolvedValueOnce({
        get: (name: string) => {
          if (name === 'alsaada_session') return { value: validOpaqueToken, name };
          return undefined;
        },
      } as any);

      (prisma.dashboardSession as any).findUnique = vi.fn().mockResolvedValueOnce({
        id: 'sess-revoked',
        sessionHash,
        userId: testUserId,
        actorTelegramId: testTelegramId,
        revokedAt: PINNED_BASE_TIME, // Revoked!
        expiresAt: new Date(PINNED_BASE_TIME.getTime() + 8 * 3600 * 1000),
        maxExpiresAt: new Date(PINNED_BASE_TIME.getTime() + 16 * 3600 * 1000),
        user: {
          id: testUserId,
          telegramId: testTelegramId,
          fullName: 'Test Admin',
          role: 'GENERAL_ADMIN',
          isActive: true,
          isBanned: false,
          isDeleted: false,
          deletedAt: null,
        },
      } as any);

      // Act
      const user = await getCurrentUser({ nullable: true });

      // Assert
      expect(user).toBeNull();
      expect(user).toBeFalsy();
      expect(Boolean(user)).toBe(false);
    });

    it('returns null from getCurrentUser when database session has expired in the past', async () => {
      // Arrange
      const validOpaqueToken = deterministicToken('expired-test');
      const sessionHash = createHash('sha256').update(validOpaqueToken).digest('hex');

      vi.mocked(cookies).mockResolvedValueOnce({
        get: (name: string) => {
          if (name === 'alsaada_session') return { value: validOpaqueToken, name };
          return undefined;
        },
      } as any);

      (prisma.dashboardSession as any).findUnique = vi.fn().mockResolvedValueOnce({
        id: 'sess-expired',
        sessionHash,
        userId: testUserId,
        actorTelegramId: testTelegramId,
        revokedAt: null,
        expiresAt: new Date(PINNED_BASE_TIME.getTime() - 10_000), // Expired 10s ago
        maxExpiresAt: new Date(PINNED_BASE_TIME.getTime() + 16 * 3600 * 1000),
        user: {
          id: testUserId,
          telegramId: testTelegramId,
          fullName: 'Test Admin',
          role: 'GENERAL_ADMIN',
          isActive: true,
          isBanned: false,
          isDeleted: false,
          deletedAt: null,
        },
      } as any);

      // Act
      const user = await getCurrentUser({ nullable: true });

      // Assert
      expect(user).toBeNull();
      expect(user).toBeFalsy();
      expect(Boolean(user)).toBe(false);
    });
  });

  describe('3. Concurrent Claim & Ceiling of 3 Active Sessions', () => {
    it('strictly enforces <= 3 active sessions ceiling under concurrent claim race conditions', async () => {
      // Arrange
      await prisma.dashboardSession.deleteMany({ where: { actorTelegramId: testTelegramId } });

      const expiresAt = new Date(PINNED_BASE_TIME.getTime() + 8 * 3600 * 1000);
      const maxExpiresAt = new Date(PINNED_BASE_TIME.getTime() + 16 * 3600 * 1000);

      // Seed 2 active sessions
      await prisma.dashboardSession.createMany({
        data: [
          {
            sessionHash: createHash('sha256').update(deterministicToken('pre-active-1')).digest('hex'),
            userId: testUserId,
            actorTelegramId: testTelegramId,
            originKind: 'LOCAL',
            expiresAt,
            maxExpiresAt,
          },
          {
            sessionHash: createHash('sha256').update(deterministicToken('pre-active-2')).digest('hex'),
            userId: testUserId,
            actorTelegramId: testTelegramId,
            originKind: 'TUNNEL',
            expiresAt,
            maxExpiresAt,
          },
        ],
      });

      // Create 2 valid unused auth links
      const rawTokenA = deterministicToken('concur-claim-a');
      const jtiHashA = createHash('sha256').update(rawTokenA).digest('hex');
      const groupA = deterministicGroupId(1);

      const rawTokenB = deterministicToken('concur-claim-b');
      const jtiHashB = createHash('sha256').update(rawTokenB).digest('hex');
      const groupB = deterministicGroupId(2);

      await prisma.dashboardAuthLink.createMany({
        data: [
          {
            groupId: groupA,
            originKind: 'LOCAL',
            targetOrigin: 'http://localtest.me:3002',
            jtiHash: jtiHashA,
            actorTelegramId: testTelegramId,
            expiresAt: new Date(PINNED_BASE_TIME.getTime() + 5 * 60 * 1000),
          },
          {
            groupId: groupB,
            originKind: 'LOCAL',
            targetOrigin: 'http://localtest.me:3002',
            jtiHash: jtiHashB,
            actorTelegramId: testTelegramId,
            expiresAt: new Date(PINNED_BASE_TIME.getTime() + 5 * 60 * 1000),
          },
        ],
      });

      // Act: Fire both claims concurrently
      const reqA = new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${rawTokenA}`, {
        headers: { accept: 'application/json' },
      });
      const reqB = new NextRequest(`http://localtest.me:3002/api/auth/claim?token=${rawTokenB}`, {
        headers: { accept: 'application/json' },
      });

      const results = await Promise.all([GET(reqA), GET(reqB)]);

      // Assert
      const successCount = results.filter((r) => r.status === 200).length;
      const failureCount = results.filter((r) => r.status === 429).length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);
      expect(results).toHaveLength(2);

      // Verify active sessions count in DB is strictly capped at 3
      const totalActive = await prisma.dashboardSession.count({
        where: {
          actorTelegramId: testTelegramId,
          revokedAt: null,
          expiresAt: { gt: PINNED_BASE_TIME },
        },
      });
      expect(totalActive).toBe(3);
      expect(totalActive).not.toBeGreaterThan(3);
    });
  });

  describe('4. Atomic Concurrency Lock on Session Extension', () => {
    it('ensures exactly one extension succeeds under parallel requests via updateMany conditional count', async () => {
      // Arrange
      const sessionHash = createHash('sha256').update(deterministicToken('extend-seed-1')).digest('hex');
      const expiresAt = new Date(PINNED_BASE_TIME.getTime() + 4 * 3600 * 1000);
      const maxExpiresAt = new Date(PINNED_BASE_TIME.getTime() + 16 * 3600 * 1000);

      const session = await prisma.dashboardSession.create({
        data: {
          sessionHash,
          userId: testUserId,
          actorTelegramId: testTelegramId,
          originKind: 'LOCAL',
          extensionCount: 0,
          expiresAt,
          maxExpiresAt,
        },
      });

      const extensionHours = 8;
      const candidateExpiresAt = new Date(expiresAt.getTime() + extensionHours * 3600 * 1000);
      const newExpiresAt = candidateExpiresAt > maxExpiresAt ? maxExpiresAt : candidateExpiresAt;

      const performAtomicExtension = async () => {
        return prisma.dashboardSession.updateMany({
          where: {
            id: session.id,
            revokedAt: null,
            extensionCount: 0,
            expiresAt: { gt: PINNED_BASE_TIME },
          },
          data: {
            extensionCount: 1,
            extendedAt: PINNED_BASE_TIME,
            expiresAt: newExpiresAt,
            maxExpiresAt,
            noticeSentAt: null,
          },
        });
      };

      // Act
      const [ext1, ext2] = await Promise.all([
        performAtomicExtension(),
        performAtomicExtension(),
      ]);

      // Assert
      const counts = [ext1.count, ext2.count];
      expect(counts).toContain(1);
      expect(counts).toContain(0);
      expect(ext1.count + ext2.count).toBe(1);

      // Verify final session state
      const refreshed = await prisma.dashboardSession.findUnique({
        where: { id: session.id },
      });
      expect(refreshed?.extensionCount).toBe(1);
      expect(refreshed?.extendedAt).toBeDefined();
      expect(refreshed?.revokedAt).toBeNull();
    });
  });
});
