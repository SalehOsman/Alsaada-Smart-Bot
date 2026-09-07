import { describe, it, expect } from 'vitest';
import {
  parseRegionalDate,
  validateDate,
  calculateDateRange,
  buildDatePickerKeyboard,
} from '../src/index.js';

describe('UniversalDatePicker', () => {
  describe('Date parsing', () => {
    it('parses ISO format YYYY-MM-DD', () => {
      const dt = parseRegionalDate('2026-09-07');
      expect(dt).not.toBeNull();
      expect(dt!.getUTCFullYear()).toBe(2026);
      expect(dt!.getUTCMonth()).toBe(8); // September (0-indexed)
      expect(dt!.getUTCDate()).toBe(7);
    });

    it('parses regional format DD-MM-YYYY with Eastern Arabic digits', () => {
      const dt = parseRegionalDate('٠٧-٠٩-٢٠٢٦');
      expect(dt).not.toBeNull();
      expect(dt!.getUTCFullYear()).toBe(2026);
      expect(dt!.getUTCDate()).toBe(7);
    });

    it('returns null for invalid strings', () => {
      expect(parseRegionalDate('invalid')).toBeNull();
      expect(parseRegionalDate('')).toBeNull();
    });
  });

  describe('Date validation', () => {
    it('blocks future dates when allowFuture is false', () => {
      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const res = validateDate(future, { allowFuture: false });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('المستقبل');
    });

    it('allows past dates', () => {
      const past = new Date('2026-01-01');
      const res = validateDate(past, { allowFuture: false });
      expect(res.isValid).toBe(true);
    });
  });

  describe('Date range calculation', () => {
    it('calculates inclusive days correctly', () => {
      const start = new Date('2026-09-01');
      const end = new Date('2026-09-05');
      const range = calculateDateRange(start, end);
      expect(range.daysCount).toBe(5);
    });
  });

  describe('Keyboard builder', () => {
    it('builds date preset keyboard with Today and Yesterday', () => {
      const kb = buildDatePickerKeyboard({ backCallbackData: 'action:back' });
      expect(kb.inline_keyboard.length).toBe(2);
      expect(kb.inline_keyboard[0]![0]!.text).toContain('اليوم');
      expect(kb.inline_keyboard[0]![1]!.text).toContain('أمس');
    });
  });
});
