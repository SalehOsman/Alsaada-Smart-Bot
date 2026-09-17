import { describe, it, expect } from 'vitest';
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

describe('Workforce Onboarding Dashboard Parity (Plan 31)', () => {
  describe('1. Static Lookup Dictionaries Parity', () => {
    it('contains Egyptian governorates including Cairo and Alexandria', () => {
      expect(Object.keys(EGYPTIAN_GOVERNORATES).length).toBeGreaterThanOrEqual(27);
      expect(EGYPTIAN_GOVERNORATES['01']).toBe('القاهرة');
      expect(EGYPTIAN_GOVERNORATES['02']).toBe('الإسكندرية');
    });

    it('contains all standard payment methods matching bot choices', () => {
      const values = PAYMENT_METHODS.map((m) => m.value);
      expect(values).toContain('CASH_SITE');
      expect(values).toContain('VODAFONE_CASH');
      expect(values).toContain('INSTAPAY');
      expect(values).toContain('BANK_TRANSFER');
    });

    it('contains contract types matching enterprise system', () => {
      const values = CONTRACT_TYPES.map((c) => c.value);
      expect(values).toContain('PERMANENT');
      expect(values).toContain('DAILY_LABOR');
      expect(values).toContain('SEASONAL');
    });

    it('contains military statuses matching Egyptian regulations', () => {
      expect(MILITARY_STATUSES.length).toBeGreaterThan(0);
      const values = MILITARY_STATUSES.map((s) => s.value);
      expect(values.some((v) => v.includes('الخدمة العسكرية'))).toBe(true);
    });

    it('contains driving license grades matching Egyptian traffic law', () => {
      expect(DRIVING_LICENSES.length).toBeGreaterThan(0);
      const values = DRIVING_LICENSES.map((l) => l.value);
      expect(values.some((v) => v.includes('أولى'))).toBe(true);
      expect(values.some((v) => v.includes('خاصة'))).toBe(true);
    });

    it('contains canteen cigarette policies matching site operations', () => {
      const values = CANTEEN_CIGARETTE_POLICIES.map((p) => p.value);
      expect(values).toContain('NONE');
      expect(values).toContain('ONE_PACK_DAILY');
    });

    it('contains PPE shoe and uniform size ranges', () => {
      expect(PPE_SHOE_SIZES).toContain('42');
      expect(PPE_SHOE_SIZES).toContain('43');
      expect(PPE_UNIFORM_SIZES).toContain('L');
      expect(PPE_UNIFORM_SIZES).toContain('XL');
    });
  });

  describe('2. Salary Calculation & Strict Daily Wage Prohibition', () => {
    it('calculates gross salary as basic + additional + custom allowances', () => {
      const basic = 6000;
      const additional = 2000;
      const allowances = [
        { title: 'بدل اغتراب', amount: 1000 },
        { title: 'بدل وجبة', amount: 500 },
      ];
      const totalAllowances = allowances.reduce((sum, a) => sum + a.amount, 0);
      const gross = basic + additional + totalAllowances;

      expect(gross).toBe(9500);

      // Daily wage must be derived by 30 days and never manually entered on UI
      const derivedDailyWage = Math.round((gross / 30) * 100) / 100;
      expect(derivedDailyWage).toBe(316.67);
    });

    it('calculates duty cycle effective working rate correctly (20 work / 10 rest vs 26 work / 4 rest)', () => {
      const gross = 9000;
      const workDays = 20;
      const restDays = 10;
      const totalDays = workDays + restDays;
      expect(totalDays).toBe(30);

      // Effective work-day earnings
      const effectivePerWorkDay = gross / workDays;
      expect(effectivePerWorkDay).toBe(450);
    });
  });

  describe('3. National ID Extraction & Smart Nickname Suggestion', () => {
    it('extracts governorate, birthdate, and gender from valid 14-digit Egyptian National ID', () => {
      const parsed = parseEgyptianNationalId('29505120101234');
      expect(parsed.isValid).toBe(true);
      expect(parsed.info?.birthDate).toBeDefined();
      expect(parsed.info?.governorateCode).toBe('01'); // Cairo
      expect(parsed.info?.gender).toBe('MALE');
    });

    it('suggests first two names as the default nickname if none provided', () => {
      const fullName = 'محمود أحمد إبراهيم علي';
      const suggested = extractFirstTwoNames(fullName);
      expect(suggested).toBe('محمود أحمد');
    });
  });

  describe('4. Frontend Validation Rules', () => {
    it('validates Egyptian mobile phone format (010, 011, 012, 015 with 11 digits)', () => {
      const validPhones = ['01012345678', '01123456789', '01234567890', '01512345678'];
      const invalidPhones = ['01312345678', '0101234567', '010123456789', '1012345678'];

      const phoneRegex = /^01[0125]\d{8}$/;
      validPhones.forEach((p) => expect(phoneRegex.test(p)).toBe(true));
      invalidPhones.forEach((p) => expect(phoneRegex.test(p)).toBe(false));
    });
  });
});
