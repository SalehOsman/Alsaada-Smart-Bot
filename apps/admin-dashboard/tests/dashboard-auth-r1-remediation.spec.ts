import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@alsaada/database';
import { middleware } from '../src/middleware';
import { getCurrentUser } from '../src/lib/auth';
import { GET } from '../src/app/api/auth/claim/route';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

describe('PLAN-22 Stop-The-Line R1 Remediation Verification Suite', () => {
  const testTelegramId = 8877665544n;
  let testUserId: string;

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

  afterAll(async () => {
    await prisma.dashboardSession.deleteMany({ where: { actorTelegramId: testTelegramId } });
    await prisma.dashboardAuthLink.deleteMany({ where: { actorTelegramId: testTelegramId } });
    await prisma.user.deleteMany({ where: { telegramId: testTelegramId } });
  });

  describe('1. Rejection of Legacy HMAC/Signed Tokens & Simulation Bypasses', () => {
    it('middleware strictly rejects and strips legacy HMAC token containing dots', async () => {
      const legacyHmacToken = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIxMjMifQ.abc123def456';
      const req = new NextRequest('http://localhost:3000/admin', {
        headers: {
          cookie: `alsaada_session=${legacyHmacToken}`,
        },
      });

      const res = await middleware(req);
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toContain('start=dashboard_access');
      // Cookie must be expired/cleared
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain('alsaada_session=;');
    });

    it('middleware strictly rejects non-hex and malformed session tokens', async () => {
      const malformedTokens = [
        'short-token',
        'g'.repeat(64), // not hex
        '0'.repeat(63), // 63 chars
        '0'.repeat(65), // 65 chars
        '<script>alert(1)</script>',
      ];

      for (const token of malformedTokens) {
        const req = new NextRequest('http://localhost:3000/admin', {
          headers: {
            cookie: `alsaada_session=${token}`,
          },
        });
        const res = await middleware(req);
        expect(res.status).toBe(302);
      }
    });

    it('getCurrentUser returns null when cookie contains legacy HMAC token', async () => {
      vi.mocked(cookies).mockResolvedValueOnce({
        get: (name: string) => {
          if (name === 'alsaada_session') {
            return { value: 'header.payload.signature', name };
          }
          return undefined;
        },
      } as any);

      const user = await getCurrentUser({ nullable: true });
      expect(user).toBeNull();
    });

    it('claim route strictly rejects non-hex and short magic tokens with 400 Bad Request', async () => {
      const badTokens = ['invalid-short', 'header.payload.sig', 'z'.repeat(64)];
      for (const token of badTokens) {
        const req = new NextRequest(`http://localhost:3002/api/auth/claim?token=${token}`, {
          headers: { accept: 'application/json' },
        });
        const res = await GET(req);
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('INVALID_TOKEN_FORMAT');
      }
    });
  });

  describe('2. Fail-Closed Principle & Session Validity Checks', () => {
    it('getCurrentUser returns null (Fail-Closed) if database throws connection error', async () => {
      const validOpaqueToken = randomBytes(32).toString('hex');
      vi.mocked(cookies).mockResolvedValueOnce({
        get: (name: string) => {
          if (name === 'alsaada_session') return { value: validOpaqueToken, name };
          return undefined;
        },
      } as any);

      const originalFindUnique = prisma.dashboardSession.findUnique;
      (prisma.dashboardSession as any).findUnique = vi
        .fn()
        .mockRejectedValueOnce(new Error('FATAL: Database connection timeout'));

      const user = await getCurrentUser({ nullable: true });
      expect(user).toBeNull();

      (prisma.dashboardSession as any).findUnique = originalFindUnique;
    });

    it('getCurrentUser returns null when database session is revoked', async () => {
      const validOpaqueToken = randomBytes(32).toString('hex');
      const sessionHash = createHash('sha256').update(validOpaqueToken).digest('hex');

      vi.mocked(cookies).mockResolvedValueOnce({
        get: (name: string) => {
          if (name === 'alsaada_session') return { value: validOpaqueToken, name };
          return undefined;
        },
      } as any);

      const originalFindUnique = prisma.dashboardSession.findUnique;
      (prisma.dashboardSession as any).findUnique = vi.fn().mockResolvedValueOnce({
        id: 'sess-revoked',
        sessionHash,
        userId: testUserId,
        actorTelegramId: testTelegramId,
        revokedAt: new Date(), // Revoked!
        expiresAt: new Date(Date.now() + 8 * 3600 * 1000),
        maxExpiresAt: new Date(Date.now() + 16 * 3600 * 1000),
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

      const user = await getCurrentUser({ nullable: true });
      expect(user).toBeNull();

      (prisma.dashboardSession as any).findUnique = originalFindUnique;
    });

    it('getCurrentUser returns null when database session has expired', async () => {
      const validOpaqueToken = randomBytes(32).toString('hex');
      const sessionHash = createHash('sha256').update(validOpaqueToken).digest('hex');

      vi.mocked(cookies).mockResolvedValueOnce({
        get: (name: string) => {
          if (name === 'alsaada_session') return { value: validOpaqueToken, name };
          return undefined;
        },
      } as any);

      const originalFindUnique = prisma.dashboardSession.findUnique;
      (prisma.dashboardSession as any).findUnique = vi.fn().mockResolvedValueOnce({
        id: 'sess-expired',
        sessionHash,
        userId: testUserId,
        actorTelegramId: testTelegramId,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000), // Expired!
        maxExpiresAt: new Date(Date.now() + 16 * 3600 * 1000),
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

      const user = await getCurrentUser({ nullable: true });
      expect(user).toBeNull();

      (prisma.dashboardSession as any).findUnique = originalFindUnique;
    });
  });

  describe('3. Concurrent Claim & Ceiling of 3 Active Sessions', () => {
    it('strictly enforces <= 3 active sessions under concurrent claim races', async () => {
      // Clear any prior sessions for testTelegramId
      await prisma.dashboardSession.deleteMany({ where: { actorTelegramId: testTelegramId } });

      // Seed 2 active sessions
      const now = new Date();
      const expiresAt = new Date(Date.now() + 8 * 3600 * 1000);
      const maxExpiresAt = new Date(Date.now() + 16 * 3600 * 1000);

      await prisma.dashboardSession.createMany({
        data: [
          {
            sessionHash: createHash('sha256').update(randomBytes(32)).digest('hex'),
            userId: testUserId,
            actorTelegramId: testTelegramId,
            originKind: 'LOCAL',
            expiresAt,
            maxExpiresAt,
          },
          {
            sessionHash: createHash('sha256').update(randomBytes(32)).digest('hex'),
            userId: testUserId,
            actorTelegramId: testTelegramId,
            originKind: 'TUNNEL',
            expiresAt,
            maxExpiresAt,
          },
        ],
      });

      // Create 2 valid unused auth links
      const rawTokenA = randomBytes(32).toString('hex');
      const jtiHashA = createHash('sha256').update(rawTokenA).digest('hex');
      const groupA = randomUUID();

      const rawTokenB = randomBytes(32).toString('hex');
      const jtiHashB = createHash('sha256').update(rawTokenB).digest('hex');
      const groupB = randomUUID();

      await prisma.dashboardAuthLink.createMany({
        data: [
          {
            groupId: groupA,
            originKind: 'LOCAL',
            targetOrigin: 'http://localhost:3002',
            jtiHash: jtiHashA,
            actorTelegramId: testTelegramId,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          },
          {
            groupId: groupB,
            originKind: 'LOCAL',
            targetOrigin: 'http://localhost:3002',
            jtiHash: jtiHashB,
            actorTelegramId: testTelegramId,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          },
        ],
      });

      // Fire both claims concurrently with accept: application/json
      const reqA = new NextRequest(`http://localhost:3002/api/auth/claim?token=${rawTokenA}`, {
        headers: { accept: 'application/json' },
      });
      const reqB = new NextRequest(`http://localhost:3002/api/auth/claim?token=${rawTokenB}`, {
        headers: { accept: 'application/json' },
      });

      const results = await Promise.all([GET(reqA), GET(reqB)]);

      const successCount = results.filter((r) => r.status === 200).length;
      const failureCount = results.filter((r) => r.status === 429).length;

      // Exactly 1 must succeed (becoming the 3rd session), and exactly 1 must fail (exceeding limit)
      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);

      // Verify active sessions count in DB is strictly 3
      const totalActive = await prisma.dashboardSession.count({
        where: {
          actorTelegramId: testTelegramId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
      });
      expect(totalActive).toBe(3);
    });
  });

  describe('4. Atomic Concurrency Lock on Session Extension', () => {
    it('ensures exactly one extension succeeds under concurrent requests via updateMany count', async () => {
      const sessionHash = createHash('sha256').update(randomBytes(32)).digest('hex');
      const expiresAt = new Date(Date.now() + 4 * 3600 * 1000);
      const maxExpiresAt = new Date(Date.now() + 16 * 3600 * 1000);

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

      // Simulate two concurrent extension requests running updateMany
      const extensionHours = 8;
      const candidateExpiresAt = new Date(expiresAt.getTime() + extensionHours * 3600 * 1000);
      const newExpiresAt = candidateExpiresAt > maxExpiresAt ? maxExpiresAt : candidateExpiresAt;

      const performAtomicExtension = async () => {
        return prisma.dashboardSession.updateMany({
          where: {
            id: session.id,
            revokedAt: null,
            extensionCount: 0,
            expiresAt: { gt: new Date() },
          },
          data: {
            extensionCount: 1,
            extendedAt: new Date(),
            expiresAt: newExpiresAt,
            maxExpiresAt,
            noticeSentAt: null,
          },
        });
      };

      const [ext1, ext2] = await Promise.all([
        performAtomicExtension(),
        performAtomicExtension(),
      ]);

      const counts = [ext1.count, ext2.count];
      expect(counts).toContain(1);
      expect(counts).toContain(0);

      // Verify final session state
      const refreshed = await prisma.dashboardSession.findUnique({
        where: { id: session.id },
      });
      expect(refreshed?.extensionCount).toBe(1);
      expect(refreshed?.extendedAt).toBeDefined();
    });
  });
});
