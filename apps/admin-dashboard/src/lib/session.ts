/**
 * Pure database-backed opaque session token generation, hashing, and validation.
 * Compatible with Edge Runtime and Node.js via standard Web Crypto API.
 */

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Validates whether a token matches the strict raw 32-byte hex opaque format (64 characters).
 */
export function isValidOpaqueTokenFormat(token: string | undefined | null): boolean {
  if (!token || typeof token !== 'string') return false;
  return /^[0-9a-f]{64}$/i.test(token.trim());
}

/**
 * Compute SHA-256 hash of an opaque token using Web Crypto API.
 */
export async function hashSessionToken(token: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(token.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(hashBuffer));
}

/**
 * Generate a new cryptographically secure 32-byte random hex opaque token and its SHA-256 hash.
 */
export async function generateOpaqueSessionToken(): Promise<{ rawToken: string; tokenHash: string }> {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const rawToken = bytesToHex(randomBytes);
  const tokenHash = await hashSessionToken(rawToken);
  return { rawToken, tokenHash };
}

