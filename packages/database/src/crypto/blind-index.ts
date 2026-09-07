import crypto from 'node:crypto';

/**
 * Computes a deterministic HMAC-SHA256 blind index hash for searchable encrypted fields.
 * Input is trimmed and lowercased to allow deterministic, case-insensitive lookups.
 */
export function createBlindIndex(value: string, salt: string): string {
  if (!value) return '';
  const normalized = value.trim().toLowerCase();
  return crypto.createHmac('sha256', salt).update(normalized).digest('hex');
}
