import { InlineKeyboard } from 'grammy';

export interface QuantityKeyboardOptions {
  quantities?: number[];
  unitName?: string;
  callbackPrefix?: string;
  cancelCallbackData?: string;
  backCallbackData?: string;
}

export const DEFAULT_QUANTITIES = [1, 2, 3, 5, 10];

/**
 * Builds the quick quantity inline keyboard.
 */
export function buildQuantityPickerKeyboard(options: QuantityKeyboardOptions = {}): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const quantities = options.quantities ?? DEFAULT_QUANTITIES;
  const unit = options.unitName ? ` ${options.unitName}` : '';
  const prefix = options.callbackPrefix ?? 'qty_val:';

  // Render buttons (up to 3 per row)
  for (let i = 0; i < quantities.length; i += 3) {
    for (let j = 0; j < 3 && i + j < quantities.length; j++) {
      const val = quantities[i + j]!;
      keyboard.text(`${val}${unit}`, `${prefix}${val}`);
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
