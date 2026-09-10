import type { EditablePersonalField } from './flow.types.js';
import { EDITABLE_FIELD_LABELS, FORBIDDEN_FINANCIAL_FIELDS } from './flow.types.js';

export interface ValidationResult {
  isValid: boolean;
  sanitizedValue?: string;
  error?: string;
}

export function validateWorkerSelfEditField(field: string): field is EditablePersonalField {
  return Object.prototype.hasOwnProperty.call(EDITABLE_FIELD_LABELS, field);
}

export function isForbiddenFinancialField(field: string): boolean {
  return (FORBIDDEN_FINANCIAL_FIELDS as readonly string[]).includes(field);
}

export function validateFieldValue(field: EditablePersonalField, value: string): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return { isValid: false, error: 'القيمة المدخلة لا يمكن أن تكون فارغة.' };
  }

  if (field === 'phone' || field === 'emergencyPhone') {
    const clean = trimmed.replace(/\D/g, '');
    if (!/^01[0125]\d{8}$/.test(clean)) {
      return { isValid: false, error: 'رقم الهاتف يجب أن يكون رقم مصري ساري مكون من 11 رقماً ويبدأ بـ 01.' };
    }
    return { isValid: true, sanitizedValue: clean };
  }

  if (field === 'ppeShoeSize') {
    const size = parseInt(trimmed, 10);
    if (isNaN(size) || size < 38 || size > 48) {
      return { isValid: false, error: 'مقاس الحذاء يجب أن يكون رقماً صحيحاً بين 38 و 48.' };
    }
    return { isValid: true, sanitizedValue: String(size) };
  }

  if (trimmed.length > 150) {
    return { isValid: false, error: 'القيمة المدخلة طويلة جداً (الحد الأقصى 150 حرفاً).' };
  }

  return { isValid: true, sanitizedValue: trimmed };
}
