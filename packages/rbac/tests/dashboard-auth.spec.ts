import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
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
  validateDashboardAuthOrigins,
  CLAIM_FAILURE_HTTP_STATUS_MAP,
} from '../src/dashboard-auth.js';

describe('Dashboard Auth Contract SSOT (@alsaada/rbac)', () => {
  const PINNED_BASE_TIME = new Date('2026-03-03T12:00:00.000Z');
  let stdoutSpy: { mockRestore: () => void };
  let stderrSpy: { mockRestore: () => void };
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleInfoSpy.mockRestore();
  });

  it('strictly defines exact constants matching PLAN-22 specifications', () => {
    // Arrange
    const expectedRoles = ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'];

    // Act
    const buttonText = DASHBOARD_REPLY_BUTTON_TEXT;
    const linkTtl = DASHBOARD_AUTH_LINK_TTL_MINUTES;
    const initSession = DASHBOARD_INITIAL_SESSION_HOURS;
    const extSession = DASHBOARD_SESSION_EXTENSION_HOURS;
    const maxSession = DASHBOARD_MAX_SESSION_HOURS;
    const maxConcurrent = DASHBOARD_MAX_CONCURRENT_SESSIONS;
    const noticeBefore = DASHBOARD_NOTICE_BEFORE_EXPIRY_MINUTES;
    const allowedRoles = DASHBOARD_ALLOWED_ROLES;

    // Assert
    expect(buttonText).toBe('🖥️ فتح لوحة التحكم');
    expect(linkTtl).toBe(5);
    expect(initSession).toBe(8);
    expect(extSession).toBe(8);
    expect(maxSession).toBe(16);
    expect(maxConcurrent).toBe(3);
    expect(noticeBefore).toBe(60);
    expect(allowedRoles).toEqual(expectedRoles);
  });

  it('correctly normalizes valid URLs to their canonical origins', () => {
    // Arrange
    const url1 = 'http://localhost:3002';
    const url2 = 'http://localhost:3002/';
    const url3 = 'http://localhost:3002/api/auth/claim?token=xyz';
    const url4 = 'https://panel.alsaada.org/admin/dashboard';
    const url5 = 'https://tunnel.example.org:8443/';

    // Act
    const norm1 = normalizeOrigin(url1);
    const norm2 = normalizeOrigin(url2);
    const norm3 = normalizeOrigin(url3);
    const norm4 = normalizeOrigin(url4);
    const norm5 = normalizeOrigin(url5);

    // Assert
    expect(norm1).toBe('http://localhost:3002');
    expect(norm2).toBe('http://localhost:3002');
    expect(norm3).toBe('http://localhost:3002');
    expect(norm4).toBe('https://panel.alsaada.org');
    expect(norm5).toBe('https://tunnel.example.org:8443');
  });

  it('rejects invalid or unsafe URL schemes during normalization', () => {
    // Arrange
    const jsScheme = 'javascript:alert(1)';
    const dataScheme = 'data:text/html,<h1>bad</h1>';
    const emptyUrl = '';
    const malformedUrl = 'not-a-url';

    // Act
    const testJs = () => normalizeOrigin(jsScheme);
    const testData = () => normalizeOrigin(dataScheme);
    const testEmpty = () => normalizeOrigin(emptyUrl);
    const testMalformed = () => normalizeOrigin(malformedUrl);

    // Assert
    expect(testJs).toThrow('INVALID_ORIGIN_PROTOCOL');
    expect(testData).toThrow('INVALID_ORIGIN_PROTOCOL');
    expect(testEmpty).toThrow('INVALID_ORIGIN_URL');
    expect(testMalformed).toThrow('INVALID_ORIGIN_FORMAT');
  });

  it('strictly validates literal exact origin matches', () => {
    // Arrange
    const localA = 'http://localhost:3002';
    const localB = 'http://localhost:3002/';
    const panelA = 'https://panel.alsaada.org/api/auth';
    const panelB = 'https://panel.alsaada.org';
    const spoofSubdomain = 'http://localhost:3002.evil.com';
    const evilHost = 'http://evil.attacker.com';
    const differentPort = 'http://localhost:3003';
    const httpsVsHttp = 'https://localhost:3002';

    // Act
    const matchValid1 = isExactOriginMatch(localA, localB);
    const matchValid2 = isExactOriginMatch(panelA, panelB);
    const matchSpoof = isExactOriginMatch(spoofSubdomain, localA);
    const matchEvil = isExactOriginMatch(evilHost, localA);
    const matchPort = isExactOriginMatch(differentPort, localA);
    const matchProto = isExactOriginMatch(httpsVsHttp, localA);

    // Assert
    expect(matchValid1).toBe(true);
    expect(matchValid2).toBe(true);
    expect(matchSpoof).toBe(false);
    expect(matchEvil).toBe(false);
    expect(matchPort).toBe(false);
    expect(matchProto).toBe(false);
  });

  it('strictly allows only the 3 canonical administrative roles', () => {
    // Arrange
    const superAdmin = 'SUPER_ADMIN';
    const genAdmin = 'GENERAL_ADMIN';
    const fieldAdmin = 'FIELD_ADMIN';
    const supervisor = 'WORKER_SUPERVISOR';
    const worker = 'WORKER';
    const supplier = 'SUPPLIER';
    const guest = 'GUEST';

    // Act
    const allowSuper = canAccessDashboardRole(superAdmin);
    const allowGen = canAccessDashboardRole(genAdmin);
    const allowField = canAccessDashboardRole(fieldAdmin);
    const denySupervisor = canAccessDashboardRole(supervisor);
    const denyWorker = canAccessDashboardRole(worker);
    const denySupplier = canAccessDashboardRole(supplier);
    const denyGuest = canAccessDashboardRole(guest);
    const denyNull = canAccessDashboardRole(null);
    const denyUndefined = canAccessDashboardRole(undefined);
    const denyUnknown = canAccessDashboardRole('UNKNOWN');

    // Assert
    expect(allowSuper).toBe(true);
    expect(allowGen).toBe(true);
    expect(allowField).toBe(true);
    expect(denySupervisor).toBe(false);
    expect(denyWorker).toBe(false);
    expect(denySupplier).toBe(false);
    expect(denyGuest).toBe(false);
    expect(denyNull).toBe(false);
    expect(denyUndefined).toBe(false);
    expect(denyUnknown).toBe(false);
  });

  it('strictly validates 64-hex opaque token format', () => {
    // Arrange
    const valid64a = 'a'.repeat(64);
    const valid64Hex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const tooShort = 'a'.repeat(63);
    const tooLong = 'a'.repeat(65);
    const nonHex = 'xyz'.repeat(21) + 'x';
    const jwtFormat = 'header.payload.signature';

    // Act
    const checkValidA = isValidOpaqueTokenFormat(valid64a);
    const checkValidHex = isValidOpaqueTokenFormat(valid64Hex);
    const checkTooShort = isValidOpaqueTokenFormat(tooShort);
    const checkTooLong = isValidOpaqueTokenFormat(tooLong);
    const checkNonHex = isValidOpaqueTokenFormat(nonHex);
    const checkJwt = isValidOpaqueTokenFormat(jwtFormat);
    const checkNull = isValidOpaqueTokenFormat(null);
    const checkNum = isValidOpaqueTokenFormat(12345);

    // Assert
    expect(checkValidA).toBe(true);
    expect(checkValidHex).toBe(true);
    expect(checkTooShort).toBe(false);
    expect(checkTooLong).toBe(false);
    expect(checkNonHex).toBe(false);
    expect(checkJwt).toBe(false);
    expect(checkNull).toBe(false);
    expect(checkNum).toBe(false);
  });

  describe('validateDashboardAuthOrigins (@alsaada/rbac)', () => {
    it('returns a typed success result for valid explicit origins', () => {
      // Arrange
      const input = {
        localUrl: 'http://localtest.me:3002',
        tunnelUrl: 'https://panel.alsaada.org',
      };

      // Act
      const result = validateDashboardAuthOrigins(input);

      // Assert
      expect(result).toEqual({
        ok: true,
        origins: {
          localOrigin: 'http://localtest.me:3002',
          tunnelOrigin: 'https://panel.alsaada.org',
        },
      });
    });

    it('returns canonical origins without throwing or exposing raw input', () => {
      // Arrange
      const input = {
        localUrl: 'http://localtest.me:3002/',
        tunnelUrl: 'https://tunnel.example.com/',
      };

      // Act
      const result = validateDashboardAuthOrigins(input);

      // Assert
      expect(result).toEqual({
        ok: true,
        origins: {
          localOrigin: 'http://localtest.me:3002',
          tunnelOrigin: 'https://tunnel.example.com',
        },
      });
    });

    it('returns LOCAL_URL_INVALID without throwing for forbidden local origins', () => {
      // Arrange
      const forbiddenLocalhost = {
        localUrl: 'http://localhost:3002',
        tunnelUrl: 'https://tunnel.example.com',
      };
      const forbiddenNipIo = {
        localUrl: 'http://127.0.0.1.nip.io:3002',
        tunnelUrl: 'https://tunnel.example.com',
      };

      // Act
      const res1 = validateDashboardAuthOrigins(forbiddenLocalhost);
      const res2 = validateDashboardAuthOrigins(forbiddenNipIo);

      // Assert
      expect(res1).toEqual({ ok: false, code: 'LOCAL_URL_INVALID' });
      expect(res2).toEqual({ ok: false, code: 'LOCAL_URL_INVALID' });
    });

    it('returns typed missing codes with zero any casts', () => {
      // Arrange
      const emptyInput = {};
      const missingTunnelInput = { localUrl: 'http://localtest.me:3002' };

      // Act
      const resEmpty = validateDashboardAuthOrigins(emptyInput);
      const resMissingTunnel = validateDashboardAuthOrigins(missingTunnelInput);

      // Assert
      expect(resEmpty).toEqual({ ok: false, code: 'LOCAL_URL_MISSING' });
      expect(resMissingTunnel).toEqual({
        ok: false,
        code: 'TUNNEL_URL_MISSING',
      });
    });

    it('returns LOCAL_URL_INVALID for invalid port, path, query or credentials', () => {
      // Arrange
      const invalidUrls = [
        'http://localtest.me',
        'http://localtest.me:99999',
        'http://localtest.me:3002/admin',
        'http://localtest.me:3002?foo=bar',
        'http://user:pass@localtest.me:3002',
      ];

      // Act
      const results = invalidUrls.map((localUrl) =>
        validateDashboardAuthOrigins({
          localUrl,
          tunnelUrl: 'https://tunnel.example.com',
        })
      );

      // Assert
      expect(results).toHaveLength(5);
      results.forEach((res) => {
        expect(res).toEqual({ ok: false, code: 'LOCAL_URL_INVALID' });
      });
    });

    it('returns TUNNEL_URL_INVALID for insecure or malformed tunnel origins', () => {
      // Arrange
      const invalidTunnels = [
        'http://tunnel.example.com',
        'not-a-url',
        'https://user:pass@tunnel.example.com',
        'https://tunnel.example.com/admin',
      ];

      // Act
      const results = invalidTunnels.map((tunnelUrl) =>
        validateDashboardAuthOrigins({
          localUrl: 'http://localtest.me:3002',
          tunnelUrl,
        })
      );

      // Assert
      expect(results).toHaveLength(4);
      results.forEach((res) => {
        expect(res).toEqual({ ok: false, code: 'TUNNEL_URL_INVALID' });
      });
    });

    it('returns ORIGINS_NOT_DISTINCT when both canonical origins are identical', () => {
      // Arrange
      const identicalOrigins = {
        localUrl: 'http://localtest.me:3002',
        tunnelUrl: 'http://localtest.me:3002',
      };

      // Act
      const result = validateDashboardAuthOrigins(identicalOrigins);

      // Assert
      expect(result).toEqual({ ok: false, code: 'ORIGINS_NOT_DISTINCT' });
    });
  });

  describe('CLAIM_FAILURE_HTTP_STATUS_MAP (@alsaada/rbac)', () => {
    it('maps every DashboardClaimFailureCode to the exact HTTP status specified in PLAN-22', () => {
      // Arrange
      const map = CLAIM_FAILURE_HTTP_STATUS_MAP;

      // Act
      const tokenMissingStatus = map.TOKEN_MISSING;
      const tokenMalformedStatus = map.TOKEN_MALFORMED;
      const tokenNotFoundStatus = map.TOKEN_NOT_FOUND;
      const tokenExpiredStatus = map.TOKEN_EXPIRED;
      const tokenClaimedStatus = map.TOKEN_ALREADY_CLAIMED;
      const originMismatchStatus = map.ORIGIN_MISMATCH;
      const roleUnauthorizedStatus = map.ROLE_UNAUTHORIZED;
      const maxSessionsStatus = map.MAX_SESSIONS_EXCEEDED;
      const configErrorStatus = map.CONFIG_ERROR;
      const dbErrorStatus = map.DATABASE_ERROR;
      const internalErrorStatus = map.INTERNAL_ERROR;

      // Assert
      expect(tokenMissingStatus).toBe(400);
      expect(tokenMalformedStatus).toBe(400);
      expect(tokenNotFoundStatus).toBe(401);
      expect(tokenExpiredStatus).toBe(401);
      expect(tokenClaimedStatus).toBe(401);
      expect(originMismatchStatus).toBe(403);
      expect(roleUnauthorizedStatus).toBe(403);
      expect(maxSessionsStatus).toBe(429);
      expect(configErrorStatus).toBe(503);
      expect(dbErrorStatus).toBe(503);
      expect(internalErrorStatus).toBe(500);
    });
  });

  it('does not export a request-origin resolver that reads Host headers', async () => {
    // Arrange
    const forbiddenExport = 'resolveEffectiveRequestOrigin';

    // Act
    const dashboardAuthApi = await import('../src/dashboard-auth.js');
    const isExported = forbiddenExport in dashboardAuthApi;

    // Assert
    expect(isExported).toBe(false);
  });
});
