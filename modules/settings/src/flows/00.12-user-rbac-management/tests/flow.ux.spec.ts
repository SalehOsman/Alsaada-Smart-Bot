import { describe, it, expect } from 'vitest';
import {
  buildUserDirectoryKeyboard,
  buildUserDetailKeyboard,
  buildRoleSelectionKeyboard,
  buildPreviewConfirmKeyboard,
  buildConflictConfirmKeyboard,
  buildLinkSuccessKeyboard,
} from '../flow.keyboard.js';
import {
  formatUserDirectoryHeader,
  formatUserDetailCard,
  formatPromptEnterTelegramId,
  formatConflictWarningCard,
} from '../flow.messages.js';

describe('Flow 00.12 UX Tests — Keyboards & Formatting', () => {
  it('ensures all keyboard callback datas are strictly <= 64 bytes', () => {
    const dirKb = buildUserDirectoryKeyboard(
      [
        {
          id: 'u-1',
          telegramId: 1234567890n,
          fullName: 'محمد إبراهيم السيد أحمد',
          role: 'SUPER_ADMIN',
          isActive: true,
          isBanned: false,
          createdAt: new Date(),
        },
      ],
      1,
      5
    );

    const detailKb = buildUserDetailKeyboard({
      id: 'u-1',
      telegramId: 1234567890n,
      fullName: 'محمد إبراهيم',
      role: 'FIELD_ADMIN',
      isActive: true,
      isBanned: false,
      createdAt: new Date(),
    });

    const roleKb = buildRoleSelectionKeyboard(1234567890n);
    const prevKb = buildPreviewConfirmKeyboard('d888e222-3333-4444-5555-666677778888', 1234567890n);
    const confKb = buildConflictConfirmKeyboard('d888e222-3333-4444-5555-666677778888', 1234567890n);
    const succKb = buildLinkSuccessKeyboard('https://wa.me/201012345678');

    const allKeyboards = [dirKb, detailKb, roleKb, prevKb, confKb, succKb];

    allKeyboards.forEach((kb) => {
      kb.inline_keyboard.forEach((row) => {
        row.forEach((btn) => {
          if ('callback_data' in btn && btn.callback_data) {
            const byteLength = Buffer.byteLength(btn.callback_data, 'utf8');
            expect(byteLength).toBeLessThanOrEqual(64);
          }
        });
      });
    });
  });

  it('verifies universal breadcrumbs are prepended in all message screens', () => {
    const header = formatUserDirectoryHeader(10, 1, 2);
    const prompt = formatPromptEnterTelegramId({
      id: 'w-1',
      code: 'OP-01',
      name: 'أحمد',
    });
    const conflict = formatConflictWarningCard(
      { id: 'w-1', code: 'OP-01', name: 'أحمد' },
      'علي قديم',
      123456789n
    );

    expect(header).toContain('📍 *المسار:*');
    expect(prompt).toContain('📍 *المسار:*');
    expect(conflict).toContain('📍 *المسار:*');
  });
});
