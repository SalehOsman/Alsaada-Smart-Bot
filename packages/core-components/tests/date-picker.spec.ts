import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseRegionalDate,
  validateDate,
  calculateDateRange,
  buildDatePickerKeyboard,
} from '../src/index.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('UniversalDatePicker', () => {
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

  describe('Date parsing', () => {
    it('1. parses ISO format YYYY-MM-DD', () => {
      // Arrange
      const isoString = '2026-09-07';

      // Act
      const dt = parseRegionalDate(isoString);

      // Assert
      expect(dt).not.toBeNull();
      expect(dt!.getUTCFullYear()).toBe(2026);
      expect(dt!.getUTCMonth()).toBe(8); // September (0-indexed)
      expect(dt!.getUTCDate()).toBe(7);
    });

    it('2. parses regional format DD-MM-YYYY with Eastern Arabic digits', () => {
      // Arrange
      const easternString = '٠٧-٠٩-٢٠٢٦';

      // Act
      const dt = parseRegionalDate(easternString);

      // Assert
      expect(dt).not.toBeNull();
      expect(dt!.getUTCFullYear()).toBe(2026);
      expect(dt!.getUTCDate()).toBe(7);
    });

    it('3. returns null for invalid strings', () => {
      // Arrange
      const invalid = 'invalid';
      const empty = '';

      // Act
      const resInvalid = parseRegionalDate(invalid);
      const resEmpty = parseRegionalDate(empty);

      // Assert
      expect(resInvalid).toBeNull();
      expect(resEmpty).toBeNull();
    });
  });

  describe('Date validation', () => {
    it('4. blocks future dates when allowFuture is false', () => {
      // Arrange
      const baseMs = PINNED_BASE_TIME.getTime();
      const future = new Date(baseMs + 7 * 24 * 60 * 60 * 1000);

      // Act
      const res = validateDate(future, { allowFuture: false });

      // Assert
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('المستقبل');
    });

    it('5. allows past dates', () => {
      // Arrange
      const past = new Date('2026-01-01');

      // Act
      const res = validateDate(past, { allowFuture: false });

      // Assert
      expect(res.isValid).toBe(true);
    });
  });

  describe('Date range calculation', () => {
    it('6. calculates inclusive days correctly', () => {
      // Arrange
      const start = new Date('2026-09-01');
      const end = new Date('2026-09-05');

      // Act
      const range = calculateDateRange(start, end);

      // Assert
      expect(range.daysCount).toBe(5);
    });
  });

  describe('Keyboard builder', () => {
    it('7. builds date preset keyboard with Today and Yesterday', () => {
      // Arrange
      const options = { backCallbackData: 'action:back' };

      // Act
      const kb = buildDatePickerKeyboard(options);

      // Assert
      expect(kb.inline_keyboard.length).toBe(2);
      expect(kb.inline_keyboard[0]![0]!.text).toContain('اليوم');
      expect(kb.inline_keyboard[0]![1]!.text).toContain('أمس');
    });
  });
});
