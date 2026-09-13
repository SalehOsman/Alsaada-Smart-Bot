import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../src/middleware';
import { generateOpaqueSessionToken } from '../src/lib/session';
import { POST as logoutPost, GET as logoutGet } from '../src/app/api/auth/logout/route';
import { getCurrentUser } from '../src/lib/auth';
import { prisma } from '@alsaada/database';
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
    createdAt: Date.now(),
  };

  const fieldAdminPayload: TestSessionPayload = {
    userId: 'usr-field-admin-002',
    telegramId: '987654321',
    role: 'FIELD_ADMIN',
    name: 'إبراهيم المشرف',
    assignedSiteId: 'site-alamein',
    assignedSiteName: 'مشروع العلمين',
    isRealSuperAdmin: false,
    createdAt: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
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
        const req = new NextRequest(`http://localhost:3000${route}`);
        const res = await middleware(req);

        expect(res.status).toBe(302);
        const location = res.headers.get('location');
        expect(location).toBeDefined();
        expect(location).toContain('start=dashboard_access');
        expect(location).not.toContain('/login');
      });
    }

    it('allows non-admin routes to pass through unhindered (NextResponse.next)', async () => {
      const publicRoutes = ['/api/health'];

      for (const route of publicRoutes) {
        const req = new NextRequest(`http://localhost:3000${route}`);
        const res = await middleware(req);
        // Middleware returns NextResponse.next() which does not set a redirect location
        expect(res.headers.get('location')).toBeNull();
      }
    });
  });

  // ==========================================================================
  // Section 2: Cookie Spoofing & Role Bypass Defenses
  // ==========================================================================
  describe('2. Cookie Spoofing & Role Bypass Defenses', () => {
    it('rejects plain cookie spoofing alsaada_admin_role=super_admin with 302 redirect', async () => {
      const req = new NextRequest('http://localhost:3000/admin', {
        headers: {
          cookie: 'alsaada_admin_role=super_admin',
        },
      });
      const res = await middleware(req);
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toContain('start=dashboard_access');
    });

    it('rejects multiple variants of spoofed role cookies without cryptographic session', async () => {
      const spoofVariants = [
        'alsaada_admin_role=superadmin',
        'alsaada_admin_role=SUPER_ADMIN',
        'alsaada_admin_role=generaladmin',
        'alsaada_admin_role=admin',
        'alsaada_admin_role=executive',
        'alsaada_admin_role=fieldadmin; role=superadmin',
      ];

      for (const cookieHeader of spoofVariants) {
        const req = new NextRequest('http://localhost:3000/admin/settings/company', {
          headers: { cookie: cookieHeader },
        });
        const res = await middleware(req);
        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toContain('start=dashboard_access');
      }
    });

    it('rejects fake alsaada_session containing random ASCII or binary bytes', async () => {
      const randomGarbageTokens = [
        'abcdef1234567890',
        'random.bytes.without.valid.format',
        'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=',
        '{"userId":"usr-super","role":"SUPER_ADMIN"}',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.fakeSignature',
        '..',
        'part1.',
        '.part2',
        'invalid_base64_!@#$.sig_!@#$',
      ];

      for (const garbage of randomGarbageTokens) {
        const req = new NextRequest('http://localhost:3000/admin/workforce/directory', {
          headers: { cookie: `alsaada_session=${garbage}` },
        });
        const res = await middleware(req);
        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toContain('start=dashboard_access');
      }
    });

    it('rejects legacy HMAC tokens containing dot separator at Edge boundary', async () => {
      const forgedToken = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiU1VQRVJfQURNSU4ifQ.invalid_sig';
      const req = new NextRequest('http://localhost:3000/admin', {
        headers: { cookie: `alsaada_session=${forgedToken}` },
      });
      const res = await middleware(req);
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toContain('start=dashboard_access');
    });

    it('rejects malformed non-hex tokens at Edge boundary', async () => {
      const rogueToken = 'non-hex-token-with-special-chars!@#$%^&*()';
      const req = new NextRequest('http://localhost:3000/admin', {
        headers: { cookie: `alsaada_session=${rogueToken}` },
      });
      const res = await middleware(req);
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toContain('start=dashboard_access');
    });

    it('rejects invalid-length tokens at Edge boundary', async () => {
      const shortToken = 'a'.repeat(32);
      const req = new NextRequest('http://localhost:3000/admin', {
        headers: { cookie: `alsaada_session=${shortToken}` },
      });
      const res = await middleware(req);
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toContain('start=dashboard_access');
    });

    it('getCurrentUser strictly returns null when unauthenticated even if alsaada_admin_role is present', async () => {
      vi.mocked(cookies).mockResolvedValueOnce({
        get: (name: string) => {
          if (name === 'alsaada_admin_role') return { value: 'superadmin', name };
          return undefined;
        },
      } as any);

      const user = await getCurrentUser({ nullable: true });
      expect(user).toBeNull();
    });

    it('getCurrentUser prevents non-superadmin from privilege escalation via alsaada_admin_role cookie', async () => {
      const validFieldAdminToken = 'f1e1d1a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d';

      // Authenticated as FIELD_ADMIN, but attempts to spoof alsaada_admin_role=superadmin
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
        expiresAt: new Date(Date.now() + 8 * 3600 * 1000),
        maxExpiresAt: new Date(Date.now() + 16 * 3600 * 1000),
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

      const user = await getCurrentUser({ nullable: true });
      expect(user).not.toBeNull();
      // Role must remain FIELD_ADMIN, NOT escalated to SUPER_ADMIN!
      expect(user?.role).toBe('FIELD_ADMIN');
      expect(user?.isRealSuperAdmin).toBe(false);
      expect(user?.id).toBe(fieldAdminPayload.userId);
    });

  });

  // ==========================================================================
  // Section 3: Logout Endpoint & Session Lifecycle Termination
  // ==========================================================================
  describe('3. Logout Endpoint & Session Termination Stress Tests', () => {
    it('POST /api/auth/logout clears alsaada_session and alsaada_admin_role cookies', async () => {
      const req = new NextRequest('http://localhost:3002/api/auth/logout', { method: 'POST' });
      const res = await logoutPost(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Logged out successfully');

      // Check cookie invalidation in response
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
      const req = new NextRequest('http://localhost:3000/api/auth/logout');
      const res = await logoutGet(req);

      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toContain('start=dashboard_access');

      // Check cookie clearing headers
      const sessionCookie = res.cookies.get('alsaada_session');
      expect(sessionCookie?.value).toBe('');
      expect(sessionCookie?.maxAge).toBe(0);

      const roleCookie = res.cookies.get('alsaada_admin_role');
      expect(roleCookie?.value).toBe('');
      expect(roleCookie?.maxAge).toBe(0);
    });

    it('full lifecycle: authenticated session is allowed, logout clears session, subsequent access is blocked', async () => {
      // Step 1: User has valid session token -> allowed through
      const validToken = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
      const authenticatedReq = new NextRequest('http://localhost:3000/admin', {
        headers: { cookie: `alsaada_session=${validToken}` },
      });
      const authRes = await middleware(authenticatedReq);
      expect(authRes.headers.get('location')).toBeNull(); // Allowed

      // Step 2: User invokes logout endpoint
      const logoutReq = new NextRequest('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        headers: { cookie: `alsaada_session=${validToken}` },
      });
      const logoutRes = await logoutPost(logoutReq);
      expect(logoutRes.status).toBe(200);
      const clearedCookieValue = logoutRes.cookies.get('alsaada_session')?.value || '';

      // Step 3: Subsequent request with cleared or missing cookie
      const postLogoutReq = new NextRequest('http://localhost:3000/admin', {
        headers: { cookie: `alsaada_session=${clearedCookieValue}` },
      });
      const blockedRes = await middleware(postLogoutReq);
      expect(blockedRes.status).toBe(302);
      expect(blockedRes.headers.get('location')).toContain('start=dashboard_access');
    });
  });
});
