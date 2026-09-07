import { InlineKeyboard } from 'grammy';
import { MyContext } from '../types/context.js';
import { prisma } from '../db.js';
import { config } from '../config/env.js';
import { encryptField, decryptField, createBlindIndex } from '@alsaada/database';
import {
  setPendingAdminEdit,
  getPendingAdminEdit,
  clearPendingAdminEdit,
} from '../redis.js';

export const ADMIN_FIELD_LABELS: Record<string, string> = {
  fullName: 'الاسم الرسمي',
  phone: 'رقم الهاتف المعتمد',
};

/**
 * Renders the Super Admin personal profile card with options to update name or phone
 */
export async function renderAdminProfileCard(
  ctx: MyContext,
  inPlace = false,
  noticeText?: string
): Promise<void> {
  if (!ctx.isRealSuperAdmin || !ctx.from) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({
        text: '🔒 هذا الملف مخصص حصرياً للمدير العام.',
        show_alert: true,
      });
    }
    return;
  }

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }

  const telegramId = BigInt(ctx.from.id);
  await clearPendingAdminEdit(telegramId);

  const user = await prisma.user.findUnique({
    where: { telegramId },
  });

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
    `👤 *الملف التعريفي لحساب المدير العام (Super Admin Profile)*\n` +
    `────────────────────────────\n` +
    `👑 *الصلاحية والصفة:* مدير عام المنظومة (Super Admin)\n` +
    `🆔 *المعرف الرقمي:* \`${ctx.from.id}\`\n` +
    `👤 *الاسم الرسمي المسجل:*\n\`${user?.fullName || 'غير مسجل'}\`\n\n` +
    `📱 *رقم الهاتف المشفر (AES-256):*\n\`${displayPhone}\`\n\n` +
    `🌐 *اسم المستخدم:* @${user?.username || 'بدون معرف'}\n` +
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
  if (!ctx.isRealSuperAdmin || !ctx.from || !ctx.callbackQuery) {
    return;
  }

  await ctx.answerCallbackQuery();

  const label = ADMIN_FIELD_LABELS[fieldKey] || fieldKey;
  const messageId = ctx.callbackQuery.message?.message_id;
  if (!messageId) return;

  await setPendingAdminEdit(BigInt(ctx.from.id), fieldKey, messageId);

  const keyboard = new InlineKeyboard()
    .text('❌ إلغاء التعديل والعودة', 'action:settings:admin_profile');

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
 * Handles incoming text when the Super Admin is updating their personal profile
 */
export async function handleAdminFieldTextInput(ctx: MyContext): Promise<boolean> {
  if (!ctx.isRealSuperAdmin || !ctx.from || !ctx.message?.text) {
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
  await ctx.deleteMessage().catch(() => {});

  const notice = `تم تحديث ${ADMIN_FIELD_LABELS[fieldKey] || fieldKey} بنجاح وحفظه في النظام.`;
  await renderAdminProfileCard(ctx, false, notice);

  return true;
}
