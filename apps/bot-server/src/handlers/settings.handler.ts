import { InlineKeyboard } from 'grammy';
import { MyContext } from '../types/context.js';
import { setImpersonatedRole, clearImpersonatedRole } from '../redis.js';
import { renderRoleHome } from './start.handler.js';

/**
 * Super Admin Settings Hub Handler
 */
export async function handleSettings(ctx: MyContext): Promise<void> {
  if (!ctx.isRealSuperAdmin) {
    await ctx.answerCallbackQuery({
      text: '🔒 هذا القسم مخصص حصرياً للمدير العام.',
      show_alert: true,
    });
    return;
  }

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
  }

  const keyboard = new InlineKeyboard()
    .text('🏢 الملف التعريفي وبيانات الشركة', 'action:settings:company_profile')
    .row()
    .text('🎭 محاكاة وتقمص الأدوار (Ghost Mode)', 'action:settings:ghost_mode')
    .row()
    .text('⚡ فحص كفاءة النظام واستجابة الشبكة', 'action:settings:ping')
    .row()
    .text('🏠 العودة للقائمة الرئيسية', 'action:main_menu');


  const text =
    `⚙️ *لوحة إعدادات المدير العام (Super Admin Control Panel)*\n\n` +
    `مرحباً بك في لوحة الإعدادات المركزية. من هنا يمكنك تجربة واجهات الأدوار المختلفة ميدانياً، فحص كفاءة النظام، وإدارة التكوينات.\n\n` +
    `اختر الإجراء المطلوب:`;

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      return;
    } catch {
      // fallback to reply
    }
  }

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

/**
 * Ghost Mode Role Impersonation Menu Handler
 */
export async function handleGhostModeMenu(ctx: MyContext): Promise<void> {
  if (!ctx.isRealSuperAdmin) {
    await ctx.answerCallbackQuery({
      text: '🔒 خاصية المحاكاة مخصصة حصرياً للمدير العام.',
      show_alert: true,
    });
    return;
  }

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
  }

  const keyboard = new InlineKeyboard()
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

  const text =
    `🎭 *نظام محاكاة وتقمص الأدوار للمدير العام (Ghost Mode Engine)*\n\n` +
    `يتيح لك هذا النظام التحول الفوري لتجربة واجهة وتدفقات أي دور تشغيلي داخل المنظومة وكأنك ذلك المستخدم، للتحقق من دقة الصلاحيات وسلامة الواجهات ميدانياً.\n\n` +
    `⚠️ *ضمانة الاستثناء السيادي:* مهما كان الدور المختار (حتى لو كان زائر أو عامل مقيد)، يظل زر العودة كمدير عام متاحاً لك دائماً أسفل الواجهة، بالإضافة إلى الأمر المباشر \`/exit_ghost\`.\n\n` +
    `اختر الدور المراد تقمصه وتجربة واجهته:`;

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

/**
 * Impersonate a specific role
 */
export async function handleImpersonateRole(ctx: MyContext, targetRole: string): Promise<void> {
  if (!ctx.isRealSuperAdmin || !ctx.from) {
    await ctx.answerCallbackQuery({
      text: '🔒 غير مصرح بتنفيذ المحاكاة.',
      show_alert: true,
    });
    return;
  }

  const telegramId = BigInt(ctx.from.id);
  await setImpersonatedRole(telegramId, targetRole);

  ctx.effectiveRole = targetRole;
  ctx.isImpersonating = true;

  await ctx.answerCallbackQuery({
    text: `🎭 تم تفعيل محاكاة دور: ${targetRole}`,
  });

  await renderRoleHome(ctx, true);
}

/**
 * Exit Ghost Mode and restore Super Admin sovereign identity
 */
export async function handleExitImpersonate(ctx: MyContext): Promise<void> {
  if (!ctx.isRealSuperAdmin || !ctx.from) {
    await ctx.answerCallbackQuery({
      text: '🔒 غير مصرح.',
      show_alert: true,
    });
    return;
  }

  const telegramId = BigInt(ctx.from.id);
  await clearImpersonatedRole(telegramId);

  ctx.effectiveRole = 'SUPER_ADMIN';
  ctx.isImpersonating = false;

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({
      text: '👑 تم إنهاء وضع المحاكاة والعودة لصلاحيات المدير العام.',
    });
  }

  await renderRoleHome(ctx, true);
}

/**
 * Command /exit_ghost handler
 */
export async function handleExitGhostCommand(ctx: MyContext): Promise<void> {
  if (!ctx.isRealSuperAdmin || !ctx.from) {
    await ctx.reply('🔒 هذا الأمر مخصص حصرياً للمدير العام.');
    return;
  }

  const telegramId = BigInt(ctx.from.id);
  await clearImpersonatedRole(telegramId);

  ctx.effectiveRole = 'SUPER_ADMIN';
  ctx.isImpersonating = false;

  await ctx.reply('👑 *تم إنهاء وضع المحاكاة بنجاح والعودة لهوية المدير العام السيادية.*', {
    parse_mode: 'Markdown',
  });

  await renderRoleHome(ctx, false);
}
