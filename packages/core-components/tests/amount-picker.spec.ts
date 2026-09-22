import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateAmount,
  checkDuplicatePaymentRisk,
  buildAmountPickerKeyboard,
} from '../src/index.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('UniversalAmountPicker', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
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

  describe('Amount validation', () => {
    it('1. accepts valid amounts in Western digits', () => {
      // Arrange
      const rawAmount = 1500;

      // Act
      const res = validateAmount(rawAmount);

      // Assert
      expect(res.isValid).toBe(true);
      expect(res.amount).toBe(1500);
    });

    it('2. accepts valid amounts in Eastern Arabic digits', () => {
      // Arrange
      const easternAmount = '١٥٠٠٫٥٠';

      // Act
      const res = validateAmount(easternAmount);

      // Assert
      expect(res.isValid).toBe(true);
      expect(res.amount).toBe(1500.5);
    });

    it('3. rejects zero and negative amounts', () => {
      // Arrange & Act
      // Arrange
      const zeroAmount = 0;
      const negativeAmount = -100;

      // Act
      const resZero = validateAmount(zeroAmount);
      const resNegative = validateAmount(negativeAmount);

      // Assert
      expect(resZero.isValid).toBe(false);
      expect(resNegative.isValid).toBe(false);
    });

    it('4. rejects invalid text non-numeric inputs', () => {
      // Arrange
      const invalidText = 'abc';

      // Act
      const res = validateAmount(invalidText);

      // Assert
      expect(res.isValid).toBe(false);
    });

    it('5. enforces maximum limits and returns error message', () => {
      // Arrange
      const excessAmount = 5000;
      const options = { maxAmount: 3000 };

      // Act
      const res = validateAmount(excessAmount, options);

      // Assert
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('الحد الأقصى');
    });

    it('6. enforces custody balance limits and returns custody error', () => {
      // Arrange
      const excessCustody = 2500;
      const options = { maxCustodyBalance: 2000 };

      // Act
      const res = validateAmount(excessCustody, options);

      // Assert
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('رصيد العهدة الحالي');
    });
  });

  describe('Duplicate payment risk radar', () => {
    it('7. detects identical payment to same worker within 24h', () => {
      // Arrange
      const baseMs = PINNED_BASE_TIME.getTime();
      const recentTx = [
        { workerId: 'w101', amount: 1000, createdAt: new Date(baseMs - 2 * 60 * 60 * 1000) }, // 2 hours ago
      ];

      // Act
      const hasRisk = checkDuplicatePaymentRisk({
        workerId: 'w101',
        amount: 1000,
        recentTransactions: recentTx,
      });

      // Assert
      expect(hasRisk).toBe(true);
    });

    it('8. ignores transactions outside the time window', () => {
      // Arrange
      const baseMs = PINNED_BASE_TIME.getTime();
      const recentTx = [
        { workerId: 'w101', amount: 1000, createdAt: new Date(baseMs - 30 * 60 * 60 * 1000) }, // 30 hours ago
      ];

      // Act
      const hasRisk = checkDuplicatePaymentRisk({
        workerId: 'w101',
        amount: 1000,
        recentTransactions: recentTx,
      });

      // Assert
      expect(hasRisk).toBe(false);
    });

    it('9. ignores transactions with different amounts or workers', () => {
      // Arrange
      const recentTx = [
        { workerId: 'w101', amount: 500, createdAt: new Date(PINNED_BASE_TIME) },
        { workerId: 'w102', amount: 1000, createdAt: new Date(PINNED_BASE_TIME) },
      ];

      // Act
      const hasRisk = checkDuplicatePaymentRisk({
        workerId: 'w101',
        amount: 1000,
        recentTransactions: recentTx,
      });

      // Assert
      expect(hasRisk).toBe(false);
    });
  });

  describe('Keyboard builder', () => {
    it('10. builds quick denomination keyboard with back and cancel buttons', () => {
      // Arrange
      const denominations = [100, 200, 500, 1000];

      // Act
      const kb = buildAmountPickerKeyboard({
        denominations,
        backCallbackData: 'action:back',
      });

      // Assert
      expect(kb.inline_keyboard.length).toBe(3); // 2 rows of 2 denominations + 1 nav row
      const navRow = kb.inline_keyboard[2]!;
      expect(navRow.some((b) => b.text.includes('السابق'))).toBe(true);
      expect(navRow.some((b) => b.text.includes('إلغاء'))).toBe(true);
    });
  });
});
