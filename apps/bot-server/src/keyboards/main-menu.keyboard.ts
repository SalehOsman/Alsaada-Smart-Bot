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
    case 'GENERAL_ADMIN':
      keyboard
        .text('👥 الموارد البشرية والعمالة', 'menu:domain:hr')
        .row()
        .text('💰 المالية والخزينة', 'menu:domain:finance')
        .row()
        .text('🚜 تشغيل المواقع والإنتاج', 'menu:domain:operations')
        .row()
        .text('⛽ التعيينات والمخازن', 'menu:domain:logistics')
        .row()
        .text('🏛️ الحوكمة وإدارة المخاطر', 'menu:domain:governance');
      break;

    case 'EXECUTIVE':
      keyboard
        .text('📊 لوحة المؤشرات التنفيذية', 'menu:exec:dashboard')
        .row()
        .text('💰 الموقف المالي والسيولة', 'menu:exec:liquidity')
        .row()
        .text('🚜 تقارير إنتاجية المواقع', 'menu:exec:production')
        .row()
        .text('📈 موازنات ومصروفات المشاريع', 'menu:exec:budgets')
        .row()
        .text('📑 قرارات واعتمادات معلقة', 'menu:exec:approvals');
      break;

    case 'FIELD_ADMIN':
      keyboard
        .text('👥 الموارد البشرية والعمالة', 'menu:domain:hr')
        .row()
        .text('💰 المالية والخزينة', 'menu:domain:finance')
        .row()
        .text('🚜 تشغيل المواقع والإنتاج', 'menu:domain:operations')
        .row()
        .text('⛽ التعيينات والمخازن', 'menu:domain:logistics')
        .row()
        .text('🏛️ الحوكمة وإدارة المخاطر', 'menu:domain:governance');
      break;


    case 'WORKER':
      keyboard
        .text('👤 ملفي وبياناتي الشخصية', 'menu:worker_sub:profile')
        .row()
        .text('💰 المستحقات والماليات', 'menu:worker_sub:finance')
        .row()
        .text('⏱️ الدوام والحضور والإجازات', 'menu:worker_sub:attendance')
        .row()
        .text('🦺 العهد ومهمات الوقاية', 'menu:worker_sub:custody')
        .row()
        .text('💬 الدعم والشكاوى واللوائح', 'menu:worker_sub:support')
        .row()
        .text('📊 كشف حسابي ومسحوباتي', 'menu:worker:statement')
        .row()
        .text('🧾 مفردات قسيمة الراتب', 'menu:worker:payslip');

      if (ctx.isDualWorkerMode) {
        keyboard
          .row()
          .text('🛡️ العودة لبوابة الإشراف الميداني', 'action:switch_identity:field_admin');
      }
      break;

    case 'SUPPLIER':
      keyboard
        .text('🧾 فواتيري ومستخلصاتي', 'menu:supplier:invoices')
        .row()
        .text('💳 دفعاتي وحسابي المالي', 'menu:supplier:payments')
        .row()
        .text('📊 تصدير كشف الحساب', 'menu:supplier:statement')
        .row()
        .text('📞 التواصل مع الإدارة', 'menu:supplier:contact');
      break;

    case 'GUEST':
    default:
      keyboard
        .text('📝 طلب تسجيل وربط حساب', 'menu:guest:register')
        .row()
        .text('🔍 الاستعلام عن حالة طلب الانضمام', 'action:guest_join:status')
        .row()
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
