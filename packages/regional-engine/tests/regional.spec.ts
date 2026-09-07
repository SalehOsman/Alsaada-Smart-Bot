import { describe, it, expect } from 'vitest';
import {
  normalizeDigits,
  parseRegionalNumber,
  formatCurrency,
  formatDate,
  formatDateTime,
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

    it('formats datetime containing date and time components', () => {
      const fixedDate = new Date('2026-09-07T08:30:00Z');
      const formatted = formatDateTime(fixedDate, DEFAULT_TIMEZONE);
      expect(formatted).toContain('2026-09-07');
    });
  });
});
