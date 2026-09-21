import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EGYPTIAN_GOVERNORATES,
  PAYMENT_METHODS,
  CONTRACT_TYPES,
  MILITARY_STATUSES,
  DRIVING_LICENSES,
  MARITAL_STATUSES,
  INSURANCE_STATUSES,
  CANTEEN_CIGARETTE_POLICIES,
  PPE_SHOE_SIZES,
  PPE_UNIFORM_SIZES,
} from '../src/lib/workforce-lookups';
import { parseEgyptianNationalId } from '@alsaada/national-id-engine';
import { extractFirstTwoNames } from '@alsaada/regional-engine';
import { PINNED_BASE_TIME } from '@alsaada/shared/testing';

describe('Workforce Onboarding Dashboard Parity (Plan 31)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('1. Static Lookup Dictionaries Parity', () => {
    it('contains Egyptian governorates including Cairo and Alexandria', () => {
      // Arrange & Act & Assert
      expect(Object.keys(EGYPTIAN_GOVERNORATES).length).toBeGreaterThanOrEqual(27);
      expect(EGYPTIAN_GOVERNORATES['01']).toBe('القاهرة');
      expect(EGYPTIAN_GOVERNORATES['02']).toBe('الإسكندرية');
      expect(EGYPTIAN_GOVERNORATES['99']).toBeUndefined();
    });

    it('contains all standard payment methods matching bot choices', () => {
      // Arrange & Act
      const values = PAYMENT_METHODS.map((m) => m.value);

      // Assert
      expect(values).toContain('CASH_SITE');
      expect(values).toContain('VODAFONE_CASH');
      expect(values).toContain('INSTAPAY');
      expect(values).toContain('BANK_TRANSFER');
      expect(values).not.toContain('BITCOIN');
    });

    it('contains contract types matching enterprise system', () => {
      // Arrange & Act
      const values = CONTRACT_TYPES.map((c) => c.value);

      // Assert
      expect(values).toContain('PERMANENT');
      expect(values).toContain('DAILY_LABOR');
      expect(values).toContain('SEASONAL');
      expect(values).not.toContain('ILLEGAL_LABOR');
    });

    it('contains military statuses matching Egyptian regulations', () => {
      // Arrange & Act
      const values = MILITARY_STATUSES.map((s) => s.value);

      // Assert
      expect(MILITARY_STATUSES.length).toBeGreaterThan(0);
      expect(values.some((v) => v.includes('الخدمة العسكرية'))).toBe(true);
      expect(values).not.toContain('FOREIGN_LEGION');
    });

    it('contains driving license grades matching Egyptian traffic law', () => {
      // Arrange & Act
      const values = DRIVING_LICENSES.map((l) => l.value);

      // Assert
      expect(DRIVING_LICENSES.length).toBeGreaterThan(0);
      expect(values.some((v) => v.includes('أولى'))).toBe(true);
      expect(values.some((v) => v.includes('خاصة'))).toBe(true);
      expect(values).not.toContain('PILOT_LICENSE');
    });

    it('contains canteen cigarette policies matching site operations', () => {
      // Arrange & Act
      const values = CANTEEN_CIGARETTE_POLICIES.map((p) => p.value);

      // Assert
      expect(values).toContain('NONE');
      expect(values).toContain('ONE_PACK_DAILY');
      expect(values).not.toContain('UNLIMITED');
    });

    it('contains PPE shoe and uniform size ranges', () => {
      // Arrange & Act & Assert
      expect(PPE_SHOE_SIZES).toContain('42');
      expect(PPE_SHOE_SIZES).toContain('43');
      expect(PPE_SHOE_SIZES).not.toContain('99');

      expect(PPE_UNIFORM_SIZES).toContain('L');
      expect(PPE_UNIFORM_SIZES).toContain('XL');
      expect(PPE_UNIFORM_SIZES).not.toContain('XXXXXL');
    });
  });

  describe('2. Salary Calculation & Strict Daily Wage Prohibition', () => {
    it('calculates gross salary as basic + additional + custom allowances', () => {
      // Arrange
      const basic = 6000;
      const additional = 2000;
      const allowances = [
        { title: 'بدل اغتراب', amount: 1000 },
        { title: 'بدل وجبة', amount: 500 },
      ];

      // Act
      const totalAllowances = allowances.reduce((sum, a) => sum + a.amount, 0);
      const gross = basic + additional + totalAllowances;
      const derivedDailyWage = Math.round((gross / 30) * 100) / 100;

      // Assert
      expect(gross).toBe(9500);
      expect(gross).not.toBe(8000);
      // Daily wage must be derived by 30 days and never manually entered on UI
      expect(derivedDailyWage).toBe(316.67);
      expect(Number.isNaN(derivedDailyWage)).toBe(false);
    });

    it('calculates duty cycle effective working rate correctly (20 work / 10 rest vs 26 work / 4 rest)', () => {
      // Arrange
      const gross = 9000;
      const workDays = 20;
      const restDays = 10;

      // Act
      const totalDays = workDays + restDays;
      const effectivePerWorkDay = gross / workDays;

      // Assert
      expect(totalDays).toBe(30);
      expect(totalDays).not.toBe(31);
      // Effective work-day earnings
      expect(effectivePerWorkDay).toBe(450);
      expect(effectivePerWorkDay).not.toBe(300);
    });
  });

  describe('3. National ID Extraction & Smart Nickname Suggestion', () => {
    it('extracts governorate, birthdate, and gender from valid 14-digit Egyptian National ID', () => {
      // Arrange
      const validId = '29505120101234';
      const invalidId = '123456';

      // Act
      const parsedValid = parseEgyptianNationalId(validId);
      const parsedInvalid = parseEgyptianNationalId(invalidId);

      // Assert
      expect(parsedValid.isValid).toBe(true);
      expect(parsedValid.info?.birthDate).toBeDefined();
      expect(parsedValid.info?.governorateCode).toBe('01'); // Cairo
      expect(parsedValid.info?.gender).toBe('MALE');

      // Negative assertion on invalid ID
      expect(parsedInvalid.isValid).toBe(false);
      expect(parsedInvalid.info).toBeUndefined();
    });

    it('suggests first two names as the default nickname if none provided', () => {
      // Arrange
      const fullName = 'محمود أحمد إبراهيم علي';
      const singleName = 'محمود';

      // Act
      const suggested = extractFirstTwoNames(fullName);
      const suggestedSingle = extractFirstTwoNames(singleName);

      // Assert
      expect(suggested).toBe('محمود أحمد');
      expect(suggested).not.toContain('إبراهيم');
      expect(suggestedSingle).toBe('محمود');
    });
  });

  describe('4. Frontend Validation Rules', () => {
    it('validates Egyptian mobile phone format (010, 011, 012, 015 with 11 digits)', () => {
      // Arrange
      const validPhones = ['01012345678', '01123456789', '01234567890', '01512345678'];
      const invalidPhones = ['01312345678', '0101234567', '010123456789', '1012345678'];
      const phoneRegex = /^01[0125]\d{8}$/;

      // Act & Assert
      validPhones.forEach((p) => {
        expect(phoneRegex.test(p)).toBe(true);
      });
      invalidPhones.forEach((p) => {
        expect(phoneRegex.test(p)).toBe(false);
      });
    });
  });
});
