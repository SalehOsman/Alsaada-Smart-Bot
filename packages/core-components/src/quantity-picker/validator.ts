import { parseRegionalNumber } from '@alsaada/regional-engine';

export type UnitType = 'DISCRETE' | 'CONTINUOUS'; // DISCRETE: علبة، كرتونة، وجبة | CONTINUOUS: لتر، طن، متر

export interface QuantityValidationOptions {
  unitType?: UnitType;
  unitName?: string;
  minQuantity?: number;
  maxQuantity?: number;
}

export interface QuantityValidationResult {
  isValid: boolean;
  quantity?: number;
  error?: string;
}

/**
 * Validates a user-entered quantity string or number.
 */
export function validateQuantity(
  input: string | number | null | undefined,
  options: QuantityValidationOptions = {}
): QuantityValidationResult {
  const unitType = options.unitType ?? 'DISCRETE';
  const unitName = options.unitName ?? 'وحدة';
  const min = options.minQuantity ?? 1;
  const max = options.maxQuantity;

  const parsed = parseRegionalNumber(input);

  if (parsed === null || isNaN(parsed)) {
    return {
      isValid: false,
      error: 'الكمية المُدخلة غير صالحة. برجاء كتابة أرقام صحيحة.',
    };
  }

  if (parsed <= 0) {
    return {
      isValid: false,
      error: 'لا يمكن تسجيل كمية بصفر أو قيمة سالبة.',
    };
  }

  if (unitType === 'DISCRETE' && !Number.isInteger(parsed)) {
    return {
      isValid: false,
      error: `الأصناف بوحدة (${unitName}) غير قابلة للتجزئة. يجب إدخال رقم صحيح دون كسور.`,
    };
  }

  if (parsed < min) {
    return {
      isValid: false,
      error: `الحد الأدنى للكمية هو ${min} ${unitName}.`,
    };
  }

  if (max !== undefined && parsed > max) {
    return {
      isValid: false,
      error: `الكمية تتجاوز الحد الأقصى المسموح به (${max} ${unitName}).`,
    };
  }

  return {
    isValid: true,
    quantity: parsed,
  };
}
