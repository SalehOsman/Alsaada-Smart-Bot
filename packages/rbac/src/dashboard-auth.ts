import type { CanonicalRole } from './types.js';

/**
 * Sovereign SSOT Contract for Bot-Only Dashboard Authentication & Server-Side Sessions
 * Compliance: PLAN-22 Stop-The-Line Remediation Package R1
 */

export const DASHBOARD_REPLY_BUTTON_TEXT = '🖥️ فتح لوحة التحكم' as const;

export const DASHBOARD_ALLOWED_ROLES: readonly CanonicalRole[] = [
  'SUPER_ADMIN',
  'GENERAL_ADMIN',
  'FIELD_ADMIN',
] as const;

export const DASHBOARD_AUTH_LINK_TTL_MINUTES = 5;
export const DASHBOARD_INITIAL_SESSION_HOURS = 8;
export const DASHBOARD_SESSION_EXTENSION_HOURS = 8;
export const DASHBOARD_MAX_SESSION_HOURS = 16;
export const DASHBOARD_MAX_CONCURRENT_SESSIONS = 3;
export const DASHBOARD_NOTICE_BEFORE_EXPIRY_MINUTES = 60;

/**
 * Normalizes an origin URL string to its canonical protocol + host (+ port if non-standard).
 * Rejects trailing slashes, paths, and query parameters.
 */
export function normalizeOrigin(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('INVALID_ORIGIN_URL: empty or non-string input');
  }

  const trimmed = rawUrl.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`INVALID_ORIGIN_PROTOCOL: unsupported protocol ${parsed.protocol}`);
    }
    return parsed.origin;
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith('INVALID_ORIGIN_PROTOCOL')) {
      throw err;
    }
    throw new Error(`INVALID_ORIGIN_FORMAT: cannot parse URL '${trimmed}'`);
  }
}

/**
 * Performs strict, case-sensitive literal equality check between two normalized origins.
 * Zero loose domain checks, zero blacklist reliance, zero substring matches.
 */
export function isExactOriginMatch(incomingOrigin: string, allowedTargetOrigin: string): boolean {
  if (!incomingOrigin || !allowedTargetOrigin) return false;
  try {
    const normIncoming = normalizeOrigin(incomingOrigin);
    const normTarget = normalizeOrigin(allowedTargetOrigin);
    return normIncoming === normTarget;
  } catch {
    return false;
  }
}

/**
 * Strict role validator for dashboard access.
 */
export function canAccessDashboardRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return (DASHBOARD_ALLOWED_ROLES as readonly string[]).includes(role as CanonicalRole);
}

/**
 * Strict 64-hex opaque token format validator.
 * Rejects legacy HMAC tokens with dots, short tokens, or non-hex characters.
 */
export function isValidOpaqueTokenFormat(token: unknown): token is string {
  if (typeof token !== 'string') return false;
  return /^[0-9a-f]{64}$/i.test(token.trim());
}
