import { describe, it, expect } from 'vitest';
import { buildAdminAssignmentsHubKeyboard } from '../flow.keyboard.js';

describe('Flow 00.5 UX Tests — تعيين وتوزيع مدراء المواقع', () => {
  it('should generate valid inline keyboard with action buttons', () => {
    const kb = buildAdminAssignmentsHubKeyboard([]);
    expect(kb).toBeDefined();
    expect(kb.inline_keyboard.length).toBeGreaterThan(0);
  });
});
