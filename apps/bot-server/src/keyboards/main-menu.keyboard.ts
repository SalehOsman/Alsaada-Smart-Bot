import { InlineKeyboard } from 'grammy';
import { MyContext } from '../types/context.js';

/**
 * Builds the enterprise main menu keyboard dynamically based on the effective user role.
 * Includes the Sovereign Escape Hatch for the Super Admin if Ghost Mode is active.
 */
export function buildMainMenuKeyboard(ctx: MyContext): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const role = ctx.effectiveRole || 'GUEST';

  switch (role) {
    case 'SUPER_ADMIN':
      keyboard
        .text('👥 الموارد البشرية والرواتب', 'menu:domain:hr')
        .text('💰 المالية والخزينة', 'menu:domain:finance')
        .row()
        .text('🚜 تشغيل المواقع والإنتاج', 'menu:domain:operations')
        .text('⛽ التعيينات والمخازن', 'menu:domain:logistics')
        .row()
        .text('🏛️ الحوكمة وإدارة المخاطر', 'menu:domain:governance')
        .text('⚙️ إعدادات النظام', 'menu:super_admin_settings');
      break;

    case 'EXECUTIVE':
      keyboard
        .text('📊 لوحة المؤشرات التنفيذية', 'menu:exec:dashboard')
        .text('💰 الموقف المالي والسيولة', 'menu:exec:liquidity')
        .row()
        .text('🚜 تقارير إنتاجية المواقع', 'menu:exec:production')
        .text('📈 موازنات ومصروفات المشاريع', 'menu:exec:budgets')
        .row()
        .text('📑 قرارات واعتمادات معلقة', 'menu:exec:approvals');
      break;

    case 'FIELD_ADMIN':
      keyboard
        .text('💵 تسجيل سلفة / مسحوبات', 'menu:field:advance')
        .text('🏖️ تسجيل إجازة / عودة', 'menu:field:leave')
        .row()
        .text('🚜 تشغيل وبوالص الفوسفات', 'menu:field:phosphate')
        .text('⛽ سجل السولار والمعدات', 'menu:field:fuel')
        .row()
        .text('📋 التمام واليوميات', 'menu:field:attendance')
        .text('💼 عهدتي الميدانية', 'menu:field:custody');
      break;

    case 'WORKER':
      keyboard
        .text('📊 كشف حسابي ومسحوباتي', 'menu:worker:statement')
        .text('🧾 مفردات قسيمة الراتب', 'menu:worker:payslip')
        .row()
        .text('🏖️ طلب إجازة', 'menu:worker:leave_req')
        .text('💵 طلب سلفة', 'menu:worker:advance_req')
        .row()
        .text('🦺 عهدي ومهماتي', 'menu:worker:ppe')
        .text('💬 استفسار / تظلم', 'menu:worker:ticket');
      break;

    case 'SUPPLIER':
      keyboard
        .text('🧾 فواتيري ومستخلصاتي', 'menu:supplier:invoices')
        .text('💳 دفعاتي وحسابي المالي', 'menu:supplier:payments')
        .row()
        .text('📊 تصدير كشف الحساب', 'menu:supplier:statement')
        .text('📞 التواصل مع الإدارة', 'menu:supplier:contact');
      break;

    case 'GUEST':
    default:
      keyboard
        .text('📝 طلب تسجيل وربط حساب', 'menu:guest:register')
        .text('❓ دليل الاستخدام واللوائح', 'menu:guest:guide')
        .row()
        .text('🆔 بطاقة معرف حسابي', 'menu:guest:identity');
      break;
  }

  // Sovereign Escape Hatch: If Super Admin is simulating another role, ALWAYS provide an escape button
  if (ctx.isImpersonating && ctx.isRealSuperAdmin) {
    keyboard
      .row()
      .text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
  }

  return keyboard;
}
