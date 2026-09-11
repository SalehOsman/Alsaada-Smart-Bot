import { describe, it, expect } from 'vitest';
import { formatGroupsHubMessage, formatHqDetailMessage } from '../flow.messages.js';
import { buildGroupsHubKeyboard } from '../flow.keyboard.js';

describe('Flow 00.11: UX Spec', () => {
  it('renders breadcrumbs and clean layout in hub message', () => {
    const text = formatGroupsHubMessage(
      {
        chatId: '-10012345',
        isBound: true,
        topicsConfigured: true,
        topics: {},
      },
      []
    );
    expect(text).toContain('⚙️ الإعدادات');
    expect(text).toContain('🏛️ إدارة المجموعات');
    expect(text).toContain('جروب الإدارة العليا');
  });

  it('renders hub keyboard with navigation buttons', () => {
    const kb = buildGroupsHubKeyboard({
      chatId: null,
      isBound: false,
      topicsConfigured: false,
      topics: {},
    });
    const flatButtons = kb.inline_keyboard.flat();
    expect(flatButtons.some((b) => b.text.includes('جروب الإدارة العليا'))).toBe(true);
    expect(flatButtons.some((b) => b.text.includes('مصفوفة ربط جروبات المواقع'))).toBe(true);
  });
});
