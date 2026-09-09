import { normalizeDigits, parseFlexibleDate } from '@alsaada/regional-engine';
import { normalizeEgyptianPhone } from '@alsaada/core-components';
import type { EditableWorkerField } from './flow.types.js';

export const FIELD_LABELS: Record<EditableWorkerField, string> = {
  // Personal & ID
  legacyCode: 'كود العامل القديم / الأرشيفي',
  name: 'الاسم الكامل الرباعي',
  nickname: 'اسم الشهرة المعتمد',
  governorateCode: 'محافظة العامل',
  address: 'محل الإقامة / العنوان',
  idCardExpiryDate: 'تاريخ انتهاء سريان البطاقة',
  bloodType: 'فصيلة الدم',
  militaryStatus: 'الموقف التجنيدي',
  maritalStatus: 'الحالة الاجتماعية',
  // Job & Operations
  shiftSystem: 'نظام الوردية والعمل',
  contractType: 'نوع التعاقد الوظيفي',
  drivingLicense: 'رخصة القيادة',
  barracksUnit: 'عنبر السكن بالكامب',
  bedNumber: 'رقم السرير / الغرفة',
  // Financial & Quotas
  dailyWage: 'اليومية الميدانية التعاقدية',
  basicSalary: 'الراتب الأساسي الشهري',
  fixedAllowances: 'البدلات الثابتة الشهرية',
  paymentMethod: 'طريقة صرف المستحقات',
  walletNumber: 'رقم المحفظة / الحساب البنكي',
  walletOwnerName: 'اسم صاحب المحفظة المسجل',
  instaPayHandle: 'معرف إنستاباي (InstaPay)',
  insuranceNumber: 'الرقم التأميني',
  insuranceStatus: 'الموقف من التأمينات الاجتماعية',
  canteenCigarettePolicy: 'سياسة مخصص السجائر',
  cigaretteBrand: 'نوع وصنف السجائر المعتمد',
  // Contacts & Safety
  phone: 'رقم الهاتف والواتساب',
  emergencyPhone: 'هاتف الطوارئ البديل',
  emergencyContactName: 'اسم جهة اتصال الطوارئ',
  ppeShoeSize: 'مقاس حذاء السلامة (السيفتي)',
  ppeUniformSize: 'مقاس زي العمل (اليونيفورم)',
  medicalNotes: 'الملاحظات الطبية والحساسية',
};

export const FIELD_KEY_SHORT_MAP: Record<string, EditableWorkerField> = {
  leg: 'legacyCode',
  name: 'name',
  nick: 'nickname',
  gov: 'governorateCode',
  addr: 'address',
  exp: 'idCardExpiryDate',
  bld: 'bloodType',
  mil: 'militaryStatus',
  mar: 'maritalStatus',
  shft: 'shiftSystem',
  cntr: 'contractType',
  lic: 'drivingLicense',
  barr: 'barracksUnit',
  bed: 'bedNumber',
  wage: 'dailyWage',
  bsal: 'basicSalary',
  fall: 'fixedAllowances',
  pmth: 'paymentMethod',
  wallet: 'walletNumber',
  wown: 'walletOwnerName',
  inst: 'instaPayHandle',
  insno: 'insuranceNumber',
  insts: 'insuranceStatus',
  cgpol: 'canteenCigarettePolicy',
  cgbrd: 'cigaretteBrand',
  phone: 'phone',
  emPhone: 'emergencyPhone',
  emName: 'emergencyContactName',
  ppes: 'ppeShoeSize',
  ppeu: 'ppeUniformSize',
  med: 'medicalNotes',
};

export const FIELD_TO_SHORT_MAP: Record<EditableWorkerField, string> = {
  legacyCode: 'leg',
  name: 'name',
  nickname: 'nick',
  governorateCode: 'gov',
  address: 'addr',
  idCardExpiryDate: 'exp',
  bloodType: 'bld',
  militaryStatus: 'mil',
  maritalStatus: 'mar',
  shiftSystem: 'shft',
  contractType: 'cntr',
  drivingLicense: 'lic',
  barracksUnit: 'barr',
  bedNumber: 'bed',
  dailyWage: 'wage',
  basicSalary: 'bsal',
  fixedAllowances: 'fall',
  paymentMethod: 'pmth',
  walletNumber: 'wallet',
  walletOwnerName: 'wown',
  instaPayHandle: 'inst',
  insuranceNumber: 'insno',
  insuranceStatus: 'insts',
  canteenCigarettePolicy: 'cgpol',
  cigaretteBrand: 'cgbrd',
  phone: 'phone',
  emergencyPhone: 'emPhone',
  emergencyContactName: 'emName',
  ppeShoeSize: 'ppes',
  ppeUniformSize: 'ppeu',
  medicalNotes: 'med',
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

  if (fieldKey === 'insuranceNumber') {
    const digits = normalizeDigits(clean.replace(/[\s-]/g, ''));
    if (!/^\d{7,10}$/.test(digits)) {
      return { isValid: false, error: 'الرقم التأميني يجب أن يتكون من 7 إلى 10 أرقام.' };
    }
    return { isValid: true, cleanValue: digits };
  }

  if (fieldKey === 'dailyWage' || fieldKey === 'basicSalary' || fieldKey === 'fixedAllowances') {
    const normalized = normalizeDigits(clean.replace(/,/g, ''));
    const num = parseFloat(normalized);
    if (isNaN(num) || num < 0) {
      return { isValid: false, error: 'المبلغ المالي يجب أن يكون رقماً موجباً.' };
    }
    return { isValid: true, cleanValue: String(num) };
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

  if (fieldKey === 'bloodType') {
    const upper = clean.toUpperCase().replace(/\s+/g, '');
    const valid = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    if (!valid.includes(upper)) {
      return { isValid: false, error: 'فصيلة الدم غير صالحة. الفصائل المقبولة: A+, A-, B+, B-, AB+, AB-, O+, O-' };
    }
    return { isValid: true, cleanValue: upper };
  }

  return { isValid: true, cleanValue: clean };
}

export function getReturnTab(fieldShort: string): import('./flow.types.js').WorkerProfileTab {
  if (['shft', 'cntr', 'lic', 'barr', 'bed'].includes(fieldShort)) return 'JOB';
  if (['wage', 'bsal', 'fall', 'pmth', 'wallet', 'wown', 'inst', 'insno', 'insts', 'cgpol', 'cgbrd'].includes(fieldShort)) return 'FINANCE';
  if (['phone', 'emPhone', 'emName', 'ppes', 'ppeu', 'med'].includes(fieldShort)) return 'DOCS';
  return 'PERSONAL';
}

