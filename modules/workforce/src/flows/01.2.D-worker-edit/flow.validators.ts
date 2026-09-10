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
  militaryStatus: 'الموقف التجنيدي',
  maritalStatus: 'الحالة الاجتماعية',
  nationalId: 'الرقم القومي / إثبات الشخصية',
  // Job & Operations
  jobTitleId: 'المسمى الوظيفي والمهنة',
  siteId: 'الموقع الميداني للعمليات',
  departmentId: 'الإدارة / القسم',
  hireDate: 'تاريخ التعيين والمباشرة',
  status: 'حالة العامل والتشغيل',
  shiftSystem: 'نظام الوردية والعمل',
  contractType: 'نوع التعاقد الوظيفي',
  drivingLicense: 'رخصة القيادة',
  barracksUnit: 'عنبر السكن بالكامب',
  bedNumber: 'رقم السرير / الغرفة',
  // Financial & Quotas
  dailyWage: 'اليومية الميدانية التعاقدية',
  basicSalary: 'الراتب الأساسي الشهري',
  fixedAllowances: 'الراتب الإضافي الشهري',
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
  mil: 'militaryStatus',
  mar: 'maritalStatus',
  nid: 'nationalId',
  job: 'jobTitleId',
  site: 'siteId',
  dept: 'departmentId',
  hire: 'hireDate',
  sts: 'status',
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
  militaryStatus: 'mil',
  maritalStatus: 'mar',
  nationalId: 'nid',
  jobTitleId: 'job',
  siteId: 'site',
  departmentId: 'dept',
  hireDate: 'hire',
  status: 'sts',
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

export function validateFieldValue(fieldKey: EditableWorkerField, value: string): { isValid: boolean; error?: string; cleanValue?: string } {
  const clean = value.trim();

  if (fieldKey === 'phone' || fieldKey === 'emergencyPhone') {
    const digits = normalizeDigits(clean.replace(/[\s-]/g, ''));
    if (!/^(010|011|012|015)\d{8}$/.test(digits)) {
      return { isValid: false, error: 'رقم الهاتف يجب أن يكون رقم مصري مكون من 11 رقم ويبدأ بـ (010, 011, 012, 015).' };
    }
    return { isValid: true, cleanValue: digits };
  }

  if (fieldKey === 'nationalId') {
    const digits = normalizeDigits(clean.replace(/[\s-]/g, ''));
    if (!/^\d{14}$/.test(digits)) {
      return { isValid: false, error: 'الرقم القومي يجب أن يتكون من 14 رقماً صحيحاً.' };
    }
    return { isValid: true, cleanValue: digits };
  }

  if (fieldKey === 'hireDate') {
    const parsed = parseFlexibleDate(clean);
    if (!parsed.isValid || !parsed.date) {
      return { isValid: false, error: 'صيغة تاريخ التعيين غير صالحة. يرجى إدخال التاريخ بصيغة يوم-شهر-سنة (مثال: 01-09-2026).' };
    }
    return { isValid: true, cleanValue: clean };
  }

  if (fieldKey === 'dailyWage' || fieldKey === 'basicSalary' || fieldKey === 'fixedAllowances') {
    const digits = normalizeDigits(clean.replace(/,/g, ''));
    const num = parseFloat(digits);
    if (isNaN(num) || num < 0) {
      return { isValid: false, error: 'يرجى إدخال قيمة عددية صحيحة أكبر من أو تساوي الصفر.' };
    }
    return { isValid: true, cleanValue: String(num) };
  }

  if (fieldKey === 'insuranceNumber') {
    const digits = normalizeDigits(clean.replace(/[\s-]/g, ''));
    if (!/^\d{8,10}$/.test(digits)) {
      return { isValid: false, error: 'الرقم التأميني يجب أن يتكون من 8 إلى 10 أرقام.' };
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

export function getReturnTab(fieldShort: string): import('./flow.types.js').WorkerProfileTab {
  if (['job', 'site', 'dept', 'hire', 'sts', 'shft', 'cntr', 'lic', 'barr', 'bed'].includes(fieldShort)) return 'JOB';
  if (['wage', 'bsal', 'fall', 'pmth', 'wallet', 'wown', 'inst', 'insno', 'insts', 'cgpol', 'cgbrd'].includes(fieldShort)) return 'FINANCE';
  if (['phone', 'emPhone', 'emName', 'ppes', 'ppeu', 'med'].includes(fieldShort)) return 'DOCS';
  return 'PERSONAL';
}
