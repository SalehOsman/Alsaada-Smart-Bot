import type { CanonicalRole, DashboardAuthorizedRole } from './types.js';

export const CANONICAL_ROLES: readonly CanonicalRole[] = [
  'SUPER_ADMIN',
  'GENERAL_ADMIN',
  'FIELD_ADMIN',
  'WORKER_SUPERVISOR',
  'WORKER',
  'SUPPLIER',
  'GUEST',
] as const;

export const DASHBOARD_AUTHORIZED_ROLES: readonly DashboardAuthorizedRole[] = [
  'SUPER_ADMIN',
  'GENERAL_ADMIN',
  'FIELD_ADMIN',
] as const;

export const DEPRECATED_ROLES = [
  'EXECUTIVE',
  'EXECUTIVE_DIRECTOR',
  'ACCOUNTANT',
  'PROJECT_MANAGER',
  'SITE_ENGINEER',
  'ADMIN',
] as const;

const CANONICAL_ROLES_SET = new Set<string>(CANONICAL_ROLES);
const DASHBOARD_ROLES_SET = new Set<string>(DASHBOARD_AUTHORIZED_ROLES);

export function isCanonicalRole(role: unknown): role is CanonicalRole {
  return typeof role === 'string' && CANONICAL_ROLES_SET.has(role);
}

export function isDashboardAuthorizedRole(role: unknown): role is DashboardAuthorizedRole {
  return typeof role === 'string' && DASHBOARD_ROLES_SET.has(role);
}

export function canAccessDashboard(role: CanonicalRole | string): boolean {
  return DASHBOARD_ROLES_SET.has(role);
}

export function getRoleArabicName(role: CanonicalRole | string): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'سوبر أدمن';
    case 'GENERAL_ADMIN':
      return 'جينرال أدمن';
    case 'FIELD_ADMIN':
      return 'مشرف الموقع';
    case 'WORKER_SUPERVISOR':
      return 'عامل مشرف';
    case 'WORKER':
      return 'عامل';
    case 'SUPPLIER':
      return 'مورد';
    case 'GUEST':
      return 'زائر';
    default:
      return 'غير معروف';
  }
}
