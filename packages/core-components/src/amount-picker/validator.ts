import { parseRegionalNumber } from '@alsaada/regional-engine';
import { type PositiveFiniteAmount, toPositiveFiniteAmount } from '../types.js';

export interface AmountValidationOptions {
  minAmount?: number;
  maxAmount?: number;
  maxCustodyBalance?: number;
}

export interface AmountValidationResult {
  isValid: boolean;
  amount?: PositiveFiniteAmount;
  error?: string;
}

/**
 * Validates a user-entered amount string or number.
 */
export function validateAmount(
  input: string | number | null | undefined,
  options: AmountValidationOptions = {}
): AmountValidationResult {
  const min = options.minAmount ?? 1;
  const max = options.maxAmount;
  const custodyMax = options.maxCustodyBalance;

  const parsed = parseRegionalNumber(input);

  if (parsed === null || isNaN(parsed) || !Number.isFinite(parsed)) {
    return {
      isValid: false,
      error: 'المبلغ المُدخل غير صالح. برجاء كتابة أرقام صحيحة.',
    };
  }

  if (parsed <= 0) {
    return {
      isValid: false,
      error: 'لا يمكن تسجيل مبلغ بصفر أو قيمة سالبة.',
    };
  }

  if (parsed < min) {
    return {
      isValid: false,
      error: `الحد الأدنى للمبلغ هو ${min} ج.م.`,
    };
  }

  if (max !== undefined && parsed > max) {
    return {
      isValid: false,
      error: `المبلغ يتجاوز الحد الأقصى المسموح به (${max} ج.م).`,
    };
  }

  if (custodyMax !== undefined && parsed > custodyMax) {
    return {
      isValid: false,
      error: `رصيد العهدة الحالي (${custodyMax} ج.م) لا يكفي لتغطية هذا المبلغ (${parsed} ج.م).`,
    };
  }

  return {
    isValid: true,
    amount: toPositiveFiniteAmount(parsed),
  };
}

export interface DuplicatePaymentRiskParams {
  workerId: string;
  amount: number;
  recentTransactions: Array<{
    workerId: string;
    amount: number;
    createdAt: Date | string;
  }>;
  windowHours?: number;
}

/**
 * Detects duplicate payment risk (e.g., duplicate advance within 24 hours).
 */
export function checkDuplicatePaymentRisk(params: DuplicatePaymentRiskParams): boolean {
  const windowMs = (params.windowHours ?? 24) * 60 * 60 * 1000;
  const now = Date.now();

  return params.recentTransactions.some((tx) => {
    if (tx.workerId !== params.workerId) return false;
    if (Math.abs(tx.amount - params.amount) > 0.01) return false;

    const txTime = new Date(tx.createdAt).getTime();
    return now - txTime <= windowMs;
  });
}
