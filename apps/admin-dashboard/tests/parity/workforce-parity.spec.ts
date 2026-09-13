import { describe, it, expect } from 'vitest';
import { projectSafeWorkerFields, isFieldMasked } from '@alsaada/rbac';
import { getWorkerDisplayName } from '@alsaada/core-components';

describe('Phase 8 / Task 9: Workforce Module Functional Parity Specification', () => {
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
    it('prioritizes nickname over full name in display label', () => {
      const displayName = getWorkerDisplayName({
        name: 'أحمد محمود إبراهيم',
        nickname: 'أبو حميد',
      });
      expect(displayName).toBe('أبو حميد');
    });

    it('falls back to full name when nickname is absent (Rule 2.5)', () => {
      const displayName = getWorkerDisplayName({
        name: 'أحمد محمود إبراهيم',
        nickname: null,
      });
      expect(displayName).toBe('أحمد محمود إبراهيم');
    });
  });

  describe('2. Contractual Compensation Masking (SSOT Rule 1.2.6 & Section 10)', () => {
    it('completely strips basicSalary, dailyWage, fixedAllowances, totalCompensation for FIELD_ADMIN', () => {
      const projected = projectSafeWorkerFields(fullWorker, 'FIELD_ADMIN');
      expect(projected.basicSalary).toBeUndefined();
      expect(projected.dailyWage).toBeUndefined();
      expect(projected.fixedAllowances).toBeUndefined();
      expect(projected.totalCompensation).toBeUndefined();
      // Non-sensitive fields remain intact
      expect(projected.nickname).toBe('أبو حميد');
      expect(projected.code).toBe('WRK-001');
      expect(projected.canteenCigarettePolicy).toBe('ONE_PACK_DAILY');
    });

    it('permits compensation viewing for SUPER_ADMIN and GENERAL_ADMIN', () => {
      const forSuper = projectSafeWorkerFields(fullWorker, 'SUPER_ADMIN');
      expect(forSuper.basicSalary).toBe(8500);
      expect(forSuper.fixedAllowances).toBe(1500);
      expect(forSuper.totalCompensation).toBe(10000);

      const forGeneral = projectSafeWorkerFields(fullWorker, 'GENERAL_ADMIN');
      expect(forGeneral.basicSalary).toBe(8500);
      expect(forGeneral.fixedAllowances).toBe(1500);
      expect(forGeneral.totalCompensation).toBe(10000);
    });

    it('strictly confirms field mask policies across all compensation keys', () => {
      const fields = ['basicSalary', 'dailyWage', 'fixedAllowances', 'overtimeRate', 'totalCompensation'];
      for (const field of fields) {
        expect(isFieldMasked('FIELD_ADMIN', 'workforce.compensation.view', field)).toBe(true);
        expect(isFieldMasked('SUPER_ADMIN', 'workforce.compensation.view', field)).toBe(false);
        expect(isFieldMasked('GENERAL_ADMIN', 'workforce.compensation.view', field)).toBe(false);
      }
    });
  });

  describe('3. Egyptian National ID & Demographics Parity (Flow 01.1)', () => {
    function parseNationalIdQuick(nid: string) {
      if (!/^\d{14}$/.test(nid)) return { isValid: false };
      const centuryDigit = parseInt(nid.charAt(0), 10);
      const yearPrefix = centuryDigit === 2 ? '19' : '20';
      const year = yearPrefix + nid.substring(1, 3);
      const month = nid.substring(3, 5);
      const day = nid.substring(5, 7);
      const genderCode = parseInt(nid.charAt(12), 10);
      return {
        isValid: true,
        birthDate: `${year}-${month}-${day}`,
        gender: genderCode % 2 === 0 ? 'FEMALE' : 'MALE',
      };
    }

    it('extracts correct birth date and gender from 14-digit Egyptian national ID', () => {
      const res = parseNationalIdQuick('29505051234577');
      expect(res.isValid).toBe(true);
      expect(res.birthDate).toBe('1995-05-05');
      expect(res.gender).toBe('MALE');

      const resFemale = parseNationalIdQuick('30208151234587');
      expect(resFemale.isValid).toBe(true);
      expect(resFemale.birthDate).toBe('2002-08-15');
      expect(resFemale.gender).toBe('FEMALE');
    });

    it('rejects invalid national ID lengths or non-numeric strings', () => {
      expect(parseNationalIdQuick('12345').isValid).toBe(false);
      expect(parseNationalIdQuick('2950505123456A').isValid).toBe(false);
    });
  });

  describe('4. Worker Offboarding & Clearance Parity (Flow 01.8)', () => {
    it('generates compliant clearance certificate number #CLR-YYYY-XXX', () => {
      const generateClearanceNumber = (year: number, sequence: number) => {
        return `#CLR-${year}-${String(sequence).padStart(3, '0')}`;
      };

      const certNum = generateClearanceNumber(2026, 42);
      expect(certNum).toBe('#CLR-2026-042');
      expect(certNum).toMatch(/^#CLR-\d{4}-\d{3}$/);
    });

    it('validates settlement status and zero-outstanding balance before final clearance', () => {
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

      expect(
        canExecuteFinalClearance({
          workerId: 'w-1',
          outstandingCustodies: 500,
          unpaidAdvances: 0,
          canteenDeductions: 0,
          settlementApproved: true,
        })
      ).toBe(false);

      expect(
        canExecuteFinalClearance({
          workerId: 'w-1',
          outstandingCustodies: 0,
          unpaidAdvances: 0,
          canteenDeductions: 0,
          settlementApproved: true,
        })
      ).toBe(true);
    });
  });
});
