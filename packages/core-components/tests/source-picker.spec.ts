import { describe, it, expect } from 'vitest';
import {
  validateFundSourceBalance,
  buildSourceOfFundsKeyboard,
  type CustodyOption,
} from '../src/index.js';

describe('UniversalSourceOfFundsPicker', () => {
  const sampleCustodies: CustodyOption[] = [
    { id: 'c1', name: 'المهندس أحمد', balance: 15000, location: 'موقع السويس' },
    { id: 'c2', name: 'المشرف محمد', balance: 2500, location: 'موقع الأدبية' },
  ];

  describe('Fund balance validation', () => {
    it('approves disbursement when custody balance is sufficient', () => {
      const res = validateFundSourceBalance(3000, {
        type: 'CUSTODY',
        custodyId: 'c1',
        availableBalance: 15000,
      });
      expect(res.isValid).toBe(true);
    });

    it('rejects disbursement when custody balance is insufficient', () => {
      const res = validateFundSourceBalance(5000, {
        type: 'CUSTODY',
        custodyId: 'c2',
        availableBalance: 2500,
      });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('لا يكفي');
      expect(res.error).toContain('2,500.00 ج.م');
      expect(res.error).toContain('5,000.00 ج.م');
    });

    it('approves disbursement from Main Treasury unconditionally', () => {
      const res = validateFundSourceBalance(50000, {
        type: 'MAIN_TREASURY',
      });
      expect(res.isValid).toBe(true);
    });

    it('rejects zero or negative disbursement amounts', () => {
      expect(validateFundSourceBalance(0, { type: 'MAIN_TREASURY' }).isValid).toBe(false);
      expect(validateFundSourceBalance(-500, { type: 'CUSTODY', availableBalance: 1000 }).isValid).toBe(false);
    });
  });

  describe('Keyboard builder', () => {
    it('builds keyboard with custodies, formatted live balances, and main treasury option', () => {
      const kb = buildSourceOfFundsKeyboard({
        custodies: sampleCustodies,
        includeMainTreasury: true,
        backCallbackData: 'action:back',
      });

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
