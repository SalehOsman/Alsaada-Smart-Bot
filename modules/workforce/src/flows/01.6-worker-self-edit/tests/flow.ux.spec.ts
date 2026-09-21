import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildFieldPickerKeyboard,
  buildConfirmKeyboard,
  buildSuccessKeyboard,
} from '../flow.keyboard.js';
import {
  formatFieldSelectionHeader,
  formatInputPrompt,
  formatConfirmation,
} from '../flow.messages.js';

describe('01.6 Worker Self-Edit — UX Tests', () => {
  const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders compact field picker keyboard within telegram constraints', () => {
    // Arrange
    const minButtonCount = 4;

    // Act
    const kb = buildFieldPickerKeyboard();
    const buttons = kb.inline_keyboard.flat();

    // Assert
    expect(buttons.length).toBeGreaterThan(minButtonCount);
    for (const btn of buttons) {
      if ('callback_data' in btn && btn.callback_data) {
        expect(Buffer.byteLength(btn.callback_data, 'utf8')).toBeLessThanOrEqual(64);
      }
    }
    expect(buttons.some((b) => 'callback_data' in b && b.callback_data === 'invalid_action')).toBe(false);
  });

  it('formats clean confirmation cards with old and new values', () => {
    // Arrange
    const field = 'address';
    const oldValue = 'القاهرة';
    const newValue = 'أسوان';
    const reason = 'تغيير السكن';

    // Act
    const card = formatConfirmation(field, oldValue, newValue, reason);

    // Assert
    expect(card).toContain('أسوان');
    expect(card).toContain('القاهرة');
    expect(card).toContain('محل الإقامة والعنوان');
    expect(card).not.toContain('undefined');
  });

  it('builds confirm and success keyboards properly', () => {
    // Arrange
    const expectedConfirm = 'action:wse:confirm';
    const expectedProfile = 'action:worker:my_profile';

    // Act
    const confirmKb = buildConfirmKeyboard();
    const successKb = buildSuccessKeyboard();

    // Assert
    expect(confirmKb.inline_keyboard.flat().some((b) => 'callback_data' in b && b.callback_data === expectedConfirm)).toBe(true);
    expect(successKb.inline_keyboard.flat().some((b) => 'callback_data' in b && b.callback_data === expectedProfile)).toBe(true);
    expect(confirmKb.inline_keyboard.flat().some((b) => 'callback_data' in b && b.callback_data === 'unknown_action')).toBe(false);
  });
});
