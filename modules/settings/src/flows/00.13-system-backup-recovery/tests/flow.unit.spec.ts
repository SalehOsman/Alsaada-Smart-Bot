import { describe, it, expect } from 'vitest';
import {
  validateBackupConfirmationCode,
  validateBackupId,
  validateAdminRole,
} from '../flow.validators.js';

describe('Flow 00.13 Unit Tests — Validators & Security Invariants', () => {
  it('validates today confirmation code strictly with RESTORE-YYYYMMDD format', () => {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const validCode = `RESTORE-${todayStr}`;

    expect(validateBackupConfirmationCode(validCode)).toBe(true);
    expect(validateBackupConfirmationCode('RESTORE-20200101')).toBe(false);
    expect(validateBackupConfirmationCode('RESTORE-INVALID')).toBe(false);
    expect(validateBackupConfirmationCode('')).toBe(false);
  });

  it('validates backupId format (BCK-YYYYMMDD-HHMMSS)', () => {
    expect(validateBackupId('BCK-20260923-120000')).toBe(true);
    expect(validateBackupId('BCK-20260101-000000')).toBe(true);
    expect(validateBackupId('INVALID-ID')).toBe(false);
    expect(validateBackupId('')).toBe(false);
  });

  it('validates admin role immunity', () => {
    expect(validateAdminRole('SUPER_ADMIN')).toBe(true);
    expect(validateAdminRole('GENERAL_ADMIN')).toBe(true);
    expect(validateAdminRole('WORKER')).toBe(false);
    expect(validateAdminRole('FIELD_ADMIN')).toBe(false);
    expect(validateAdminRole('ACCOUNTANT')).toBe(false);
    expect(validateAdminRole('SUPPLIER')).toBe(false);
    expect(validateAdminRole('GUEST')).toBe(false);
  });
});
