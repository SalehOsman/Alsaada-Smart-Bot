import { describe, it, expect } from 'vitest';
import {
  parseEgyptianNationalId,
  isValidEgyptianNationalId,
} from '../src/index.js';

describe('@alsaada/national-id-engine', () => {
  it('parses valid male National ID from 20th century (1995)', () => {
    // 2 (century 1900) 95 (1995) 05 (May) 15 (15th) 12 (Dakahlia) 015 (sequence) 3 (odd=male) 1 (checksum)
    const result = parseEgyptianNationalId('29505151201531');
    expect(result.isValid).toBe(true);
    expect(result.info).toBeDefined();

    const info = result.info!;
    expect(info.nationalId).toBe('29505151201531');
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
    // 3 (century 2000) 02 (2002) 08 (August) 10 (10th) 01 (Cairo) 024 (sequence) 2 (even=female) 2 (checksum)
    const result = parseEgyptianNationalId('30208100102422');
    expect(result.isValid).toBe(true);
    expect(result.info).toBeDefined();

    const info = result.info!;
    expect(info.nationalId).toBe('30208100102422');
    expect(info.birthDateString).toBe('2002-08-10');
    expect(info.gender).toBe('FEMALE');
    expect(info.genderArabic).toBe('أنثى');
    expect(info.governorateCode).toBe('01');
    expect(info.governorateNameAr).toBe('القاهرة');
    expect(info.governorateNameEn).toBe('Cairo');
    expect(info.century).toBe(2000);
  });

  it('handles Eastern Arabic numerals seamlessly', () => {
    const result = parseEgyptianNationalId('٢٩٥٠٥١٥١٢٠١٥٣١');
    expect(result.isValid).toBe(true);
    expect(result.info?.nationalId).toBe('29505151201531');
    expect(result.info?.birthDateString).toBe('1995-05-15');
  });

  it('handles spaces and hyphens gracefully', () => {
    const result = parseEgyptianNationalId(' 2-950515-12-01531 ');
    expect(result.isValid).toBe(true);
    expect(result.info?.nationalId).toBe('29505151201531');
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
});
