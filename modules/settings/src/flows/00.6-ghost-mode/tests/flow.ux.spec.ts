import { describe, it, expect } from 'vitest';
import { buildGhostModeMenuKeyboard } from '../flow.keyboard.js';

describe('Flow 00.6 UX Tests — محاكاة وتقمص الأدوار', () => {
  it('should generate valid inline keyboard with action buttons', () => {
    const kb = buildGhostModeMenuKeyboard();
    expect(kb).toBeDefined();
    expect(kb.inline_keyboard.length).toBeGreaterThan(0);
  });
});
