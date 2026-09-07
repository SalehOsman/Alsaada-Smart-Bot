import { describe, it, expect } from 'vitest';
import {
  validateQuantity,
  buildQuantityPickerKeyboard,
} from '../src/index.js';

describe('UniversalQuantityPicker', () => {
  describe('Quantity validation', () => {
    it('accepts integer quantities for discrete units', () => {
      const res = validateQuantity('5', { unitType: 'DISCRETE', unitName: 'علبة' });
      expect(res.isValid).toBe(true);
      expect(res.quantity).toBe(5);
    });

    it('rejects decimal fractions for discrete units (e.g. cigarettes or meals)', () => {
      const res = validateQuantity('2.5', { unitType: 'DISCRETE', unitName: 'خرطوشة' });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('غير قابلة للتجزئة');
    });

    it('accepts decimal quantities for continuous units (e.g. fuel liters, phosphate tons)', () => {
      const res = validateQuantity('150.75', { unitType: 'CONTINUOUS', unitName: 'لتر' });
      expect(res.isValid).toBe(true);
      expect(res.quantity).toBe(150.75);
    });

    it('rejects zero or negative quantities', () => {
      expect(validateQuantity(0).isValid).toBe(false);
      expect(validateQuantity(-5).isValid).toBe(false);
    });
  });

  describe('Keyboard builder', () => {
    it('builds quick quantity buttons with custom unit suffix', () => {
      const kb = buildQuantityPickerKeyboard({
        quantities: [1, 2, 5],
        unitName: 'علبة',
        backCallbackData: 'action:back',
      });

      expect(kb.inline_keyboard.length).toBe(2);
      expect(kb.inline_keyboard[0]![0]!.text).toBe('1 علبة');
    });
  });
});
