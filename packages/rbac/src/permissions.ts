import type { CanonicalRole } from './types.js';

export const CONTRACTUAL_COMPENSATION_FIELDS = [
  'basicSalary',
  'dailyWage',
  'fixedAllowances',
  'allowances',
  'overtimeRate',
  'totalCompensation',
  'totalMonthlySalary',
  'basic_salary',
  'daily_wage',
  'fixed_allowances',
  'overtime_rate',
  'total_compensation',
  'total_monthly_salary',
] as const;

export const SENSITIVE_IDENTITY_FIELDS = [
  'nationalId',
  'national_id',
] as const;

export const NON_DELEGATABLE_PERMISSIONS: readonly string[] = [
  'system.roles.manage',
  'system.users.manage',
  'system.settings.manage',
  'system.audit.view',
  'system.backup.manage',
  'workforce.compensation.edit',
  'workforce.compensation.view',
  'finance.treasury.manage',
  'finance.ledger.sovereign',
  'approvals.sovereign.decide',
] as const;

const COMPENSATION_FIELDS_SET = new Set<string>(CONTRACTUAL_COMPENSATION_FIELDS);
const IDENTITY_FIELDS_SET = new Set<string>(SENSITIVE_IDENTITY_FIELDS);
const NON_DELEGATABLE_SET = new Set<string>(NON_DELEGATABLE_PERMISSIONS);

export function isNonDelegatable(permissionKey: string): boolean {
  return NON_DELEGATABLE_SET.has(permissionKey);
}

export function isFieldMasked(
  role: CanonicalRole | string,
  permissionKey: string,
  fieldName: string,
  context?: { isSelf?: boolean }
): boolean {
  const isCompensation = COMPENSATION_FIELDS_SET.has(fieldName);
  const isIdentity = IDENTITY_FIELDS_SET.has(fieldName);

  if (isCompensation) {
    // SUPER_ADMIN and GENERAL_ADMIN have full view access
    if (role === 'SUPER_ADMIN' || role === 'GENERAL_ADMIN') {
      return false;
    }
    // Workers can only view their own contractual compensation
    if ((role === 'WORKER' || role === 'WORKER_SUPERVISOR') && context?.isSelf === true) {
      return false;
    }
    // FIELD_ADMIN, other workers, suppliers, guests are strictly masked
    return true;
  }

  if (isIdentity) {
    if (role === 'SUPER_ADMIN' || role === 'GENERAL_ADMIN') {
      return false;
    }
    if (context?.isSelf === true) {
      return false;
    }
    return true;
  }

  return false;
}

export function getMaskedFields(
  role: CanonicalRole | string,
  permissionKey: string,
  context?: { isSelf?: boolean }
): string[] {
  const masked: string[] = [];
  for (const field of CONTRACTUAL_COMPENSATION_FIELDS) {
    if (isFieldMasked(role, permissionKey, field, context)) {
      masked.push(field);
    }
  }
  for (const field of SENSITIVE_IDENTITY_FIELDS) {
    if (isFieldMasked(role, permissionKey, field, context)) {
      masked.push(field);
    }
  }
  return masked;
}

export function projectSafeWorkerFields<T extends Record<string, any>>(
  worker: T,
  role: CanonicalRole | string,
  options?: { isSelf?: boolean }
): Partial<T> {
  const masked = new Set(getMaskedFields(role, 'workforce.compensation.view', options));
  const safe: Record<string, any> = {};

  for (const [key, value] of Object.entries(worker)) {
    if (!masked.has(key)) {
      safe[key] = value;
    }
  }

  return safe as Partial<T>;
}
