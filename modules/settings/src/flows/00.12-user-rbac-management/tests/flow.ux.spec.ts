import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.12 UX Tests — Keyboards & Formatting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ensures all keyboard callback data items are strictly within 64 bytes limit', () => {
    // Arrange
    const sampleUser = {
      id: 'u-1',
      telegramId: 1234567890n,
      fullName: 'محمد إبراهيم السيد أحمد',
      role: 'SUPER_ADMIN',
      isActive: true,
      isBanned: false,
      createdAt: PINNED_BASE_TIME,
    };

    // Act
    const dirKb = buildUserDirectoryKeyboard([sampleUser], 1, 5);
    const detailKb = buildUserDetailKeyboard({
      ...sampleUser,
      role: 'FIELD_ADMIN',
    });
    const roleKb = buildRoleSelectionKeyboard(1234567890n);
    const prevKb = buildPreviewConfirmKeyboard('d888e222-3333-4444-5555-666677778888', 1234567890n);
    const confKb = buildConflictConfirmKeyboard('d888e222-3333-4444-5555-666677778888', 1234567890n);
    const succKb = buildLinkSuccessKeyboard('https://wa.me/201012345678');
    const allKeyboards = [dirKb, detailKb, roleKb, prevKb, confKb, succKb];

    // Assert
    expect(allKeyboards).toHaveLength(6);
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
    // Arrange
    const totalCount = 10;
    const page = 1;
    const totalPages = 2;
    const workerSummary = {
      id: 'w-1',
      code: 'OP-01',
      name: 'أحمد',
    };

    // Act
    const header = formatUserDirectoryHeader(totalCount, page, totalPages);
    const prompt = formatPromptEnterTelegramId(workerSummary);
    const conflict = formatConflictWarningCard(
      workerSummary,
      'علي قديم',
      123456789n
    );

    // Assert
    expect(header).toContain('📍 *المسار:*');
    expect(prompt).toContain('📍 *المسار:*');
    expect(conflict).toContain('📍 *المسار:*');
    expect(header).not.toContain('undefined');
  });
});
