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
});

