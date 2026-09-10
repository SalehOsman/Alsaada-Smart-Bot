import type { UserRole } from '../../shared/module.types.js';

const ALLOWED_IMPERSONATION_ROLES = new Set<UserRole>([
  'GENERAL_ADMIN',
  'FIELD_ADMIN',
  'WORKER',
  'SUPPLIER',
  'GUEST',
  'EXECUTIVE',
  'ACCOUNTANT',
]);

export function validateImpersonationRole(role: string): { isValid: boolean; role?: UserRole } {
  if (ALLOWED_IMPERSONATION_ROLES.has(role as UserRole)) {
    return { isValid: true, role: role as UserRole };
  }
  return { isValid: false };
}
