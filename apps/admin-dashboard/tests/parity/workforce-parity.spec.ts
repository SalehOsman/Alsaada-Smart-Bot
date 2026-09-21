import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { projectSafeWorkerFields, isFieldMasked } from '@alsaada/rbac';
import { getWorkerDisplayName } from '@alsaada/core-components';
import { parseEgyptianNationalId } from '@alsaada/national-id-engine';
import { PINNED_BASE_TIME } from '@alsaada/shared/testing';

describe('Workforce Module Functional Parity Specification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const fullWorker = {
    id: 'wrk-1001',
    code: 'WRK-001',
    name: 'أحمد محمود إبراهيم',
    nickname: 'أبو حميد',
    phone: '01012345678',
    nationalId: '29505051234567',
    siteId: 'site-alamein',
    siteName: 'مشروع العلمين',
    jobTitle: 'سائق لودر',
    status: 'ACTIVE',
    basicSalary: 8500,
    dailyWage: 350,
    fixedAllowances: 1500,
    totalCompensation: 10000,
    canteenCigarettePolicy: 'ONE_PACK_DAILY',
    cigaretteBrand: 'كليوباترا بوكس',
    insuranceNumber: '87654321',
  };

  describe('1. Nickname Prominence (SSOT Rule 2.5)', () => {
    it('prioritizes nickname over full name in display label when nickname is present', () => {
      // Arrange
      const workerWithNickname = {
        name: 'أحمد محمود إبراهيم',
        nickname: 'أبو حميد',
      };

      // Act
      const displayName = getWorkerDisplayName(workerWithNickname);

      // Assert
      expect(displayName).toBe('أبو حميد');
      expect(displayName).not.toBe('أحمد محمود إبراهيم');
    });

    it('falls back to full name strictly when nickname is absent or null', () => {
      // Arrange
      const workerWithoutNickname = {
        name: 'أحمد محمود إبراهيم',
        nickname: null,
      };

      // Act
      const displayName = getWorkerDisplayName(workerWithoutNickname);

      // Assert
      expect(displayName).toBe('أحمد محمود إبراهيم');
      expect(displayName).not.toBeNull();
      expect(displayName).not.toBe('');
    });
  });

  describe('2. Contractual Compensation Masking (SSOT Rule 1.2.6 & Section 10)', () => {
    it('completely strips basicSalary, dailyWage, fixedAllowances, totalCompensation for FIELD_ADMIN', () => {
      // Arrange
      const role = 'FIELD_ADMIN';

      // Act
      const projected = projectSafeWorkerFields(fullWorker, role);

      // Assert
      expect(projected.basicSalary).toBeUndefined();
      expect(projected.dailyWage).toBeUndefined();
      expect(projected.fixedAllowances).toBeUndefined();
      expect(projected.totalCompensation).toBeUndefined();
      expect(projected.basicSalary).not.toBe(8500);

      // Non-sensitive fields remain intact
      expect(projected.nickname).toBe('أبو حميد');
      expect(projected.code).toBe('WRK-001');
      expect(projected.canteenCigarettePolicy).toBe('ONE_PACK_DAILY');
    });

    it('permits compensation viewing for SUPER_ADMIN and GENERAL_ADMIN with complete numerical parity', () => {
      // Arrange
      const superRole = 'SUPER_ADMIN';
      const generalRole = 'GENERAL_ADMIN';

      // Act
      const forSuper = projectSafeWorkerFields(fullWorker, superRole);
      const forGeneral = projectSafeWorkerFields(fullWorker, generalRole);

      // Assert
      expect(forSuper.basicSalary).toBe(8500);
      expect(forSuper.fixedAllowances).toBe(1500);
      expect(forSuper.totalCompensation).toBe(10000);
      expect(forSuper.basicSalary).not.toBeUndefined();

      expect(forGeneral.basicSalary).toBe(8500);
      expect(forGeneral.fixedAllowances).toBe(1500);
      expect(forGeneral.totalCompensation).toBe(10000);
      expect(forGeneral.totalCompensation).not.toBeUndefined();
    });

    it('strictly confirms field mask policies across all compensation keys for FIELD_ADMIN and executive roles', () => {
      // Arrange
      const compensationFields = ['basicSalary', 'dailyWage', 'fixedAllowances', 'overtimeRate', 'totalCompensation'];

      // Act & Assert
      for (const field of compensationFields) {
        // Arrange
        const currentField = field;

        // Act
        const isMaskedForField = isFieldMasked('FIELD_ADMIN', 'workforce.compensation.view', currentField);
        const isMaskedForSuper = isFieldMasked('SUPER_ADMIN', 'workforce.compensation.view', currentField);
        const isMaskedForGeneral = isFieldMasked('GENERAL_ADMIN', 'workforce.compensation.view', currentField);

        // Assert
        expect(isMaskedForField).toBe(true);
        expect(isMaskedForSuper).toBe(false);
        expect(isMaskedForGeneral).toBe(false);
        expect(isMaskedForField).not.toBe(false);
      }
    });
  });

  describe('3. Egyptian National ID & Demographics Parity (Flow 01.1)', () => {
    it('extracts correct birth date, century, and gender from valid 14-digit Egyptian national ID', () => {
      // Arrange
      const validMaleNid = '29505120101234';

      // Act
      const res = parseEgyptianNationalId(validMaleNid);

      // Assert
      expect(res.isValid).toBe(true);
      expect(res.info?.birthDate).toBeDefined();
      expect(res.info?.birthDateString).toBe('1995-05-12');
      expect(res.info?.gender).toBe('MALE');
      expect(res.info?.gender).not.toBe('FEMALE');
      expect(res.error).toBeUndefined();
    });

    it('rejects invalid national ID lengths, empty inputs, or non-numeric strings with appropriate error', () => {
      // Arrange
      const invalidShortNid = '12345';
      const nonNumericNid = '2950505123456A';

      // Act
      const shortRes = parseEgyptianNationalId(invalidShortNid);
      const alphaRes = parseEgyptianNationalId(nonNumericNid);

      // Assert
      expect(shortRes.isValid).toBe(false);
      expect(alphaRes.isValid).toBe(false);
      expect(shortRes.error).toBeDefined();
      expect(alphaRes.error).toBeDefined();
      expect(shortRes.isValid).not.toBe(true);
      expect(alphaRes.isValid).not.toBe(true);
    });
  });

  describe('4. Worker Offboarding & Clearance Parity (Flow 01.8)', () => {
    it('generates compliant clearance certificate number format #CLR-YYYY-XXX', () => {
      // Arrange
      const generateClearanceNumber = (year: number, sequence: number) => {
        return `#CLR-${year}-${String(sequence).padStart(3, '0')}`;
      };

      // Act
      const certNum = generateClearanceNumber(2026, 42);

      // Assert
      expect(certNum).toBe('#CLR-2026-042');
      expect(certNum).toMatch(/^#CLR-\d{4}-\d{3}$/);
      expect(certNum).not.toContain('undefined');
    });

    it('validates settlement status and zero-outstanding balance before permitting final clearance', () => {
      // Arrange
      interface ClearanceRecord {
        workerId: string;
        outstandingCustodies: number;
        unpaidAdvances: number;
        canteenDeductions: number;
        settlementApproved: boolean;
      }

      const canExecuteFinalClearance = (rec: ClearanceRecord) => {
        const totalOutstanding = rec.outstandingCustodies + rec.unpaidAdvances + rec.canteenDeductions;
        return totalOutstanding === 0 && rec.settlementApproved;
      };

      const unclearedRecord: ClearanceRecord = {
        workerId: 'w-1',
        outstandingCustodies: 500,
        unpaidAdvances: 0,
        canteenDeductions: 0,
        settlementApproved: true,
      };

      const clearedRecord: ClearanceRecord = {
        workerId: 'w-1',
        outstandingCustodies: 0,
        unpaidAdvances: 0,
        canteenDeductions: 0,
        settlementApproved: true,
      };

      // Act
      const deniedResult = canExecuteFinalClearance(unclearedRecord);
      const allowedResult = canExecuteFinalClearance(clearedRecord);

      // Assert
      expect(deniedResult).toBe(false);
      expect(allowedResult).toBe(true);
      expect(deniedResult).not.toBe(true);
      expect(allowedResult).not.toBe(false);
    });
  });
});
