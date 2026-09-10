import { InlineKeyboard } from 'grammy';

export function buildGhostModeMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('👔 الإدارة التنفيذية والمالية', 'action:impersonate:EXECUTIVE')
    .text('🛡️ المشرف الميداني', 'action:impersonate:FIELD_ADMIN')
    .row()
    .text('👷 العامل الميداني', 'action:impersonate:WORKER')
    .text('🚚 المورد ومقاول الباطن', 'action:impersonate:SUPPLIER')
    .row()
    .text('👤 الزائر والمستخدم الجديد', 'action:impersonate:GUEST')
    .row()
    .text('🔙 العودة للإعدادات', 'menu:super_admin_settings')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');
}

export function buildExitGhostKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
}
