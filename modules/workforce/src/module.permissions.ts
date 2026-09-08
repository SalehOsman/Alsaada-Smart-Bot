import type { UserRole } from './shared/module.types.js';

export const WORKFORCE_ALLOWED_ROLES: readonly UserRole[] = [
  'SUPER_ADMIN',
  'GENERAL_ADMIN',
  'FIELD_ADMIN',
  'ACCOUNTANT',
  'EXECUTIVE',
] as const;

export const WORKFORCE_EXPORT_FINANCIAL_ROLES: readonly UserRole[] = [
  'SUPER_ADMIN',
] as const;

export function canAccessWorkforceHub(role?: UserRole): boolean {
  if (!role) return false;
  return WORKFORCE_ALLOWED_ROLES.includes(role);
}

export function canExportFinancialData(isSuperAdmin?: boolean, role?: UserRole): boolean {
  return Boolean(isSuperAdmin) || role === 'SUPER_ADMIN';
}
