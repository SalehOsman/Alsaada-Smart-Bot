import { InlineKeyboard } from 'grammy';
import { MyContext } from '../types/context.js';
import { prisma } from '../db.js';
import { config } from '../config/env.js';
import { encryptField, decryptField, createBlindIndex } from '@alsaada/database';
import {
  setPendingAdminEdit,
  getPendingAdminEdit,
  clearPendingAdminEdit,
  setAdminDualMode,
} from '../redis.js';
import { invalidateUserCache } from '../middlewares/auth.middleware.js';
import { systemDataService } from '../services/system-data.service.js';
import { buildPersistentReplyKeyboard } from '../keyboards/reply-bar.keyboard.js';
import { syncUserCommandsScope } from '../services/command-scope.service.js';
import { renderRoleHome } from './start.handler.js';

export const ADMIN_FIELD_LABELS: Record<string, string> = {
  fullName: 'الاسم الرسمي',
  phone: 'رقم الهاتف المعتمد',
};

/**
 * Renders the Field Admin personal profile card & settings with dual identity switcher
 */
export async function renderFieldAdminProfileCard(
  ctx: MyContext,
  inPlace = false,
  noticeText?: string
): Promise<void> {
  if (!ctx.from) return;

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }

  const telegramId = BigInt(ctx.from.id);
  await clearPendingAdminEdit(telegramId);

  // ⚡ L1 IN-MEMORY RAM (< 0.1ms) with SWR background revalidation via SystemDataService
  const user = await systemDataService.getAdminUser(telegramId);

  let displayPhone = 'غير مسجل';
  if (user?.phoneEncrypted && config.databaseEncryptionKey) {
    try {
      displayPhone = decryptField(user.phoneEncrypted, config.databaseEncryptionKey);
    } catch {
      displayPhone = '⚠️ خطأ في فك التشفير';
    }
  }

  const assignedSiteName = (user as any)?.assignedSite?.name || '🌐 وصول عام / غير مقيد بموقع محدد';

  const keyboard = new InlineKeyboard()
    .text('👷 التبديل لحسابي كعامل (بوابة الخدمة الذاتية)', 'action:switch_identity:worker')
    .row()
    .text('📱 تسجيل / تعديل رقم الهاتف', 'action:edit_admin:phone')
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (ctx.isImpersonating && ctx.isRealSuperAdmin) {
    keyboard
      .row()
      .text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
  }

  let banner = '';
  if (noticeText) {
    banner = `✨ *${noticeText}*\n────────────────────────────\n\n`;
  }

  const text =
    `${banner}` +
    `🛡️ *الملف الشخصي وإعدادات المشرف الميداني*\n` +
    `────────────────────────────\n` +
    `👤 *الاسم المسجل:*\n\`${user?.fullName || 'غير مسجل'}\`\n\n` +
    `📱 *رقم الهاتف:*\n\`${displayPhone}\`\n\n` +
    `📍 *الموقع المسؤول:* ${assignedSiteName}\n` +
    `🆔 *المعرف الرقمي:* \`${ctx.from.id}\`\n` +
    `🛡️ *حالة الحساب:* 🟢 نشط ومعتمد ميدانياً\n` +
    `────────────────────────────\n` +
    `💡 *التبديل لحساب العامل:* يتيح لك الاطلاع على كشف حسابك ومسحوباتك وتقديم طلباتك الشخصية دون تداخل مع صلاحياتك الإشرافية.\n\n` +
    `👇 *اختر الإجراء المطلوب:*`;

  if (inPlace && ctx.callbackQuery) {
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
 * Switch an active Field Admin to Worker Self-Service mode
 */
export async function handleSwitchToWorker(ctx: MyContext): Promise<void> {
  if (!ctx.from) return;
  const telegramId = BigInt(ctx.from.id);

  await setAdminDualMode(telegramId, true);
  await invalidateUserCache(telegramId);
  await systemDataService.invalidateUser(telegramId);

  ctx.effectiveRole = 'WORKER';
  ctx.isDualWorkerMode = true;

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({
      text: '🔄 تم التبديل إلى بوابة العامل بنجاح.',
    });
  }

  await syncUserCommandsScope(ctx.api, telegramId, 'WORKER', true);
  const replyKeyboard = buildPersistentReplyKeyboard(ctx);

  await ctx.reply(
    '🔄 *تم التبديل بنجاح إلى [ بوابة العامل — الخدمة الذاتية ]*\n' +
    'أنت الآن تستعرض المنظومة بصفتك الشخصية كعامل.\n' +
    'يمكنك الاطلاع على قسيمة راتبك، كشف مسحوباتك، وتقديم طلباتك دون تداخل مع صلاحياتك الإشرافية.\n' +
    'لإلغاء هذا الوضع والعودة لبوابة الإشراف، اضغط زر `[ 🛡️ العودة لبوابة الإشراف ]` في لوحة التنقل أو القائمة الرئيسية.',
    {
      parse_mode: 'Markdown',
      reply_markup: replyKeyboard,
    }
  );

  await renderRoleHome(ctx, false);
}

