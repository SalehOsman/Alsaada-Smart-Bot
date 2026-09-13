import { Keyboard } from 'grammy';
import { MyContext } from '../types/context.js';

/**
 * Builds the enterprise persistent bottom reply keyboard.
 * Provides instant single-tap navigation without cluttering the chat.
 * Strictly adheres to Zero RBAC UI Leakage and compact layout.
 */
export function buildPersistentReplyKeyboard(ctx: MyContext): Keyboard {
  const keyboard = new Keyboard();
  const role = ctx.effectiveRole || 'GUEST';

  if (ctx.isImpersonating && ctx.isRealSuperAdmin) {
    keyboard.text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)').row();
  }

  if (role === 'SUPER_ADMIN' || role === 'GENERAL_ADMIN') {
    keyboard
      .text('🏠 القائمة الرئيسية')
      .text('⚙️ إعدادات النظام');
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


  return keyboard.resized().persistent();
}
