/**
 * Type contracts for Flow 99.2 (sandbox-calc)
 * "العمليات الحسابية والقناع المالي"
 */

export type CalcOperationType = 'ADD' | 'SUBTRACT' | 'MULTIPLY' | 'DIVIDE' | 'NET_PAY' | 'MASK_RECORD';

export interface FinancialRecordDTO {
  basicSalary: number;
  allowances: number;
  deductions: number;
  notes?: string | undefined;
}

export interface MaskedFinancialRecordDTO {
  basicSalary: string;
  allowances: string;
  deductions: string;
  netPay: string;
  isMasked: boolean;
}

export interface SandboxCalcSessionData {
  flowId: '99.2';
  step: 'INIT' | 'PROMPT' | 'CONFIRM' | 'COMPLETED';
  idempotencyKey?: string | undefined;
  payload?: Record<string, unknown> | undefined;
}

export interface SandboxCalcInputDTO {
  idempotencyKey: string;
  actorTelegramId: string;
  operation?: CalcOperationType | undefined;
  operands?: {
    a?: number | undefined;
    b?: number | undefined;
    record?: FinancialRecordDTO | undefined;
  } | undefined;
  actorRole?: string | undefined;
  notes?: string | undefined;
}

export interface SandboxCalcResultDTO {
  success: boolean;
  referenceId: string;
  messageArabic: string;
  numericResult?: number | undefined;
  maskedRecord?: MaskedFinancialRecordDTO | undefined;
}