/**
 * Switch back from Worker mode to Field Admin portal
 */
export async function handleSwitchToFieldAdmin(ctx: MyContext): Promise<void> {
  if (!ctx.from) return;
  const telegramId = BigInt(ctx.from.id);

  await setAdminDualMode(telegramId, false);
  await invalidateUserCache(telegramId);
  await systemDataService.invalidateUser(telegramId);

  ctx.effectiveRole = 'FIELD_ADMIN';
  ctx.isDualWorkerMode = false;

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({
      text: '🛡️ تمت العودة لبوابة الإشراف بنجاح.',
    });
  }

  await syncUserCommandsScope(ctx.api, telegramId, 'FIELD_ADMIN', false);
  const replyKeyboard = buildPersistentReplyKeyboard(ctx);

  await ctx.reply(
    '🛡️ *تمت العودة بنجاح إلى [ بوابة المشرف الميداني وإدارة المواقع ]*\n' +
    'تم استعادة لوحة التحكم الإشرافية وكافة صلاحيات متابعة العمال والمشاريع.',
    {
      parse_mode: 'Markdown',
      reply_markup: replyKeyboard,
    }
  );

  await renderRoleHome(ctx, false);
}

/**
 * Universal toggle command /switch_role
 */
export async function handleSwitchRoleCommand(ctx: MyContext): Promise<void> {
  if (!ctx.from) return;
  const role = ctx.effectiveRole || 'GUEST';

  if (role === 'FIELD_ADMIN') {
    await handleSwitchToWorker(ctx);
  } else if (role === 'WORKER' && ctx.isDualWorkerMode) {
    await handleSwitchToFieldAdmin(ctx);
  } else {
    await ctx.reply('🔒 خاصية تبديل الهوية متاحة حصرياً للمشرفين الميدانيين المسجلين.');
  }
}

/**
 * Renders the personal profile card (Super Admin or Field Admin based on role)
 */
