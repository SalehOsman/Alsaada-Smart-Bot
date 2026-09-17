import type { CanonicalRole } from './types.js';

/**
 * Sovereign SSOT Contract for Bot-Only Dashboard Authentication & Server-Side Sessions
 * Compliance: PLAN-22 Stop-The-Line Remediation Package R1C-A-C1
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
 * Closed Discriminated Union representing all expected and typed claim failure codes.
 */
export type DashboardClaimFailureCode =
  | 'TOKEN_MISSING'
  | 'TOKEN_MALFORMED'
  | 'TOKEN_NOT_FOUND'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_ALREADY_CLAIMED'
  | 'ORIGIN_MISMATCH'
  | 'ROLE_UNAUTHORIZED'
  | 'MAX_SESSIONS_EXCEEDED'
  | 'CONFIG_ERROR'
  | 'DATABASE_ERROR'
  | 'INTERNAL_ERROR';

/**
 * Allowed HTTP status codes for the dashboard claim endpoint.
 */
export type DashboardClaimHttpStatus = 400 | 401 | 403 | 429 | 500 | 503;

/**
 * Static mapping between claim failure codes and their corresponding HTTP status codes.
 */
export const CLAIM_FAILURE_HTTP_STATUS_MAP: Record<DashboardClaimFailureCode, DashboardClaimHttpStatus> = {
  TOKEN_MISSING: 400,
  TOKEN_MALFORMED: 400,
  TOKEN_NOT_FOUND: 401,
  TOKEN_EXPIRED: 401,
  TOKEN_ALREADY_CLAIMED: 401,
  ORIGIN_MISMATCH: 403,
  ROLE_UNAUTHORIZED: 403,
  MAX_SESSIONS_EXCEEDED: 429,
  CONFIG_ERROR: 503,
  DATABASE_ERROR: 503,
  INTERNAL_ERROR: 500,
};

export class DashboardAuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DashboardAuthConfigError';
  }
}

export interface DashboardAuthOriginsInput {
  localUrl?: string;
  tunnelUrl?: string;
}

export interface DashboardAuthOrigins {
  localOrigin: string;
  tunnelOrigin: string;
}

export type DashboardAuthOriginsValidationCode =
  | 'LOCAL_URL_MISSING'
  | 'TUNNEL_URL_MISSING'
  | 'LOCAL_URL_INVALID'
  | 'TUNNEL_URL_INVALID'
  | 'ORIGINS_NOT_DISTINCT';

export type DashboardAuthOriginsResult =
  | { ok: true; origins: DashboardAuthOrigins }
  | { ok: false; code: DashboardAuthOriginsValidationCode };

/**
 * Sovereign validator for dashboard origins.
 * Pure function, zero dependency on telemetry or network.
 * Strictly enforces http://localtest.me:<port> for local and https:// for tunnel.
 */
export function validateDashboardAuthOrigins(input: DashboardAuthOriginsInput): DashboardAuthOriginsResult {
  if (!input || typeof input !== 'object' || !input.localUrl || typeof input.localUrl !== 'string' || input.localUrl.trim() === '') {
    return { ok: false, code: 'LOCAL_URL_MISSING' };
  }

  const { localUrl, tunnelUrl } = input;

  if (!tunnelUrl || typeof tunnelUrl !== 'string' || tunnelUrl.trim() === '') {
    return { ok: false, code: 'TUNNEL_URL_MISSING' };
  }

  if (localUrl.trim() === tunnelUrl.trim()) {
    return { ok: false, code: 'ORIGINS_NOT_DISTINCT' };
  }

  let parsedLocal: URL;
  try {
    parsedLocal = new URL(localUrl.trim());
  } catch {
    return { ok: false, code: 'LOCAL_URL_INVALID' };
  }

  if (parsedLocal.protocol !== 'http:') {
    return { ok: false, code: 'LOCAL_URL_INVALID' };
  }

  if (parsedLocal.hostname !== 'localtest.me') {
    return { ok: false, code: 'LOCAL_URL_INVALID' };
  }

  if (!parsedLocal.port || parsedLocal.port === '') {
    return { ok: false, code: 'LOCAL_URL_INVALID' };
  }

  const portNum = Number(parsedLocal.port);
  if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    return { ok: false, code: 'LOCAL_URL_INVALID' };
  }

  if (parsedLocal.pathname !== '/' && parsedLocal.pathname !== '') {
    return { ok: false, code: 'LOCAL_URL_INVALID' };
  }

  if (parsedLocal.search !== '') {
    return { ok: false, code: 'LOCAL_URL_INVALID' };
  }

  if (parsedLocal.hash !== '') {
    return { ok: false, code: 'LOCAL_URL_INVALID' };
  }

  if (parsedLocal.username !== '' || parsedLocal.password !== '') {
    return { ok: false, code: 'LOCAL_URL_INVALID' };
  }

  let parsedTunnel: URL;
  try {
    parsedTunnel = new URL(tunnelUrl.trim());
  } catch {
    return { ok: false, code: 'TUNNEL_URL_INVALID' };
  }

  if (parsedTunnel.protocol !== 'https:') {
    return { ok: false, code: 'TUNNEL_URL_INVALID' };
  }

  if (!parsedTunnel.hostname || parsedTunnel.hostname.trim() === '') {
    return { ok: false, code: 'TUNNEL_URL_INVALID' };
  }

  if (parsedTunnel.pathname !== '/' && parsedTunnel.pathname !== '') {
    return { ok: false, code: 'TUNNEL_URL_INVALID' };
  }

  if (parsedTunnel.search !== '') {
    return { ok: false, code: 'TUNNEL_URL_INVALID' };
  }

  if (parsedTunnel.hash !== '') {
    return { ok: false, code: 'TUNNEL_URL_INVALID' };
  }

  if (parsedTunnel.username !== '' || parsedTunnel.password !== '') {
    return { ok: false, code: 'TUNNEL_URL_INVALID' };
  }

  const localOrigin = parsedLocal.origin;
  const tunnelOrigin = parsedTunnel.origin;

  if (localOrigin === tunnelOrigin) {
    return { ok: false, code: 'ORIGINS_NOT_DISTINCT' };
  }

  return {
    ok: true,
    origins: {
      localOrigin,
      tunnelOrigin,
    },
  };
}

/**
 * Normalizes an origin URL string to its canonical protocol + host (+ port if non-standard).
 * Rejects trailing slashes, paths, and query parameters.
 */
export function normalizeOrigin(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('INVALID_ORIGIN_URL: empty or non-string input');
  }

  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`INVALID_ORIGIN_FORMAT: cannot parse URL '${trimmed}'`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`INVALID_ORIGIN_PROTOCOL: unsupported protocol ${parsed.protocol}`);
  }
  return parsed.origin;
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

