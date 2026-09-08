import { InlineKeyboard } from 'grammy';
import { MyContext } from '../types/context.js';
import { prisma } from '../db.js';
import { config } from '../config/env.js';
import { workerService } from '../services/worker.service.js';
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
 * 👥 تصيير بوابة قطاع الموارد البشرية والعمالة (HR Domain Hub)
 * مُقسمة إلى 5 أقسام فرعية بالترتيب المعتمد:
 * 1. 💵 السلف والمسحوبات وحسابات العمال
 * 2. 🏖️ الإجازات والدوام والتواجد الميداني
 * 3. 📁 شؤون العاملين والتعيينات
 * 4. 💰 الرواتب والأجور والمستحقات (محجوبة مسبقاً لغير السوبر أدمن)
 * 5. 🏛️ الشؤون الإدارية والوثائق والمخيم
 */
export async function renderHrHub(ctx: MyContext, inPlace = false): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }
  if (!ctx.from) return;
  const telegramId = BigInt(ctx.from.id);

  const role = ctx.effectiveRole || 'GUEST';
  const isSuperAdmin = role === 'SUPER_ADMIN' || ctx.isRealSuperAdmin;

  // جلب إحصائيات سريعة من الكاش
  const summary = await workerService.getWorkersSummary().catch(() => ({
    totalActive: 0,
    egyptianCount: 0,
    foreignCount: 0,
  }));

  const text =
    `👥 *بوابة قطاع الموارد البشرية والعمالة*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `مرحباً بك في المركز التشغيلي لإدارة قوى العمل والمواقع لشركة السعادة.\n\n` +
    `📊 *الموقف الحالي للقوى العاملة:*\n` +
    `• إجمالي العمالة النشطة بالمواقع: *${summary.totalActive} عامل*\n` +
    `  ├─ 🇪🇬 عمالة مصرية (رقم قومي): *${summary.egyptianCount}*\n` +
    `  └─ 🌍 عمالة وافدة (جواز سفر): *${summary.foreignCount}*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `اختر القسم الفرعي المطلوب للمتابعة:`;

  const keyboard = new InlineKeyboard()
    // 1st: السلف والمسحوبات وحسابات العمال
    .text('💵 السلف والمسحوبات وحسابات العمال', 'menu:hr_sub:advances')
    .row()
    // 2nd: الإجازات والدوام والتواجد الميداني
    .text('🏖️ الإجازات والدوام والتواجد الميداني', 'menu:hr_sub:leaves')
    .row()
    // 3rd: شؤون العاملين والتعيينات
    .text('📁 شؤون العاملين والتعيينات', 'menu:hr_sub:onboarding')
    .row();

  // 4th: الرواتب والأجور والمستحقات (حصرياً للسوبر أدمن مع الحجب المسبق الصارم)
  if (isSuperAdmin) {
    keyboard
      .text('💰 الرواتب والأجور والمستحقات', 'menu:hr_sub:payroll')
      .row();
  }

  // 5th: الشؤون الإدارية والوثائق والمخيم
  keyboard
    .text('🏛️ الشؤون الإدارية والوثائق والمخيم', 'menu:hr_sub:admin_affairs')
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
    await screenFlowService.trackActiveScreen(telegramId, ctx.chat.id, sentMsgId, 'hr_hub', false);
  }
}

/**
 * 📂 تصيير الأقسام الفرعية لبوابة الموارد البشرية
 */
