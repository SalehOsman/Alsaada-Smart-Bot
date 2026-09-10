import { InlineKeyboard } from 'grammy';

export function buildAdminProfileKeyboard(isImpersonating?: boolean): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text('✏️ تعديل الاسم الرسمي', 'action:edit_admin:fullName')
    .row()
    .text('📱 تسجيل / تعديل رقم الهاتف', 'action:edit_admin:phone')
    .row()
    .text('🔙 العودة للإعدادات', 'action:settings_sub:identity')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (isImpersonating) {
    keyboard.row().text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
  }

  return keyboard;
}

export function buildFieldAdminProfileKeyboard(isImpersonating?: boolean): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text('👷 التبديل لحسابي كعامل (بوابة الخدمة الذاتية)', 'action:switch_identity:worker')
    .row()
    .text('📱 تسجيل / تعديل رقم الهاتف', 'action:edit_admin:phone')
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (isImpersonating) {
    keyboard.row().text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
  }

  return keyboard;
}

export function buildCancelAdminEditKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('❌ إلغاء والعودة للملف الشخصي', 'action:settings:admin_profile');
}
