import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../src/middleware';
import { generateOpaqueSessionToken } from '../src/lib/session';
import { POST as logoutPost, GET as logoutGet } from '../src/app/api/auth/logout/route';
import { getCurrentUser } from '../src/lib/auth';
import { prisma } from '@alsaada/database';
import { PINNED_BASE_TIME } from '@alsaada/shared/testing';
import { cookies } from 'next/headers';

vi.mock('@alsaada/database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    dashboardSession: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

interface TestSessionPayload {
  userId: string;
  telegramId: string;
  role: string;
  name: string;
  assignedSiteId?: string;
  assignedSiteName?: string;
  isRealSuperAdmin: boolean;
  createdAt: number;
}

describe('Adversarial Stress Test: Route Protection, Role Spoofing Defenses & Session Termination', () => {
  const superAdminPayload: TestSessionPayload = {
    userId: 'usr-super-admin-001',
    telegramId: '123456789',
    role: 'SUPER_ADMIN',
    name: 'صالح عثمان',
    isRealSuperAdmin: true,
    createdAt: PINNED_BASE_TIME.getTime(),
  };

  const fieldAdminPayload: TestSessionPayload = {
    userId: 'usr-field-admin-002',
    telegramId: '987654321',
    role: 'FIELD_ADMIN',
    name: 'إبراهيم المشرف',
    assignedSiteId: 'site-alamein',
    assignedSiteName: 'مشروع العلمين',
    isRealSuperAdmin: false,
    createdAt: PINNED_BASE_TIME.getTime(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==========================================================================
  // Section 1: Unauthenticated Direct Access to Protected Routes
  // ==========================================================================
  describe('1. Unauthenticated Direct Route Access Stress Tests', () => {
    const protectedRoutes = [
      '/admin',
      '/admin/workforce/directory',
      '/admin/settings/company',
      '/admin/settings/users',
      '/admin/settings/audit-vault',
      '/admin/workforce/clearances',
      '/admin/deeply/nested/path/test',
      '/admin/workforce/directory?tab=active&page=2&search=saleh',
    ];

    for (const route of protectedRoutes) {
      it(`strictly redirects unauthenticated access to ${route} with HTTP 302 to bot deep-link`, async () => {
        // Arrange
        const req = new NextRequest(`http://localhost:3000${route}`);

        // Act
        const res = await middleware(req);

        // Assert
        expect(res.status).toBe(302);
        const location = res.headers.get('location');
        expect(location).toBeDefined();
        expect(location).toContain('start=dashboard_access');
        expect(location).not.toContain('/login');
        expect(location).not.toContain('/admin');
      });
    }

    it('allows non-admin routes to pass through unhindered (NextResponse.next)', async () => {
      // Arrange
      const publicRoutes = ['/api/health'];

      for (const route of publicRoutes) {
        const req = new NextRequest(`http://localhost:3000${route}`);

        // Act
        const res = await middleware(req);

        // Assert
        expect(res.status).not.toBe(302);
        expect(res.headers.get('location')).toBeNull();
      }
    });
  });

  // ==========================================================================
  // Section 2: Cookie Spoofing & Role Bypass Defenses
  // ==========================================================================
  describe('2. Cookie Spoofing & Role Bypass Defenses', () => {
    it('rejects plain cookie spoofing alsaada_admin_role=super_admin with 302 redirect', async () => {
      // Arrange
      const req = new NextRequest('http://localhost:3000/admin', {
        headers: {
          cookie: 'alsaada_admin_role=super_admin',
        },
      });

      // Act
      const res = await middleware(req);

      // Assert
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toContain('start=dashboard_access');
      expect(res.headers.get('location')).not.toContain('/admin');
    });

    it('rejects multiple variants of spoofed role cookies without cryptographic session', async () => {
      // Arrange
      const spoofVariants = [
        'alsaada_admin_role=superadmin',
        'alsaada_admin_role=SUPER_ADMIN',
        'alsaada_admin_role=GENERAL_ADMIN',
        'alsaada_admin_role=FIELD_ADMIN',
        'alsaada_admin_role=ADMIN',
        'alsaada_admin_role=root',
        'alsaada_admin_role=1',
        'alsaada_admin_role=true',
        'alsaada_admin_role={"role":"SUPER_ADMIN"}',
      ];

      for (const cookieHeader of spoofVariants) {
        const req = new NextRequest('http://localhost:3000/admin/settings/company', {
          headers: { cookie: cookieHeader },
        });

        // Act
        const res = await middleware(req);

        // Assert
        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toContain('start=dashboard_access');
        expect(res.headers.get('location')).not.toContain('/admin');
      }
    });

    it('rejects fake alsaada_session containing random ASCII or binary bytes', async () => {
      // Arrange
      const garbageTokens = [
        'fake_token_12345',
        'admin',
        'true',
        'null',
        'undefined',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMCda8Yhe3iZaWbvV5XKSTbuAn0M',
        '00000000-0000-0000-0000-000000000000',
        '<script>alert(1)</script>',
        "' OR '1'='1",
      ];

      for (const garbage of garbageTokens) {
        const req = new NextRequest('http://localhost:3000/admin', {
          headers: { cookie: `alsaada_session=${garbage}` },
        });

        // Act
        const res = await middleware(req);

        // Assert
        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toContain('start=dashboard_access');
        expect(res.headers.get('location')).not.toContain('/admin');
      }
    });

    it('rejects legacy HMAC tokens containing dot separator at Edge boundary', async () => {
      // Arrange
      const legacyHmacToken = 'payload_content.signature_hex_part';
      const req = new NextRequest('http://localhost:3000/admin', {
        headers: { cookie: `alsaada_session=${legacyHmacToken}` },
      });

      // Act
      const res = await middleware(req);

      // Assert
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toContain('start=dashboard_access');
      expect(res.headers.get('location')).not.toContain('/admin');
    });

    it('rejects malformed non-hex tokens at Edge boundary', async () => {
      // Arrange
      const nonHexToken = 'z'.repeat(64);
      const req = new NextRequest('http://localhost:3000/admin', {
        headers: { cookie: `alsaada_session=${nonHexToken}` },
      });

      // Act
      const res = await middleware(req);

      // Assert
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toContain('start=dashboard_access');
      expect(res.headers.get('location')).not.toContain('/admin');
    });

    it('rejects invalid-length tokens at Edge boundary', async () => {
      // Arrange
      const shortToken = 'a'.repeat(32);
      const req = new NextRequest('http://localhost:3000/admin', {
        headers: { cookie: `alsaada_session=${shortToken}` },
      });

      // Act
      const res = await middleware(req);

      // Assert
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toContain('start=dashboard_access');
      expect(res.headers.get('location')).not.toContain('/admin');
    });

    it('getCurrentUser strictly returns null when unauthenticated even if alsaada_admin_role is present', async () => {
      // Arrange
      vi.mocked(cookies).mockResolvedValueOnce({
        get: (name: string) => {
          if (name === 'alsaada_admin_role') return { value: 'superadmin', name };
          return undefined;
        },
      } as any);

      // Act
      const user = await getCurrentUser({ nullable: true });

      // Assert
      expect(user).toBeNull();
      expect(prisma.dashboardSession.findUnique).not.toHaveBeenCalled();
    });

    it('getCurrentUser prevents non-superadmin from privilege escalation via alsaada_admin_role cookie', async () => {
      // Arrange
      const validFieldAdminToken = 'f1e1d1a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d';

      vi.mocked(cookies).mockResolvedValueOnce({
        get: (name: string) => {
          if (name === 'alsaada_session') return { value: validFieldAdminToken, name };
          if (name === 'alsaada_admin_role') return { value: 'superadmin', name };
          return undefined;
        },
      } as any);

      vi.mocked(prisma.dashboardSession.findUnique).mockResolvedValueOnce({
        id: 'sess-field-admin',
        sessionHash: 'hash',
        userId: fieldAdminPayload.userId,
        actorTelegramId: BigInt(fieldAdminPayload.telegramId),
        revokedAt: null,
        expiresAt: new Date(PINNED_BASE_TIME.getTime() + 8 * 3600 * 1000),
        maxExpiresAt: new Date(PINNED_BASE_TIME.getTime() + 16 * 3600 * 1000),
        user: {
          id: fieldAdminPayload.userId,
          telegramId: BigInt(fieldAdminPayload.telegramId),
          fullName: fieldAdminPayload.name,
          role: 'FIELD_ADMIN',
          isActive: true,
          isBanned: false,
          isDeleted: false,
          deletedAt: null,
          assignedSiteId: 'site-alamein',
          assignedSite: { name: 'مشروع العلمين' },
        },
      } as any);

      // Act
      const user = await getCurrentUser({ nullable: true });

      // Assert
      expect(user).not.toBeNull();
      expect(user?.role).toBe('FIELD_ADMIN');
      expect(user?.role).not.toBe('SUPER_ADMIN');
      expect(user?.isRealSuperAdmin).toBe(false);
      expect(user?.id).toBe(fieldAdminPayload.userId);
    });
  });

  // ==========================================================================
  // Section 3: Logout Endpoint & Session Lifecycle Termination
  // ==========================================================================
  describe('3. Logout Endpoint & Session Termination Stress Tests', () => {
    it('POST /api/auth/logout clears alsaada_session and alsaada_admin_role cookies', async () => {
      // Arrange
      const req = new NextRequest('http://localhost:3002/api/auth/logout', { method: 'POST' });

      // Act
      const res = await logoutPost(req);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Logged out successfully');

      const sessionCookie = res.cookies.get('alsaada_session');
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie?.value).toBe('');
      expect(sessionCookie?.maxAge).toBe(0);

      const roleCookie = res.cookies.get('alsaada_admin_role');
      expect(roleCookie).toBeDefined();
      expect(roleCookie?.value).toBe('');
      expect(roleCookie?.maxAge).toBe(0);
    });

    it('GET /api/auth/logout clears cookies and redirects to bot deep-link', async () => {
      // Arrange
      const req = new NextRequest('http://localhost:3000/api/auth/logout');

      // Act
      const res = await logoutGet(req);

      // Assert
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toContain('start=dashboard_access');
      expect(res.headers.get('location')).not.toContain('/admin');

      const sessionCookie = res.cookies.get('alsaada_session');
      expect(sessionCookie?.value).toBe('');
      expect(sessionCookie?.maxAge).toBe(0);

      const roleCookie = res.cookies.get('alsaada_admin_role');
      expect(roleCookie?.value).toBe('');
      expect(roleCookie?.maxAge).toBe(0);
    });

    it('full lifecycle: authenticated session is allowed, logout clears session, subsequent access is blocked', async () => {
      // Arrange & Step 1: User has valid session token -> allowed through
      const validToken = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
      const authenticatedReq = new NextRequest('http://localhost:3000/admin', {
        headers: { cookie: `alsaada_session=${validToken}` },
      });

      // Act 1
      const authRes = await middleware(authenticatedReq);

      // Assert 1
      expect(authRes.headers.get('location')).toBeNull();

      // Step 2: User invokes logout endpoint
      const logoutReq = new NextRequest('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        headers: { cookie: `alsaada_session=${validToken}` },
      });

      // Act 2
      const logoutRes = await logoutPost(logoutReq);

      // Assert 2
      expect(logoutRes.status).toBe(200);
      const clearedCookieValue = logoutRes.cookies.get('alsaada_session')?.value || '';

      // Step 3: Subsequent request with cleared cookie
      const postLogoutReq = new NextRequest('http://localhost:3000/admin', {
        headers: { cookie: `alsaada_session=${clearedCookieValue}` },
      });

      // Act 3
      const blockedRes = await middleware(postLogoutReq);

      // Assert 3
      expect(blockedRes.status).toBe(302);
      expect(blockedRes.headers.get('location')).toContain('start=dashboard_access');
      expect(blockedRes.headers.get('location')).not.toContain('/admin');
    });
  });
});