export async function renderHrSubHub(ctx: MyContext, subKey: string, inPlace = true): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }
  if (!ctx.from) return;
  const telegramId = BigInt(ctx.from.id);

  const role = ctx.effectiveRole || 'GUEST';
  const isSuperAdmin = role === 'SUPER_ADMIN' || ctx.isRealSuperAdmin;

  let text = '';
  const keyboard = new InlineKeyboard();

  switch (subKey) {
    case 'advances': {
      text =
        `💵 *قسم السلف والمسحوبات وحسابات العمال*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `إدارة السلف النقدية، المصاريف الميدانية، ومسحوبات العمال اليومية.\n\n` +
        `اختر الإجراء المطلوب:`;

      keyboard
        .text('➕ طلب / تسجيل سلفة جديدة', 'action:advances:request')
        .row()
        .text('💸 تسجيل مسحوب نقدي ميداني', 'action:advances:cash_withdrawal')
        .row()
        .text('📋 سجل السلف والمسحوبات النشطة', 'action:advances:active_list')
        .row()
        .text('📊 كشف حساب وتصفية عامل', 'action:advances:worker_statement')
        .row();
      break;
    }

    case 'leaves': {
      text =
        `🏖️ *قسم الإجازات والدوام والتواجد الميداني*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `إدارة نزول واستئناف العمل، رصيد الإجازات، وحضور ومطابقة الموقع.\n\n` +
        `اختر الإجراء المطلوب:`;

      keyboard
        .text('➕ تسجيل إجازة أو نزول لعامل', 'action:leaves:request')
        .row()
        .text('🛬 تسجيل عودة واستئناف العمل', 'action:leaves:return')
        .row()
        .text('📍 كشف التواجد الميداني وحضور اليوم', 'action:leaves:daily_attendance')
        .row()
        .text('📋 سجل الإجازات والنزول المفتوح', 'action:leaves:active_list')
        .row();
      break;
    }

    case 'onboarding': {
      text =
        `📁 *قسم شؤون العاملين والتعيينات*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `تسجيل وتوثيق ملفات العمال الجدد، دليل السجل الشامل، وتعديل البيانات.\n\n` +
        `اختر الإجراء المطلوب:`;

      keyboard
        .text('➕ تسجيل وتعيين عامل جديد', 'action:worker:add_single')
        .row()
        .text('📋 دليل وسجل العاملين (360°)', 'action:worker:directory')
        .row();

      if (isSuperAdmin) {
        keyboard.text('✏️ تعديل بيانات عامل (تنفيذ فوري)', 'action:worker_edit:pick').row();

        const pendingCount = await prisma.workerEditRequest.count({ where: { status: 'PENDING' } }).catch(() => 0);
        if (pendingCount > 0) {
          keyboard.text(`📨 مراجعة طلبات التعديل المعلقة (${pendingCount})`, 'action:worker_edit:pending_list').row();
        }

        keyboard
          .text('📥 تنزيل قالب العمال (إكسيل)', 'action:worker:download_excel')
          .row()
          .text('📤 رفع كشف العمال (إكسيل)', 'action:worker:upload_excel')
          .row();
      } else {
        keyboard.text('📝 طلب تعديل بيانات عامل', 'action:worker_edit:pick').row();
      }
      break;
    }

    case 'payroll': {
      if (!isSuperAdmin) {
        return renderHrHub(ctx, inPlace);
      }

      text =
        `💰 *قسم الرواتب والأجور والمستحقات*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `إدارة مسيرات الرواتب الشهرية، قسائم القبض، البدلات، والتسويات المالية.\n\n` +
        `اختر الإجراء المطلوب:`;

      keyboard
        .text('📊 مسير الرواتب الشهري العام', 'action:payroll:monthly_sheet')
        .row()
        .text('🧾 إصدار وتوزيع قسائم الرواتب', 'action:payroll:slips')
        .row()
        .text('⚙️ إعدادات البدلات والاستقطاعات', 'action:payroll:allowances_settings')
        .row()
        .text('💰 ترحيل الرواتب والمطابقة البنكية', 'action:payroll:bank_export')
        .row();
      break;
    }

    case 'admin_affairs': {
      text =
        `🏛️ *الشؤون الإدارية والوثائق والمخيم*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `متابعة سريان بطاقات الهوية، سكن ومخيم العمال، الجزاءات، والمخاطبات.\n\n` +
        `اختر الإجراء المطلوب:`;

      keyboard
        .text('🪪 تنبيهات سريان البطاقات والوثائق', 'action:admin_affairs:expiry_alerts')
        .row()
        .text('⛺ سكن العمال والمخيم والإعاشة', 'action:admin_affairs:camp_management')
        .row()
        .text('⚖️ الجزاءات والإنذارات والمكافآت', 'action:admin_affairs:penalties_rewards')
        .row()
        .text('📄 الشهادات والخطابات الإدارية', 'action:admin_affairs:letters')
        .row();
      break;
    }

    default:
      return renderHrHub(ctx, inPlace);
  }

  // Navigation rows
  keyboard
    .text('🔙 العودة للموارد البشرية', 'menu:domain:hr')
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
    await screenFlowService.trackActiveScreen(telegramId, ctx.chat.id, sentMsgId, `hr_sub:${subKey}`, false);
  }
}

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

/**
 * 🏗️ شاشة إعلامية للوظائف الفرعية الجاري استكمالها في أقسام الموارد البشرية
 */
export async function handleHrPlaceholder(ctx: MyContext): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }
  const callbackData = ctx.callbackQuery?.data || '';

  const keyboard = new InlineKeyboard()
    .text('🔙 العودة للموارد البشرية', 'menu:domain:hr')
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  const text =
    `🏗️ *هذه الوظيفة قيد التجهيز المالي والربط الميداني*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔹 *المعرف الإجرائي:* \`${callbackData}\`\n` +
    `🔹 *الحالة التشغيلية:* تم اعتماد هيكل القسم والزر، وجارٍ استكمال بناء معالج الإدخال المالي والترحيل وفق وثيقة الحوكمة (SSOT).\n\n` +
    `اضغط أدناه للعودة:`;

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

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}
