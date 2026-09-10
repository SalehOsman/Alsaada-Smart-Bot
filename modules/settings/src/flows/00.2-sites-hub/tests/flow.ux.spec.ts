import { describe, it, expect } from 'vitest';
import { buildSitesListKeyboard } from '../flow.keyboard.js';

describe('Flow 00.2 UX Tests — مصفوفة المشاريع والمواقع الميدانية', () => {
  it('should generate valid inline keyboard with action buttons', () => {
    const kb = buildSitesListKeyboard([]);
    expect(kb).toBeDefined();
    expect(kb.inline_keyboard.length).toBeGreaterThan(0);
  });
});
