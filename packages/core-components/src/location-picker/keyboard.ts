import { InlineKeyboard } from 'grammy';
import type { LocationPromptKeyboardOptions } from './types.js';

/**
 * Builds the inline keyboard for location prompt with skip, back, and cancel actions.
 */
export function buildLocationPromptKeyboard(options: LocationPromptKeyboardOptions = {}): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // 1. Skip button
  if (options.skipCallbackData) {
    keyboard.text(options.skipText ?? '⏭️ تخطي (بدون إحداثيات الآن)', options.skipCallbackData).row();
  }

  // 2. Control row: [ ◀️ السابق ] alongside [ ❌ إلغاء ]
  if (options.backCallbackData && options.cancelCallbackData) {
    keyboard
      .text(options.backText ?? '◀️ السابق', options.backCallbackData)
      .text(options.cancelText ?? '❌ إلغاء', options.cancelCallbackData);
  } else if (options.backCallbackData) {
    keyboard.text(options.backText ?? '◀️ السابق', options.backCallbackData);
  } else if (options.cancelCallbackData) {
    keyboard.text(options.cancelText ?? '❌ إلغاء', options.cancelCallbackData);
  }

  return keyboard;
}
