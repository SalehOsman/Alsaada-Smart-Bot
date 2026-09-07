import { InlineKeyboard } from 'grammy';
import { MyContext } from '../types/context.js';
import { prisma } from '../db.js';
import {
  setPendingSiteAction,
  getPendingSiteAction,
  clearPendingSiteAction,
} from '../redis.js';

/**
 * Renders the Sites & Projects Hub listing all active and inactive sites
 */
export async function renderSitesHub(
  ctx: MyContext,
  inPlace = false,
  noticeText?: string
): Promise<void> {
  if (!ctx.isRealSuperAdmin || !ctx.from) {
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

  await clearPendingSiteAction(BigInt(ctx.from.id));

  // Fetch all sites with project and worker counts
  const sites = await prisma.site.findMany({
    include: {
      project: true,
      workers: { select: { id: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const keyboard = new InlineKeyboard();

  // List each site as an interactive button
  sites.forEach((site) => {
    const statusIcon = site.status === 'ACTIVE' ? '🟢' : '🔴';
    const workerCount = site.workers.length;
    keyboard
      .text(`${statusIcon} ${site.name} (${site.code}) — 👥 ${workerCount}`, `action:site:view:${site.code}`)
      .row();
  });

  // Action buttons
  keyboard
    .text('➕ إضافة موقع / فرع ميداني جديد', 'action:site:add_new')
    .row()
    .text('🔙 العودة للكيان المؤسسي', 'action:settings_sub:corporate')
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
    `🏗️ *مصفوفة المشاريع والفروع والمواقع الميدانية (Sites Hub)*\n` +
    `────────────────────────────\n` +
    `📌 *المصدر المعتمد:* PostgreSQL 16 (\`sites\` & \`projects\`)\n` +
    `📊 *إجمالي المواقع المسجلة:* ${sites.length} موقع ميداني\n\n` +
    `👇 *اضغط على أي موقع أدناه للاطلاع على تفاصيله أو تغيير حالته التشغيلية:*`;

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
 * Renders individual site details with status toggle option
 */
export async function renderSiteDetail(
  ctx: MyContext,
  siteCode: string,
  inPlace = true
): Promise<void> {
  if (!ctx.isRealSuperAdmin || !ctx.from) return;

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }

  const site = await prisma.site.findUnique({
    where: { code: siteCode },
    include: {
      project: true,
      workers: { select: { id: true } },
    },
  });

  if (!site) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: '⚠️ الموقع غير موجود.', show_alert: true });
    }
    return renderSitesHub(ctx, inPlace);
  }

  const isActive = site.status === 'ACTIVE';
  const toggleLabel = isActive ? '🔴 تعطيل الموقع (إيقاف التشغيل)' : '🟢 تنشيط الموقع (تشغيل)';

  const keyboard = new InlineKeyboard()
    .text(toggleLabel, `action:site:toggle:${site.code}`)
    .row()
    .text('🔙 العودة لمصفوفة المواقع', 'action:settings:sites_hub')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (ctx.isImpersonating && ctx.isRealSuperAdmin) {
    keyboard
      .row()
      .text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
  }

  const text =
    `📍 *بطاقة تفاصيل الموقع الميداني*\n` +
    `────────────────────────────\n` +
    `🏗️ *اسم الموقع:* ${site.name}\n` +
    `🔹 *الكود الهيكلي:* \`${site.code}\`\n` +
    `🏢 *المشروع التابع له:* ${site.project?.name || 'مشروع عام'}\n` +
    `🗺️ *المحافظة / الإقليم:* ${site.governorateCode}\n` +
    `📶 *الحالة التشغيلية:* ${isActive ? '🟢 نشط ومفعل ميدانياً' : '🔴 متوقف ومجمد مؤقتاً'}\n` +
    `👥 *العمالة المسكنة:* ${site.workers.length} عامل\n` +
    `📐 *السياج الجغرافي:* ${site.geofenceRadiusMeters || 1000} متر\n` +
    `────────────────────────────\n` +
    `اختر الإجراء المطلوب أدناه:`;

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
 * Toggles a site's status between ACTIVE and INACTIVE
 */
export async function handleToggleSiteStatus(
  ctx: MyContext,
  siteCode: string
): Promise<void> {
  if (!ctx.isRealSuperAdmin) return;

  const site = await prisma.site.findUnique({ where: { code: siteCode } });
  if (!site) return;

  const nextStatus = site.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  await prisma.site.update({
    where: { code: siteCode },
    data: { status: nextStatus },
  });

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({
      text: `تم تغيير حالة الموقع إلى: ${nextStatus === 'ACTIVE' ? 'نشط 🟢' : 'متوقف 🔴'}`,
    });
  }

  await renderSiteDetail(ctx, siteCode, true);
}

/**
 * Initiates adding a new site wizard
 */
export async function handleStartAddSite(ctx: MyContext): Promise<void> {
  if (!ctx.isRealSuperAdmin || !ctx.from || !ctx.callbackQuery) return;

  await ctx.answerCallbackQuery();
  const messageId = ctx.callbackQuery.message?.message_id;
  if (!messageId) return;

  await setPendingSiteAction(BigInt(ctx.from.id), {
    action: 'add_name',
    messageId,
    draft: {},
  });

  const keyboard = new InlineKeyboard()
    .text('❌ إلغاء والعودة', 'action:settings:sites_hub');

  const text =
    `➕ *إضافة فرع / موقع ميداني جديد — (الخطوة 1 من 3)*\n` +
    `────────────────────────────\n` +
    `📝 *يرجى إرسال اسم الموقع الجديد في رسالة نصية:*\n` +
    `*(مثال: موقع منجم الفوسفات بالسباعية - قطاع 2)*\n\n` +
    `أو اضغط زر الإلغاء أدناه للتراجع.`;

  try {
    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } catch (err) {
    console.error('Failed to edit message for add site:', err);
  }
}

/**
 * Handles text messages during the site creation wizard
 */
export async function handleSiteTextInput(ctx: MyContext): Promise<boolean> {
  if (!ctx.isRealSuperAdmin || !ctx.from || !ctx.message?.text) {
    return false;
  }

  const telegramId = BigInt(ctx.from.id);
  const pending = await getPendingSiteAction(telegramId);
  if (!pending) return false;

  const textVal = ctx.message.text.trim();
  const messageId = pending.messageId;

  if (pending.action === 'add_name') {
    if (textVal.length < 3) {
      await ctx.reply('⚠️ اسم الموقع قصير جداً. يرجى إدخال اسم واضح.');
      return true;
    }

    await setPendingSiteAction(telegramId, {
      action: 'add_code',
      messageId,
      draft: { ...pending.draft, name: textVal },
    });

    await ctx.deleteMessage().catch(() => {});

    const keyboard = new InlineKeyboard()
      .text('❌ إلغاء والعودة', 'action:settings:sites_hub');

    const promptText =
      `➕ *إضافة موقع جديد — (الخطوة 2 من 3)*\n` +
      `────────────────────────────\n` +
      `✅ *الاسم المعتمد:* ${textVal}\n\n` +
      `🔤 *الرجاء إرسال كود الموقع بالإنجليزية (مثال: STE-SEB-02):*`;

    try {
      await ctx.api.editMessageText(ctx.chat!.id, messageId, promptText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch {
      await ctx.reply(promptText, { parse_mode: 'Markdown', reply_markup: keyboard });
    }

    return true;
  }

  if (pending.action === 'add_code') {
    const formattedCode = textVal.toUpperCase().replace(/\s+/g, '-');
    const existing = await prisma.site.findUnique({ where: { code: formattedCode } });
    if (existing) {
      await ctx.reply(`⚠️ كود الموقع \`${formattedCode}\` مستخدم بالفعل لموقع آخر. يرجى اختيار كود مختلف:`);
      return true;
    }

    await setPendingSiteAction(telegramId, {
      action: 'add_gov',
      messageId,
      draft: { ...pending.draft, code: formattedCode },
    });

    await ctx.deleteMessage().catch(() => {});

    const keyboard = new InlineKeyboard()
      .text('❌ إلغاء والعودة', 'action:settings:sites_hub');

    const promptText =
      `➕ *إضافة موقع جديد — (الخطوة 3 من 3)*\n` +
      `────────────────────────────\n` +
      `✅ *الاسم:* ${pending.draft?.name}\n` +
      `✅ *الكود:* \`${formattedCode}\`\n\n` +
      `🗺️ *أرسل اسم أو كود المحافظة التابع لها الموقع (مثال: أسوان أو ASW):*`;

    try {
      await ctx.api.editMessageText(ctx.chat!.id, messageId, promptText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch {
      await ctx.reply(promptText, { parse_mode: 'Markdown', reply_markup: keyboard });
    }

    return true;
  }

  if (pending.action === 'add_gov') {
    const govCode = textVal;

    // Get or create default tenant and project
    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: { code: 'ALSAADA', name: 'شركة السعادة للمقاولات' },
      });
    }

    let project = await prisma.project.findFirst({ where: { tenantId: tenant.id } });
    if (!project) {
      project = await prisma.project.create({
        data: {
          tenantId: tenant.id,
          code: 'PRJ-MAIN-01',
          name: 'المشروع العام لعمليات المقاولات والتعدين',
          status: 'ACTIVE',
        },
      });
    }

    // Create the site in PostgreSQL
    const createdSite = await prisma.site.create({
      data: {
        projectId: project.id,
        code: pending.draft!.code!,
        name: pending.draft!.name!,
        governorateCode: govCode,
        status: 'ACTIVE',
        geofenceRadiusMeters: 1000,
      },
    });

    await clearPendingSiteAction(telegramId);
    await ctx.deleteMessage().catch(() => {});

    const notice = `تمت إضافة موقع (${createdSite.name}) بنجاح وتفعيله في المنظومة.`;
    await renderSitesHub(ctx, false, notice);

    return true;
  }

  return false;
}
