import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateQuantity,
  buildQuantityPickerKeyboard,
} from '../src/index.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('UniversalQuantityPicker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
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

  describe('Quantity validation', () => {
    it('1. accepts integer quantities for discrete units', () => {
      // Arrange
      const rawInput = '5';
      const options = { unitType: 'DISCRETE' as const, unitName: 'علبة' };

      // Act
      const res = validateQuantity(rawInput, options);

      // Assert
      expect(res.isValid).toBe(true);
      expect(res.quantity).toBe(5);
      expect(res.error).toBeUndefined();
    });

    it('2. rejects decimal fractions for discrete units (e.g. cigarettes or meals)', () => {
      // Arrange
      const rawInput = '2.5';
      const options = { unitType: 'DISCRETE' as const, unitName: 'خرطوشة' };

      // Act
      const res = validateQuantity(rawInput, options);

      // Assert
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('غير قابلة للتجزئة');
      expect(res.quantity).toBeUndefined();
    });

    it('3. accepts decimal quantities for continuous units (e.g. fuel liters, phosphate tons)', () => {
      // Arrange
      const rawInput = '150.75';
      const options = { unitType: 'CONTINUOUS' as const, unitName: 'لتر' };

      // Act
      const res = validateQuantity(rawInput, options);

      // Assert
      expect(res.isValid).toBe(true);
      expect(res.quantity).toBe(150.75);
      expect(res.error).toBeUndefined();
    });

    it('4. rejects zero or negative quantities', () => {
      // Arrange
      const zeroInput = 0;
      const negativeInput = -5;

      // Act
      const resZero = validateQuantity(zeroInput);
      const resNeg = validateQuantity(negativeInput);

      // Assert
      expect(resZero.isValid).toBe(false);
      expect(resNeg.isValid).toBe(false);
      expect(resZero.error).toBeDefined();
      expect(resNeg.error).toBeDefined();
    });
  });

  describe('Keyboard builder', () => {
    it('5. builds quick quantity buttons with custom unit suffix', () => {
      // Arrange
      const options = {
        quantities: [1, 2, 5],
        unitName: 'علبة',
        backCallbackData: 'action:back',
      };

      // Act
      const kb = buildQuantityPickerKeyboard(options);

      // Assert
      expect(kb.inline_keyboard.length).toBe(2);
      expect(kb.inline_keyboard[0]![0]!.text).toBe('1 علبة');
      expect(kb.inline_keyboard[0]![1]!.text).toBe('2 علبة');
      expect(kb.inline_keyboard[0]![2]!.text).toBe('5 علبة');
      expect(kb.inline_keyboard[1]![0]!.text).toContain('السابق');
    });
  });
});
