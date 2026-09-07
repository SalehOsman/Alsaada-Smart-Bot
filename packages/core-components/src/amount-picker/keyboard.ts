import { InlineKeyboard } from 'grammy';
import { formatCurrency } from '@alsaada/regional-engine';

export interface AmountKeyboardOptions {
  denominations?: number[];
  callbackPrefix?: string;
  cancelCallbackData?: string;
  backCallbackData?: string;
}

export const DEFAULT_DENOMINATIONS = [100, 200, 500, 1000, 2000, 3000];

/**
 * Builds the quick denomination inline keyboard for monetary amounts.
 */
export function buildAmountPickerKeyboard(options: AmountKeyboardOptions = {}): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const denominations = options.denominations ?? DEFAULT_DENOMINATIONS;
  const prefix = options.callbackPrefix ?? 'amount_val:';

  // Render 2 buttons per row
  for (let i = 0; i < denominations.length; i += 2) {
    const val1 = denominations[i]!;
    keyboard.text(formatCurrency(val1, { decimals: 0 }), `${prefix}${val1}`);

    if (i + 1 < denominations.length) {
      const val2 = denominations[i + 1]!;
      keyboard.text(formatCurrency(val2, { decimals: 0 }), `${prefix}${val2}`);
    }
    keyboard.row();
  }

  // Navigation row: Back & Cancel
  if (options.backCallbackData) {
    keyboard.text('◀️ السابق', options.backCallbackData);
  }
  keyboard.text('❌ إلغاء', options.cancelCallbackData ?? 'action:cancel');

  return keyboard;
}
