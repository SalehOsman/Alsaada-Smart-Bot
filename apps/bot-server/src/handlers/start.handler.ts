import { InlineKeyboard } from 'grammy';
import { MyContext } from '../types/context.js';
import { config } from '../config/env.js';
import { prisma } from '../db.js';
import { formatDate } from '@alsaada/regional-engine';
import { invalidateUserCache } from '../middlewares/auth.middleware.js';
import { buildMainMenuKeyboard, buildDynamicMainMenuKeyboard } from '../keyboards/main-menu.keyboard.js';
import { buildPersistentReplyKeyboard } from '../keyboards/reply-bar.keyboard.js';
import { screenFlowService } from '../services/screen-flow.service.js';
import { verifyWorkerInviteToken, validateLinkingTokenConsumption, GuestJoinRepository, GuestJoinService } from '@alsaada/workforce';
import { syncUserCommandsScope } from '../services/command-scope.service.js';
import { systemDataService } from '../services/system-data.service.js';

import { getRoleTitle, buildWelcomeMessage } from './start.helpers.js';
export { getRoleTitle, buildWelcomeMessage };

/**
 * Render the main role interface in-place or via a new message
 */
export async function renderRoleHome(ctx: MyContext, inPlace = false): Promise<void> {
  const telegramId = ctx.from ? BigInt(ctx.from.id) : 0n;
  const companyName = await systemDataService.getCompanyTradeName();
  const text = buildWelcomeMessage(ctx, companyName);
  const keyboard = await buildDynamicMainMenuKeyboard(ctx);


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
  // الحذف الصامت لأمر /start في الخلفية دون تكرار الحذف المزدوج
  await screenFlowService.cleanupIncomingUserMessage(ctx);

  const telegramId = ctx.from ? BigInt(ctx.from.id) : 0n;

  // 1. فحص رابط الربط والمصادقة المشفر أو رابط الوصول للوحة التحكم
  const startPayload = (ctx.match || '').toString().trim();
  if (startPayload === 'dashboard_access') {
    await screenFlowService.ensurePersistentKeyboard(ctx, undefined, true);
    await ctx.reply(
      '🖥️ *لوحة التحكم المؤسسية*\n\n' +
      'لإصدار رابط دخول مشفر وجديد إلى لوحة التحكم، يرجى الضغط على زر:\n' +
      '*«🖥️ فتح لوحة التحكم»* من لوحة الأزرار بالأسفل ⬇️',
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
      }
    );
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

      await screenFlowService.ensurePersistentKeyboard(ctx, undefined, true);

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
    const companyName = await systemDataService.getCompanyTradeName();

    if (worker) {
      // إذا كان العامل مرتبطاً بالفعل بهذا الحساب
      if (worker.telegramId && worker.telegramId === telegramId) {
        await ctx.reply(
          `👋 *أهلاً بك مجدداً يا ${worker.name}!*\n` +
          `🏢 *${companyName}*\n` +
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
        await screenFlowService.ensurePersistentKeyboard(ctx, undefined, true);
        await renderRoleHome(ctx, false);
        return;
      }

      // إذا كان العامل مرتبطاً بحساب تليجرام آخر
      if (worker.telegramId && worker.telegramId !== telegramId) {
        await ctx.reply(
          `⚠️ *تنبيه أمني:* هذا السجل الوظيفي (\`#${worker.code}\`) مرتبط بالفعل بحساب تليجرام آخر معتمد بالمنظومة.\n` +
          `إذا كنت قد غيرت حسابك، يرجى مراجعة إدارة الموارد البشرية لإعادة ضبط الحساب.`,
          {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
          }
        );
        return;
      }

      // 🛡️ Admin Shield: فحص إذا كان المستخدم يملك صلاحية إدارية
      const adminRoles = ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'];
      const userRole = ctx.effectiveRole || ctx.dbUser?.role || 'GUEST';
      const isAdmin = adminRoles.includes(userRole) || ctx.isRealSuperAdmin;

      if (isAdmin) {
        const adminPreviewCard =
          `🛡️ *[وضع معاينة الإدارة]*\n` +
          `━━━━━━━━━━━━━━━━━━━━━\n` +
          `هذا رابط دعوة خاص بالعامل: *${worker.name}* (\`#${worker.code}\`).\n` +
          `💼 *المسمى الوظيفي:* ${worker.jobTitle} | 📍 *الموقع:* ${worker.site?.name || 'الموقع العام'}\n` +
          `━━━━━━━━━━━━━━━━━━━━━\n` +
          `⚠️ أنت مسجل حالياً بصلاحية إدارية (*${getRoleTitle(userRole)}*).\n` +
          `لا يمكن ربط هذا العامل بحسابك الإداري منعاً لاختلاط الصلاحيات أو خفض الرتبة.`;

        await ctx.reply(adminPreviewCard, {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
        });
        return;
      }

      // فحص ما إذا كان هناك طلب معلق بالفعل لنفس المستخدم
      const pendingTicket = await guestJoinRepo.findPendingApplication(telegramId);

      if (pendingTicket) {
        await ctx.reply(
          `⏳ *طلبك قيد المراجعة الإدارية*\n` +
          `━━━━━━━━━━━━━━━━━━━━━\n` +
          `يوجد لديك بالفعل طلب معلق لربط وتفعيل حسابك برقم التذكرة: \`${pendingTicket.ticketNumber}\`.\n` +
          `يرجى انتظار موافقة واعتماد إدارة المنظومة وسيصلك إشعار لحظي فور التفعيل.`,
          {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
          }
        );
        return;
      }

      // Pre-filled Join Application for Guests/Workers
      const siteLine = worker.site?.name ? `📍 *الموقع الميداني المخصص:* ${worker.site.name}\n` : '';
      const hireDateLine = `📅 *تاريخ مباشرة العمل:* *${formatDate(worker.hireDate)}*\n`;
      const shiftLine = worker.shiftSystem ? `🔄 *نظام الدوام:* ${worker.shiftSystem.replace(/_/g, ' ')}\n` : '';

      const welcomeCard =
        `👋 *أهلاً وسهلاً بك زميلنا العزيز/ ${worker.name}*\n` +
        `🏢 *${companyName} — البوابة الرقمية للعاملين*\n` +
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
        `اضغط على الزر أدناه لإرسال طلب تفعيل وربط حسابك للإدارة للمراجعة والاعتماد:`;

      const kb = new InlineKeyboard()
        .text('📝 إرسال طلب ربط وتفعيل حسابي', `act:sub_join:${worker.code}:${inviteToken}`)
        .row()
        .text('🏠 القائمة الرئيسية', 'action:main_menu');

      await ctx.reply(welcomeCard, { parse_mode: 'Markdown', reply_markup: kb });
      return;
    }
  }

  // التدفق الاعتيادي لبدء البوت — مزامنة الأوامر في الخلفية دون حظر استجابة المستخدم
  if (ctx.from) {
    void syncUserCommandsScope(
      ctx.api,
      telegramId,
      ctx.effectiveRole || 'GUEST',
      !!ctx.isDualWorkerMode
    ).catch(() => {});
  }

  // 4. ضمان تثبيت كيبورد الرد السريع الدائم وفرض التحديث الفوري عند /start
  await screenFlowService.ensurePersistentKeyboard(ctx, undefined, true);

  await renderRoleHome(ctx, false);
}

// تصدير معالجات ربط العمال والاعتماد وإلغاء الربط
export {
  handleSubmitJoinRequest,
  handleApproveWorkerLink,
  handleRejectWorkerLink,
  handleAdminUnlinkWorker,
  handleSubmitJoinRequest as handleClaimWorker,
} from './worker-linking.handler.js';

