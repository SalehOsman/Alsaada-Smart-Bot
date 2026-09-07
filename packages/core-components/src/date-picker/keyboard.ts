import { InlineKeyboard } from 'grammy';
import { formatDate } from '@alsaada/regional-engine';

export interface DateKeyboardOptions {
  includeToday?: boolean;
  includeYesterday?: boolean;
  callbackPrefix?: string;
  cancelCallbackData?: string;
  backCallbackData?: string;
}

/**
 * Builds the quick date presets inline keyboard.
 */
export function buildDatePickerKeyboard(options: DateKeyboardOptions = {}): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const prefix = options.callbackPrefix ?? 'date_val:';
  const now = new Date();

  // 1. Quick presets: Today, Yesterday
  if (options.includeToday !== false) {
    keyboard.text('📅 اليوم', `${prefix}${formatDate(now)}`);
  }

  if (options.includeYesterday !== false) {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    keyboard.text('🗓️ أمس', `${prefix}${formatDate(yesterday)}`);
  }
  keyboard.row();

  // 2. Navigation row: Back & Cancel
  if (options.backCallbackData) {
    keyboard.text('◀️ السابق', options.backCallbackData);
  }
  keyboard.text('❌ إلغاء', options.cancelCallbackData ?? 'action:cancel');

  return keyboard;
}
