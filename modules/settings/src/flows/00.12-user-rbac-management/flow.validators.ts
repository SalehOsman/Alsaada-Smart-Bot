import { normalizeDigits } from '@alsaada/regional-engine';

export const VALID_RBAC_ROLES = [
  'SUPER_ADMIN',
  'EXECUTIVE',
  'FIELD_ADMIN',
  'ACCOUNTANT',
  'WORKER',
  'GUEST',
] as const;

export type ValidRbacRole = (typeof VALID_RBAC_ROLES)[number];

export function validateTelegramId(input: string): { isValid: boolean; normalizedId?: bigint | undefined; error?: string | undefined } {
  if (!input) {
    return { isValid: false, error: 'يرجى إدخال معرف التليجرام الرقمي.' };
  }

  const normalized = normalizeDigits(input).trim().replace(/[^0-9]/g, '');
  if (!normalized || normalized.length < 6 || normalized.length > 15) {
    return { isValid: false, error: 'معرف التليجرام غير صالح. يجب أن يتكون من 6 إلى 15 رقماً.' };
  }

  try {
    const id = BigInt(normalized);
    if (id <= 0n) {
      return { isValid: false, error: 'معرف التليجرام يجب أن يكون رقماً موجباً.' };
    }
    return { isValid: true, normalizedId: id };
  } catch {
    return { isValid: false, error: 'معرف التليجرام غير صالح.' };
  }
}

export function validateRole(role: string): boolean {
  return VALID_RBAC_ROLES.includes(role as ValidRbacRole);
}

export function validateSearchQuery(query: string): boolean {
  return Boolean(query && query.trim().length >= 1);
}
