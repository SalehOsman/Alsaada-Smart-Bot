import { Keyboard } from 'grammy';
import { canAccessDashboard, CanonicalRole } from '@alsaada/rbac';
import { MyContext } from '../types/context.js';

export const DASHBOARD_KEYBOARD_BUTTON_TEXT = '🖥️ فتح لوحة التحكم';

/**
 * Builds the enterprise persistent bottom reply keyboard.
 * Provides instant single-tap navigation without cluttering the chat.
 * Strictly adheres to Zero RBAC UI Leakage and compact layout.
 */
export function buildPersistentReplyKeyboard(ctx: MyContext): Keyboard {
  const keyboard = new Keyboard();
  const role = ctx.effectiveRole || 'GUEST';

  if (role === 'SUPER_ADMIN') {
    keyboard.text('🏠 القائمة الرئيسية');
    if (!ctx.isImpersonating) {
      keyboard.text('⚙️ إعدادات النظام');
    }
  } else if (role === 'GENERAL_ADMIN') {
    keyboard.text('🏠 القائمة الرئيسية');
  } else if (role === 'FIELD_ADMIN') {
    keyboard
      .text('🏠 القائمة الرئيسية')
      .row()
      .text('👷 التبديل لحسابي كعامل')
      .text('👤 ملفي الشخصي');
  } else if (role === 'WORKER_SUPERVISOR') {
    keyboard
      .text('🏠 القائمة الرئيسية')
      .row()
      .text('🚜 تسجيل منسوب')
      .text('👤 ملفي الشخصي');
  } else if (role === 'WORKER') {
    if (ctx.isDualWorkerMode) {
      keyboard
        .text('🏠 القائمة الرئيسية')
        .row()
        .text('🛡️ العودة لبوابة الإشراف')
        .text('👤 ملفي الشخصي');
    } else {
      keyboard
        .text('🏠 القائمة الرئيسية')
        .row()
        .text('📊 كشف حسابي')
        .text('🧾 قسيمة راتبي')
        .row()
        .text('👤 ملفي الشخصي');
    }
  } else if (role === 'SUPPLIER') {
    keyboard
      .text('🏠 القائمة الرئيسية')
      .row()
      .text('🧾 فواتيري ومستخلصاتي')
      .text('👤 ملفي الشخصي');
  } else {
    // GUEST
    keyboard
      .text('🏠 القائمة الرئيسية')
      .row()
      .text('🆔 بطاقة معرفي');
  }

  // Section 4.2 Visibility Rules (SSOT):
  // 1. Private chat with bot only
  // 2. Active, non-banned account
  // 3. Effective role in ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN']
  // 4. Not momentarily impersonating a non-admin role
  // 5. Never visible to WORKER_SUPERVISOR, WORKER, SUPPLIER, GUEST
  const isPrivate = ctx.chat?.type === 'private';
  const isAccountActive = ctx.dbUser ? (ctx.dbUser.isActive && !ctx.dbUser.isBanned) : true;
  const isAuthorizedRole = canAccessDashboard(role as CanonicalRole);
  const isNotImpersonatingNonAdmin = !ctx.isImpersonating || isAuthorizedRole;

  if (isPrivate && isAccountActive && isAuthorizedRole && isNotImpersonatingNonAdmin) {
    keyboard.row().text(DASHBOARD_KEYBOARD_BUTTON_TEXT);
  }

  // Ghost Mode Sovereign Escape Hatch: placed in the LAST row below all simulated role buttons
  if (ctx.isImpersonating && ctx.isRealSuperAdmin) {
    keyboard.row().text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)');
  }

  return keyboard.resized().persistent().placeholder('اختر إجراءً من القائمة بالأسفل...');
}
