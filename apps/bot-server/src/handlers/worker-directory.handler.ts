import { InlineKeyboard } from 'grammy';
import { MyContext } from '../types/context.js';
import { prisma } from '../db.js';
import { config } from '../config/env.js';
import { screenFlowService } from '../services/screen-flow.service.js';
import { decryptField } from '@alsaada/database';
import { formatDateDMY, formatCurrency } from '@alsaada/regional-engine';
import { EGYPTIAN_GOVERNORATES } from '@alsaada/national-id-engine';
import {
  buildWorkerPickerKeyboard,
  paginateItems,
  getWorkerDisplayName,
  WorkerItem,
  normalizeEgyptianPhone,
} from '@alsaada/core-components';
import {
  setPendingWorkerDirSearch,
  getPendingWorkerDirSearch,
  clearPendingWorkerDirSearch,
} from '../redis.js';

/**
 * 📋 استعراض دليل وسجل العاملين التفاعلي (360°)
 * يعرض 10 عاملين في الصفحة بتنسيق الأزرار الموحد مع اسم الشهرة وأيقونة الوظيفة وإمكانية البحث
 */
export async function renderWorkersDirectory(
  ctx: MyContext,
  page = 1,
  searchQuery?: string,
  inPlace = false
): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }
  if (!ctx.from) return;
  const telegramId = BigInt(ctx.from.id);

  // جلب كافة العمال النشطين
  const allWorkers = await prisma.worker.findMany({
    where: { isDeleted: false, status: 'ACTIVE' },
    include: { site: true, department: true },
    orderBy: { createdAt: 'desc' },
  });

  // تحويل لسجلات WorkerItem
  let workerItems: WorkerItem[] = allWorkers.map((w) => ({
    id: w.id,
    code: w.code,
    legacyCode: w.legacyCode || undefined,
    aliases: w.aliases || [],
    name: w.name,
    nickname: w.nickname || undefined,
    jobTitle: w.jobTitle,
    siteLocation: w.site?.name || undefined,
  }));

  const cleanQuery = searchQuery?.trim();
  if (cleanQuery) {
    const qLower = cleanQuery.toLowerCase();
    workerItems = workerItems.filter(
      (w) =>
        w.name.toLowerCase().includes(qLower) ||
        (w.nickname && w.nickname.toLowerCase().includes(qLower)) ||
        w.code.toLowerCase().includes(qLower) ||
        (w.legacyCode && w.legacyCode.toLowerCase().includes(qLower)) ||
        (w.jobTitle && w.jobTitle.toLowerCase().includes(qLower))
    );
  }

  const { items, pagination } = paginateItems(workerItems, page, 10);

  const customActionButtons = [];
  if (cleanQuery) {
    customActionButtons.push({
      text: '🔄 إلغاء البحث وعرض كافة العمال',
      callbackData: 'action:worker:dir:clear_search',
    });
  } else {
    customActionButtons.push({
      text: '🔍 بحث بالاسم أو الشهرة أو الكود',
      callbackData: 'action:worker:dir:search_prompt',
    });
  }

  const keyboard = buildWorkerPickerKeyboard({
    workers: items,
    pagination,
    customActionButtons,
    workerCallbackPrefix: 'action:worker:view:',
    pageCallbackPrefix: 'action:worker:dir:page:',
    backCallbackData: 'menu:hr_sub:onboarding',
    mainMenuCallbackData: 'action:main_menu',
    includeLegacyCode: false,
  });

  let text =
    `📋 *دليل وسجل العاملين الشامل (360°)*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    (cleanQuery
      ? `🔍 نتائج البحث عن: *"${cleanQuery}"* (${workerItems.length} نتيجة):\n\n`
      : `إجمالي العمالة النشطة المسجلة: *${allWorkers.length} عامل*\n\n`) +
    `_اختر عاملاً من القائمة أدناه لعرض بطاقة بياناته والتواصل الفوري:_`;

  if (items.length === 0) {
    text =
      `📋 *دليل وسجل العاملين الشامل*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      (cleanQuery
        ? `⚠️ لم يتم العثور على أي عامل يطابق البحث: *"${cleanQuery}"*.\n\nاضغط أدناه لإلغاء البحث.`
        : `_لا يوجد عمال مسجلون حالياً في قاعدة البيانات._`);
  }

  let sentMsgId = 0;
  if (inPlace && ctx.callbackQuery) {
    try {
      const msg = await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      sentMsgId = typeof msg === 'object' ? msg.message_id : 0;
    } catch {
      const sent = await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      sentMsgId = sent.message_id;
    }
  } else {
    const sent = await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    sentMsgId = sent.message_id;
  }

  if (ctx.chat && sentMsgId) {
    await screenFlowService.trackActiveScreen(telegramId, ctx.chat.id, sentMsgId, 'workers_directory', false);
  }
}

