import { InlineKeyboard } from 'grammy';
import { MyContext } from '../types/context.js';
import { config } from '../config/env.js';
import { prisma } from '../db.js';
import { formatDate } from '@alsaada/regional-engine';
import { invalidateUserCache } from '../middlewares/auth.middleware.js';
import { buildMainMenuKeyboard } from '../keyboards/main-menu.keyboard.js';
import { buildPersistentReplyKeyboard } from '../keyboards/reply-bar.keyboard.js';
import { syncUserCommandsScope } from '../services/command-scope.service.js';

export function getRoleTitle(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '👑 مدير عام (سوبر أدمن)';
    case 'EXECUTIVE':
      return '👔 إدارة تنفيذية ومالية';
    case 'FIELD_ADMIN':
      return '🛡️ مشرف موقع وميداني';
    case 'ACCOUNTANT':
      return '💼 محاسب مالي';
    case 'WORKER':
      return '👷 عامل مسجل (بوابة الخدمة الذاتية)';
    case 'SUPPLIER':
      return '🚚 مورد / مقاول باطن';
    case 'GUEST':
    default:
      return '👤 زائر (بانتظار الربط والاعتماد)';
  }
}

export function buildWelcomeMessage(ctx: MyContext): string {
  const name = ctx.from?.first_name || 'أهلاً بك';
  const role = ctx.effectiveRole || 'GUEST';
  const roleTitle = getRoleTitle(role);

  let simulationBanner = '';
  if (ctx.isImpersonating && ctx.isRealSuperAdmin) {
    simulationBanner =
      `🎭 *[ وضع المحاكاة النشط — GHOST MODE ]*\n` +
      `أنت تستعرض وتختبر النظام الآن بهوية: *${roleTitle}*\n` +
      `لإنهاء المحاكاة والعودة لصلاحيات المدير العام، اضغط زر الإنهاء بالأسفل.\n` +
      `────────────────────────\n\n`;
  }

  switch (role) {
    case 'SUPER_ADMIN':
      return (
        `${simulationBanner}` +
        `🏢 *منظومة شركة السعادة للمقاولات العامة*\n` +
        `🤖 *محرك البوت المؤسسي الجديد (Al-Saada Enterprise Engine \`v${config.appVersion}\`)*\n\n` +
        `مرحباً بك يا *${name}* 👋\n\n` +
        `🔹 *المعرف الرقمي:* \`${ctx.from?.id}\`\n` +
        `🔹 *الصلاحية المعتمدة:* ${roleTitle}\n` +
        `🔹 *حالة الحساب:* 🟢 نشط ومعتمد\n` +
        `🔹 *محرك البيانات:* PostgreSQL 16 (مشفر وموثق جنائياً)\n\n` +
        `اختر القسم المطلوب من لوحة التحكم أدناه:`
      );

    case 'EXECUTIVE':
      return (
        `${simulationBanner}` +
        `👔 *بوابة الإدارة التنفيذية والمالية*\n` +
        `🏢 *شركة السعادة للمقاولات العامة*\n\n` +
        `مرحباً بك يا *${name}* 👋\n\n` +
        `هنا يمكنك متابعة لوحات المؤشرات التشغيلية، السيولة النقدية، والموقف المالي للمشاريع.\n\n` +
        `اختر التقرير أو الإجراء المطلوب من القائمة أدناه:`
      );

    case 'FIELD_ADMIN':
      return (
        `${simulationBanner}` +
        `🛡️ *بوابة المشرف الميداني وإدارة المواقع*\n` +
        `🏢 *شركة السعادة للمقاولات العامة*\n\n` +
        `مرحباً بك يا *${name}* 👋\n\n` +
        `🔹 *المعرف الرقمي:* \`${ctx.from?.id}\`\n` +
        `🔹 *الصلاحية المعتمدة:* ${roleTitle}\n` +
        `🔹 *حالة الحساب:* 🟢 نشط ومعتمد ميدانياً\n\n` +
        `اختر القسم التشغيلي المطلوب من لوحة التحكم أدناه:`
      );

    case 'WORKER':
      return (
        `${simulationBanner}` +
        `👷 *بوابة الخدمة الذاتية للعاملين*\n` +
        `🏢 *شركة السعادة للمقاولات العامة*\n\n` +
        `مرحباً بك يا *${name}* 👋\n\n` +
        `هنا يمكنك الاستعلام عن كشف حسابك، مفردات قسيمة راتبك، وتقديم طلبات الإجازات والسلف.\n\n` +
        `اختر الخدمة المطلوبة من القائمة أدناه:`
      );

    case 'SUPPLIER':
      return (
        `${simulationBanner}` +
        `🚚 *بوابة الموردين ومقاولي الباطن*\n` +
        `🏢 *شركة السعادة للمقاولات العامة*\n\n` +
        `مرحباً بك يا *${name}* 👋\n\n` +
        `هنا يمكنك استعراض الفواتير المعتمدة، دفعاتك المالية، وتصدير كشوف الحساب الرسمية.\n\n` +
        `اختر الإجراء المطلوب من القائمة أدناه:`
      );

    case 'GUEST':
    default:
      return (
        `${simulationBanner}` +
        `👤 *بوابة الزوار والمستخدمين الجدد*\n` +
        `🏢 *شركة السعادة للمقاولات العامة*\n\n` +
        `مرحباً بك يا *${name}* 👋\n\n` +
        `حسابك غير مرتبط حالياً بأي سجل وظيفي أو مالي معتمد في المنظومة.\n` +
        `🔹 *معرفك الرقمي:* \`${ctx.from?.id}\`\n\n` +
        `يمكنك تزويد الإدارة بمعرفك لربط حسابك أو تقديم طلب تسجيل جديد من الخيارات أدناه:`
      );
  }
}

