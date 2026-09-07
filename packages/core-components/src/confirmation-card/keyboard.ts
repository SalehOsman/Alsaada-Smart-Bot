import { InlineKeyboard } from 'grammy';

export interface ConfirmationKeyboardOptions {
  confirmCallbackData?: string;
  editCallbackData?: string;
  cancelCallbackData?: string;
  confirmText?: string;
}

/**
 * Builds the confirmation review inline keyboard.
 */
export function buildConfirmationKeyboard(options: ConfirmationKeyboardOptions = {}): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  keyboard.text(options.confirmText ?? '✅ تأكيد وحفظ العملية', options.confirmCallbackData ?? 'action:confirm').row();

  if (options.editCallbackData) {
    keyboard.text('✏️ تعديل البيانات', options.editCallbackData);
  }

  keyboard.text('❌ إلغاء المعاملة', options.cancelCallbackData ?? 'action:cancel').row();

  return keyboard;
}
