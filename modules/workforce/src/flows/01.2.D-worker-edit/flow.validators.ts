import { normalizeDigits, parseFlexibleDate } from '@alsaada/regional-engine';
import { normalizeEgyptianPhone } from '@alsaada/core-components';
import type { EditableWorkerField } from './flow.types.js';

export const FIELD_LABELS: Record<EditableWorkerField, string> = {
  legacyCode: 'كود العامل القديم / الأرشيفي',
  name: 'الاسم الكامل الرباعي',
  nickname: 'اسم الشهرة المعتمد',
  phone: 'رقم الهاتف والواتساب',
  emergencyPhone: 'هاتف الطوارئ',
  walletNumber: 'رقم المحفظة / الحساب البنكي',
  idCardExpiryDate: 'تاريخ انتهاء سريان البطاقة',
  governorateCode: 'محافظة العامل',
  address: 'محل الإقامة / العنوان',
  drivingLicense: 'رخصة القيادة',
  militaryStatus: 'الموقف التجنيدي',
  maritalStatus: 'الحالة الاجتماعية',
};

export const FIELD_KEY_SHORT_MAP: Record<string, EditableWorkerField> = {
  leg: 'legacyCode',
  name: 'name',
  nick: 'nickname',
  phone: 'phone',
  wallet: 'walletNumber',
  gov: 'governorateCode',
  addr: 'address',
  exp: 'idCardExpiryDate',
  emPhone: 'emergencyPhone',
  lic: 'drivingLicense',
  mil: 'militaryStatus',
  mar: 'maritalStatus',
};

export const FIELD_TO_SHORT_MAP: Record<EditableWorkerField, string> = {
  legacyCode: 'leg',
  name: 'name',
  nickname: 'nick',
  phone: 'phone',
  walletNumber: 'wallet',
  governorateCode: 'gov',
  address: 'addr',
  idCardExpiryDate: 'exp',
  emergencyPhone: 'emPhone',
  drivingLicense: 'lic',
  militaryStatus: 'mil',
  maritalStatus: 'mar',
};

export function validateFieldValue(
  fieldKey: EditableWorkerField,
  rawValue: string
): { isValid: boolean; cleanValue?: string; error?: string } {
  const clean = rawValue.trim();
  if (!clean) {
    return { isValid: false, error: 'القيمة الجديدة لا يمكن أن تكون فارغة.' };
  }

  if (fieldKey === 'phone' || fieldKey === 'emergencyPhone' || fieldKey === 'walletNumber') {
    const digits = normalizeDigits(clean.replace(/[\s-]/g, ''));
    if (fieldKey === 'phone') {
      const normalized = normalizeEgyptianPhone(digits);
      if (!normalized) {
        return { isValid: false, error: 'رقم الهاتف غير صالح. يرجى إدخال رقم مصري صحيح (مثال: 01012345678).' };
      }
    }
    return { isValid: true, cleanValue: digits };
  }

  if (fieldKey === 'idCardExpiryDate') {
    const parsed = parseFlexibleDate(clean);
    if (!parsed.isValid || !parsed.date) {
      return { isValid: false, error: 'صيغة التاريخ غير صالحة. يرجى إدخال التاريخ بصيغة يوم-شهر-سنة (مثال: 26-05-2028).' };
    }
    return { isValid: true, cleanValue: clean };
  }

  if (fieldKey === 'name') {
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length < 2) {
      return { isValid: false, error: 'يرجى إدخال اسمين على الأقل (الاسم واسم الوالد).' };
    }
    return { isValid: true, cleanValue: clean };
  }

  return { isValid: true, cleanValue: clean };
}
