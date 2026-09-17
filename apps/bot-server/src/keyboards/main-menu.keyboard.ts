import { InlineKeyboard } from 'grammy';
import { MyContext } from '../types/context.js';
import { fastCache } from '../services/fast-cache.service.js';

/**
 * Builds the enterprise main menu keyboard dynamically based on the effective user role.
 * 100% pure inline menu matching the simulated role; escape hatch is strictly delegated to the persistent reply keyboard.
 * Memoized via FastCache to eliminate GC churn.
 */
export function buildMainMenuKeyboard(ctx: MyContext): InlineKeyboard {
  const role = ctx.effectiveRole || 'GUEST';
  const isDual = !!ctx.isDualWorkerMode;
  const cacheKey = `kb:main_menu:${role}:${isDual}`;

  return fastCache.memoizeKeyboard(cacheKey, () => {
    const keyboard = new InlineKeyboard();

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

    case 'WORKER_SUPERVISOR':
      keyboard
        .text('🚜 تسجيل منسوب السولار الميداني', 'flow:fuel_level')
        .row()
        .text('⛽ صرف مهمات وتعيينات', 'flow:canteen_dispense')
        .row()
        .text('⏱️ تسجيل دوام وحضور', 'flow:attendance_record')
        .row()
        .text('👤 خدماتي الشخصية', 'menu:worker_sub:profile');
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

    return keyboard;
  });
}
