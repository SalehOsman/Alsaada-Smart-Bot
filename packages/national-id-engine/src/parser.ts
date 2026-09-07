import { normalizeDigits } from '@alsaada/regional-engine';
import { EGYPTIAN_GOVERNORATES } from './constants.js';
import type { Gender, NationalIdInfo, NationalIdValidationResult } from './types.js';

/**
 * Validates and parses a 14-digit Egyptian National ID.
 */
export function parseEgyptianNationalId(rawInput: string | null | undefined): NationalIdValidationResult {
  if (!rawInput) {
    return { isValid: false, error: 'الرقم القومي مطلوب ولا يمكن أن يكون فارغاً' };
  }

  // 1. Normalize Eastern/Persian numerals and remove spaces/dashes
  const cleanId = normalizeDigits(rawInput.trim().replace(/[-\s]/g, ''));

  // 2. Format length check
  if (!/^\d{14}$/.test(cleanId)) {
    return {
      isValid: false,
      error: `الرقم القومي يجب أن يتكون من 14 رقماً بالضبط (المُدخل: ${cleanId.length} رقم)`,
    };
  }

  // 3. Century Code (Digit 1)
  const centuryDigit = cleanId[0]!;
  let centuryYear = 0;
  if (centuryDigit === '2') {
    centuryYear = 1900;
  } else if (centuryDigit === '3') {
    centuryYear = 2000;
  } else {
    return {
      isValid: false,
      error: 'رمز القرن في الرقم القومي غير صحيح (يجب أن يبدأ بـ 2 لمواليد 1900-1999 أو 3 لمواليد 2000 فما فوق)',
    };
  }

  // 4. Birth Date (Digits 2-7)
  const yearSuffix = parseInt(cleanId.substring(1, 3), 10);
  const month = parseInt(cleanId.substring(3, 5), 10);
  const day = parseInt(cleanId.substring(5, 7), 10);
  const fullYear = centuryYear + yearSuffix;

  if (month < 1 || month > 12) {
    return { isValid: false, error: `شهر الميلاد غير صحيح (${month})` };
  }

  if (day < 1 || day > 31) {
    return { isValid: false, error: `يوم الميلاد غير صحيح (${day})` };
  }

  const birthDate = new Date(Date.UTC(fullYear, month - 1, day));
  // Validate leap years & calendar bounds
  if (
    birthDate.getUTCFullYear() !== fullYear ||
    birthDate.getUTCMonth() !== month - 1 ||
    birthDate.getUTCDate() !== day
  ) {
    return { isValid: false, error: `تاريخ الميلاد في الرقم القومي غير صالح تقويمياً (${fullYear}-${month}-${day})` };
  }

  // Check that birthdate is not in the future
  const today = new Date();
  if (birthDate.getTime() > today.getTime()) {
    return { isValid: false, error: 'تاريخ الميلاد في الرقم القومي يقع في المستقبل' };
  }

  // 5. Governorate (Digits 8-9)
  const govCode = cleanId.substring(7, 9);
  const gov = EGYPTIAN_GOVERNORATES[govCode];
  if (!gov) {
    return { isValid: false, error: `كود المحافظة غير صحيح (${govCode})` };
  }

  // 6. Gender (Digit 13: Odd = Male, Even = Female)
  const genderDigit = parseInt(cleanId[12]!, 10);
  const gender: Gender = genderDigit % 2 !== 0 ? 'MALE' : 'FEMALE';
  const genderArabic = gender === 'MALE' ? 'ذكر' : 'أنثى';

  // 7. Age Calculation
  let age = today.getUTCFullYear() - fullYear;
  const currentMonth = today.getUTCMonth() + 1;
  const currentDay = today.getUTCDate();
  if (currentMonth < month || (currentMonth === month && currentDay < day)) {
    age--;
  }

  const mmStr = String(month).padStart(2, '0');
  const ddStr = String(day).padStart(2, '0');
  const birthDateString = `${fullYear}-${mmStr}-${ddStr}`;

  const info: NationalIdInfo = {
    nationalId: cleanId,
    isValid: true,
    birthDate,
    birthDateString,
    age,
    gender,
    genderArabic,
    governorateCode: govCode,
    governorateNameAr: gov.nameAr,
    governorateNameEn: gov.nameEn,
    century: centuryYear,
  };

  return {
    isValid: true,
    info,
  };
}

/**
 * Returns true if the provided National ID is strictly valid.
 */
export function isValidEgyptianNationalId(rawInput: string | null | undefined): boolean {
  return parseEgyptianNationalId(rawInput).isValid;
}
