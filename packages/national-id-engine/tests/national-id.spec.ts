import { describe, it, expect } from 'vitest';
import {
  parseEgyptianNationalId,
  isValidEgyptianNationalId,
  detectGovernorateFromAddress,
  getGovernorateCodeByName,
  calculateNationalIdCheckDigit,
  validateNationalIdCheckDigit,
} from '../src/index.js';

describe('@alsaada/national-id-engine', () => {
  it('parses valid male National ID from 20th century (1995)', () => {
    // 2 (century 1900) 95 (1995) 05 (May) 15 (15th) 12 (Dakahlia) 015 (sequence) 3 (odd=male) 2 (valid Modulo-11 checksum)
    const result = parseEgyptianNationalId('29505151201532');
    expect(result.isValid).toBe(true);
    expect(result.info).toBeDefined();

    const info = result.info!;
    expect(info.nationalId).toBe('29505151201532');
    expect(info.birthDateString).toBe('1995-05-15');
    expect(info.gender).toBe('MALE');
    expect(info.genderArabic).toBe('ذكر');
    expect(info.governorateCode).toBe('12');
    expect(info.governorateNameAr).toBe('الدقهلية');
    expect(info.governorateNameEn).toBe('Dakahlia');
    expect(info.century).toBe(1900);
    expect(info.age).toBeGreaterThanOrEqual(30);
  });

  it('parses valid female National ID from 21st century (2002)', () => {
    // 3 (century 2000) 02 (2002) 08 (August) 10 (10th) 01 (Cairo) 024 (sequence) 2 (even=female) 5 (valid Modulo-11 checksum)
    const result = parseEgyptianNationalId('30208100102425');
    expect(result.isValid).toBe(true);
    expect(result.info).toBeDefined();

    const info = result.info!;
    expect(info.nationalId).toBe('30208100102425');
    expect(info.birthDateString).toBe('2002-08-10');
    expect(info.gender).toBe('FEMALE');
    expect(info.genderArabic).toBe('أنثى');
    expect(info.governorateCode).toBe('01');
    expect(info.governorateNameAr).toBe('القاهرة');
    expect(info.governorateNameEn).toBe('Cairo');
    expect(info.century).toBe(2000);
  });

  it('handles Eastern Arabic numerals seamlessly', () => {
    const result = parseEgyptianNationalId('٢٩٥٠٥١٥١٢٠١٥٣٢');
    expect(result.isValid).toBe(true);
    expect(result.info?.nationalId).toBe('29505151201532');
    expect(result.info?.birthDateString).toBe('1995-05-15');
  });

  it('handles spaces and hyphens gracefully', () => {
    const result = parseEgyptianNationalId(' 2-950515-12-01532 ');
    expect(result.isValid).toBe(true);
    expect(result.info?.nationalId).toBe('29505151201532');
  });

  it('rejects invalid lengths', () => {
    const shortResult = parseEgyptianNationalId('2950515120153');
    expect(shortResult.isValid).toBe(false);
    expect(shortResult.error).toContain('14 رقماً');

    const longResult = parseEgyptianNationalId('2950515120153199');
    expect(longResult.isValid).toBe(false);
  });

  it('rejects invalid century codes', () => {
    const result = parseEgyptianNationalId('49505151201531');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('رمز القرن');
  });

  it('rejects invalid months or calendar dates', () => {
    // Month 13
    const invalidMonth = parseEgyptianNationalId('29513151201531');
    expect(invalidMonth.isValid).toBe(false);
    expect(invalidMonth.error).toContain('شهر');

    // Feb 30 (invalid calendar day)
    const invalidFeb = parseEgyptianNationalId('29502301201531');
    expect(invalidFeb.isValid).toBe(false);
    expect(invalidFeb.error).toContain('تاريخ الميلاد');
  });

  it('rejects invalid governorate codes', () => {
    const invalidGov = parseEgyptianNationalId('29505159901531');
    expect(invalidGov.isValid).toBe(false);
    expect(invalidGov.error).toContain('المحافظة');
  });

  it('handles empty, null or undefined input safely', () => {
    expect(isValidEgyptianNationalId('')).toBe(false);
    expect(isValidEgyptianNationalId(null)).toBe(false);
    expect(isValidEgyptianNationalId(undefined)).toBe(false);
  });

  it('detects governorates from address text accurately', () => {
    expect(detectGovernorateFromAddress('القاهرة - مدينة نصر - شارع عباس العقاد')).toBe('القاهرة');
    expect(detectGovernorateFromAddress('الجيزة - الدقي - شارع التحرير')).toBe('الجيزة');
    expect(detectGovernorateFromAddress('بورسعيد - حي الشرق')).toBe('بورسعيد');
    expect(detectGovernorateFromAddress('الإسكندرية - سيدي جابر')).toBe('الإسكندرية');
    expect(detectGovernorateFromAddress('الغردقة - البحر الأحمر')).toBe('البحر الأحمر');
  });

  it('resolves governorate codes by name', () => {
    expect(getGovernorateCodeByName('القاهرة')).toBe('01');
    expect(getGovernorateCodeByName('الإسكندرية')).toBe('02');
    expect(getGovernorateCodeByName('بورسعيد')).toBe('03');
    expect(getGovernorateCodeByName('الجيزة')).toBe('21');
    expect(getGovernorateCodeByName('خارج الجمهورية (وافد)')).toBe('88');
  });

  it('calculates and validates 14th check digit (Modulo-11) correctly', () => {
    // Test calculateNationalIdCheckDigit
    const first13 = '2950515120153';
    // Weights: [2,7,6,5,4,3,2,7,6,5,4,3,2]
    // sum = 4+63+30+0+20+3+10+7+12+0+4+15+6 = 174
    // 174 % 11 = 9 => 11 - 9 = 2
    const calculated = calculateNationalIdCheckDigit(first13);
    expect(calculated).toBe(2);

    const validIdWithCalculatedDigit = `${first13}${calculated}`;
    expect(validateNationalIdCheckDigit(validIdWithCalculatedDigit)).toBe(true);

    // Non-matching check digit
    expect(validateNationalIdCheckDigit(`${first13}9`)).toBe(false);
  });

  it('allows non-blocking warning when strictCheckDigit is explicitly set to false', () => {
    const idWithDiffCheckDigit = '29505151201531'; // last digit is 1 instead of 2
    const result = parseEgyptianNationalId(idWithDiffCheckDigit, { strictCheckDigit: false });
    expect(result.isValid).toBe(true);
    expect(result.info?.isCheckDigitValid).toBe(false);
    expect(result.warning).toContain('تحذير إرشادي');
  });

  it('strictly rejects invalid check digit by default', () => {
    const idWithDiffCheckDigit = '29505151201531';
    const result = parseEgyptianNationalId(idWithDiffCheckDigit);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Modulo-11');
  });
});

