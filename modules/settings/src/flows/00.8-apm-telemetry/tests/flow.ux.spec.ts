import { describe, it, expect } from 'vitest';
import { buildApmDashboardKeyboard } from '../flow.keyboard.js';

describe('Flow 00.8 UX Tests — رادار الأداء ومراقبة الخدمات', () => {
  it('should generate valid inline keyboard with action buttons', () => {
    const kb = buildApmDashboardKeyboard();
    expect(kb).toBeDefined();
    expect(kb.inline_keyboard.length).toBeGreaterThan(0);
  });
});
