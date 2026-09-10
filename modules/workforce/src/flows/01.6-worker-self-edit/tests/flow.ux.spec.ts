import { describe, it, expect } from 'vitest';
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
  it('should render compact field picker keyboard within telegram constraints', () => {
    const kb = buildFieldPickerKeyboard();
    const buttons = kb.inline_keyboard.flat();

    expect(buttons.length).toBeGreaterThan(4);
    for (const btn of buttons) {
      if ('callback_data' in btn && btn.callback_data) {
        expect(Buffer.byteLength(btn.callback_data, 'utf8')).toBeLessThanOrEqual(64);
      }
    }
  });

  it('should format clean confirmation cards with old and new values', () => {
    const card = formatConfirmation('address', 'القاهرة', 'أسوان', 'تغيير السكن');
    expect(card).toContain('أسوان');
    expect(card).toContain('القاهرة');
    expect(card).toContain('محل الإقامة والعنوان');
  });

  it('should build confirm and success keyboards properly', () => {
    const confirmKb = buildConfirmKeyboard();
    expect(confirmKb.inline_keyboard.flat().some((b) => 'callback_data' in b && b.callback_data === 'action:wse:confirm')).toBe(true);

    const successKb = buildSuccessKeyboard();
    expect(successKb.inline_keyboard.flat().some((b) => 'callback_data' in b && b.callback_data === 'action:worker:my_profile')).toBe(true);
  });
});
