import { describe, it, expect } from 'vitest';
import { assertRichMessage } from '@alsaada/core-components';
import {
  SandboxCalcService,
  validateSandboxCalcInput,
  buildSandboxCalcMainMenuKeyboard,
  buildSandboxCalcConfirmKeyboard,
  buildSandboxCalcPromptMessage,
  buildSandboxCalcResultTable,
  buildSandboxCalcConfirmMessage,
  handleSandboxCalcError,
  handleSandboxCalcAction,
} from '../../src/flows/99.2-sandbox-calc/index.js';

describe('Work Plan 89 — Flow 99.2 (sandbox-calc) Constitutional 10-File Slice Spec', () => {
  const service = new SandboxCalcService();

  describe('1. Arithmetic Calculations & Operations', () => {
    it('executes addition correctly', () => {
      expect(service.calculate('ADD', 15.5, 24.5)).toBe(40);
      expect(service.calculate('ADD', -10, 25)).toBe(15);
    });

    it('executes subtraction correctly', () => {
      expect(service.calculate('SUBTRACT', 100, 35.5)).toBe(64.5);
    });

    it('executes multiplication correctly', () => {
      expect(service.calculate('MULTIPLY', 12.5, 4)).toBe(50);
    });

    it('executes division correctly and handles fractional precision', () => {
      expect(service.calculate('DIVIDE', 100, 3)).toBe(33.33);
      expect(service.calculate('DIVIDE', 50, 2)).toBe(25);
    });

    it('throws error when dividing by zero', () => {
      expect(() => service.calculate('DIVIDE', 100, 0)).toThrow('لا يمكن القسمة على صفر');
    });

    it('calculates net pay correctly: basic + allowances - deductions', () => {
      const net = service.calculateNetPay({
        basicSalary: 8000,
        allowances: 1500,
        deductions: 500,
      });
      expect(net).toBe(9000);
    });
  });

  describe('2. Financial Masking & Compensation Privacy (G8 Compliance)', () => {
    const sampleRecord = {
      basicSalary: 9500,
      allowances: 1500,
      deductions: 500,
    };

    it('SUPER_ADMIN receives unmasked compensation details', () => {
      const unmasked = service.maskFinancialRecord(sampleRecord, 'SUPER_ADMIN');
      expect(unmasked.isMasked).toBe(false);
      expect(unmasked.basicSalary).toContain('9,500.00 ج.م');
      expect(unmasked.allowances).toContain('1,500.00 ج.م');
      expect(unmasked.deductions).toContain('500.00 ج.م');
      expect(unmasked.netPay).toContain('10,500.00 ج.م');
    });

    it('FIELD_ADMIN has all financial figures masked with asterisks', () => {
      const masked = service.maskFinancialRecord(sampleRecord, 'FIELD_ADMIN');
      expect(masked.isMasked).toBe(true);
      expect(masked.basicSalary).toBe('*** ج.م');
      expect(masked.allowances).toBe('*** ج.م');
      expect(masked.deductions).toBe('*** ج.م');
      expect(masked.netPay).toBe('*** ج.م');
    });

    it('WORKER and other unauthorized roles have all financial figures masked', () => {
      const masked = service.maskFinancialRecord(sampleRecord, 'WORKER');
      expect(masked.isMasked).toBe(true);
      expect(masked.netPay).toBe('*** ج.م');
    });
  });

  describe('3. Service executeOperation Integration', () => {
    it('executes arithmetic operation mode and returns numericResult', async () => {
      const res = await service.executeOperation({
        idempotencyKey: 'test-key-12345678',
        actorTelegramId: 'usr-99',
        operation: 'MULTIPLY',
        operands: { a: 20, b: 5 },
      });

      expect(res.success).toBe(true);
      expect(res.referenceId).toContain('SANDBOX-CALC');
      expect(res.numericResult).toBe(100);
      expect(res.messageArabic).toContain('تم تنفيذ العملية الحسابية (MULTIPLY)');
    });

    it('executes financial masking mode for SUPER_ADMIN with unmasked details', async () => {
      const res = await service.executeOperation({
        idempotencyKey: 'test-key-12345678',
        actorTelegramId: 'usr-admin',
        operation: 'NET_PAY',
        actorRole: 'SUPER_ADMIN',
        operands: {
          record: { basicSalary: 10000, allowances: 2000, deductions: 1000 },
        },
      });

      expect(res.success).toBe(true);
      expect(res.numericResult).toBe(11000);
      expect(res.maskedRecord?.isMasked).toBe(false);
      expect(res.maskedRecord?.basicSalary).toContain('10,000.00');
    });

    it('executes financial masking mode for FIELD_ADMIN with masked figures', async () => {
      const res = await service.executeOperation({
        idempotencyKey: 'test-key-12345678',
        actorTelegramId: 'usr-field',
        operation: 'NET_PAY',
        actorRole: 'FIELD_ADMIN',
        operands: {
          record: { basicSalary: 10000, allowances: 2000, deductions: 1000 },
        },
      });

      expect(res.success).toBe(true);
      expect(res.maskedRecord?.isMasked).toBe(true);
      expect(res.maskedRecord?.basicSalary).toBe('*** ج.م');
    });
  });

  describe('4. Input Validation & Boundaries', () => {
    it('validates standard valid payload', () => {
      const valid = validateSandboxCalcInput({
        idempotencyKey: 'idemp-key-12345',
        actorTelegramId: 'user-1',
        operation: 'NET_PAY',
        notes: 'Calculation notes',
      });
      expect(valid.success).toBe(true);
    });

    it('validates boundary idempotency keys (8 and 64 chars)', () => {
      expect(validateSandboxCalcInput({
        idempotencyKey: '12345678',
        actorTelegramId: 'user-1',
      }).success).toBe(true);

      expect(validateSandboxCalcInput({
        idempotencyKey: 'a'.repeat(64),
        actorTelegramId: 'user-1',
      }).success).toBe(true);

      // Too short
      expect(validateSandboxCalcInput({
        idempotencyKey: '1234567',
        actorTelegramId: 'user-1',
      }).success).toBe(false);

      // Too long
      expect(validateSandboxCalcInput({
        idempotencyKey: 'a'.repeat(65),
        actorTelegramId: 'user-1',
      }).success).toBe(false);
    });

    it('rejects invalid operations or corrupted inputs', () => {
      expect(validateSandboxCalcInput({
        idempotencyKey: '12345678',
        actorTelegramId: 'user-1',
        operation: 'INVALID_OP',
      }).success).toBe(false);

      expect(validateSandboxCalcInput(null).success).toBe(false);
      expect(validateSandboxCalcInput(undefined).success).toBe(false);
    });
  });

  describe('5. Telegram Ergonomics Budget & Rich Messages', () => {
    it('builds keyboard conforming strictly to Telegram Ergonomics Budget (36/16/7/3)', () => {
      const kb = buildSandboxCalcMainMenuKeyboard();
      expect(kb.inline_keyboard.length).toBeLessThanOrEqual(7);

      for (const row of kb.inline_keyboard) {
        expect(row.length).toBeLessThanOrEqual(3);
        for (const btn of row) {
          expect(btn.text.length).toBeLessThanOrEqual(16);
          expect(btn.callback_data.length).toBeLessThanOrEqual(64);
        }
      }

      const confirmKb = buildSandboxCalcConfirmKeyboard('calc-99');
      for (const row of confirmKb.inline_keyboard) {
        expect(row.length).toBeLessThanOrEqual(3);
        for (const btn of row) {
          expect(btn.text.length).toBeLessThanOrEqual(16);
          expect(btn.callback_data.length).toBeLessThanOrEqual(64);
        }
      }
    });

    it('builds valid Rich Messages compliant with Rule 8.1 Zero Raw Text Policy', () => {
      const promptMsg = buildSandboxCalcPromptMessage('العمليات الحسابية والقناع المالي');
      expect(() => assertRichMessage(promptMsg)).not.toThrow();
      expect(promptMsg.is_rtl).toBe(true);

      const confirmMsg = buildSandboxCalcConfirmMessage('CALC-002');
      expect(() => assertRichMessage(confirmMsg)).not.toThrow();
      expect(confirmMsg.is_rtl).toBe(true);

      const tableMsg = buildSandboxCalcResultTable({
        basicSalary: '8,000.00 ج.م',
        allowances: '1,000.00 ج.م',
        deductions: '500.00 ج.م',
        netPay: '8,500.00 ج.م',
        isMasked: false,
      });
      expect(() => assertRichMessage(tableMsg)).not.toThrow();
      expect(tableMsg.is_rtl).toBe(true);
    });

    it('handles callback actions cleanly and returns rich message responses', async () => {
      const replied: unknown[] = [];
      const mockCtx = {
        callbackQuery: { data: 'action:sandbox:sandbox-calc:mask' },
        reply: async (content: unknown) => {
          replied.push(content);
        },
      };

      const handled = await handleSandboxCalcAction(mockCtx, service);
      expect(handled).toBe(true);
      expect(replied.length).toBe(1);
      expect(() => assertRichMessage(replied[0] as any)).not.toThrow();
    });

    it('handles error gracefully without crashing', () => {
      const res = handleSandboxCalcError(new Error('Calculation failed'));
      expect(res.handled).toBe(true);
      expect(res.userMessageArabic).toContain('حدث خطأ');
    });
  });
});
