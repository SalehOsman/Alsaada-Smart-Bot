import { InlineKeyboard } from 'grammy';

export function buildCorporateProfileKeyboard(isImpersonating?: boolean): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text('🔙 العودة للإعدادات', 'menu:super_admin_settings')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (isImpersonating) {
    keyboard.row().text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
  }

  return keyboard;
}

export function buildCompanyEditConfirmationKeyboard(fieldKey: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ نعم، تعديل البيان', `action:edit_comp:${fieldKey}`)
    .text('❌ إلغاء', 'action:settings:company_profile');
}

export function buildCancelCompanyEditKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('❌ إلغاء التعديل والعودة', 'action:settings:company_profile');
}
