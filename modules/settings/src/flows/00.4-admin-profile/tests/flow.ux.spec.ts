import { describe, it, expect } from 'vitest';
import { buildAdminProfileKeyboard } from '../flow.keyboard.js';

describe('Flow 00.4 UX Tests — الملف الشخصي للمدير العام', () => {
  it('should generate valid inline keyboard with action buttons', () => {
    const kb = buildAdminProfileKeyboard();
    expect(kb).toBeDefined();
    expect(kb.inline_keyboard.length).toBeGreaterThan(0);
  });
});
