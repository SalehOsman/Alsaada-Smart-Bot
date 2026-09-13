import { InlineKeyboard } from 'grammy';
import { MyContext } from '../types/context.js';
import { config } from '../config/env.js';
import { prisma } from '../db.js';
import { formatDate } from '@alsaada/regional-engine';
import { invalidateUserCache } from '../middlewares/auth.middleware.js';
import { buildMainMenuKeyboard } from '../keyboards/main-menu.keyboard.js';
import { buildPersistentReplyKeyboard } from '../keyboards/reply-bar.keyboard.js';
import { screenFlowService } from '../services/screen-flow.service.js';
import { verifyWorkerInviteToken, validateLinkingTokenConsumption, GuestJoinRepository, GuestJoinService } from '@alsaada/workforce';
import { syncUserCommandsScope } from '../services/command-scope.service.js';

import { getRoleTitle, buildWelcomeMessage } from './start.helpers.js';
export { getRoleTitle, buildWelcomeMessage };

/**
 * Render the main role interface in-place or via a new message
 */
export async function renderRoleHome(ctx: MyContext, inPlace = false): Promise<void> {
  const telegramId = ctx.from ? BigInt(ctx.from.id) : 0n;
  const text = buildWelcomeMessage(ctx);
  const keyboard = buildMainMenuKeyboard(ctx);

  if (inPlace && ctx.callbackQuery?.message && ctx.chat) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      if (telegramId > 0n) {
        await screenFlowService.trackActiveScreen(
          telegramId,
          ctx.chat.id,
          ctx.callbackQuery.message.message_id,
          'main_menu',
          false
        );
      }
      return;
    } catch {
      // If content did not change or message cannot be edited, fall through to reply
    }
  }

  // 1. تنظيف أي تدفق سابق غير مكتمل قبل عرض القائمة كرسالة جديدة
  await screenFlowService.cleanupUnfinishedFlow(ctx, 'main_menu');

  // 2. إرسال بطاقة القائمة الرئيسية وحفظ معرفها النشط
  const sent = await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });

  if (telegramId > 0n && ctx.chat) {
    await screenFlowService.trackActiveScreen(
      telegramId,
      ctx.chat.id,
      sent.message_id,
      'main_menu',
      false
    );
  }
}

