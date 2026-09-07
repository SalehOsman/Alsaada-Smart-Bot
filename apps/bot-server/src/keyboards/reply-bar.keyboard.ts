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

  if (role === 'SUPER_ADMIN') {
    keyboard
      .text('🏠 القائمة الرئيسية')
      .text('⚙️ إعدادات النظام')
      .row()
      .text('👤 ملفي الشخصي')
      .text('⚡ فحص الكفاءة');
  } else if (role === 'FIELD_ADMIN') {
    keyboard
      .text('🏠 القائمة الرئيسية')
      .text('👷 التبديل لحسابي كعامل')
      .row()
      .text('👤 ملفي وإعداداتي')
      .text('⚡ فحص الكفاءة');
  } else if (role === 'WORKER') {
    if (ctx.isDualWorkerMode) {
      keyboard
        .text('🏠 القائمة الرئيسية')
        .text('🛡️ العودة لبوابة الإشراف')
        .row()
        .text('🧾 قسيمة راتبي')
        .text('👤 ملفي الشخصي');
    } else {
      keyboard
        .text('🏠 القائمة الرئيسية')
        .text('📊 كشف حسابي')
        .row()
        .text('🧾 قسيمة راتبي')
        .text('👤 ملفي الشخصي');
    }
  } else if (role === 'EXECUTIVE') {
    keyboard
      .text('🏠 القائمة الرئيسية')
      .text('📊 لوحة المؤشرات')
      .row()
      .text('👤 ملفي الشخصي')
      .text('⚡ فحص الكفاءة');
  } else if (role === 'SUPPLIER') {
    keyboard
      .text('🏠 القائمة الرئيسية')
      .text('🧾 فواتيري ومستخلصاتي')
      .row()
      .text('👤 ملفي الشخصي');
  } else {
    // GUEST
    keyboard
      .text('🏠 القائمة الرئيسية')
      .text('🆔 بطاقة معرفي');
  }

  return keyboard.resized().persistent();
}