/**
 * 🪪 بطاقة بيانات العامل المتكاملة (Worker 360 Card)
 * تطبق مبدأ الحجب المالي المسبق الصارم (الرواتب والبدلات تظهر حصرياً للسوبر أدمن)
 * مع أزرار التواصل عبر واتساب، اتصال مباشر، ودعوة البوت.
 */
export async function renderWorkerDetailCard(
  ctx: MyContext,
  workerId: string,
  returnPage = 1,
  inPlace = true
): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }
  if (!ctx.from) return;
  const telegramId = BigInt(ctx.from.id);

  const role = ctx.effectiveRole || 'GUEST';
  const isSuperAdmin = role === 'SUPER_ADMIN' || ctx.isRealSuperAdmin;

  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    include: { site: true, department: true, jobRef: true },
  });

  if (!worker) {
    await ctx.reply('⚠️ تعذر العثور على ملف العامل المطلوب.');
    return;
  }

  // فك تشفير البيانات المشفرة بمرونة وأمان
  const encKey = config.databaseEncryptionKey;
  const safeDecrypt = (val: string | null | undefined): string => {
    if (!val) return '-';
    if (!encKey) return val;
    try {
      return decryptField(val, encKey);
    } catch {
      return val;
    }
  };

  const cleanPhone = safeDecrypt(worker.phoneEncrypted);
  const cleanEmergencyPhone = safeDecrypt(worker.emergencyPhoneEncrypted);
  const cleanId = worker.idType === 'NATIONAL_ID'
    ? safeDecrypt(worker.nationalIdEncrypted)
    : safeDecrypt(worker.passportNumberEncrypted);
  const cleanWallet = safeDecrypt(worker.accountNumberEncrypted);

  const displayName = getWorkerDisplayName(worker);
  const govName = (worker.governorateCode && EGYPTIAN_GOVERNORATES[worker.governorateCode]?.nameAr) || 'غير محدد';
  const birthDateStr = worker.birthDate ? formatDateDMY(worker.birthDate) : '-';
  const hireDateStr = worker.hireDate ? formatDateDMY(worker.hireDate) : '-';
  const expiryDateStr = worker.idCardExpiryDate ? formatDateDMY(worker.idCardExpiryDate) : 'غير مسجل';

  // حالة ربط حساب التليجرام
  const telegramStatus = worker.telegramId
    ? `🟢 *مرتبط بحساب تليجرام* (\`${worker.telegramId}\`)`
    : `⚪ *غير مرتبط ببوت تليجرام حتى الآن*`;

  // الحجب المسبق الصارم للبيانات المالية (Pre-render Financial RBAC Masking)
  let financialSection = '';
  if (isSuperAdmin) {
    const basic = Number(worker.basicSalary || 0);
    const allowances = Number(worker.fixedAllowances || 0);
    const daily = Number(worker.dailyWage || 0);
    financialSection =
      `\n💰 *البيانات المالية والمستحقات (خاص بالسوبر أدمن):*\n` +
      `• الراتب الأساسي: *${formatCurrency(basic)} ج.م*\n` +
      `• البدلات الشهرية: *${formatCurrency(allowances)} ج.م*\n` +
      `• إجمالي الراتب: *${formatCurrency(basic + allowances)} ج.م*\n` +
      `• الأجر اليومي التقديري: *${formatCurrency(daily)} ج.م*\n`;
  }

  const text =
    `👤 *بطاقة بيانات العامل الميدانية (360°)*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔹 *الاسم الكامل:* *${worker.name}*\n` +
    `🏷️ *اسم الشهرة:* *${worker.nickname || '-'}*\n` +
    `🆔 *كود العامل:* \`${worker.code}\`${worker.legacyCode ? ` | القديم: \`${worker.legacyCode}\`` : ''}\n` +
    `💼 *الوظيفة:* ${worker.jobTitle} | 📍 *الموقع:* ${worker.site?.name || 'غير محدد'}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔢 *نوع الإثبات:* ${worker.idType === 'NATIONAL_ID' ? '🇪🇬 رقم قومي مصري' : '🌍 جواز سفر'}\n` +
    `📋 *رقم الإثبات:* \`${cleanId}\`\n` +
    `⏳ *تاريخ انتهاء السريان:* *${expiryDateStr}*\n` +
    `📅 *تاريخ الميلاد:* ${birthDateStr} | 📍 *المحافظة:* ${govName}\n` +
    `🏠 *العنوان ومحل الإقامة:* ${worker.address || '-'}\n` +
    `📅 *تاريخ التعيين:* ${hireDateStr}\n` +
    `🔄 *نظام الدوام والشيفت:* ${worker.shiftSystem || '20_WORK_10_REST'}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `📱 *رقم الهاتف:* \`${cleanPhone}\`\n` +
    `🚨 *هاتف الطوارئ:* \`${cleanEmergencyPhone}\`\n` +
    `💳 *المحفظة / الحساب:* \`${cleanWallet}\` (${worker.walletType || 'نقدي'})\n` +
    `🤖 *حالة البوت الذكي:* ${telegramStatus}\n` +
    financialSection +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `اختر إجراء التواصل أو التعديل أدناه:`;

  // روابط التواصل الذكية
  const normalizedPhone = normalizeEgyptianPhone(cleanPhone) || cleanPhone.replace(/\D/g, '');
  const waChatUrl = `https://wa.me/2${normalizedPhone}`;

  // رابط دعوة الانضمام للبوت عبر واتساب
  const botUser = (config.botUsername || 'Alsaada_HRtest_Bot').replace(/^@/, '').trim();
  const inviteLink = `https://t.me/${botUser}?start=join_${worker.code}`;
  const inviteMsg = encodeURIComponent(
    `مرحباً بك يا ${displayName}،\n` +
    `ندعوك للانضمام إلى منظومة بوت شركة السعادة الذكي لمتابعة رصيدك، سلفك، وساعات عملك.\n` +
    `اضغط على الرابط التالي للبدء مباشرة:\n${inviteLink}`
  );
  const waInviteUrl = `https://wa.me/2${normalizedPhone}?text=${inviteMsg}`;

  const keyboard = new InlineKeyboard()
    .url('📲 مراسلة العامل عبر واتساب', waChatUrl)
    .row()
    .text('📞 اتصال هاتفي مباشر', `action:worker:call:${worker.id}`)
    .row()
    .url('📨 إرسال دعوة بوت تليجرام عبر واتساب', waInviteUrl)
    .row()
    .text('✏️ تعديل بيانات العامل', `we:menu:${worker.id}`)
    .row()
    .text('🔙 العودة لدليل العاملين', `action:worker:dir:page:${returnPage}`)
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  let sentMsgId = 0;
  if (inPlace && ctx.callbackQuery) {
    try {
      const msg = await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      sentMsgId = typeof msg === 'object' ? msg.message_id : 0;
    } catch {
      const sent = await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      sentMsgId = sent.message_id;
    }
  } else {
    const sent = await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    sentMsgId = sent.message_id;
  }

  if (ctx.chat && sentMsgId) {
    await screenFlowService.trackActiveScreen(telegramId, ctx.chat.id, sentMsgId, `worker_detail:${worker.id}`, false);
  }
}

