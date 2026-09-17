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
    it('returns a typed success result for valid explicit origins', async () => {
      const { validateDashboardAuthOrigins } = await import('../src/dashboard-auth.js');
      const result = validateDashboardAuthOrigins({
        localUrl: 'http://localtest.me:3002',
        tunnelUrl: 'https://panel.alsaada.org',
      });
      expect(result).toEqual({
        ok: true,
        origins: {
          localOrigin: 'http://localtest.me:3002',
          tunnelOrigin: 'https://panel.alsaada.org',
        },
      });
    });

    it('returns canonical origins without throwing or exposing raw input', async () => {
      const { validateDashboardAuthOrigins } = await import('../src/dashboard-auth.js');
      const result = validateDashboardAuthOrigins({
        localUrl: 'http://localtest.me:3002/',
        tunnelUrl: 'https://tunnel.example.com/',
      });
      expect(result).toEqual({
        ok: true,
        origins: {
          localOrigin: 'http://localtest.me:3002',
          tunnelOrigin: 'https://tunnel.example.com',
        },
      });
    });

    it('returns LOCAL_URL_INVALID without throwing for forbidden local origins', async () => {
      const { validateDashboardAuthOrigins } = await import('../src/dashboard-auth.js');
      expect(validateDashboardAuthOrigins({
        localUrl: 'http://localhost:3002',
        tunnelUrl: 'https://tunnel.example.com',
      })).toEqual({ ok: false, code: 'LOCAL_URL_INVALID' });
      expect(validateDashboardAuthOrigins({
        localUrl: 'http://127.0.0.1.nip.io:3002',
        tunnelUrl: 'https://tunnel.example.com',
      })).toEqual({ ok: false, code: 'LOCAL_URL_INVALID' });
    });

    it('returns typed missing codes with zero any casts', async () => {
      const { validateDashboardAuthOrigins } = await import('../src/dashboard-auth.js');
      expect(validateDashboardAuthOrigins({})).toEqual({ ok: false, code: 'LOCAL_URL_MISSING' });
      expect(validateDashboardAuthOrigins({ localUrl: 'http://localtest.me:3002' })).toEqual({
        ok: false,
        code: 'TUNNEL_URL_MISSING',
      });
    });

    it('returns LOCAL_URL_INVALID for invalid port, path, query or credentials', async () => {
      const { validateDashboardAuthOrigins } = await import('../src/dashboard-auth.js');
      for (const localUrl of [
        'http://localtest.me',
        'http://localtest.me:99999',
        'http://localtest.me:3002/admin',
        'http://localtest.me:3002?foo=bar',
        'http://user:pass@localtest.me:3002',
      ]) {
        expect(validateDashboardAuthOrigins({
          localUrl,
          tunnelUrl: 'https://tunnel.example.com',
        })).toEqual({ ok: false, code: 'LOCAL_URL_INVALID' });
      }
    });

    it('returns TUNNEL_URL_INVALID for insecure or malformed tunnel origins', async () => {
      const { validateDashboardAuthOrigins } = await import('../src/dashboard-auth.js');
      for (const tunnelUrl of [
        'http://tunnel.example.com',
        'not-a-url',
        'https://user:pass@tunnel.example.com',
        'https://tunnel.example.com/admin',
      ]) {
        expect(validateDashboardAuthOrigins({
          localUrl: 'http://localtest.me:3002',
          tunnelUrl,
        })).toEqual({ ok: false, code: 'TUNNEL_URL_INVALID' });
      }
    });

    it('returns ORIGINS_NOT_DISTINCT when both canonical origins are identical', async () => {
      const { validateDashboardAuthOrigins } = await import('../src/dashboard-auth.js');
      expect(validateDashboardAuthOrigins({
        localUrl: 'http://localtest.me:3002',
        tunnelUrl: 'http://localtest.me:3002',
      })).toEqual({ ok: false, code: 'ORIGINS_NOT_DISTINCT' });
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

  it('does not export a request-origin resolver that reads Host headers', async () => {
    const dashboardAuthApi = await import('../src/dashboard-auth.js');
    expect('resolveEffectiveRequestOrigin' in dashboardAuthApi).toBe(false);
  });
});
