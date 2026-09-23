/**
 * Business Service for Flow 99.2 (sandbox-calc)
 * "العمليات الحسابية والقناع المالي"
 */

import type {
  CalcOperationType,
  FinancialRecordDTO,
  MaskedFinancialRecordDTO,
  SandboxCalcInputDTO,
  SandboxCalcResultDTO,
} from './types.js';

export class SandboxCalcService {
  constructor(private readonly repository?: unknown) {}

  /**
   * Executes arithmetic operation safely with full boundary protection.
   */
  calculate(op: CalcOperationType, a: number, b: number): number {
    switch (op) {
      case 'ADD':
        return Math.round((a + b) * 100) / 100;
      case 'SUBTRACT':
        return Math.round((a - b) * 100) / 100;
      case 'MULTIPLY':
        return Math.round(a * b * 100) / 100;
      case 'DIVIDE':
        if (b === 0) {
          throw new Error('لا يمكن القسمة على صفر');
        }
        return Math.round((a / b) * 100) / 100;
      default:
        throw new Error(`عملية حسابية غير مدعومة: ${op}`);
    }
  }

  /**
   * Calculates net remuneration: Basic + Allowances - Deductions
   */
  calculateNetPay(record: FinancialRecordDTO): number {
    const basic = Number(record.basicSalary) || 0;
    const allowances = Number(record.allowances) || 0;
    const deductions = Number(record.deductions) || 0;
    return Math.round((basic + allowances - deductions) * 100) / 100;
  }

  /**
   * Financial Masking Guard (G8 compliance):
   * SUPER_ADMIN receives transparent, unmasked compensation data.
   * All other roles (FIELD_ADMIN, WORKER, GUEST) have financial amounts masked.
   */
  maskFinancialRecord(record: FinancialRecordDTO, role: string): MaskedFinancialRecordDTO {
    const net = this.calculateNetPay(record);
    const isSuperAdmin = role === 'SUPER_ADMIN';

    if (isSuperAdmin) {
      return {
        basicSalary: `${record.basicSalary.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م`,
        allowances: `${record.allowances.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م`,
        deductions: `${record.deductions.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م`,
        netPay: `${net.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م`,
        isMasked: false,
      };
    }

    return {
      basicSalary: '*** ج.م',
      allowances: '*** ج.م',
      deductions: '*** ج.م',
      netPay: '*** ج.م',
      isMasked: true,
    };
  }

  async executeOperation(input: SandboxCalcInputDTO): Promise<SandboxCalcResultDTO> {
    const referenceId = `SANDBOX-CALC-${Date.now().toString(36).toUpperCase()}`;
    const op = input.operation ?? 'NET_PAY';

    if (op === 'MASK_RECORD' || op === 'NET_PAY') {
      const record = input.operands?.record ?? {
        basicSalary: 8500,
        allowances: 1200,
        deductions: 300,
      };
      const masked = this.maskFinancialRecord(record, input.actorRole ?? 'WORKER');
      const net = this.calculateNetPay(record);

      return {
        success: true,
        referenceId,
        messageArabic: `تم حساب وتطبيق القناع المالي بنجاح. الرقم المرجعي: ${referenceId}`,
        numericResult: net,
        maskedRecord: masked,
      };
    }

    const a = input.operands?.a ?? 0;
    const b = input.operands?.b ?? 0;
    const result = this.calculate(op, a, b);

    return {
      success: true,
      referenceId,
      messageArabic: `تم تنفيذ العملية الحسابية (${op}) بنجاح: ${result}. الرقم المرجعي: ${referenceId}`,
      numericResult: result,
    };
  }
}
