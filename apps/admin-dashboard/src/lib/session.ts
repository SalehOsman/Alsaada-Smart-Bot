export interface SessionPayload {
  userId: string;
  telegramId: string;
  role: string;
  name: string;
  sessionId?: string | null;
  assignedSiteId?: string | null;
  assignedSiteName?: string | null;
  isRealSuperAdmin?: boolean;
  createdAt: number;
}

const SESSION_SECRET =
  process.env.DATABASE_ENCRYPTION_KEY ||
  process.env.ENCRYPTION_KEY ||
  'alsaada-enterprise-session-secret-key-32-chars-long';

function bytesToBase64Url(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64url');
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(str: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(str, 'base64url'));
  }
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function computeHmac(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
  return bytesToBase64Url(new Uint8Array(sigBuffer));
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const enc = new TextEncoder();
  const dataStr = JSON.stringify(payload);
  const dataB64 = bytesToBase64Url(enc.encode(dataStr));
  const signature = await computeHmac(SESSION_SECRET, dataB64);
  return `${dataB64}.${signature}`;
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [dataB64, signature] = parts;
    if (!dataB64 || !signature) return null;

    const expectedSig = await computeHmac(SESSION_SECRET, dataB64);
    if (signature !== expectedSig) return null;

    const dec = new TextDecoder();
    const jsonBytes = base64UrlToBytes(dataB64);
    const json = dec.decode(jsonBytes);
    const payload = JSON.parse(json) as SessionPayload;

    // Strictly enforce 8-hour session TTL (matches database dashboard_sessions)
    const sessionTtlHours = parseInt(process.env.DASHBOARD_SESSION_TTL_HOURS || '8', 10);
    const maxAgeMs = sessionTtlHours * 3600 * 1000;
    if (Date.now() - payload.createdAt > maxAgeMs) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
