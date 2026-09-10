import type { CompanyFieldKey } from './flow.types.js';

export function validateCompanyFieldValue(
  fieldKey: CompanyFieldKey,
  value: string
): { isValid: boolean; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { isValid: false, error: 'لا يمكن أن تكون القيمة فارغة.' };
  }

  if (trimmed.length > 200) {
    return { isValid: false, error: 'القيمة طويلة جداً (الحد الأقصى 200 حرف).' };
  }

  if (fieldKey === 'officialEmail') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return { isValid: false, error: 'صيغة البريد الإلكتروني غير صحيحة.' };
    }
  }

  if (fieldKey === 'baseCurrency' && trimmed.toUpperCase() !== 'EGP') {
    return { isValid: false, error: 'العملة المدعومة حالياً هي الجنيه المصري (EGP) فقط.' };
  }

  return { isValid: true };
}
