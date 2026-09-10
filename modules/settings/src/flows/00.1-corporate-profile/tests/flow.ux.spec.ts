import { describe, it, expect } from 'vitest';
import { buildCorporateProfileKeyboard } from '../flow.keyboard.js';

describe('Flow 00.1 UX Tests — الملف التعريفي وبيانات الشركة', () => {
  it('should generate valid inline keyboard with action buttons', () => {
    const kb = buildCorporateProfileKeyboard();
    expect(kb).toBeDefined();
    expect(kb.inline_keyboard.length).toBeGreaterThan(0);
  });
});