/**
 * Render the main role interface in-place or via a new message
 */
export async function renderRoleHome(ctx: MyContext, inPlace = false): Promise<void> {
  const text = buildWelcomeMessage(ctx);
  const keyboard = buildMainMenuKeyboard(ctx);

  if (inPlace && ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      return;
    } catch {
      // If content did not change or message cannot be edited, fall through to reply
    }
  }

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

export async function handleStart(ctx: MyContext): Promise<void> {
  const telegramId = ctx.from ? BigInt(ctx.from.id) : 0n;

  // 1. فحص رابط الدعوة الذكي (Deep Link: /start join_CODE or /start worker_CODE)
  const startPayload = (ctx.match || '').toString().trim();
  if (startPayload.startsWith('join_') || startPayload.startsWith('worker_')) {
    const workerCode = startPayload.replace(/^(join_|worker_)/, '').trim();
    const worker = await prisma.worker.findFirst({
      where: {
        OR: [
          { code: workerCode },
          { legacyCode: workerCode },
          { aliases: { has: workerCode } },
        ],
        isDeleted: false,
      },
      include: { site: true, department: true },
    });

    if (worker) {
      // إذا كان العامل مرتبطاً بالفعل بهذا الحساب
      if (worker.telegramId && worker.telegramId === telegramId) {
        await ctx.reply(
          `👋 *أهلاً بك مجدداً يا ${worker.name}!*\n` +
          `🏢 *شركة السعادة للمقاولات العامة والتعدين*\n` +
          `━━━━━━━━━━━━━━━━━━━━━\n` +
          `🆔 *كودك الوظيفي المعتمد:* \`#${worker.code}\`\n` +
          `💼 *الوظيفة:* ${worker.jobTitle} | 📍 *الموقع:* ${worker.site?.name || 'الموقع العام'}\n` +
          `━━━━━━━━━━━━━━━━━━━━━\n` +
          `✅ حسابك مفعل ومربوط بنجاح بالبوابة الرقمية للعاملين.`,
          { parse_mode: 'Markdown' }
        );
        if (telegramId > 0n) {
          await syncUserCommandsScope(ctx.api, telegramId, 'WORKER', false);
        }
        await renderRoleHome(ctx, false);
        return;
      }

      // إذا كان العامل غير مرتبط أو قيد التفعيل
      const siteLine = worker.site?.name ? `📍 *الموقع الميداني المخصص:* ${worker.site.name}\n` : '';
      const hireDateLine = `📅 *تاريخ مباشرة العمل:* *${formatDate(worker.hireDate)}*\n`;
      const shiftLine = worker.shiftSystem ? `🔄 *نظام الدوام:* ${worker.shiftSystem}\n` : '';

      const welcomeCard =
        `👋 *أهلاً وسهلاً بك زميلنا العزيز/ ${worker.name}*\n` +
        `🏢 *شركة السعادة للمقاولات العامة والتعدين — البوابة الرقمية للعاملين*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `🆔 *كودك الوظيفي المعتمد:* \`#${worker.code}\`\n` +
        `💼 *المسمى الوظيفي:* ${worker.jobTitle}\n` +
        siteLine +
        hireDateLine +
        shiftLine +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `🌟 *لقد فتحت البوت عبر رابط دعوتك الرسمي المباشر!*\n\n` +
        `✨ *المميزات المتاحة فور تفعيل حسابك:*\n` +
        `• 🔔 إشعارات لحظية بالسلف والمسحوبات والإجازات.\n` +
        `• 💵 استعراض مفردات وقسيمة راتبك الشهري فور اعتمادها.\n` +
        `• 🌴 تقديم طلبات الإجازات ومتابعة رصيدك وأيام عملك.\n` +
        `• 📝 تقديم طلبات السلف وتحديث بيانات المحفظة الإلكترونية.\n` +
        `• 🛡️ متابعة مهمات الوقاية (PPE) والتظلمات الميدانية.\n\n` +
        `اضغط على الزر أدناه لتأكيد هويتك وتفعيل خدماتك الذاتية فوراً:`;

      const kb = new InlineKeyboard()
        .text('⚡ تأكيد وربط حسابي فوراً', `action:claim_worker:${worker.code}`)
        .row()
        .text('🏠 القائمة الرئيسية', 'action:main_menu');

      await ctx.reply(welcomeCard, { parse_mode: 'Markdown', reply_markup: kb });
      return;
    }
  }

  // التدفق الاعتيادي لبدء البوت
  if (ctx.from) {
    await syncUserCommandsScope(
      ctx.api,
      telegramId,
      ctx.effectiveRole || 'GUEST',
      !!ctx.isDualWorkerMode
    );
  }

  const replyKeyboard = buildPersistentReplyKeyboard(ctx);
  const navMsg = await ctx.reply('⏳', {
    reply_markup: replyKeyboard,
  });
  if (ctx.chat) {
    await ctx.api.deleteMessage(ctx.chat.id, navMsg.message_id).catch(() => {});
  }

  await renderRoleHome(ctx, false);
}

