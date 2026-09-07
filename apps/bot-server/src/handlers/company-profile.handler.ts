import { InlineKeyboard } from 'grammy';
import { MyContext } from '../types/context.js';
import { prisma } from '../db.js';
import {
  setPendingCompanyEdit,
  getPendingCompanyEdit,
  clearPendingCompanyEdit,
} from '../redis.js';

export const COMPANY_FIELD_LABELS: Record<string, string> = {
  legalName: 'اسم الشركة القانوني',
  tradeName: 'الاسم التجاري المختصر',
  commercialRegistrationNumber: 'رقم السجل التجاري',
  taxRegistrationNumber: 'رقم البطاقة الضريبية',
  headquartersAddress: 'المقر الرئيسي والإداري',
  primaryPhone: 'هاتف الإدارة والتواصل',
  officialEmail: 'البريد الإلكتروني الرسمي',
  baseCurrency: 'العملة الأساسية (EGP)',
};

/**
 * Renders the Company Profile card with in-place action buttons to edit individual fields
 */
export async function renderCompanyProfileCard(
  ctx: MyContext,
  inPlace = false,
  noticeText?: string
): Promise<void> {
  if (!ctx.isRealSuperAdmin) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({
        text: '🔒 هذا القسم مخصص حصرياً للمدير العام.',
        show_alert: true,
      });
    }
    return;
  }

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }

  // Clear any existing pending edit for this user
  if (ctx.from) {
    await clearPendingCompanyEdit(BigInt(ctx.from.id));
  }

  // Fetch active company profile
  const profile = await prisma.companyProfile.findFirst({
    include: { tenant: true },
  });

  const keyboard = new InlineKeyboard()
    .text('✏️ الاسم القانوني', 'action:edit_comp:legalName')
    .text('✏️ الاسم التجاري', 'action:edit_comp:tradeName')
    .row()
    .text('✏️ السجل التجاري', 'action:edit_comp:commercialRegistrationNumber')
    .text('✏️ البطاقة الضريبية', 'action:edit_comp:taxRegistrationNumber')
    .row()
    .text('✏️ المقر الرئيسي', 'action:edit_comp:headquartersAddress')
    .text('✏️ هاتف الإدارة', 'action:edit_comp:primaryPhone')
    .row()
    .text('✏️ البريد الرسمي', 'action:edit_comp:officialEmail')
    .text('✏️ العملة الأساسية', 'action:edit_comp:baseCurrency')
    .row()
    .text('🔙 العودة للإعدادات', 'menu:super_admin_settings')
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
    `🏢 *الملف التعريفي وبيانات الشركة الرسمية (Corporate Profile)*\n` +
    `────────────────────────────\n` +
    `📌 *المصدر المعتمد:* PostgreSQL 16 (\`company_profiles\`)\n` +
    `البيانات المعتمدة في العقود، الخطابات، وسندات الرواتب:\n\n` +
    `🏛️ *اسم الشركة القانوني:*\n\`${profile?.legalName || 'غير مسجل'}\`\n\n` +
    `🏷️ *الاسم التجاري المختصر:*\n\`${profile?.tradeName || 'غير مسجل'}\`\n\n` +
    `📜 *رقم السجل التجاري:*\n\`${profile?.commercialRegistrationNumber || 'غير مسجل'}\`\n\n` +
    `💳 *البطاقة الضريبية:*\n\`${profile?.taxRegistrationNumber || 'غير مسجل'}\`\n\n` +
    `📍 *المقر الرئيسي والإداري:*\n\`${profile?.headquartersAddress || 'غير مسجل'}\`\n\n` +
    `📞 *هاتف الإدارة والدعم:*\n\`${profile?.primaryPhone || 'غير مسجل'}\`\n\n` +
    `✉️ *البريد الإلكتروني الرسمي:*\n\`${profile?.officialEmail || 'غير مسجل'}\`\n\n` +
    `💱 *العملة الأساسية والمعتمدة:*\n\`${profile?.baseCurrency || 'EGP'}\`\n` +
    `────────────────────────────\n` +
    `👇 *اضغط على أي بيان أعلاه لتعديله وتحديثه فورياً:*`;

  if (inPlace && ctx.callbackQuery) {
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
 * Initiates an in-place prompt asking the user to send the new field value
 */
export async function handleStartEditCompanyField(
  ctx: MyContext,
  fieldKey: string
): Promise<void> {
  if (!ctx.isRealSuperAdmin || !ctx.from || !ctx.callbackQuery) {
    return;
  }

  await ctx.answerCallbackQuery();

  const label = COMPANY_FIELD_LABELS[fieldKey] || fieldKey;
  const profile = await prisma.companyProfile.findFirst();
  const currentValue = profile ? (profile as any)[fieldKey] || 'غير محدد' : 'غير محدد';

  const messageId = ctx.callbackQuery.message?.message_id;
  if (!messageId) return;

  // Save pending state in Redis for 10 minutes
  await setPendingCompanyEdit(BigInt(ctx.from.id), fieldKey, messageId);

  const keyboard = new InlineKeyboard()
    .text('❌ إلغاء التعديل والعودة', 'action:settings:company_profile');

  const text =
    `✏️ *تعديل: ${label}*\n` +
    `────────────────────────────\n` +
    `🔹 *القيمة الحالية المعتمدة:*\n\`${currentValue}\`\n\n` +
    `💬 *الرجاء إرسال القيمة الجديدة الآن في رسالة نصية...*\n` +
    `أو اضغط زر الإلغاء أدناه للإبقاء على القيمة الحالية.`;

  try {
    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } catch (err) {
    console.error('Failed to edit message for company field prompt:', err);
  }
}

/**
 * Handles incoming text messages when a user is actively editing a company profile field
 */
export async function handleCompanyFieldTextInput(ctx: MyContext): Promise<boolean> {
  if (!ctx.isRealSuperAdmin || !ctx.from || !ctx.message?.text) {
    return false;
  }

  const telegramId = BigInt(ctx.from.id);
  const pending = await getPendingCompanyEdit(telegramId);
  if (!pending) {
    return false;
  }

  const newValue = ctx.message.text.trim();
  const fieldKey = pending.fieldKey;
  const fieldLabel = COMPANY_FIELD_LABELS[fieldKey] || fieldKey;

  // Validate non-empty
  if (!newValue) {
    await ctx.reply('⚠️ لا يمكن أن تكون القيمة فارغة. الرجاء كتابة القيمة المطلوبة.');
    return true;
  }

  // Validate email format if editing email
  if (fieldKey === 'officialEmail' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newValue)) {
    await ctx.reply('⚠️ صيغة البريد الإلكتروني غير صحيحة. يرجى إرسال بريد صحيح (مثال: info@company.com).');
    return true;
  }

  try {
    // 1. Update in PostgreSQL
    let profile = await prisma.companyProfile.findFirst();
    if (profile) {
      await prisma.companyProfile.update({
        where: { id: profile.id },
        data: { [fieldKey]: newValue },
      });
    } else {
      const tenant = await prisma.tenant.findFirst();
      if (tenant) {
        await prisma.companyProfile.create({
          data: {
            tenantId: tenant.id,
            legalName: fieldKey === 'legalName' ? newValue : 'شركة السعادة',
            tradeName: fieldKey === 'tradeName' ? newValue : 'شركة السعادة',
            [fieldKey]: newValue,
          },
        });
      }
    }

    // 2. Clear Redis pending state
    await clearPendingCompanyEdit(telegramId);

    // 3. Silently delete user's text message to keep chat history clean
    await ctx.deleteMessage().catch(() => {});

    // 4. Update the original card in-place
    const updatedProfile = await prisma.companyProfile.findFirst({
      include: { tenant: true },
    });

    const keyboard = new InlineKeyboard()
      .text('✏️ الاسم القانوني', 'action:edit_comp:legalName')
      .text('✏️ الاسم التجاري', 'action:edit_comp:tradeName')
      .row()
      .text('✏️ السجل التجاري', 'action:edit_comp:commercialRegistrationNumber')
      .text('✏️ البطاقة الضريبية', 'action:edit_comp:taxRegistrationNumber')
      .row()
      .text('✏️ المقر الرئيسي', 'action:edit_comp:headquartersAddress')
      .text('✏️ هاتف الإدارة', 'action:edit_comp:primaryPhone')
      .row()
      .text('✏️ البريد الرسمي', 'action:edit_comp:officialEmail')
      .text('✏️ العملة الأساسية', 'action:edit_comp:baseCurrency')
      .row()
      .text('🔙 العودة للإعدادات', 'menu:super_admin_settings')
      .text('🏠 القائمة الرئيسية', 'action:main_menu');

    if (ctx.isImpersonating && ctx.isRealSuperAdmin) {
      keyboard
        .row()
        .text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
    }

    const text =
      `✅ *تم تحديث ${fieldLabel} بنجاح وحفظه في قاعدة البيانات.*\n` +
      `────────────────────────────\n\n` +
      `🏢 *الملف التعريفي وبيانات الشركة الرسمية (Corporate Profile)*\n` +
      `────────────────────────────\n` +
      `📌 *المصدر المعتمد:* PostgreSQL 16 (\`company_profiles\`)\n\n` +
      `🏛️ *اسم الشركة القانوني:*\n\`${updatedProfile?.legalName || 'غير مسجل'}\`\n\n` +
      `🏷️ *الاسم التجاري المختصر:*\n\`${updatedProfile?.tradeName || 'غير مسجل'}\`\n\n` +
      `📜 *رقم السجل التجاري:*\n\`${updatedProfile?.commercialRegistrationNumber || 'غير مسجل'}\`\n\n` +
      `💳 *البطاقة الضريبية:*\n\`${updatedProfile?.taxRegistrationNumber || 'غير مسجل'}\`\n\n` +
      `📍 *المقر الرئيسي والإداري:*\n\`${updatedProfile?.headquartersAddress || 'غير مسجل'}\`\n\n` +
      `📞 *هاتف الإدارة والدعم:*\n\`${updatedProfile?.primaryPhone || 'غير مسجل'}\`\n\n` +
      `✉️ *البريد الإلكتروني الرسمي:*\n\`${updatedProfile?.officialEmail || 'غير مسجل'}\`\n\n` +
      `💱 *العملة الأساسية والمعتمدة:*\n\`${updatedProfile?.baseCurrency || 'EGP'}\`\n` +
      `────────────────────────────\n` +
      `👇 *اضغط على أي بيان أعلاه لتعديله وتحديثه فورياً:*`;

    try {
      await ctx.api.editMessageText(ctx.chat!.id, pending.messageId, text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch {
      await ctx.reply(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    }

    return true;
  } catch (err) {
    console.error('Failed to update company field:', err);
    await ctx.reply('❌ حدث خطأ أثناء تحديث البيان في قاعدة البيانات.');
    return true;
  }
}
