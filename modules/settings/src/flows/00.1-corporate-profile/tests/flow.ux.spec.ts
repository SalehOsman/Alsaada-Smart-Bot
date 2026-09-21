import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildCorporateProfileKeyboard,
  buildCancelCompanyEditKeyboard,
} from '../flow.keyboard.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.1 UX Tests — الملف التعريفي وبيانات الشركة', () => {
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

  it('generates valid inline keyboard conforming to Telegram constraints', () => {
    // Arrange
    const isImpersonating = false;

    // Act
    const kb = buildCorporateProfileKeyboard(isImpersonating);

    // Assert
    expect(kb).toBeDefined();
    expect(kb.inline_keyboard.length).toBeGreaterThan(0);
    expect(kb.inline_keyboard.length).toBeLessThanOrEqual(7);

    for (const row of kb.inline_keyboard) {
      expect(row.length).toBeLessThanOrEqual(3);
      for (const btn of row) {
        expect(btn.text.length).toBeGreaterThan(0);
        if ('callback_data' in btn && btn.callback_data) {
          expect(Buffer.byteLength(btn.callback_data, 'utf8')).toBeLessThanOrEqual(64);
        }
      }
    }
  });

  it('appends impersonation exit button when impersonating flag is active', () => {
    // Arrange
    const normalFlag = false;
    const impersonatingFlag = true;

    // Act
    const kbNormal = buildCorporateProfileKeyboard(normalFlag);
    const kbImpersonating = buildCorporateProfileKeyboard(impersonatingFlag);

    // Assert
    const normalExitBtn = kbNormal.inline_keyboard
      .flat()
      .find((b) => 'callback_data' in b && b.callback_data === 'action:exit_impersonate');
    const impersonatingExitBtn = kbImpersonating.inline_keyboard
      .flat()
      .find((b) => 'callback_data' in b && b.callback_data === 'action:exit_impersonate');

    expect(normalExitBtn).toBeUndefined();
    expect(impersonatingExitBtn).toBeDefined();
  });

  it('generates cancel keyboard with callback returning to company profile', () => {
    // Arrange
    const expectedCallback = 'action:settings:company_profile';

    // Act
    const cancelKb = buildCancelCompanyEditKeyboard();

    // Assert
    expect(cancelKb.inline_keyboard).toHaveLength(1);
    const btn = cancelKb.inline_keyboard[0]![0]!;
    expect(btn).toBeDefined();
    expect('callback_data' in btn && btn.callback_data).toBe(expectedCallback);
  });
});
