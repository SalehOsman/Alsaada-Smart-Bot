import { describe, expect, it } from 'vitest';
import {
  canAccessDashboardRole,
  DASHBOARD_ALLOWED_ROLES,
  DASHBOARD_AUTH_LINK_TTL_MINUTES,
  DASHBOARD_INITIAL_SESSION_HOURS,
  DASHBOARD_MAX_CONCURRENT_SESSIONS,
  DASHBOARD_MAX_SESSION_HOURS,
  DASHBOARD_NOTICE_BEFORE_EXPIRY_MINUTES,
  DASHBOARD_REPLY_BUTTON_TEXT,
  DASHBOARD_SESSION_EXTENSION_HOURS,
  isExactOriginMatch,
  isValidOpaqueTokenFormat,
  normalizeOrigin,
} from '../src/dashboard-auth.js';

describe('Dashboard Auth Contract SSOT (@alsaada/rbac)', () => {
  it('strictly defines exact constants matching PLAN-22 specifications', () => {
    expect(DASHBOARD_REPLY_BUTTON_TEXT).toBe('🖥️ فتح لوحة التحكم');
    expect(DASHBOARD_AUTH_LINK_TTL_MINUTES).toBe(5);
    expect(DASHBOARD_INITIAL_SESSION_HOURS).toBe(8);
    expect(DASHBOARD_SESSION_EXTENSION_HOURS).toBe(8);
    expect(DASHBOARD_MAX_SESSION_HOURS).toBe(16);
    expect(DASHBOARD_MAX_CONCURRENT_SESSIONS).toBe(3);
    expect(DASHBOARD_NOTICE_BEFORE_EXPIRY_MINUTES).toBe(60);
    expect(DASHBOARD_ALLOWED_ROLES).toEqual(['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN']);
  });

  it('correctly normalizes valid URLs to their canonical origins', () => {
    expect(normalizeOrigin('http://localhost:3002')).toBe('http://localhost:3002');
    expect(normalizeOrigin('http://localhost:3002/')).toBe('http://localhost:3002');
    expect(normalizeOrigin('http://localhost:3002/api/auth/claim?token=xyz')).toBe('http://localhost:3002');
    expect(normalizeOrigin('https://panel.alsaada.org/admin/dashboard')).toBe('https://panel.alsaada.org');
    expect(normalizeOrigin('https://tunnel.example.org:8443/')).toBe('https://tunnel.example.org:8443');
  });

  it('rejects invalid or unsafe URL schemes during normalization', () => {
    expect(() => normalizeOrigin('javascript:alert(1)')).toThrow('INVALID_ORIGIN_PROTOCOL');
    expect(() => normalizeOrigin('data:text/html,<h1>bad</h1>')).toThrow('INVALID_ORIGIN_PROTOCOL');
    expect(() => normalizeOrigin('')).toThrow('INVALID_ORIGIN_URL');
    expect(() => normalizeOrigin('not-a-url')).toThrow('INVALID_ORIGIN_FORMAT');
  });

  it('strictly validates literal exact origin matches', () => {
    expect(isExactOriginMatch('http://localhost:3002', 'http://localhost:3002/')).toBe(true);
    expect(isExactOriginMatch('https://panel.alsaada.org/api/auth', 'https://panel.alsaada.org')).toBe(true);

    // Host header spoofing & subdomain attacks MUST fail
    expect(isExactOriginMatch('http://localhost:3002.evil.com', 'http://localhost:3002')).toBe(false);
    expect(isExactOriginMatch('http://evil.attacker.com', 'http://localhost:3002')).toBe(false);
    expect(isExactOriginMatch('http://localhost:3003', 'http://localhost:3002')).toBe(false);
    expect(isExactOriginMatch('https://localhost:3002', 'http://localhost:3002')).toBe(false);
  });

  it('strictly allows only the 3 canonical administrative roles', () => {
    expect(canAccessDashboardRole('SUPER_ADMIN')).toBe(true);
    expect(canAccessDashboardRole('GENERAL_ADMIN')).toBe(true);
    expect(canAccessDashboardRole('FIELD_ADMIN')).toBe(true);

    expect(canAccessDashboardRole('WORKER_SUPERVISOR')).toBe(false);
    expect(canAccessDashboardRole('WORKER')).toBe(false);
    expect(canAccessDashboardRole('SUPPLIER')).toBe(false);
    expect(canAccessDashboardRole('GUEST')).toBe(false);
    expect(canAccessDashboardRole(null)).toBe(false);
    expect(canAccessDashboardRole(undefined)).toBe(false);
    expect(canAccessDashboardRole('UNKNOWN')).toBe(false);
  });

  it('strictly validates 64-hex opaque token format', () => {
    expect(isValidOpaqueTokenFormat('a'.repeat(64))).toBe(true);
    expect(isValidOpaqueTokenFormat('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef')).toBe(true);
    expect(isValidOpaqueTokenFormat('a'.repeat(63))).toBe(false);
    expect(isValidOpaqueTokenFormat('a'.repeat(65))).toBe(false);
    expect(isValidOpaqueTokenFormat('xyz'.repeat(21) + 'x')).toBe(false);
    expect(isValidOpaqueTokenFormat('header.payload.signature')).toBe(false);
    expect(isValidOpaqueTokenFormat(null)).toBe(false);
    expect(isValidOpaqueTokenFormat(12345)).toBe(false);
  });

  describe('validateDashboardAuthOrigins (@alsaada/rbac)', () => {
    it('successfully validates standard local and tunnel origins', async () => {
      const { validateDashboardAuthOrigins } = await import('../src/dashboard-auth.js');
      const result = validateDashboardAuthOrigins({
        localUrl: 'http://localtest.me:3002',
        tunnelUrl: 'https://panel.alsaada.org',
      });
      expect(result).toEqual({
        localOrigin: 'http://localtest.me:3002',
        tunnelOrigin: 'https://panel.alsaada.org',
      });
    });

    it('successfully accepts trailing slashes and extracts pure canonical origin', async () => {
      const { validateDashboardAuthOrigins } = await import('../src/dashboard-auth.js');
      const result = validateDashboardAuthOrigins({
        localUrl: 'http://localtest.me:3002/',
        tunnelUrl: 'https://tunnel.example.com/',
      });
      expect(result).toEqual({
        localOrigin: 'http://localtest.me:3002',
        tunnelOrigin: 'https://tunnel.example.com',
      });
    });

    it('rejects localhost and 127.0.0.1.nip.io for local origin', async () => {
      const { validateDashboardAuthOrigins, DashboardAuthConfigError } = await import('../src/dashboard-auth.js');
      expect(() =>
        validateDashboardAuthOrigins({
          localUrl: 'http://localhost:3002',
          tunnelUrl: 'https://tunnel.example.com',
        }),
      ).toThrow(DashboardAuthConfigError);

      expect(() =>
        validateDashboardAuthOrigins({
          localUrl: 'http://127.0.0.1.nip.io:3002',
          tunnelUrl: 'https://tunnel.example.com',
        }),
      ).toThrow(DashboardAuthConfigError);
    });

    it('rejects missing or non-numeric port for local origin', async () => {
      const { validateDashboardAuthOrigins, DashboardAuthConfigError } = await import('../src/dashboard-auth.js');
      expect(() =>
        validateDashboardAuthOrigins({
          localUrl: 'http://localtest.me',
          tunnelUrl: 'https://tunnel.example.com',
        }),
      ).toThrow(DashboardAuthConfigError);

      expect(() =>
        validateDashboardAuthOrigins({
          localUrl: 'http://localtest.me:99999',
          tunnelUrl: 'https://tunnel.example.com',
        }),
      ).toThrow(DashboardAuthConfigError);
    });

    it('rejects local origin with subpath, query, hash or credentials', async () => {
      const { validateDashboardAuthOrigins, DashboardAuthConfigError } = await import('../src/dashboard-auth.js');
      expect(() =>
        validateDashboardAuthOrigins({
          localUrl: 'http://localtest.me:3002/admin',
          tunnelUrl: 'https://tunnel.example.com',
        }),
      ).toThrow(DashboardAuthConfigError);

      expect(() =>
        validateDashboardAuthOrigins({
          localUrl: 'http://localtest.me:3002?foo=bar',
          tunnelUrl: 'https://tunnel.example.com',
        }),
      ).toThrow(DashboardAuthConfigError);

      expect(() =>
        validateDashboardAuthOrigins({
          localUrl: 'http://user:pass@localtest.me:3002',
          tunnelUrl: 'https://tunnel.example.com',
        }),
      ).toThrow(DashboardAuthConfigError);
    });

    it('rejects unencrypted tunnel origin or invalid tunnel host', async () => {
      const { validateDashboardAuthOrigins, DashboardAuthConfigError } = await import('../src/dashboard-auth.js');
      expect(() =>
        validateDashboardAuthOrigins({
          localUrl: 'http://localtest.me:3002',
          tunnelUrl: 'http://tunnel.example.com',
        }),
      ).toThrow(DashboardAuthConfigError);
    });

    it('rejects collision between local and tunnel origin', async () => {
      const { validateDashboardAuthOrigins, DashboardAuthConfigError } = await import('../src/dashboard-auth.js');
      expect(() =>
        validateDashboardAuthOrigins({
          localUrl: 'http://localtest.me:3002',
          tunnelUrl: 'http://localtest.me:3002',
        }),
      ).toThrow(DashboardAuthConfigError);
    });

    it('rejects missing or empty inputs', async () => {
      const { validateDashboardAuthOrigins, DashboardAuthConfigError } = await import('../src/dashboard-auth.js');
      expect(() => validateDashboardAuthOrigins({} as any)).toThrow(DashboardAuthConfigError);
      expect(() => validateDashboardAuthOrigins({ localUrl: '' } as any)).toThrow(DashboardAuthConfigError);
    });
  });

  describe('CLAIM_FAILURE_HTTP_STATUS_MAP (@alsaada/rbac)', () => {
    it('maps every DashboardClaimFailureCode to the exact HTTP status specified in PLAN-22', async () => {
      const { CLAIM_FAILURE_HTTP_STATUS_MAP } = await import('../src/dashboard-auth.js');
      expect(CLAIM_FAILURE_HTTP_STATUS_MAP.TOKEN_MISSING).toBe(400);
      expect(CLAIM_FAILURE_HTTP_STATUS_MAP.TOKEN_MALFORMED).toBe(400);
      expect(CLAIM_FAILURE_HTTP_STATUS_MAP.TOKEN_NOT_FOUND).toBe(401);
      expect(CLAIM_FAILURE_HTTP_STATUS_MAP.TOKEN_EXPIRED).toBe(401);
      expect(CLAIM_FAILURE_HTTP_STATUS_MAP.TOKEN_ALREADY_CLAIMED).toBe(401);
      expect(CLAIM_FAILURE_HTTP_STATUS_MAP.ORIGIN_MISMATCH).toBe(403);
      expect(CLAIM_FAILURE_HTTP_STATUS_MAP.ROLE_UNAUTHORIZED).toBe(403);
      expect(CLAIM_FAILURE_HTTP_STATUS_MAP.MAX_SESSIONS_EXCEEDED).toBe(429);
      expect(CLAIM_FAILURE_HTTP_STATUS_MAP.CONFIG_ERROR).toBe(503);
      expect(CLAIM_FAILURE_HTTP_STATUS_MAP.DATABASE_ERROR).toBe(503);
      expect(CLAIM_FAILURE_HTTP_STATUS_MAP.INTERNAL_ERROR).toBe(500);
    });
  });

  describe('resolveEffectiveRequestOrigin (@alsaada/rbac)', () => {
    const trustedOrigins = {
      localOrigin: 'http://localtest.me:3002',
      tunnelOrigin: 'https://enquirer-hardening-penny.ngrok-free.dev',
    };

    it('returns nextUrlOrigin directly if it matches localOrigin', async () => {
      const { resolveEffectiveRequestOrigin } = await import('../src/dashboard-auth.js');
      const origin = resolveEffectiveRequestOrigin('http://localtest.me:3002', undefined, trustedOrigins);
      expect(origin).toBe('http://localtest.me:3002');
    });

    it('returns nextUrlOrigin directly if it matches tunnelOrigin', async () => {
      const { resolveEffectiveRequestOrigin } = await import('../src/dashboard-auth.js');
      const origin = resolveEffectiveRequestOrigin('https://enquirer-hardening-penny.ngrok-free.dev', undefined, trustedOrigins);
      expect(origin).toBe('https://enquirer-hardening-penny.ngrok-free.dev');
    });

    it('resolves tunnelOrigin from reverse-proxy headers when nextUrlOrigin is internal localhost:3002', async () => {
      const { resolveEffectiveRequestOrigin } = await import('../src/dashboard-auth.js');
      const headers = new Map<string, string>([
        ['x-forwarded-proto', 'https'],
        ['x-forwarded-host', 'enquirer-hardening-penny.ngrok-free.dev'],
        ['host', 'localhost:3002'],
      ]);
      const origin = resolveEffectiveRequestOrigin('http://localhost:3002', headers, trustedOrigins);
      expect(origin).toBe('https://enquirer-hardening-penny.ngrok-free.dev');
    });

    it('resolves localOrigin from browser Host header when nextUrlOrigin is internal localhost:3002', async () => {
      const { resolveEffectiveRequestOrigin } = await import('../src/dashboard-auth.js');
      const headers = new Map<string, string>([
        ['host', 'localtest.me:3002'],
      ]);
      const origin = resolveEffectiveRequestOrigin('http://localhost:3002', headers, trustedOrigins);
      expect(origin).toBe('http://localtest.me:3002');
    });

    it('strictly rejects adversarial host header spoofing (evil.com) and falls back to untrusted nextUrlOrigin', async () => {
      const { resolveEffectiveRequestOrigin } = await import('../src/dashboard-auth.js');
      const headers = new Map<string, string>([
        ['x-forwarded-proto', 'https'],
        ['x-forwarded-host', 'evil.com'],
        ['host', 'evil.com'],
      ]);
      const origin = resolveEffectiveRequestOrigin('http://localhost:3002', headers, trustedOrigins);
      expect(origin).toBe('http://localhost:3002'); // NOT evil.com!
    });

    it('does NOT match localhost:3002 when developer accesses without localtest.me', async () => {
      const { resolveEffectiveRequestOrigin } = await import('../src/dashboard-auth.js');
      const headers = new Map<string, string>([
        ['host', 'localhost:3002'],
      ]);
      const origin = resolveEffectiveRequestOrigin('http://localhost:3002', headers, trustedOrigins);
      expect(origin).toBe('http://localhost:3002'); // Remains localhost:3002 which will fail exact-match with localtest.me:3002
    });

    it('resolves tunnelOrigin when x-forwarded-host contains comma-separated proxy chain', async () => {
      const { resolveEffectiveRequestOrigin } = await import('../src/dashboard-auth.js');
      const headers = new Map<string, string>([
        ['x-forwarded-proto', 'https'],
        ['x-forwarded-host', 'enquirer-hardening-penny.ngrok-free.dev, 10.0.0.1'],
      ]);
      const origin = resolveEffectiveRequestOrigin('http://localhost:3002', headers, trustedOrigins);
      expect(origin).toBe('https://enquirer-hardening-penny.ngrok-free.dev');
    });

    it('resolves tunnelOrigin when x-forwarded-host is uppercase (case-insensitive)', async () => {
      const { resolveEffectiveRequestOrigin } = await import('../src/dashboard-auth.js');
      const headers = new Map<string, string>([
        ['x-forwarded-proto', 'HTTPS'],
        ['x-forwarded-host', 'ENQUIRER-HARDENING-PENNY.NGROK-FREE.DEV'],
      ]);
      const origin = resolveEffectiveRequestOrigin('http://localhost:3002', headers, trustedOrigins);
      expect(origin).toBe('https://enquirer-hardening-penny.ngrok-free.dev');
    });

    it('resolves trusted origin from Host header if x-forwarded-host is untrusted', async () => {
      const { resolveEffectiveRequestOrigin } = await import('../src/dashboard-auth.js');
      const headers = new Map<string, string>([
        ['x-forwarded-host', 'untrusted-proxy.lan'],
        ['host', 'localtest.me:3002'],
      ]);
      const origin = resolveEffectiveRequestOrigin('http://localhost:3002', headers, trustedOrigins);
      expect(origin).toBe('http://localtest.me:3002');
    });
  });
});

