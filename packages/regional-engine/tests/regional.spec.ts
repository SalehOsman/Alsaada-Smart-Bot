import { describe, it, expect } from 'vitest';
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
  describe('Numbers normalization', () => {
    it('normalizes Eastern Arabic numerals to Western digits', () => {
      expect(normalizeDigits('١٢٣٤٥٦٧٨٩٠')).toBe('1234567890');
      expect(normalizeDigits('سلفة بمبلغ ١٥٠٠ جنيه')).toBe('سلفة بمبلغ 1500 جنيه');
    });

    it('normalizes Persian numerals to Western digits', () => {
      expect(normalizeDigits('۱۲۳۴۵۶۷۸۹۰')).toBe('1234567890');
    });

    it('handles empty or blank strings gracefully', () => {
      expect(normalizeDigits('')).toBe('');
    });

    it('parses regional numeric inputs accurately', () => {
      expect(parseRegionalNumber('١٥٠٠')).toBe(1500);
      expect(parseRegionalNumber(' 1,500.50 ')).toBe(1500.5);
      expect(parseRegionalNumber('١٬٥٠٠٫٧٥')).toBe(1500.75);
      expect(parseRegionalNumber(2500)).toBe(2500);
      expect(parseRegionalNumber('invalid_text')).toBeNull();
      expect(parseRegionalNumber(null)).toBeNull();
      expect(parseRegionalNumber(undefined)).toBeNull();
    });
  });

  describe('Currency formatting', () => {
    it('formats numbers with default currency (EGP / ج.م)', () => {
      expect(formatCurrency(1500)).toBe('1,500.00 ج.م');
      expect(formatCurrency(0)).toBe('0.00 ج.م');
      expect(formatCurrency(250.5)).toBe('250.50 ج.م');
    });

    it('supports custom currency configurations', () => {
      expect(formatCurrency(500, { symbol: 'ر.س', decimals: 0 })).toBe('500 ر.س');
      expect(formatCurrency(1200.755, { symbol: '$', decimals: 2 })).toBe('1,200.76 $');
    });
  });

  describe('Date and Time formatting', () => {
    it('formats date in YYYY-MM-DD standard', () => {
      const fixedDate = new Date('2026-09-07T12:00:00Z');
      const formatted = formatDate(fixedDate, DEFAULT_TIMEZONE);
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('formats date in DD-MM-YYYY (day-month-year) standard', () => {
      const fixedDate = new Date(Date.UTC(2028, 4, 26, 12, 0, 0)); // 26 May 2028
      expect(formatDateDMY(fixedDate)).toBe('26-05-2028');
    });

    it('formats datetime containing date and time components', () => {
      const fixedDate = new Date('2026-09-07T08:30:00Z');
      const formatted = formatDateTime(fixedDate, DEFAULT_TIMEZONE);
      expect(formatted).toContain('2026-09-07');
    });
  });

  describe('Universal parseFlexibleDate Engine', () => {
    it('parses DD/MM/YYYY and formats to DD-MM-YYYY', () => {
      const res = parseFlexibleDate('26/05/2028');
      expect(res.isValid).toBe(true);
      expect(res.formattedDMY).toBe('26-05-2028');
      expect(res.formattedISO).toBe('2028-05-26');
    });

    it('parses YYYY-MM-DD and formats to DD-MM-YYYY', () => {
      const res = parseFlexibleDate('2028-05-26');
      expect(res.isValid).toBe(true);
      expect(res.formattedDMY).toBe('26-05-2028');
    });

    it('parses Arabic numerals e.g. ٢٦-٠٥-٢٠٢٨', () => {
      const res = parseFlexibleDate('٢٦-٠٥-٢٠٢٨');
      expect(res.isValid).toBe(true);
      expect(res.formattedDMY).toBe('26-05-2028');
    });

    it('parses Year and Month only (YYYY/MM) as on Egyptian National IDs', () => {
      const res = parseFlexibleDate('2028/05');
      expect(res.isValid).toBe(true);
      expect(res.formattedDMY).toBe('01-05-2028');
      expect(res.formattedISO).toBe('2028-05-01');
    });

    it('parses date inside surrounding text e.g. البطاقة سارية حتى 2028/05', () => {
      const res = parseFlexibleDate('البطاقة سارية حتى 2028/05');
      expect(res.isValid).toBe(true);
      expect(res.formattedDMY).toBe('01-05-2028');
    });

    it('parses 2-digit years e.g. 26/05/28', () => {
      const res = parseFlexibleDate('26/05/28');
      expect(res.isValid).toBe(true);
      expect(res.formattedDMY).toBe('26-05-2028');
    });

    it('returns error for invalid dates', () => {
      const res = parseFlexibleDate('not-a-date');
      expect(res.isValid).toBe(false);
      expect(res.error).toBeDefined();
    });
  });
});
