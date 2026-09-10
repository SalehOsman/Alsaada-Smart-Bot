import { InlineKeyboard } from 'grammy';
import type { SettingsModuleContext } from './module.types.js';

export function buildSettingsMainKeyboard(isImpersonating?: boolean): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text('🏢 الكيان المؤسسي والمشاريع', 'action:settings_sub:corporate')
    .row()
    .text('👤 الحساب والأمان والمحاكاة', 'action:settings_sub:identity')
    .row()
    .text('⚡ أداء وتشغيل المنظومة والرقابة', 'action:settings_sub:system')
    .row()
    .text('🏠 العودة للقائمة الرئيسية', 'action:main_menu');

  if (isImpersonating) {
    kb.row().text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
  }

  return kb;
}

export function buildCorporateSubKeyboard(isImpersonating?: boolean): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text('🏢 الملف التعريفي وبيانات الشركة', 'action:settings:company_profile')
    .row()
    .text('🏗️ مصفوفة المشاريع والمواقع الميدانية', 'action:settings:sites_hub')
    .row()
    .text('💼 الأقسام الوظيفية ومصفوفة المهن', 'action:settings:job_matrix')
    .row()
    .text('🔙 العودة لقائمة الإعدادات', 'menu:super_admin_settings')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (isImpersonating) {
    kb.row().text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
  }

  return kb;
}

export function buildIdentitySubKeyboard(isImpersonating?: boolean): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text('👤 ملفي الشخصي (حساب المدير العام)', 'action:settings:admin_profile')
    .row()
    .text('👥 تعيين وتوزيع مدراء المواقع', 'action:settings:admin_assignments')
    .row()
    .text('🎭 محاكاة وتقمص الأدوار (Ghost Mode)', 'action:settings:ghost_mode')
    .row()
    .text('🔙 العودة لقائمة الإعدادات', 'menu:super_admin_settings')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (isImpersonating) {
    kb.row().text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
  }

  return kb;
}

export function buildSystemSubKeyboard(isImpersonating?: boolean): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text('🔍 التحقيق الجنائي والأعطال النشطة', 'action:settings:audit_vault')
    .row()
    .text('⚡ رادار الأداء والسرعة الفائقة (APM)', 'action:settings:apm_dashboard')
    .row()
    .text('🛑 صمامات الطوارئ والذاكرة اللحظية', 'action:settings:emergency_cache')
    .row()
    .text('🔙 العودة لقائمة الإعدادات', 'menu:super_admin_settings')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (isImpersonating) {
    kb.row().text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
  }

  return kb;
}

export async function handleSettingsHub(ctx: SettingsModuleContext): Promise<void> {
  const isSuper = Boolean(
    ctx.isRealSuperAdmin &&
    ctx.effectiveRole === 'SUPER_ADMIN' &&
    !ctx.isImpersonating
  );

  if (!isSuper) {
    const alertMsg = '🔒 هذا القسم مخصص حصرياً للمدير العام، ومحجوب أثناء وضع المحاكاة.';
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({
        text: alertMsg,
        show_alert: true,
      }).catch(() => {});
    } else {
      await ctx.reply(alertMsg);
    }
    return;
  }

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }

  const keyboard = buildSettingsMainKeyboard(ctx.isImpersonating);
  const text =
    `⚙️ *مركز إعدادات النظام والتحكم السيادي*\n` +
    `────────────────────────────\n` +
    `لوحة التحكم المركزية لإدارة الكيان المؤسسي، الفروع والمواقع الميدانية، وضبط صلاحيات الإشراف والأمان والرقابة الجنائية.\n\n` +
    `👇 *اختر القسم الإداري المطلوب:*`;

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      return;
    } catch {
      // fallback
    }
  }

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

export async function handleSettingsSubCategory(
  ctx: SettingsModuleContext,
  category: 'corporate' | 'identity' | 'system'
): Promise<void> {
  if (!ctx.isRealSuperAdmin || ctx.effectiveRole !== 'SUPER_ADMIN' || ctx.isImpersonating) return;
  if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

  let text = '';
  let keyboard: InlineKeyboard;

  if (category === 'corporate') {
    keyboard = buildCorporateSubKeyboard(ctx.isImpersonating);
    text =
      `🏢 *إعدادات الكيان المؤسسي والمشاريع والمواقع*\n` +
      `────────────────────────────\n` +
      `إدارة بيانات شركة السعادة الرسمية، السجل التجاري والضريبي، مصفوفة الفروع والمواقع، والهيكل الوظيفي ومصفوفة المهن والورديات.\n\n` +
      `اختر الإجراء المطلوب:`;
  } else if (category === 'identity') {
    keyboard = buildIdentitySubKeyboard(ctx.isImpersonating);
    text =
      `👤 *إعدادات الحساب الشخصي والأمان والمحاكاة*\n` +
      `────────────────────────────\n` +
      `تعديل بيانات حسابك الشخصي كمدير عام، تعيين مدراء الفروع، أو تقمص واجهات الأدوار التشغيلية لاختبار المنظومة ميدانياً.\n\n` +
      `اختر الإجراء المطلوب:`;
  } else {
    keyboard = buildSystemSubKeyboard(ctx.isImpersonating);
    text =
      `⚡ *أداء وتشغيل المنظومة والرقابة الجنائية*\n` +
      `────────────────────────────\n` +
      `وحدة التحقيق الجنائي وتتبع مسار العمليات، كونسول الأعطال النشطة، رادار APM وسرعة الخدمات الخارجية، وصمامات الصيانة والذاكرة اللحظية.\n\n` +
      `اختر الإجراء المطلوب:`;
  }

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      return;
    } catch {
      // fallback
    }
  }
  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}
