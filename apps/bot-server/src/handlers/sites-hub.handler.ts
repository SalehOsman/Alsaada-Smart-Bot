import { InlineKeyboard } from 'grammy';
import { MyContext } from '../types/context.js';
import { prisma } from '../db.js';
import {
  setPendingSiteAction,
  getPendingSiteAction,
  clearPendingSiteAction,
} from '../redis.js';
import { parseCoordinates, formatGoogleMapsUrl } from '../utils/coordinates.js';

export const SITE_FIELD_LABELS: Record<string, string> = {
  name: 'اسم الموقع',
  gov: 'المحافظة / الإقليم',
  location: 'الموقع الجغرافي (GPS)',
  geofence: 'نطاق السياج الجغرافي',
};

/**
 * Calculates the next sequential site code (e.g. STE-02 after STE-01)
 */
export async function getNextSiteCode(): Promise<string> {
  const sites = await prisma.site.findMany({
    select: { code: true },
  });

  let maxSeq = 0;
  for (const s of sites) {
    const match = s.code.match(/^STE-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  const nextNum = maxSeq + 1;
  const padded = nextNum < 10 ? `0${nextNum}` : `${nextNum}`;
  return `STE-${padded}`;
}

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
    `📊 *إجمالي المواقع المسجلة:* ${sites.length} موقع\n\n` +
    `👇 *اضغط على أي موقع أدناه للاطلاع على تفاصيله أو تعديل بياناته:*`;

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
 * Renders individual site details with full editing and status toggle options
 */
export async function renderSiteDetail(
  ctx: MyContext,
  siteCode: string,
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
    .text('✏️ تعديل اسم الموقع', `action:site:edit:name:${site.code}`)
    .text('🗺️ تعديل المحافظة', `action:site:edit:gov:${site.code}`)
    .row()
    .text('📍 تسجيل / تحديث GPS', `action:site:edit:location:${site.code}`)
    .text('📐 تعديل السياج', `action:site:edit:geofence:${site.code}`)
    .row()
    .text(toggleLabel, `action:site:toggle:${site.code}`)
    .row()
    .text('🔙 العودة لمصفوفة المواقع', 'action:settings:sites_hub')
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

  let gpsInfo = '`غير مسجلة بعد`';
  if (site.latitude && site.longitude) {
    const lat = site.latitude.toString();
    const lng = site.longitude.toString();
    const mapsUrl = formatGoogleMapsUrl(lat, lng);
    gpsInfo = `\`${lat}, ${lng}\`\n🗺️ [فتح الموقع على خرائط Google](${mapsUrl})`;
  }

  const text =
    `${banner}` +
    `📍 *بطاقة تفاصيل الموقع الميداني*\n` +
    `────────────────────────────\n` +
    `🏗️ *اسم الموقع:* ${site.name}\n` +
    `🔹 *الكود الهيكلي:* \`${site.code}\`\n` +
    `🏢 *المشروع التابع له:* ${site.project?.name || 'مشروع عام'}\n` +
    `🗺️ *المحافظة / الإقليم:* \`${site.governorateCode || 'عام'}\`\n` +
    `📍 *إحداثيات الموقع (GPS):*\n${gpsInfo}\n` +
    `📶 *الحالة التشغيلية:* ${isActive ? '🟢 نشط ومفعل ميدانياً' : '🔴 متوقف ومجمد مؤقتاً'}\n` +
    `👥 *العمالة المسكنة:* ${site.workers.length} عامل\n` +
    `📐 *السياج الجغرافي:* \`${site.geofenceRadiusMeters || 1000} متر\`\n` +
    `────────────────────────────\n` +
    `👇 *اختر الإجراء المطلوب أدناه:*`;

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
 * Initiates adding a new site wizard with auto-generated sequential code
 */
export async function handleStartAddSite(ctx: MyContext): Promise<void> {
  if (!ctx.isRealSuperAdmin || !ctx.from || !ctx.callbackQuery) return;

  await ctx.answerCallbackQuery();
  const messageId = ctx.callbackQuery.message?.message_id;
  if (!messageId) return;

  const nextCode = await getNextSiteCode();

  await setPendingSiteAction(BigInt(ctx.from.id), {
    action: 'add_name',
    messageId,
    draft: { code: nextCode },
  });

  const keyboard = new InlineKeyboard()
    .text('❌ إلغاء والعودة', 'action:settings:sites_hub');

  const text =
    `➕ *إضافة فرع / موقع ميداني جديد — (الخطوة 1 من 3)*\n` +
    `────────────────────────────\n` +
    `🔢 *الكود المتسلسل المحجوز تلقائياً:* \`${nextCode}\`\n\n` +
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
 * Initiates in-place editing for a site field (name, gov, location, geofence)
 */
export async function handleStartEditSiteField(
  ctx: MyContext,
  fieldKey: string,
  siteCode: string
): Promise<void> {
  if (!ctx.isRealSuperAdmin || !ctx.from || !ctx.callbackQuery) return;

  await ctx.answerCallbackQuery();
  const messageId = ctx.callbackQuery.message?.message_id;
  if (!messageId) return;

  const site = await prisma.site.findUnique({ where: { code: siteCode } });
  if (!site) return;

  const telegramId = BigInt(ctx.from.id);

  if (fieldKey === 'geofence') {
    await setPendingSiteAction(telegramId, {
      action: 'edit_geofence',
      siteCode,
      messageId,
    });

    const keyboard = new InlineKeyboard()
      .text('500 متر', `action:site:set_geo:${siteCode}:500`)
      .text('1,000 متر', `action:site:set_geo:${siteCode}:1000`)
      .row()
      .text('2,000 متر', `action:site:set_geo:${siteCode}:2000`)
      .text('5,000 متر', `action:site:set_geo:${siteCode}:5000`)
      .row()
      .text('❌ إلغاء والعودة', `action:site:view:${siteCode}`);

    const text =
      `📐 *تعديل نطاق السياج الجغرافي (Geofence Radius)*\n` +
      `────────────────────────────\n` +
      `🏗️ *الموقع:* ${site.name} (\`${site.code}\`)\n` +
      `📏 *السياج الحالي:* \`${site.geofenceRadiusMeters || 1000} متر\`\n\n` +
      `👇 *اختر النطاق المطلوب بالأزرار، أو أرسل الرقم المطلوب بالأمتار في رسالة نصية:*`;

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch {}
    return;
  }

  if (fieldKey === 'location') {
    await setPendingSiteAction(telegramId, {
      action: 'edit_location',
      siteCode,
      messageId,
    });

    const keyboard = new InlineKeyboard()
      .text('❌ إلغاء والعودة', `action:site:view:${siteCode}`);

    const text =
      `📍 *تسجيل وتحديث الموقع الجغرافي (GPS)*\n` +
      `────────────────────────────\n` +
      `🏗️ *الموقع:* ${site.name} (\`${site.code}\`)\n\n` +
      `📡 *يرجى إرسال الموقع عبر إحدى الطرق التالية:*\n` +
      `1️⃣ *مشاركة الموقع المباشر:* اضغط على مشبك المرفقات 📎 في تليجرام ثم اختر الموقع (Location).\n` +
      `2️⃣ *إرسال الإحداثيات كنص:* (مثال: \`25.4412, 30.5512\`).\n` +
      `3️⃣ *إرسال رابط خرائط Google:* من تطبيق الخرائط مباشرة.\n\n` +
      `أو اضغط زر الإلغاء أدناه للإبقاء على الإحداثيات الحالية.`;

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch {}
    return;
  }

  // Name or Governorate
  const actionType = fieldKey === 'gov' ? 'edit_gov' : 'edit_name';
  await setPendingSiteAction(telegramId, {
    action: actionType,
    siteCode,
    messageId,
  });

  const keyboard = new InlineKeyboard()
    .text('❌ إلغاء والعودة', `action:site:view:${siteCode}`);

  const label = SITE_FIELD_LABELS[fieldKey] || fieldKey;
  const text =
    `✏️ *تعديل ${label}*\n` +
    `────────────────────────────\n` +
    `🏗️ *الموقع:* ${site.name} (\`${site.code}\`)\n\n` +
    `💬 *يرجى إرسال القيمة الجديدة في رسالة نصية الآن...*\n` +
    `أو اضغط زر الإلغاء أدناه للتراجع.`;

  try {
    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } catch {}
}

/**
 * Sets geofence radius directly from inline keyboard
 */
export async function handleSetSiteGeofence(
  ctx: MyContext,
  siteCode: string,
  radius: number
): Promise<void> {
  if (!ctx.isRealSuperAdmin) return;

  await prisma.site.update({
    where: { code: siteCode },
    data: { geofenceRadiusMeters: radius },
  });

  if (ctx.from) {
    await clearPendingSiteAction(BigInt(ctx.from.id));
  }

  const notice = `تم تحديث السياج الجغرافي للموقع إلى (${radius} متر) بنجاح.`;
  await renderSiteDetail(ctx, siteCode, true, notice);
}

/**
 * Handles incoming location pin from Telegram attachment
 */
export async function handleSiteLocationInput(ctx: MyContext): Promise<boolean> {
  if (!ctx.isRealSuperAdmin || !ctx.from || !ctx.message?.location) {
    return false;
  }

  const telegramId = BigInt(ctx.from.id);
  const pending = await getPendingSiteAction(telegramId);
  if (!pending || pending.action !== 'edit_location' || !pending.siteCode) {
    return false;
  }

  const lat = ctx.message.location.latitude;
  const lng = ctx.message.location.longitude;

  await prisma.site.update({
    where: { code: pending.siteCode },
    data: { latitude: lat, longitude: lng },
  });

  await clearPendingSiteAction(telegramId);
  await ctx.deleteMessage().catch(() => {});

  const notice = `تم تسجيل إحداثيات الموقع بنجاح (${lat.toFixed(6)}, ${lng.toFixed(6)}).`;
  await renderSiteDetail(ctx, pending.siteCode, false, notice);
  return true;
}

/**
 * Handles confirmation of the auto-generated site code
 */
export async function handleConfirmSiteCode(
  ctx: MyContext,
  confirmedCode: string
): Promise<void> {
  if (!ctx.isRealSuperAdmin || !ctx.from || !ctx.callbackQuery) return;

  const telegramId = BigInt(ctx.from.id);
  const pending = await getPendingSiteAction(telegramId);
  if (!pending || !pending.draft?.name) return;

  await ctx.answerCallbackQuery();
  const messageId = ctx.callbackQuery.message?.message_id || pending.messageId;

  await setPendingSiteAction(telegramId, {
    action: 'add_gov',
    messageId,
    draft: { ...pending.draft, code: confirmedCode },
  });

  const keyboard = new InlineKeyboard()
    .text('القاهرة', `action:site:set_gov:${confirmedCode}:القاهرة`)
    .text('الوادى الجديد', `action:site:set_gov:${confirmedCode}:الوادى الجديد`)
    .row()
    .text('أسوان', `action:site:set_gov:${confirmedCode}:أسوان`)
    .text('البحر الأحمر', `action:site:set_gov:${confirmedCode}:البحر الأحمر`)
    .row()
    .text('❌ إلغاء والعودة', 'action:settings:sites_hub');

  const promptText =
    `➕ *إضافة موقع جديد — (الخطوة 3 من 3)*\n` +
    `────────────────────────────\n` +
    `✅ *الاسم:* ${pending.draft.name}\n` +
    `✅ *الكود:* \`${confirmedCode}\`\n\n` +
    `🗺️ *اختر المحافظة من الأزرار أو أرسل اسمها في رسالة نصية:*`;

  try {
    await ctx.editMessageText(promptText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } catch {}
}

/**
 * Finalizes site creation when governorate is selected from inline button
 */
export async function handleSelectSiteGov(
  ctx: MyContext,
  siteCode: string,
  govName: string
): Promise<void> {
  if (!ctx.isRealSuperAdmin || !ctx.from) return;

  const telegramId = BigInt(ctx.from.id);
  const pending = await getPendingSiteAction(telegramId);
  const siteName = pending?.draft?.name || 'موقع جديد';

  let tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { code: 'ALSAADA', name: 'شركة السعادة للمقاولات العامة والتعدين' },
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

  const createdSite = await prisma.site.create({
    data: {
      projectId: project.id,
      code: siteCode,
      name: siteName,
      governorateCode: govName,
      status: 'ACTIVE',
      geofenceRadiusMeters: 1000,
    },
  });

  await clearPendingSiteAction(telegramId);

  const notice = `تمت إضافة موقع (${createdSite.name}) بنجاح وتفعيله في المنظومة.`;
  await renderSiteDetail(ctx, createdSite.code, true, notice);
}

/**
 * Handles incoming text messages for site adding or editing
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

  // 1. Edit Name
  if (pending.action === 'edit_name' && pending.siteCode) {
    if (textVal.length < 3) {
      await ctx.reply('⚠️ اسم الموقع قصير جداً.');
      return true;
    }
    await prisma.site.update({
      where: { code: pending.siteCode },
      data: { name: textVal },
    });
    await clearPendingSiteAction(telegramId);
    await ctx.deleteMessage().catch(() => {});
    await renderSiteDetail(ctx, pending.siteCode, false, `تم تعديل اسم الموقع إلى (${textVal}) بنجاح.`);
    return true;
  }

  // 2. Edit Governorate
  if (pending.action === 'edit_gov' && pending.siteCode) {
    if (textVal.length < 2) {
      await ctx.reply('⚠️ اسم المحافظة قصير جداً.');
      return true;
    }
    await prisma.site.update({
      where: { code: pending.siteCode },
      data: { governorateCode: textVal },
    });
    await clearPendingSiteAction(telegramId);
    await ctx.deleteMessage().catch(() => {});
    await renderSiteDetail(ctx, pending.siteCode, false, `تم تعديل المحافظة إلى (${textVal}) بنجاح.`);
    return true;
  }

  // 3. Edit Geofence
  if (pending.action === 'edit_geofence' && pending.siteCode) {
    const meters = parseInt(textVal, 10);
    if (isNaN(meters) || meters < 50 || meters > 50000) {
      await ctx.reply('⚠️ يرجى إدخال رقم صحيح لنطاق السياج بين 50 و 50000 متر.');
      return true;
    }
    await prisma.site.update({
      where: { code: pending.siteCode },
      data: { geofenceRadiusMeters: meters },
    });
    await clearPendingSiteAction(telegramId);
    await ctx.deleteMessage().catch(() => {});
    await renderSiteDetail(ctx, pending.siteCode, false, `تم تعديل نطاق السياج الجغرافي إلى (${meters} متر) بنجاح.`);
    return true;
  }

  // 4. Edit Location (Coordinates / Google Maps link)
  if (pending.action === 'edit_location' && pending.siteCode) {
    const coords = await parseCoordinates(textVal);
    if (!coords) {
      await ctx.reply(
        '⚠️ تعذر استخراج الإحداثيات من النص المدخل.\nيرجى إرسال إحداثيات صحيحة (مثال: `25.4412, 30.5512`) أو رابط خرائط Google، أو استخدام مشبك المرفقات 📎 لمشاركة الموقع مباشرة.'
      );
      return true;
    }
    await prisma.site.update({
      where: { code: pending.siteCode },
      data: { latitude: coords.latitude, longitude: coords.longitude },
    });
    await clearPendingSiteAction(telegramId);
    await ctx.deleteMessage().catch(() => {});
    const notice = `تم تسجيل إحداثيات الموقع بنجاح (${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}).`;
    await renderSiteDetail(ctx, pending.siteCode, false, notice);
    return true;
  }

  // 5. Add Site - Step 1: Name -> Present Step 2 with auto-generated code
  if (pending.action === 'add_name') {
    if (textVal.length < 3) {
      await ctx.reply('⚠️ اسم الموقع قصير جداً. يرجى إدخال اسم واضح.');
      return true;
    }

    const nextCode = pending.draft?.code || (await getNextSiteCode());

    await setPendingSiteAction(telegramId, {
      action: 'add_code',
      messageId,
      draft: { ...pending.draft, name: textVal, code: nextCode },
    });

    await ctx.deleteMessage().catch(() => {});

    const keyboard = new InlineKeyboard()
      .text(`✅ اعتماد الكود المقترح (${nextCode})`, `action:site:confirm_code:${nextCode}`)
      .row()
      .text('❌ إلغاء والعودة', 'action:settings:sites_hub');

    const promptText =
      `➕ *إضافة موقع جديد — (الخطوة 2 من 3)*\n` +
      `────────────────────────────\n` +
      `✅ *الاسم المعتمد:* ${textVal}\n\n` +
      `🔢 *الكود التسلسلي المقترح تلقائياً:* \`${nextCode}\`\n\n` +
      `👇 *اضغط على زر الاعتماد المباشر أدناه، أو أرسل كوداً مخصصاً بالإنجليزية في رسالة نصية:*`;

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

  // 6. Add Site - Step 2: Custom Code
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
      .text('القاهرة', `action:site:set_gov:${formattedCode}:القاهرة`)
      .text('الوادى الجديد', `action:site:set_gov:${formattedCode}:الوادى الجديد`)
      .row()
      .text('أسوان', `action:site:set_gov:${formattedCode}:أسوان`)
      .text('البحر الأحمر', `action:site:set_gov:${formattedCode}:البحر الأحمر`)
      .row()
      .text('❌ إلغاء والعودة', 'action:settings:sites_hub');

    const promptText =
      `➕ *إضافة موقع جديد — (الخطوة 3 من 3)*\n` +
      `────────────────────────────\n` +
      `✅ *الاسم:* ${pending.draft?.name}\n` +
      `✅ *الكود:* \`${formattedCode}\`\n\n` +
      `🗺️ *اختر المحافظة من الأزرار أو أرسل اسمها في رسالة نصية:*`;

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

  // 7. Add Site - Step 3: Governorate (text input)
  if (pending.action === 'add_gov') {
    const govCode = textVal;

    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: { code: 'ALSAADA', name: 'شركة السعادة للمقاولات العامة والتعدين' },
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
    await renderSiteDetail(ctx, createdSite.code, false, notice);

    return true;
  }

  return false;
}
