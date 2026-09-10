import { InlineKeyboard } from 'grammy';

export function buildCorporateProfileKeyboard(isImpersonating?: boolean): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text('✏️ الاسم القانوني', 'action:edit_comp:legalName')
    .text('✏️ الاسم التجاري', 'action:edit_comp:tradeName')
    .row()
    .text('✏️ السجل التجاري', 'action:edit_comp:commercialRegistrationNumber')
    .text('✏️ البطاقة الضريبية', 'action:edit_comp:taxRegistrationNumber')
    .row()
    .text('✏️ المقر الرئيسي', 'action:edit_comp:headquartersAddress')
    .text('✏️ هاتف الإدارة', 'action:edit_comp:primaryPhone')
    .row()
    .text('✏️ البريد الرسمي', 'action:edit_comp:officialEmail')
    .text('✏️ العملة الأساسية', 'action:edit_comp:baseCurrency')
    .row()
    .text('🔙 العودة للإعدادات', 'menu:super_admin_settings')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (isImpersonating) {
    keyboard.row().text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
  }

  return keyboard;
}

export function buildCancelCompanyEditKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('❌ إلغاء التعديل والعودة', 'action:settings:company_profile');
}
