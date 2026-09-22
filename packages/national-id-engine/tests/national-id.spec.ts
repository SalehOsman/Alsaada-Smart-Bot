import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseEgyptianNationalId,
  isValidEgyptianNationalId,
  detectGovernorateFromAddress,
  getGovernorateCodeByName,
  calculateNationalIdCheckDigit,
  validateNationalIdCheckDigit,
} from '../src/index.js';

const PINNED_BASE_TIME = new Date('2026-09-11T12:00:00.000Z');

describe('@alsaada/national-id-engine', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('parses valid male National ID from 20th century (1995)', () => {
    // Arrange
    const id = '29505151201532';

    // Act
    const result = parseEgyptianNationalId(id);

    // Assert
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
    expect(info.age).toBe(31);
    expect(info.gender).not.toBe('FEMALE');
  });

  it('parses valid female National ID from 21st century (2002)', () => {
    // Arrange
    const id = '30208100102425';

    // Act
    const result = parseEgyptianNationalId(id);

    // Assert
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
    expect(info.gender).not.toBe('MALE');
  });

  it('handles Eastern Arabic numerals seamlessly', () => {
    // Arrange
    const easternId = '٢٩٥٠٥١٥١٢٠١٥٣٢';

    // Act
    const result = parseEgyptianNationalId(easternId);

    // Assert
    expect(result.isValid).toBe(true);
    expect(result.info?.nationalId).toBe('29505151201532');
    expect(result.info?.birthDateString).toBe('1995-05-15');
    expect(result.error).toBeUndefined();
  });

  it('handles spaces and hyphens gracefully', () => {
    // Arrange
    const formattedId = ' 2-950515-12-01532 ';

    // Act
    const result = parseEgyptianNationalId(formattedId);

    // Assert
    expect(result.isValid).toBe(true);
    expect(result.info?.nationalId).toBe('29505151201532');
    expect(result.error).toBeUndefined();
  });

  it('rejects invalid lengths', () => {
    // Arrange
    const shortId = '2950515120153';
    const longId = '2950515120153199';

    // Act
    const shortResult = parseEgyptianNationalId(shortId);
    const longResult = parseEgyptianNationalId(longId);

    // Assert
    expect(shortResult.isValid).toBe(false);
    expect(shortResult.error).toContain('14 رقماً');
    expect(longResult.isValid).toBe(false);
  });

  it('rejects invalid century codes', () => {
    // Arrange
    const invalidCenturyId = '49505151201531';

    // Act
    const result = parseEgyptianNationalId(invalidCenturyId);

    // Assert
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('رمز القرن');
    expect(result.info).toBeUndefined();
  });

  it('rejects invalid months or calendar dates', () => {
    // Arrange
    const invalidMonthId = '29513151201531';
    const invalidFebId = '29502301201531';

    // Act
    const invalidMonth = parseEgyptianNationalId(invalidMonthId);
    const invalidFeb = parseEgyptianNationalId(invalidFebId);

    // Assert
    expect(invalidMonth.isValid).toBe(false);
    expect(invalidMonth.error).toContain('شهر');
    expect(invalidFeb.isValid).toBe(false);
    expect(invalidFeb.error).toContain('تاريخ الميلاد');
  });

  it('rejects invalid governorate codes', () => {
    // Arrange
    const invalidGovId = '29505159901531';

    // Act
    const invalidGov = parseEgyptianNationalId(invalidGovId);

    // Assert
    expect(invalidGov.isValid).toBe(false);
    expect(invalidGov.error).toContain('المحافظة');
    expect(invalidGov.info).toBeUndefined();
  });

  it('handles empty, null or undefined input safely', () => {
    // Arrange
    const emptyInput = '';
    const nullInput = null;
    const undefinedInput = undefined;

    // Act
    const emptyCheck = isValidEgyptianNationalId(emptyInput);
    const nullCheck = isValidEgyptianNationalId(nullInput);
    const undefinedCheck = isValidEgyptianNationalId(undefinedInput);

    // Assert
    expect(emptyCheck).toBe(false);
    expect(nullCheck).toBe(false);
    expect(undefinedCheck).toBe(false);
  });

  it('detects governorates from address text accurately', () => {
    // Arrange
    const addr1 = 'القاهرة - مدينة نصر - شارع عباس العقاد';
    const addr2 = 'الجيزة - الدقي - شارع التحرير';
    const addr3 = 'بورسعيد - حي الشرق';
    const addr4 = 'الإسكندرية - سيدي جابر';
    const addr5 = 'الغردقة - البحر الأحمر';

    // Act
    const res1 = detectGovernorateFromAddress(addr1);
    const res2 = detectGovernorateFromAddress(addr2);
    const res3 = detectGovernorateFromAddress(addr3);
    const res4 = detectGovernorateFromAddress(addr4);
    const res5 = detectGovernorateFromAddress(addr5);

    // Assert
    expect(res1).toBe('القاهرة');
    expect(res2).toBe('الجيزة');
    expect(res3).toBe('بورسعيد');
    expect(res4).toBe('الإسكندرية');
    expect(res5).toBe('البحر الأحمر');
    expect(detectGovernorateFromAddress('شارع مجهول تماماً')).toBeNull();
  });

  it('resolves governorate codes by name', () => {
    // Arrange
    const nameCairo = 'القاهرة';
    const nameAlex = 'الإسكندرية';
    const namePortSaid = 'بورسعيد';
    const nameGiza = 'الجيزة';
    const nameForeign = 'خارج الجمهورية (وافد)';

    // Act
    const codeCairo = getGovernorateCodeByName(nameCairo);
    const codeAlex = getGovernorateCodeByName(nameAlex);
    const codePortSaid = getGovernorateCodeByName(namePortSaid);
    const codeGiza = getGovernorateCodeByName(nameGiza);
    const codeForeign = getGovernorateCodeByName(nameForeign);

    // Assert
    expect(codeCairo).toBe('01');
    expect(codeAlex).toBe('02');
    expect(codePortSaid).toBe('03');
    expect(codeGiza).toBe('21');
    expect(codeForeign).toBe('88');
    expect(getGovernorateCodeByName('محافظة وهمية')).toBeNull();
  });

  it('calculates and validates 14th check digit (Modulo-11) correctly', () => {
    // Arrange
    const first13 = '2950515120153';

    // Act
    const calculated = calculateNationalIdCheckDigit(first13);
    const validIdWithCalculatedDigit = `${first13}${calculated}`;
    const isValidMatch = validateNationalIdCheckDigit(validIdWithCalculatedDigit);
    const isInvalidMatch = validateNationalIdCheckDigit(`${first13}9`);

    // Assert
    expect(calculated).toBe(2);
    expect(isValidMatch).toBe(true);
    expect(isInvalidMatch).toBe(false);
  });

  it('allows non-blocking warning when strictCheckDigit is explicitly set to false', () => {
    // Arrange
    const idWithDiffCheckDigit = '29505151201531';

    // Act
    const result = parseEgyptianNationalId(idWithDiffCheckDigit, { strictCheckDigit: false });

    // Assert
    expect(result.isValid).toBe(true);
    expect(result.info?.isCheckDigitValid).toBe(false);
    expect(result.warning).toContain('تحذير إرشادي');
  });

  it('strictly rejects invalid check digit by default', () => {
    // Arrange
    const idWithDiffCheckDigit = '29505151201531';

    // Act
    const result = parseEgyptianNationalId(idWithDiffCheckDigit);

    // Assert
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Modulo-11');
    expect(result.info).toBeUndefined();
  });
});