export async function renderAdminProfileCard(
  ctx: MyContext,
  inPlace = false,
  noticeText?: string
): Promise<void> {
  const role = ctx.effectiveRole || 'GUEST';

  // If the user is a Field Admin (or simulating Field Admin), render the Field Admin profile
  if (role === 'FIELD_ADMIN') {
    await renderFieldAdminProfileCard(ctx, inPlace, noticeText);
    return;
  }

  if (!ctx.isRealSuperAdmin) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({
        text: '🔒 هذا الملف مخصص حصرياً للمدير العام.',
        show_alert: true,
      });
    }
    return;
  }

  if (!ctx.from) return;



  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }

  const telegramId = BigInt(ctx.from.id);
  await clearPendingAdminEdit(telegramId);

  // ⚡ L1 IN-MEMORY RAM (< 0.1ms) with SWR background revalidation via SystemDataService
  const user = await systemDataService.getAdminUser(telegramId);

  let displayPhone = 'غير مسجل';
  if (user?.phoneEncrypted && config.databaseEncryptionKey) {
    try {
      displayPhone = decryptField(user.phoneEncrypted, config.databaseEncryptionKey);
    } catch {
      displayPhone = '⚠️ خطأ في فك التشفير';
    }
  }

  const keyboard = new InlineKeyboard()
    .text('✏️ تعديل الاسم الرسمي', 'action:edit_admin:fullName')
    .row()
    .text('📱 تسجيل / تعديل رقم الهاتف', 'action:edit_admin:phone')
    .row()
    .text('🔙 العودة للحساب والأمان', 'action:settings_sub:identity')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (ctx.isImpersonating && ctx.isRealSuperAdmin) {
    keyboard
      .row()
      .text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
  }

  let banner = '';
  if (noticeText) {
    banner = `✨ *${noticeText}*\n────────────────────────────\n\n`;
  }

  const text =
    `${banner}` +
    `👤 *الملف التعريفي لحساب المدير العام*\n` +
    `────────────────────────────\n` +
    `👑 *الصفة والصلاحية:* المدير العام لمنظومة شركة السعادة\n` +
    `🆔 *المعرف الرقمي:* \`${ctx.from.id}\`\n` +
    `👤 *الاسم الرسمي المسجل:*\n\`${user?.fullName || 'غير مسجل'}\`\n\n` +
    `📱 *رقم الهاتف المعتمد:*\n\`${displayPhone}\`\n\n` +
    `🌐 *اسم المستخدم:* \`${user?.username ? `@${user.username}` : 'بدون معرف'}\`\n` +
    `🛡️ *حالة الحساب:* 🟢 نشط ومعتمد سيادياً\n` +
    `────────────────────────────\n` +
    `👇 *اختر الإجراء المطلوب أدناه لتحديث بياناتك:*`;

  if (inPlace && ctx.callbackQuery) {
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
 * Initiates an in-place prompt asking the user to send the new field value
 */
export async function handleStartEditAdminField(
  ctx: MyContext,
  fieldKey: string
): Promise<void> {
  const role = ctx.effectiveRole || 'GUEST';
  const isSuperAdmin = ctx.isRealSuperAdmin && !ctx.isImpersonating;
  const isFieldAdmin = role === 'FIELD_ADMIN' || (ctx.isImpersonating && role === 'FIELD_ADMIN');

  if ((!isSuperAdmin && !isFieldAdmin) || !ctx.from || !ctx.callbackQuery) {
    return;
  }

  await ctx.answerCallbackQuery();

  const label = ADMIN_FIELD_LABELS[fieldKey] || fieldKey;
  const messageId = ctx.callbackQuery.message?.message_id;
  if (!messageId) return;

  await setPendingAdminEdit(BigInt(ctx.from.id), fieldKey, messageId);

  const returnAction = isFieldAdmin ? 'menu:field_admin_settings' : 'action:settings:admin_profile';
  const keyboard = new InlineKeyboard()
    .text('❌ إلغاء التعديل والعودة', returnAction);

  const text =
    `✏️ *تعديل: ${label}*\n` +
    `────────────────────────────\n` +
    `💬 *الرجاء إرسال القيمة الجديدة الآن في رسالة نصية...*\n` +
    (fieldKey === 'phone' ? `*(مثال: 01012345678 أو +201012345678)*\n\n` : `\n`) +
    `أو اضغط زر الإلغاء أدناه للإبقاء على القيمة الحالية.`;

  try {
    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } catch (err) {
    console.error('Failed to edit message for admin field prompt:', err);
  }
}

/**
 * Handles incoming text when an admin (Super Admin or Field Admin) is updating their personal profile
 */
export async function handleAdminFieldTextInput(ctx: MyContext): Promise<boolean> {
  const role = ctx.effectiveRole || 'GUEST';
  const isSuperAdmin = ctx.isRealSuperAdmin && !ctx.isImpersonating;
  const isFieldAdmin = role === 'FIELD_ADMIN' || (ctx.isImpersonating && role === 'FIELD_ADMIN');

  if ((!isSuperAdmin && !isFieldAdmin) || !ctx.from || !ctx.message?.text) {
    return false;
  }

  const telegramId = BigInt(ctx.from.id);
  const pending = await getPendingAdminEdit(telegramId);
  if (!pending) {
    return false;
  }

  const newValue = ctx.message.text.trim();
  const fieldKey = pending.fieldKey;

  if (!newValue) {
    await ctx.reply('⚠️ لا يمكن ترك الحقل فارغاً.');
    return true;
  }

  // Phone validation
  if (fieldKey === 'phone') {
    const cleanPhone = newValue.replace(/[\s-]/g, '');
    if (!/^\+?[0-9]{10,15}$/.test(cleanPhone)) {
      await ctx.reply('⚠️ صيغة رقم الهاتف غير صحيحة. يرجى إرسال رقم هاتف صحيح (مثال: 01012345678).');
      return true;
    }

    let phoneEncrypted: string | null = null;
    let phoneBlindIndex: string | null = null;

    if (config.databaseEncryptionKey && config.blindIndexSalt) {
      phoneEncrypted = encryptField(cleanPhone, config.databaseEncryptionKey);
      phoneBlindIndex = createBlindIndex(cleanPhone, config.blindIndexSalt);
    }

    await prisma.user.update({
      where: { telegramId },
      data: {
        phoneEncrypted,
        phoneBlindIndex,
      },
    });
  } else if (fieldKey === 'fullName') {
    if (newValue.length < 3) {
      await ctx.reply('⚠️ الاسم قصير جداً. يرجى كتابة الاسم الثلاثي أو الثنائي على الأقل.');
      return true;
    }

    await prisma.user.update({
      where: { telegramId },
      data: { fullName: newValue },
    });
  }

  await clearPendingAdminEdit(telegramId);
  await invalidateUserCache(telegramId);
  await systemDataService.invalidateUser(telegramId);
  await ctx.deleteMessage().catch(() => {});

  const notice = `تم تحديث ${ADMIN_FIELD_LABELS[fieldKey] || fieldKey} بنجاح وحفظه في النظام.`;
  if (isFieldAdmin) {
    await renderFieldAdminProfileCard(ctx, false, notice);
  } else {
    await renderAdminProfileCard(ctx, false, notice);
  }

  return true;
}

