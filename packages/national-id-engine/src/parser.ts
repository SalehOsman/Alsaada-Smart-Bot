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

/**
 * Detects Egyptian governorate from address text or common city/district names.
 */
export function detectGovernorateFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const norm = address
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');

  if (
    norm.includes('القاهره') ||
    norm.includes('قاهره') ||
    norm.includes('مدينه نصر') ||
    norm.includes('المعادي') ||
    norm.includes('مصر الجديده') ||
    norm.includes('عين شمس') ||
    norm.includes('حلوان') ||
    norm.includes('المرج') ||
    norm.includes('شبرا مصر') ||
    norm.includes('الزيتون')
  ) {
    return 'القاهرة';
  }
  if (
    norm.includes('الجيزه') ||
    norm.includes('جيزه') ||
    norm.includes('الدقي') ||
    norm.includes('العجوزه') ||
    norm.includes('الهرم') ||
    norm.includes('فيصل') ||
    norm.includes('اكتوبر') ||
    norm.includes('زايد') ||
    norm.includes('البدرشين') ||
    norm.includes('الحوامديه') ||
    norm.includes('العياط') ||
    norm.includes('الصف') ||
    norm.includes('اوسيم') ||
    norm.includes('بولاق الدكرور')
  ) {
    return 'الجيزة';
  }
  if (
    norm.includes('الاسكندريه') ||
    norm.includes('اسكندريه') ||
    norm.includes('سموحه') ||
    norm.includes('المنتزه') ||
    norm.includes('العجمي') ||
    norm.includes('سيدي جابر') ||
    norm.includes('الرمل') ||
    norm.includes('العامريه') ||
    norm.includes('برج العرب')
  ) {
    return 'الإسكندرية';
  }
  if (
    norm.includes('القليوبيه') ||
    norm.includes('قليوبيه') ||
    norm.includes('شبرا الخيمه') ||
    norm.includes('بنها') ||
    norm.includes('قليوب') ||
    norm.includes('طوخ') ||
    norm.includes('العبور') ||
    norm.includes('الخانكه') ||
    norm.includes('القناطر الخيريه')
  ) {
    return 'القليوبية';
  }
  if (
    norm.includes('الشرقيه') ||
    norm.includes('شرقيه') ||
    norm.includes('الزقازيق') ||
    norm.includes('بلبيس') ||
    norm.includes('العاشر من رمضان') ||
    norm.includes('فاقوس') ||
    norm.includes('ابو حماد') ||
    norm.includes('منيا القمح')
  ) {
    return 'الشرقية';
  }
  if (
    norm.includes('الدقهليه') ||
    norm.includes('دقهليه') ||
    norm.includes('المنصوره') ||
    norm.includes('ميت غمر') ||
    norm.includes('السنبلاوين') ||
    norm.includes('دكرنس') ||
    norm.includes('بلقاس') ||
    norm.includes('شربين') ||
    norm.includes('اجا')
  ) {
    return 'الدقهلية';
  }
  if (
    norm.includes('البحيره') ||
    norm.includes('بحيره') ||
    norm.includes('دمنهور') ||
    norm.includes('كفر الدوار') ||
    norm.includes('ايتاي البارود') ||
    norm.includes('كوم حماده') ||
    norm.includes('رشيد') ||
    norm.includes('ادكو') ||
    norm.includes('وادي النطرون')
  ) {
    return 'البحيرة';
  }
  if (
    norm.includes('الغربيه') ||
    norm.includes('غربيه') ||
    norm.includes('طنطا') ||
    norm.includes('المحله') ||
    norm.includes('زفتي') ||
    norm.includes('كفر الزيات') ||
    norm.includes('سمنود')
  ) {
    return 'الغربية';
  }
  if (
    norm.includes('المنوفيه') ||
    norm.includes('منوفيه') ||
    norm.includes('شبين الكوم') ||
    norm.includes('منوف') ||
    norm.includes('اشمون') ||
    norm.includes('قويسنا') ||
    norm.includes('بركه السبع') ||
    norm.includes('السادات')
  ) {
    return 'المنوفية';
  }
  if (
    norm.includes('كفر الشيخ') ||
    norm.includes('دسوق') ||
    norm.includes('فوه') ||
    norm.includes('مطوبس') ||
    norm.includes('بيلا') ||
    norm.includes('بلطيم')
  ) {
    return 'كفر الشيخ';
  }
  if (
    norm.includes('دمياط') ||
    norm.includes('راس البر') ||
    norm.includes('فارسكور') ||
    norm.includes('الزرقا')
  ) {
    return 'دمياط';
  }
  if (
    norm.includes('بورسعيد') ||
    norm.includes('بور سعيد') ||
    norm.includes('بورفؤاد') ||
    norm.includes('المناخ') ||
    norm.includes('الزهور')
  ) {
    return 'بورسعيد';
  }
  if (
    norm.includes('السويس') ||
    norm.includes('سويس') ||
    norm.includes('الاربعين') ||
    norm.includes('عتاقه')
  ) {
    return 'السويس';
  }
  if (
    norm.includes('الاسماعيليه') ||
    norm.includes('اسماعيليه') ||
    norm.includes('التل الكبير') ||
    norm.includes('فايد') ||
    norm.includes('القنطره')
  ) {
    return 'الإسماعيلية';
  }
  if (
    norm.includes('الفيوم') ||
    norm.includes('فيوم') ||
    norm.includes('سنورس') ||
    norm.includes('اطسا') ||
    norm.includes('طاميه') ||
    norm.includes('ابشواي')
  ) {
    return 'الفيوم';
  }
  if (
    norm.includes('بني سويف') ||
    norm.includes('الواسطي') ||
    norm.includes('ناصر') ||
    norm.includes('اهناسيا') ||
    norm.includes('ببا') ||
    norm.includes('الفشن')
  ) {
    return 'بني سويف';
  }
  if (
    norm.includes('المنيا') ||
    norm.includes('منيا') ||
    norm.includes('مغاغه') ||
    norm.includes('بني مزار') ||
    norm.includes('مطاي') ||
    norm.includes('سمالوط') ||
    norm.includes('ملوي')
  ) {
    return 'المنيا';
  }
  if (
    norm.includes('اسيوط') ||
    norm.includes('ديروط') ||
    norm.includes('القوصيه') ||
    norm.includes('ابنوب') ||
    norm.includes('منفلوط') ||
    norm.includes('ابو تيج')
  ) {
    return 'أسيوط';
  }
  if (
    norm.includes('سوهاج') ||
    norm.includes('طهطا') ||
    norm.includes('جرجا') ||
    norm.includes('اخميم') ||
    norm.includes('المراغه') ||
    norm.includes('طما') ||
    norm.includes('البلينا')
  ) {
    return 'سوهاج';
  }
  if (
    norm.includes('قنا') ||
    norm.includes('نجع حمادي') ||
    norm.includes('قوص') ||
    norm.includes('دشنا') ||
    norm.includes('ابو تشت') ||
    norm.includes('فرشوط')
  ) {
    return 'قنا';
  }
  if (
    norm.includes('الاقصر') ||
    norm.includes('اقصر') ||
    norm.includes('اسنا') ||
    norm.includes('ارمنت')
  ) {
    return 'الأقصر';
  }
  if (
    norm.includes('اسوان') ||
    norm.includes('كوم امبو') ||
    norm.includes('ادفو') ||
    norm.includes('نصر النوبه') ||
    norm.includes('دراو')
  ) {
    return 'أسوان';
  }
  if (
    norm.includes('البحر الاحمر') ||
    norm.includes('الغردقه') ||
    norm.includes('سفاجا') ||
    norm.includes('القصير') ||
    norm.includes('مرسي علم') ||
    norm.includes('راس غارب')
  ) {
    return 'البحر الأحمر';
  }
  if (
    norm.includes('الوادي الجديد') ||
    norm.includes('الخارجه') ||
    norm.includes('الداخله') ||
    norm.includes('الفرافره')
  ) {
    return 'الوادي الجديد';
  }
  if (
    norm.includes('مطروح') ||
    norm.includes('مرسي مطروح') ||
    norm.includes('الحمام') ||
    norm.includes('العلمين') ||
    norm.includes('الضبعة') ||
    norm.includes('سيوه')
  ) {
    return 'مطروح';
  }
  if (
    norm.includes('شمال سيناء') ||
    norm.includes('العريش') ||
    norm.includes('الشيخ زويد') ||
    norm.includes('رفح') ||
    norm.includes('بئر العبد')
  ) {
    return 'شمال سيناء';
  }
  if (
    norm.includes('جنوب سيناء') ||
    norm.includes('شرم الشيخ') ||
    norm.includes('الطور') ||
    norm.includes('دهب') ||
    norm.includes('نويبع') ||
    norm.includes('طابا')
  ) {
    return 'جنوب سيناء';
  }

  return null;
}

/**
 * Resolves governorate code ('01', '02', etc.) from Arabic governorate name.
 */
export function getGovernorateCodeByName(nameAr: string | null | undefined): string | null {
  if (!nameAr) return null;
  const clean = nameAr.trim().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

  if (clean.includes('خارج الجمهوريه') || clean.includes('وافد')) {
    return '88';
  }

  for (const [code, info] of Object.entries(EGYPTIAN_GOVERNORATES)) {
    const govClean = info.nameAr.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
    if (clean === govClean || clean.includes(govClean) || govClean.includes(clean)) {
      return code;
    }
  }
  return null;
}