/**
 * ⚡ معالجة زر ربط وتفعيل حساب العامل المباشر من رابط الدعوة
 */
export async function handleClaimWorker(ctx: MyContext): Promise<void> {
  if (!ctx.callbackQuery || !ctx.from) return;
  await ctx.answerCallbackQuery().catch(() => {});

  const data = ctx.callbackQuery.data || '';
  const workerCode = data.replace('action:claim_worker:', '').trim();
  const telegramId = BigInt(ctx.from.id);

  const worker = await prisma.worker.findFirst({
    where: {
      OR: [
        { code: workerCode },
        { legacyCode: workerCode },
        { aliases: { has: workerCode } },
      ],
      isDeleted: false,
    },
    include: { site: true },
  });

  if (!worker) {
    await ctx.reply('❌ تعذر العثور على سجل العامل المطلوب.', {
      reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
    });
    return;
  }

  if (worker.telegramId && worker.telegramId !== telegramId) {
    await ctx.reply(
      '⚠️ *تنبيه أمني:* هذا السجل الوظيفي مرتبط بالفعل بحساب تليجرام آخر.\nيرجى مراجعة إدارة الموارد البشرية لنقل أو تحديث الربط.',
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
      }
    );
    return;
  }

  // ربط العامل وتحديث حسابه في قاعدة البيانات
  await prisma.worker.update({
    where: { id: worker.id },
    data: { telegramId },
  });

  await prisma.user.upsert({
    where: { telegramId },
    update: {
      role: 'WORKER',
      workerId: worker.id,
      isActive: true,
    },
    create: {
      telegramId,
      username: ctx.from.username || null,
      fullName: worker.name,
      role: 'WORKER',
      workerId: worker.id,
      isActive: true,
    },
  });

  await invalidateUserCache(telegramId);
  await syncUserCommandsScope(ctx.api, telegramId, 'WORKER', false);

  const successText =
    `🎉 *تهانينا يا ${worker.name}! تم تفعيل وربط حسابك بنجاح 100%!*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `أصبحت الآن متصلاً رسمياً ببوابة الخدمة الذاتية للعاملين بشركة السعادة.\n\n` +
    `🆔 *كودك الوظيفي:* \`#${worker.code}\`\n` +
    `💼 *الوظيفة:* ${worker.jobTitle} | 📍 *الموقع:* ${worker.site?.name || 'الموقع العام'}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `يمكنك الآن متابعة كافة مستحقاتك، طلبات الإجازات، والسلف المالية مباشرة.`;

  const replyKeyboard = buildPersistentReplyKeyboard(ctx);
  const navMsg = await ctx.reply('⏳', {
    reply_markup: replyKeyboard,
  });
  if (ctx.chat) {
    await ctx.api.deleteMessage(ctx.chat.id, navMsg.message_id).catch(() => {});
  }

  ctx.effectiveRole = 'WORKER';
  if (ctx.dbUser) {
    ctx.dbUser.role = 'WORKER';
    ctx.dbUser.workerId = worker.id;
    ctx.dbUser.isActive = true;
  }

  try {
    await ctx.editMessageText(successText, {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard().text('🏠 الانتقال للخدمة الذاتية', 'action:main_menu'),
    });
  } catch {
    await ctx.reply(successText, {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard().text('🏠 الانتقال للخدمة الذاتية', 'action:main_menu'),
    });
  }
}