/**
 * 🔍 طلب إدخال نص البحث في دليل العاملين
 */
export async function handleWorkerDirSearchPrompt(ctx: MyContext): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }
  if (!ctx.from) return;
  const telegramId = BigInt(ctx.from.id);

  const text =
    `🔍 *بحث في دليل وسجل العاملين*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `يرجى إرسال نص البحث في رسالة:\n` +
    `• الاسم (مثل: محمد، أحمد)\n` +
    `• اسم الشهرة (مثل: أبو علي، الصعيدي)\n` +
    `• كود العامل الرسمي أو القديم (مثل: OP-DRV-001)\n` +
    `• المسمى الوظيفي (مثل: سائق، لحام)\n\n` +
    `_أو اضغط أدناه للإلغاء والعودة للدليل:_`;

  const keyboard = new InlineKeyboard()
    .text('🔙 إلغاء والعودة لدليل العاملين', 'action:worker:directory')
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  let promptMsgId = 0;
  if (ctx.callbackQuery) {
    try {
      const msg = await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      promptMsgId = typeof msg === 'object' ? msg.message_id : 0;
    } catch {
      const sent = await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      promptMsgId = sent.message_id;
    }
  } else {
    const sent = await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    promptMsgId = sent.message_id;
  }

  await setPendingWorkerDirSearch(telegramId, promptMsgId);
  if (ctx.chat && promptMsgId) {
    await screenFlowService.trackActiveScreen(telegramId, ctx.chat.id, promptMsgId, 'worker_dir_search', false);
  }
}

/**
 * 🔍 معالجة إدخال نص البحث والفلترة الفورية
 */
export async function handleWorkerDirSearchInput(ctx: MyContext): Promise<boolean> {
  if (!ctx.from || !ctx.message?.text) return false;
  const telegramId = BigInt(ctx.from.id);

  const promptMsgId = await getPendingWorkerDirSearch(telegramId);
  if (!promptMsgId) return false;

  const searchQuery = ctx.message.text.trim();
  await clearPendingWorkerDirSearch(telegramId);
  await screenFlowService.cleanupIncomingUserMessage(ctx);

  // حذف رسالة السؤال السابقة لعدم تراكم الرسائل
  if (ctx.chat && promptMsgId) {
    await ctx.api.deleteMessage(ctx.chat.id, promptMsgId).catch(() => {});
  }

  await renderWorkersDirectory(ctx, 1, searchQuery, false);
  return true;
}

/**
 * 📞 إرسال كارت الاتصال الهاتفي المباشر للعامل
 */
export async function handleWorkerCallContact(ctx: MyContext, workerId: string): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }

  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
  });

  if (!worker) {
    await ctx.reply('⚠️ لم يتم العثور على العامل.');
    return;
  }

  const encKey = config.databaseEncryptionKey;
  const rawPhone = worker.phoneEncrypted && encKey
    ? decryptField(worker.phoneEncrypted, encKey)
    : worker.phoneEncrypted || '';

  const normalized = normalizeEgyptianPhone(rawPhone) || rawPhone;
  const displayName = getWorkerDisplayName(worker);

  if (ctx.chat) {
    await ctx.replyWithContact(`+20${normalized}`, displayName).catch(async () => {
      await ctx.reply(`📞 رقم هاتف العامل *${displayName}*:\n\`+20${normalized}\`\n_يمكنك النقر على الرقم للاتصال به مباشرة._`, {
        parse_mode: 'Markdown',
      });
    });
  }
}
