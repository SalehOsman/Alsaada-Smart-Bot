import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizeDigits,
  parseRegionalNumber,
  formatCurrency,
  formatDate,
  formatDateDMY,
  formatDateTime,
  parseFlexibleDate,
  DEFAULT_CURRENCY,
  DEFAULT_TIMEZONE,
} from '../src/index.js';

describe('@alsaada/regional-engine', () => {
  const PINNED_BASE_TIME = new Date('2026-03-03T12:00:00.000Z');
  let stdoutSpy: any;
  let stderrSpy: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;
  let consoleInfoSpy: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleInfoSpy.mockRestore();
  });

  describe('Numbers normalization', () => {
    it('normalizes Eastern Arabic numerals to Western digits', () => {
      // Arrange
      const rawNumbers = '١٢٣٤٥٦٧٨٩٠';
      const mixedText = 'سلفة بمبلغ ١٥٠٠ جنيه';

      // Act
      const normalizedNumbers = normalizeDigits(rawNumbers);
      const normalizedText = normalizeDigits(mixedText);

      // Assert
      expect(normalizedNumbers).toBe('1234567890');
      expect(normalizedText).toBe('سلفة بمبلغ 1500 جنيه');
      expect(normalizedNumbers).not.toContain('١');
    });

    it('normalizes Persian numerals to Western digits', () => {
      // Arrange
      const rawPersian = '۱۲۳۴۵۶۷۸۹۰';

      // Act
      const normalized = normalizeDigits(rawPersian);

      // Assert
      expect(normalized).toBe('1234567890');
      expect(normalized).not.toContain('۲');
    });

    it('handles empty or blank strings gracefully', () => {
      // Arrange
      const empty = '';

      // Act
      const res = normalizeDigits(empty);

      // Assert
      expect(res).toBe('');
      expect(res).not.toBe('0');
    });

    it('parses regional numeric inputs accurately', () => {
      // Arrange
      const easternNum = '١٥٠٠';
      const westernWithCommas = ' 1,500.50 ';
      const arabicFormatted = '١٬٥٠٠٫٧٥';
      const numberInput = 2500;
      const invalidText = 'invalid_text';

      // Act
      const resEastern = parseRegionalNumber(easternNum);
      const resWestern = parseRegionalNumber(westernWithCommas);
      const resArabic = parseRegionalNumber(arabicFormatted);
      const resNum = parseRegionalNumber(numberInput);
      const resInvalid = parseRegionalNumber(invalidText);
      const resNull = parseRegionalNumber(null);
      const resUndef = parseRegionalNumber(undefined);
      const resInf = parseRegionalNumber(Infinity);
      const resNegInf = parseRegionalNumber(-Infinity);
      const resStrInf = parseRegionalNumber('Infinity');
      const resStrNegInf = parseRegionalNumber('-Infinity');
      const resNaN = parseRegionalNumber(NaN);

      // Assert
      expect(resEastern).toBe(1500);
      expect(resWestern).toBe(1500.5);
      expect(resArabic).toBe(1500.75);
      expect(resNum).toBe(2500);
      expect(resInvalid).toBeNull();
      expect(resNull).toBeNull();
      expect(resUndef).toBeNull();
      expect(resInf).toBeNull();
      expect(resNegInf).toBeNull();
      expect(resStrInf).toBeNull();
      expect(resStrNegInf).toBeNull();
      expect(resNaN).toBeNull();
    });
  });

  describe('Currency formatting', () => {
    it('formats numbers with default currency (EGP / ج.م)', () => {
      // Arrange
      const val1 = 1500;
      const val2 = 0;
      const val3 = 250.5;

      // Act
      const curr1 = formatCurrency(val1);
      const curr2 = formatCurrency(val2);
      const curr3 = formatCurrency(val3);

      // Assert
      expect(curr1).toBe('1,500.00 ج.م');
      expect(curr2).toBe('0.00 ج.م');
      expect(curr3).toBe('250.50 ج.م');
      expect(curr1).not.toBe('1500');
    });

    it('supports custom currency configurations', () => {
      // Arrange
      const sarVal = 500;
      const usdVal = 1200.755;

      // Act
      const sarFormatted = formatCurrency(sarVal, { symbol: 'ر.س', decimals: 0 });
      const usdFormatted = formatCurrency(usdVal, { symbol: '$', decimals: 2 });

      // Assert
      expect(sarFormatted).toBe('500 ر.س');
      expect(usdFormatted).toBe('1,200.76 $');
      expect(sarFormatted).not.toContain('ج.م');
    });
  });

  describe('Date and Time formatting', () => {
    it('formats date in YYYY-MM-DD standard', () => {
      // Arrange
      const fixedDate = new Date('2026-09-07T12:00:00Z');

      // Act
      const formatted = formatDate(fixedDate, DEFAULT_TIMEZONE);

      // Assert
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(formatted).not.toContain('undefined');
    });

    it('formats date in DD-MM-YYYY (day-month-year) standard', () => {
      // Arrange
      const fixedDate = new Date(Date.UTC(2028, 4, 26, 12, 0, 0));

      // Act
      const formatted = formatDateDMY(fixedDate);

      // Assert
      expect(formatted).toBe('26-05-2028');
      expect(formatted).not.toBe('2028-05-26');
    });

    it('formats datetime containing date and time components', () => {
      // Arrange
      const fixedDate = new Date('2026-09-07T08:30:00Z');

      // Act
      const formatted = formatDateTime(fixedDate, DEFAULT_TIMEZONE);

      // Assert
      expect(formatted).toContain('2026-09-07');
      expect(formatted).not.toBe('');
    });
  });

  describe('Universal parseFlexibleDate Engine', () => {
    it('parses DD/MM/YYYY and formats to DD-MM-YYYY', () => {
      // Arrange
      const dateStr = '26/05/2028';

      // Act
      const res = parseFlexibleDate(dateStr);

      // Assert
      expect(res.isValid).toBe(true);
      expect(res.formattedDMY).toBe('26-05-2028');
      expect(res.formattedISO).toBe('2028-05-26');
      expect(res.error).toBeUndefined();
    });

    it('parses YYYY-MM-DD and formats to DD-MM-YYYY', () => {
      // Arrange
      const dateStr = '2028-05-26';

      // Act
      const res = parseFlexibleDate(dateStr);

      // Assert
      expect(res.isValid).toBe(true);
      expect(res.formattedDMY).toBe('26-05-2028');
      expect(res.error).toBeUndefined();
    });

    it('parses Arabic numerals e.g. ٢٦-٠٥-٢٠٢٨', () => {
      // Arrange
      const dateStr = '٢٦-٠٥-٢٠٢٨';

      // Act
      const res = parseFlexibleDate(dateStr);

      // Assert
      expect(res.isValid).toBe(true);
      expect(res.formattedDMY).toBe('26-05-2028');
      expect(res.error).toBeUndefined();
    });

    it('parses Year and Month only (YYYY/MM) as on Egyptian National IDs', () => {
      // Arrange
      const dateStr = '2028/05';

      // Act
      const res = parseFlexibleDate(dateStr);

      // Assert
      expect(res.isValid).toBe(true);
      expect(res.formattedDMY).toBe('01-05-2028');
      expect(res.formattedISO).toBe('2028-05-01');
      expect(res.error).toBeUndefined();
    });

    it('parses date inside surrounding text e.g. البطاقة سارية حتى 2028/05', () => {
      // Arrange
      const dateStr = 'البطاقة سارية حتى 2028/05';

      // Act
      const res = parseFlexibleDate(dateStr);

      // Assert
      expect(res.isValid).toBe(true);
      expect(res.formattedDMY).toBe('01-05-2028');
      expect(res.error).toBeUndefined();
    });

    it('parses 2-digit years e.g. 26/05/28', () => {
      // Arrange
      const dateStr = '26/05/28';

      // Act
      const res = parseFlexibleDate(dateStr);

      // Assert
      expect(res.isValid).toBe(true);
      expect(res.formattedDMY).toBe('26-05-2028');
      expect(res.error).toBeUndefined();
    });

    it('returns error for invalid dates', () => {
      // Arrange
      const invalidDateStr = 'not-a-date';

      // Act
      const res = parseFlexibleDate(invalidDateStr);

      // Assert
      expect(res.isValid).toBe(false);
      expect(res.error).toBeDefined();
      expect(res.formattedDMY).toBeUndefined();
    });
  });
});
