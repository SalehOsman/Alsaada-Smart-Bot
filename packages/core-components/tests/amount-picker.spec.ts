import { describe, it, expect } from 'vitest';
import {
  validateAmount,
  checkDuplicatePaymentRisk,
  buildAmountPickerKeyboard,
} from '../src/index.js';

describe('UniversalAmountPicker', () => {
  describe('Amount validation', () => {
    it('accepts valid amounts in Western digits', () => {
      const res = validateAmount(1500);
      expect(res.isValid).toBe(true);
      expect(res.amount).toBe(1500);
    });

    it('accepts valid amounts in Eastern Arabic digits', () => {
      const res = validateAmount('١٥٠٠٫٥٠');
      expect(res.isValid).toBe(true);
      expect(res.amount).toBe(1500.5);
    });

    it('rejects zero and negative amounts', () => {
      expect(validateAmount(0).isValid).toBe(false);
      expect(validateAmount(-100).isValid).toBe(false);
    });

    it('rejects invalid text', () => {
      expect(validateAmount('abc').isValid).toBe(false);
    });

    it('enforces maximum limits', () => {
      const res = validateAmount(5000, { maxAmount: 3000 });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('الحد الأقصى');
    });

    it('enforces custody balance limits', () => {
      const res = validateAmount(2500, { maxCustodyBalance: 2000 });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('رصيد العهدة الحالي');
    });
  });

  describe('Duplicate payment risk radar', () => {
    it('detects identical payment to same worker within 24h', () => {
      const recentTx = [
        { workerId: 'w101', amount: 1000, createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) }, // 2 hours ago
      ];

      const hasRisk = checkDuplicatePaymentRisk({
        workerId: 'w101',
        amount: 1000,
        recentTransactions: recentTx,
      });

      expect(hasRisk).toBe(true);
    });

    it('ignores transactions outside the time window', () => {
      const recentTx = [
        { workerId: 'w101', amount: 1000, createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000) }, // 30 hours ago
      ];

      const hasRisk = checkDuplicatePaymentRisk({
        workerId: 'w101',
        amount: 1000,
        recentTransactions: recentTx,
      });

      expect(hasRisk).toBe(false);
    });

    it('ignores transactions with different amounts or workers', () => {
      const recentTx = [
        { workerId: 'w101', amount: 500, createdAt: new Date() },
        { workerId: 'w102', amount: 1000, createdAt: new Date() },
      ];

      const hasRisk = checkDuplicatePaymentRisk({
        workerId: 'w101',
        amount: 1000,
        recentTransactions: recentTx,
      });

      expect(hasRisk).toBe(false);
    });
  });

  describe('Keyboard builder', () => {
    it('builds quick denomination keyboard with back and cancel buttons', () => {
      const kb = buildAmountPickerKeyboard({
        denominations: [100, 200, 500, 1000],
        backCallbackData: 'action:back',
      });

      expect(kb.inline_keyboard.length).toBe(3); // 2 rows of 2 denominations + 1 nav row
      const navRow = kb.inline_keyboard[2]!;
      expect(navRow.some((b) => b.text.includes('السابق'))).toBe(true);
      expect(navRow.some((b) => b.text.includes('إلغاء'))).toBe(true);
    });
  });
});
