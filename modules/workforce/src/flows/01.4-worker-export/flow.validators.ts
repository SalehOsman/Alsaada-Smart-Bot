import { parseEgyptianNationalId } from '@alsaada/national-id-engine';
import { normalizeDigits } from '@alsaada/regional-engine';
import type { WorkerRowData } from './flow.types.js';

export function validateFileExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.xlsx') || lower.endsWith('.xls');
}

export function validateWorkerRow(
  row: WorkerRowData,
  validJobCodes: Set<string>,
  validSiteCodes: Set<string>
): string[] {
  const errors: string[] = [];
  const prefix = `صف ${row.rowNumber}: `;

  // 1. Full name validation
  const nameParts = row.fullName.trim().split(/\s+/).filter(Boolean);
  if (nameParts.length < 3) {
    errors.push(`${prefix}الاسم يجب أن يكون ثلاثياً على الأقل (المسجل: "${row.fullName}").`);
  }

  // 2. ID Validation
  const cleanId = normalizeDigits(row.idNumber).trim();
  if (row.idType === 'NATIONAL_ID') {
    const nidResult = parseEgyptianNationalId(cleanId);
    if (!nidResult.isValid) {
      errors.push(`${prefix}الرقم القومي غير صحيح (${cleanId}): ${nidResult.error || 'رقم غير مطابق للمواصفات القياسية'}.`);
    }
  } else {
    // Passport
    if (cleanId.length < 5) {
      errors.push(`${prefix}رقم جواز السفر غير صحيح أو قصير جداً (${cleanId}).`);
    }
    if (!row.birthDate) {
      errors.push(`${prefix}تاريخ الميلاد إلزامي للعمالة الوافدة حاملي جواز السفر.`);
    }
    if (!row.gender) {
      errors.push(`${prefix}تحديد النوع (ذكر/أنثى) إلزامي لحاملي جواز السفر.`);
    }
  }

  // 3. Phone validation
  const cleanPhone = normalizeDigits(row.phone).replace(/\D/g, '');
  if (!cleanPhone || cleanPhone.length < 10) {
    errors.push(`${prefix}رقم الهاتف والواتساب غير صحيح (${row.phone}).`);
  }

  // 4. Job code validation
  const cleanJobCode = row.jobCode.trim();
  if (!cleanJobCode || !validJobCodes.has(cleanJobCode)) {
    errors.push(`${prefix}كود الوظيفة (${cleanJobCode}) غير مسجل بالنظام.`);
  }

  // 5. Site code validation
  const cleanSiteCode = row.siteCode.trim();
  if (!cleanSiteCode || !validSiteCodes.has(cleanSiteCode)) {
    errors.push(`${prefix}كود الموقع (${cleanSiteCode}) غير مسجل بالنظام.`);
  }

  return errors;
}

export const WorkerExportValidators = {
  validateFileExtension,
  validateWorkerRow,
} as const;
