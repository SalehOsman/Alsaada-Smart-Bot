import { InlineKeyboard } from 'grammy';
import type { AlertPolicyType } from './flow.types.js';

export function buildApmDashboardKeyboard(isImpersonating?: boolean): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text('⚡ كاشف العمليات البطيئة (Top 10)', 'action:apm:slow_ops')
    .row()
    .text('📊 لوحة فحص الربط والخدمات الخارجية', 'action:apm:health_check')
    .row()
    .text('🔔 ضبط حساسية وتوجيه الإنذارات', 'action:apm:alert_policy')
    .row()
    .text('🔙 العودة للإعدادات', 'action:settings_sub:system')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (isImpersonating) {
    keyboard.row().text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
  }

  return keyboard;
}

export function buildSlowOpsKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔄 تحديث القائمة', 'action:apm:slow_ops')
    .row()
    .text('🔙 العودة لرادار الأداء', 'action:settings:apm_dashboard')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');
}

export function buildServicesHealthKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔄 إعادة الفحص الآن', 'action:apm:health_check')
    .row()
    .text('🔙 العودة لرادار الأداء', 'action:settings:apm_dashboard')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');
}

export function buildAlertPolicyKeyboard(currentPolicy: AlertPolicyType): InlineKeyboard {
  const isImmediate = currentPolicy === 'IMMEDIATE';
  const isSmart = currentPolicy === 'SMART';
  const isDaily = currentPolicy === 'DAILY_DIGEST';

  return new InlineKeyboard()
    .text(`${isImmediate ? '🔘' : '⚪'} ⚡ حساسية فورية (كل خطأ)`, 'action:apm:set_policy:IMMEDIATE')
    .row()
    .text(`${isSmart ? '🔘' : '⚪'} 🧠 حساسية ذكية (الأخطاء الحرجة)`, 'action:apm:set_policy:SMART')
    .row()
    .text(`${isDaily ? '🔘' : '⚪'} 🌙 التقرير المجمع الصامت (مسائي)`, 'action:apm:set_policy:DAILY_DIGEST')
    .row()
    .text('🔙 العودة لرادار الأداء', 'action:settings:apm_dashboard')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');
}
