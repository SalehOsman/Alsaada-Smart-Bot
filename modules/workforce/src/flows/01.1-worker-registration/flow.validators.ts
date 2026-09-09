import { parseEgyptianNationalId } from '@alsaada/national-id-engine';
import { normalizeDigits, parseFlexibleDate } from '@alsaada/regional-engine';
import { normalizeEgyptianPhone } from '@alsaada/core-components';
import type { WorkerValidationResult } from './flow.types.js';

export function validateWorkerIdentification(
  idType: 'NATIONAL_ID' | 'PASSPORT',
  rawId: string,
  extra?: { birthDate?: Date | undefined; gender?: 'MALE' | 'FEMALE' | undefined }
): WorkerValidationResult {
  if (!rawId || !rawId.trim()) {
    return { isValid: false, error: 'رقم الإثبات مطلوب ولا يمكن تركه فارغاً.' };
  }

  if (idType === 'NATIONAL_ID') {
    const parsed = parseEgyptianNationalId(rawId);
    if (!parsed.isValid || !parsed.info) {
      return { isValid: false, error: parsed.error || 'الرقم القومي غير صالح.' };
    }
    return {
      isValid: true,
      birthDate: parsed.info.birthDate,
      age: parsed.info.age,
      gender: parsed.info.gender,
      genderArabic: parsed.info.genderArabic,
      governorateCode: parsed.info.governorateCode,
      governorateNameAr: parsed.info.governorateNameAr,
    };
  }

  // Passport Validation
  const cleanPassport = normalizeDigits(rawId.trim().toUpperCase().replace(/[\s-]/g, ''));
  if (cleanPassport.length < 5 || cleanPassport.length > 20) {
    return {
      isValid: false,
      error: 'رقم جواز السفر غير صحيح (يجب أن يتراوح بين 5 و 20 حرفاً ورقم).',
    };
  }
  if (!extra?.birthDate) {
    return { isValid: false, error: 'تاريخ الميلاد إلزامي في حال تسجيل جواز السفر.' };
  }
  if (!extra?.gender) {
    return { isValid: false, error: 'تحديد النوع (ذكر / أنثى) إلزامي في حال تسجيل جواز السفر.' };
  }

  const today = new Date();
  let age = today.getFullYear() - extra.birthDate.getFullYear();
  const m = today.getMonth() - extra.birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < extra.birthDate.getDate())) {
    age--;
  }

  return {
    isValid: true,
    birthDate: extra.birthDate,
    age: Math.max(0, age),
    gender: extra.gender,
    genderArabic: extra.gender === 'MALE' ? 'ذكر' : 'أنثى',
    governorateCode: '88',
    governorateNameAr: 'خارج الجمهورية (وافد)',
  };
}

export function validateWorkerPhoneNumber(rawPhone: string): { isValid: boolean; normalized?: string; error?: string } {
  const clean = normalizeDigits(rawPhone.trim().replace(/[\s-]/g, ''));
  const normalized = normalizeEgyptianPhone(clean);
  if (!normalized) {
    return { isValid: false, error: 'رقم الهاتف غير صالح. يرجى إدخال رقم مصري صحيح يبدأ بـ 010 أو 011 أو 012 أو 015.' };
  }
  return { isValid: true, normalized: clean };
}

export function validateWorkerFullName(name: string): { isValid: boolean; error?: string } {
  const trimmed = name.trim();
  if (trimmed.length < 5) {
    return { isValid: false, error: 'الاسم قصير جداً. يرجى إدخال الاسم ثلاثياً أو رباعياً على الأقل.' };
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    return { isValid: false, error: 'يرجى إدخال اسمين على الأقل (الاسم واسم الوالد).' };
  }
  return { isValid: true };
}

export function validateWorkerHireDate(rawDate: string): { isValid: boolean; date?: Date; error?: string } {
  const parsed = parseFlexibleDate(rawDate);
  if (!parsed.isValid || !parsed.date) {
    return { isValid: false, error: 'صيغة التاريخ غير صالحة. يرجى كتابة التاريخ بصيغة يوم-شهر-سنة مثل: 01-09-2026.' };
  }
  return { isValid: true, date: parsed.date };
}
