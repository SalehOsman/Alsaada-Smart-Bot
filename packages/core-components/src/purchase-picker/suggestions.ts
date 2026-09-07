import { InlineKeyboard } from 'grammy';

export const DEFAULT_IN_KIND_SUGGESTIONS = [
  '🥫 معلبات وإعاشة',
  '🥾 حذاء أمان / سيفتي',
  '💊 مستلزمات طبية',
  '📱 كارت شحن',
  '🦺 مهمات سلامة شخصية',
  '🧴 نظافة شخصية',
];

export interface PurchaseSuggestionsOptions {
  suggestions?: string[];
  callbackPrefix?: string;
  allowManualInput?: boolean;
  manualInputCallbackData?: string;
  backCallbackData?: string;
  cancelCallbackData?: string;
}

/**
 * Builds the suggestions inline keyboard for in-kind worker purchases.
 */
export function buildPurchaseSuggestionsKeyboard(options: PurchaseSuggestionsOptions = {}): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const suggestions = options.suggestions ?? DEFAULT_IN_KIND_SUGGESTIONS;
  const prefix = options.callbackPrefix ?? 'item_sug:';

  // Render 2 items per row
  for (let i = 0; i < suggestions.length; i += 2) {
    const item1 = suggestions[i]!;
    keyboard.text(item1, `${prefix}${encodeURIComponent(item1)}`);

    if (i + 1 < suggestions.length) {
      const item2 = suggestions[i + 1]!;
      keyboard.text(item2, `${prefix}${encodeURIComponent(item2)}`);
    }
    keyboard.row();
  }

  // Option to write manual custom text
  if (options.allowManualInput !== false) {
    keyboard.text('✍️ كتابة بيان مخصص يدوياً', options.manualInputCallbackData ?? 'item_manual_input').row();
  }

  // Navigation row: Back & Cancel
  if (options.backCallbackData) {
    keyboard.text('◀️ السابق', options.backCallbackData);
  }
  keyboard.text('❌ إلغاء', options.cancelCallbackData ?? 'action:cancel');

  return keyboard;
}
