export type Gender = 'MALE' | 'FEMALE';

export interface NationalIdInfo {
  nationalId: string;
  isValid: boolean;
  birthDate: Date;
  birthDateString: string; // YYYY-MM-DD
  age: number;
  gender: Gender;
  genderArabic: 'ذكر' | 'أنثى';
  governorateCode: string;
  governorateNameAr: string;
  governorateNameEn: string;
  century: number;
  isCheckDigitValid?: boolean | undefined;
}

export interface ParseNationalIdOptions {
  strictCheckDigit?: boolean | undefined;
}

export interface NationalIdValidationResult {
  isValid: boolean;
  error?: string | undefined;
  warning?: string | undefined;
  info?: NationalIdInfo | undefined;
}
