import { InlineKeyboard } from 'grammy';

export interface CompletionKeyboardOptions {
  whatsappUrl?: string | null;
  whatsappButtonText?: string;
  repeatButtonText: string;
  repeatCallbackData: string;
  sectionButtonText: string;
  sectionCallbackData: string;
  mainMenuCallbackData?: string;
}

/**
 * Builds the Universal Post-Action Completion Keyboard strictly matching Section 5.2 of the Charter.
 * Elements order:
 * 1. Direct field action / WhatsApp receipt URL button (if available)
 * 2. Repeat same operation immediately
 * 3. Return to parent module/section
 * 4. Return to Main Menu
 */
export function buildCompletionKeyboard(options: CompletionKeyboardOptions): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // 1. WhatsApp or Direct Action (if provided)
  if (options.whatsappUrl) {
    const label = options.whatsappButtonText ?? '📲 إرسال الإشعار للعامل عبر واتساب';
    keyboard.url(label, options.whatsappUrl).row();
  }

  // 2. Repeat same operation immediately
  keyboard.text(options.repeatButtonText, options.repeatCallbackData).row();

  // 3. Return to parent section
  keyboard.text(options.sectionButtonText, options.sectionCallbackData).row();

  // 4. Return to Main Menu
  keyboard.text('🏠 القائمة الرئيسية', options.mainMenuCallbackData ?? 'action:main_menu');

  return keyboard;
}
