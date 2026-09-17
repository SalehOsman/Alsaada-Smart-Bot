import {
  normalizeOrigin,
  isExactOriginMatch,
  type DashboardAuthOrigins,
} from './dashboard-auth.js';

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
