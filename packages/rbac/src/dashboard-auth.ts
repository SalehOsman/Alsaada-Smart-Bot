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

/**
 * Sovereign validator for dashboard origins.
 * Pure function, zero dependency on telemetry or network.
 * Strictly enforces http://localtest.me:<port> for local and https:// for tunnel.
 */
export function validateDashboardAuthOrigins(input: DashboardAuthOriginsInput): DashboardAuthOrigins {
  if (!input || typeof input !== 'object') {
    throw new DashboardAuthConfigError('INVALID_INPUT: input must be an object');
  }

  const { localUrl, tunnelUrl } = input;

  if (!localUrl || typeof localUrl !== 'string' || localUrl.trim() === '') {
    throw new DashboardAuthConfigError('MISSING_LOCAL_URL: DASHBOARD_LOCAL_URL is required');
  }

  if (!tunnelUrl || typeof tunnelUrl !== 'string' || tunnelUrl.trim() === '') {
    throw new DashboardAuthConfigError('MISSING_TUNNEL_URL: DASHBOARD_TUNNEL_URL is required');
  }

  let parsedLocal: URL;
  try {
    parsedLocal = new URL(localUrl.trim());
  } catch {
    throw new DashboardAuthConfigError(`INVALID_LOCAL_URL: cannot parse '${localUrl}' as URL`);
  }

  if (parsedLocal.protocol !== 'http:') {
    throw new DashboardAuthConfigError(`INVALID_LOCAL_PROTOCOL: local origin must use 'http:', got '${parsedLocal.protocol}'`);
  }

  if (parsedLocal.hostname !== 'localtest.me') {
    throw new DashboardAuthConfigError(`INVALID_LOCAL_HOSTNAME: local origin must use 'localtest.me', got '${parsedLocal.hostname}'`);
  }

  if (!parsedLocal.port || parsedLocal.port === '') {
    throw new DashboardAuthConfigError('MISSING_LOCAL_PORT: local origin must specify an explicit port');
  }

  const portNum = Number(parsedLocal.port);
  if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    throw new DashboardAuthConfigError(`INVALID_LOCAL_PORT: port must be between 1 and 65535, got '${parsedLocal.port}'`);
  }

  if (parsedLocal.pathname !== '/' && parsedLocal.pathname !== '') {
    throw new DashboardAuthConfigError(`INVALID_LOCAL_PATH: local origin must not have path, got '${parsedLocal.pathname}'`);
  }

  if (parsedLocal.search !== '') {
    throw new DashboardAuthConfigError('INVALID_LOCAL_QUERY: local origin must not contain query parameters');
  }

  if (parsedLocal.hash !== '') {
    throw new DashboardAuthConfigError('INVALID_LOCAL_HASH: local origin must not contain URL hash');
  }

  if (parsedLocal.username !== '' || parsedLocal.password !== '') {
    throw new DashboardAuthConfigError('INVALID_LOCAL_CREDENTIALS: local origin must not contain user credentials');
  }

  let parsedTunnel: URL;
  try {
    parsedTunnel = new URL(tunnelUrl.trim());
  } catch {
    throw new DashboardAuthConfigError(`INVALID_TUNNEL_URL: cannot parse '${tunnelUrl}' as URL`);
  }

  if (parsedTunnel.protocol !== 'https:') {
    throw new DashboardAuthConfigError(`INVALID_TUNNEL_PROTOCOL: tunnel origin must use 'https:', got '${parsedTunnel.protocol}'`);
  }

  if (!parsedTunnel.hostname || parsedTunnel.hostname.trim() === '') {
    throw new DashboardAuthConfigError('INVALID_TUNNEL_HOSTNAME: tunnel origin must have a valid hostname');
  }

  if (parsedTunnel.pathname !== '/' && parsedTunnel.pathname !== '') {
    throw new DashboardAuthConfigError(`INVALID_TUNNEL_PATH: tunnel origin must not have path, got '${parsedTunnel.pathname}'`);
  }

  if (parsedTunnel.search !== '') {
    throw new DashboardAuthConfigError('INVALID_TUNNEL_QUERY: tunnel origin must not contain query parameters');
  }

  if (parsedTunnel.hash !== '') {
    throw new DashboardAuthConfigError('INVALID_TUNNEL_HASH: tunnel origin must not contain URL hash');
  }

  if (parsedTunnel.username !== '' || parsedTunnel.password !== '') {
    throw new DashboardAuthConfigError('INVALID_TUNNEL_CREDENTIALS: tunnel origin must not contain user credentials');
  }

  const localOrigin = parsedLocal.origin;
  const tunnelOrigin = parsedTunnel.origin;

  if (localOrigin === tunnelOrigin) {
    throw new DashboardAuthConfigError('ORIGIN_COLLISION: local and tunnel origins must be distinct');
  }

  return {
    localOrigin,
    tunnelOrigin,
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

export interface RequestHeadersLike {
  get(name: string): string | null | undefined;
}

/**
 * Resolves the effective request origin for dashboard authentication.
 * In compliance with PLAN-22 & reverse-proxy tunnel standards:
 * - If nextUrlOrigin already exactly matches a trusted origin, it is used directly.
 * - If running in Node.js / Docker where nextUrlOrigin defaults to an internal bind (e.g. localhost:3002),
 *   it inspects reverse-proxy and host headers (x-forwarded-proto, x-forwarded-host, host)
 *   strictly validated against the sovereign trusted origins SSOT (localOrigin & tunnelOrigin).
 * - Untrusted or spoofed host headers (e.g. evil.com) are strictly rejected and never returned as trusted origins.
 */
export function resolveEffectiveRequestOrigin(
  nextUrlOrigin: string,
  headers: RequestHeadersLike | undefined,
  trustedOrigins: DashboardAuthOrigins
): string {
  if (!nextUrlOrigin || typeof nextUrlOrigin !== 'string') {
    throw new Error('INVALID_ORIGIN_URL: empty or non-string nextUrlOrigin');
  }

  let normNextUrl: string;
  try {
    normNextUrl = normalizeOrigin(nextUrlOrigin);
  } catch {
    return nextUrlOrigin;
  }

  // 1. If nextUrlOrigin already matches either trusted origin, use it immediately.
  if (
    isExactOriginMatch(normNextUrl, trustedOrigins.localOrigin) ||
    isExactOriginMatch(normNextUrl, trustedOrigins.tunnelOrigin)
  ) {
    return normNextUrl;
  }

  // 2. Check forwarded reverse-proxy and host headers if available
  if (headers && typeof headers.get === 'function') {
    const rawForwardedProto = headers.get('x-forwarded-proto');
    const candidateHosts: string[] = [];

    const fwdHost = headers.get('x-forwarded-host');
    if (fwdHost && typeof fwdHost === 'string') {
      const h = fwdHost.split(',')[0]!.trim().toLowerCase();
      if (h && !candidateHosts.includes(h)) candidateHosts.push(h);
    }
    const standardHost = headers.get('host');
    if (standardHost && typeof standardHost === 'string') {
      const h = standardHost.split(',')[0]!.trim().toLowerCase();
      if (h && !candidateHosts.includes(h)) candidateHosts.push(h);
    }

    if (candidateHosts.length > 0) {
      // Reconstruct candidate protocols: prefer x-forwarded-proto, then fallback to https and http
      const candidateProtos: string[] = [];
      if (rawForwardedProto && typeof rawForwardedProto === 'string') {
        const p = rawForwardedProto.split(',')[0]!.trim().toLowerCase();
        if (p === 'https' || p === 'http') {
          candidateProtos.push(p);
        }
      }
      if (!candidateProtos.includes('https')) candidateProtos.push('https');
      if (!candidateProtos.includes('http')) candidateProtos.push('http');

      for (const host of candidateHosts) {
        for (const proto of candidateProtos) {
          const candidateUrl = `${proto}://${host}`;
          // STRICT SECURITY GATE: candidateUrl MUST match one of the sovereign trusted origins!
          if (
            isExactOriginMatch(candidateUrl, trustedOrigins.localOrigin) ||
            isExactOriginMatch(candidateUrl, trustedOrigins.tunnelOrigin)
          ) {
            return normalizeOrigin(candidateUrl);
          }
        }
      }
    }
  }

  // 3. Fallback to normNextUrl (which will fail exact-match safely if untrusted)
  return normNextUrl;
}