export async function handleStart(ctx: MyContext): Promise<void> {
  // الحذف الصامت لأمر /start وتنظيف أي تدفق سابق
  await screenFlowService.cleanupIncomingUserMessage(ctx);
  await screenFlowService.cleanupUnfinishedFlow(ctx, 'start');

  const telegramId = ctx.from ? BigInt(ctx.from.id) : 0n;

  // 1. فحص رابط الربط والمصادقة المشفر أو رابط الوصول للوحة التحكم
  const startPayload = (ctx.match || '').toString().trim();
  if (startPayload === 'dashboard_access') {
    const { handleDashboardCommand } = await import('./dashboard.handler.js');
    await handleDashboardCommand(ctx);
    return;
  }

  if (startPayload.startsWith('link_')) {
    const parts = startPayload.replace(/^link_/, '').split('_');
    const workerCode = parts[0]?.trim() || '';
    const applicantTelegramIdStr = parts[1]?.trim() || '';
    const expiresAt = parseInt(parts[2]?.trim() || '0', 10);
    const signature = parts[3]?.trim() || '';
    const applicantTelegramId = BigInt(applicantTelegramIdStr || '0');

    const secretKey = config.databaseEncryptionKey;
    if (!secretKey) {
      throw new Error('DATABASE_ENCRYPTION_KEY is required in configuration.');
    }
    const guestJoinRepo = new GuestJoinRepository(prisma);
    const guestJoinService = new GuestJoinService(guestJoinRepo, secretKey);

    try {
      const result = await guestJoinService.consumeLinkingToken(
        workerCode,
        applicantTelegramId,
        expiresAt,
        signature,
        telegramId,
        ctx.from?.username
      );

      await invalidateUserCache(telegramId);
      await syncUserCommandsScope(ctx.api, telegramId, 'WORKER', false);

      ctx.effectiveRole = 'WORKER';
      if (ctx.dbUser) {
        ctx.dbUser.role = 'WORKER';
        ctx.dbUser.workerId = result.workerId;
        ctx.dbUser.isActive = true;
      }

      const successCard =
        `🎉 *تهانينا يا ${result.workerName}! تم تفعيل وربط حسابك بنجاح!*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `تم التحقق من الختم الرقمي ومطابقة حساب التليجرام الخاص بك بنسبة 100%.\n\n` +
        `🆔 *كودك الوظيفي:* \`#${result.workerCode}\`\n` +
        `💼 *الوظيفة:* ${result.jobTitle} | 📍 *الموقع:* ${result.siteName || 'الموقع العام'}\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `أصبحت الآن متصلاً رسمياً بالبوابة الذاتية للعاملين.`;

      await screenFlowService.ensurePersistentKeyboard(ctx);

      await ctx.reply(successCard, {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard().text('🚀 فتح البوابة الذاتية', 'action:main_menu'),
      });
      return;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'رابط التفعيل غير صالح.';
      await ctx.reply(
        `⚠️ *تنبيه أمني صارم:*\n${errMsg}\nيرجى مراجعة إدارة الموارد البشرية.`,
        {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
        }
      );
      return;
    }
  }

  // 1.1 فحص رابط الدعوة الذكي المشفر (Deep Link: /start inv_CODE_TOKEN)
  if (startPayload.startsWith('inv_') || startPayload.startsWith('join_') || startPayload.startsWith('worker_')) {
    let workerCode = '';
    let inviteToken = '';

    if (startPayload.startsWith('inv_')) {
      const parts = startPayload.replace(/^inv_/, '').split('_');
      workerCode = parts[0]?.trim() || '';
      inviteToken = parts[1]?.trim() || '';
    } else {
      workerCode = startPayload.replace(/^(join_|worker_)/, '').trim();
    }

    const secretKey = config.databaseEncryptionKey;
    if (!secretKey) {
      throw new Error('DATABASE_ENCRYPTION_KEY is required in configuration.');
    }
    const isTokenValid = inviteToken ? verifyWorkerInviteToken(workerCode, inviteToken, secretKey) : false;

    // رفض الروابط غير الموقعة أو المخمنة لمنع اختطاف الحسابات
    if (!isTokenValid) {
      await ctx.reply(
        '⚠️ *تنبيه أمني:* رابط الدعوة غير صالح أو غير موثق بتوقيع رقمي معتمد.\nيرجى التواصل مع إدارة الموارد البشرية للحصول على رابط دعوة معتمد ومحدث.',
        {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
        }
      );
      return;
    }

    const guestJoinRepo = new GuestJoinRepository(prisma);
    const worker = await guestJoinRepo.findWorkerByCodeOrSearch(workerCode);

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
      const shiftLine = worker.shiftSystem ? `🔄 *نظام الدوام:* ${worker.shiftSystem.replace(/_/g, ' ')}\n` : '';

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
        .text('⚡ تأكيد وربط حسابي فوراً', `action:claim_worker:${worker.code}:${inviteToken}`)
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

  // 4. ضمان فرض تثبيت كيبورد الرد السريع الدائم في أسفل الشات وإظهاره فوراً
  await screenFlowService.ensurePersistentKeyboard(ctx, undefined, true);

  await renderRoleHome(ctx, false);
}

/**
 * ⚡ معالجة زر ربط وتفعيل حساب العامل المباشر من رابط الدعوة
 */
export async function handleClaimWorker(ctx: MyContext): Promise<void> {
  if (!ctx.callbackQuery || !ctx.from) return;
  await ctx.answerCallbackQuery().catch(() => {});

  const data = ctx.callbackQuery.data || '';
  const rawData = data.replace('action:claim_worker:', '').trim();
  const [workerCode, token] = rawData.split(':');
  const telegramId = BigInt(ctx.from.id);

  if (!workerCode || !token) {
    await ctx.reply('⚠️ *تنبيه أمني:* رمز توثيق الدعوة مفقود أو غير صالح.', {
      reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
    });
    return;
  }

  const secretKey = config.databaseEncryptionKey;
  if (!secretKey) {
    throw new Error('DATABASE_ENCRYPTION_KEY is required in configuration.');
  }
  if (!verifyWorkerInviteToken(workerCode, token, secretKey)) {
    await ctx.reply('⚠️ *تنبيه أمني:* رمز توثيق الدعوة غير مطابق أو تم التلاعب به.', {
      reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
    });
    return;
  }

  try {
    const guestJoinRepo = new GuestJoinRepository(prisma);
    const linkResult = await guestJoinRepo.linkWorkerAccount(
      workerCode,
      telegramId,
      ctx.from.username || undefined,
      token
    );

    await invalidateUserCache(telegramId);
    await syncUserCommandsScope(ctx.api, telegramId, 'WORKER', false);

    const successText =
      `🎉 *تهانينا يا ${linkResult.workerName}! تم تفعيل وربط حسابك بنجاح 100%!*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `أصبحت الآن متصلاً رسمياً ببوابة الخدمة الذاتية للعاملين بشركة السعادة.\n\n` +
      `🆔 *كودك الوظيفي:* \`#${linkResult.workerCode}\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `يمكنك الآن متابعة كافة مستحقاتك، طلبات الإجازات، والسلف المالية مباشرة.`;

    ctx.effectiveRole = 'WORKER';
    await ctx.reply(successText, {
      parse_mode: 'Markdown',
      reply_markup: buildMainMenuKeyboard(ctx),
    });
    return;
  } catch (err: any) {
    await ctx.reply(`⚠️ *تنبيه أمني:* ${err.message || 'تعذر إتمام عملية ربط وتفعيل الحساب.'}`, {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
    });
    return;
  }
}

