import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateFundSourceBalance,
  buildSourceOfFundsKeyboard,
  type CustodyOption,
} from '../src/index.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('UniversalSourceOfFundsPicker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const sampleCustodies: CustodyOption[] = [
    { id: 'c1', name: 'المهندس أحمد', balance: 15000, location: 'موقع السويس' },
    { id: 'c2', name: 'المشرف محمد', balance: 2500, location: 'موقع الأدبية' },
  ];

  describe('Fund balance validation', () => {
    it('1. approves disbursement when custody balance is sufficient', () => {
      // Arrange
      const amount = 3000;
      const source = {
        type: 'CUSTODY' as const,
        custodyId: 'c1',
        availableBalance: 15000,
      };

      // Act
      const res = validateFundSourceBalance(amount, source);

      // Assert
      expect(res.isValid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('2. rejects disbursement when custody balance is insufficient', () => {
      // Arrange
      const amount = 5000;
      const source = {
        type: 'CUSTODY' as const,
        custodyId: 'c2',
        availableBalance: 2500,
      };

      // Act
      const res = validateFundSourceBalance(amount, source);

      // Assert
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('لا يكفي');
      expect(res.error).toContain('2,500.00 ج.م');
      expect(res.error).toContain('5,000.00 ج.م');
    });

    it('3. approves disbursement from Main Treasury unconditionally', () => {
      // Arrange
      const amount = 50000;
      const source = {
        type: 'MAIN_TREASURY' as const,
      };

      // Act
      const res = validateFundSourceBalance(amount, source);

      // Assert
      expect(res.isValid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('4. rejects zero or negative disbursement amounts', () => {
      // Arrange
      const zeroAmount = 0;
      const negativeAmount = -500;
      const mainSource = { type: 'MAIN_TREASURY' as const };
      const custodySource = { type: 'CUSTODY' as const, availableBalance: 1000 };

      // Act
      const resZero = validateFundSourceBalance(zeroAmount, mainSource);
      const resNeg = validateFundSourceBalance(negativeAmount, custodySource);

      // Assert
      expect(resZero.isValid).toBe(false);
      expect(resNeg.isValid).toBe(false);
      expect(resZero.error).toBeDefined();
      expect(resNeg.error).toBeDefined();
    });
  });

  describe('Keyboard builder', () => {
    it('5. builds keyboard with custodies, formatted live balances, and main treasury option', () => {
      // Arrange
      const options = {
        custodies: sampleCustodies,
        includeMainTreasury: true,
        backCallbackData: 'action:back',
      };

      // Act
      const kb = buildSourceOfFundsKeyboard(options);

      // Assert
      expect(kb.inline_keyboard.length).toBe(4); // 2 custodies + 1 main treasury + 1 nav row
      expect(kb.inline_keyboard[0]![0]!.text).toContain('المهندس أحمد');
      expect(kb.inline_keyboard[0]![0]!.text).toContain('15,000 ج.م');
      expect(kb.inline_keyboard[1]![0]!.text).toContain('المشرف محمد');
      expect(kb.inline_keyboard[2]![0]!.text).toContain('الخزينة المركزية');

      const navRow = kb.inline_keyboard[3]!;
      expect(navRow.some((b) => b.text.includes('السابق'))).toBe(true);
      expect(navRow.some((b) => b.text.includes('إلغاء'))).toBe(true);
    });
  });
});
