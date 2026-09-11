import { describe, it, expect } from 'vitest';
import { formatPoliciesHubMessage, formatScopeDepartmentsMessage } from '../flow.messages.js';
import { buildPoliciesHubKeyboard } from '../flow.keyboard.js';

describe('Flow 00.10: UX Spec', () => {
  it('renders breadcrumbs and clean layout in hub message', () => {
    const text = formatPoliciesHubMessage();
    expect(text).toContain('⚙️ الإعدادات');
    expect(text).toContain('🔔 سياسات الإشعارات');
    expect(text).toContain('جروبات المواقع الميدانية');
  });

  it('renders hub keyboard with navigation buttons', () => {
    const kb = buildPoliciesHubKeyboard();
    const flatButtons = kb.inline_keyboard.flat();
    expect(flatButtons.some((b) => b.text.includes('جروبات المواقع'))).toBe(true);
    expect(flatButtons.some((b) => b.text.includes('جروب الإدارة العليا'))).toBe(true);
  });
});
