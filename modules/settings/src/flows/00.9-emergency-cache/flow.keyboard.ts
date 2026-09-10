import { InlineKeyboard } from 'grammy';

export function buildEmergencyCacheKeyboard(isMaintenanceActive: boolean, isImpersonating?: boolean): InlineKeyboard {
  const switchIcon = isMaintenanceActive ? '🟢 تعطيل وضع الصيانة (فتح البوت للجميع)' : '🛑 تفعيل قفل وضع الصيانة الطارئ';
  const switchAction = isMaintenanceActive ? 'action:emergency:toggle_maintenance' : 'action:emergency:confirm_maintenance_prompt';

  const keyboard = new InlineKeyboard()
    .text(switchIcon, switchAction)
    .row()
    .text('🔄 إعادة تدفئة الذاكرة اللحظية (Cache Flush & Pre-Warm)', 'action:emergency:prewarm')
    .row()
    .text('🔙 العودة لقسم الأداء والتشغيل', 'action:settings_sub:system')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (isImpersonating) {
    keyboard.row().text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
  }

  return keyboard;
}

export function buildConfirmMaintenanceKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🛑 تأكيد إغلاق البوت فوراً وتفعيل الصيانة', 'action:emergency:toggle_maintenance')
    .row()
    .text('❌ تراجع وإلغاء', 'action:settings:emergency_cache');
}
