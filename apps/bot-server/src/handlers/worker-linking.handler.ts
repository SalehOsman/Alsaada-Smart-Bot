import { InlineKeyboard } from 'grammy';
import type { MyContext } from '../types/context.js';
import { config } from '../config/env.js';
import { prisma } from '../db.js';
import { formatDate } from '@alsaada/regional-engine';
import { invalidateUserCache } from '../middlewares/auth.middleware.js';
import { syncUserCommandsScope } from '../services/command-scope.service.js';
import { systemDataService } from '../services/system-data.service.js';
import { GuestJoinRepository, verifyWorkerInviteToken } from '@alsaada/workforce';
import { notifyFlowOperation } from '@alsaada/core-components';
import { getRoleTitle } from './start.helpers.js';

const ADMIN_ROLES = ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'];

/**
 * 📝 معالجة زر إرسال طلب تفعيل وربط حساب العامل للمراجعة الإدارية
 */
export async function handleSubmitJoinRequest(ctx: MyContext): Promise<void> {
  if (!ctx.callbackQuery || !ctx.from) return;
  await ctx.answerCallbackQuery().catch(() => {});

  const data = ctx.callbackQuery.data || '';
  const rawData = data.replace(/^(?:action:(?:submit_join_request|claim_worker)|act:sub_join):/, '').trim();
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

  const guestJoinRepo = new GuestJoinRepository(prisma);
  const worker = await guestJoinRepo.findWorkerByCodeOrSearch(workerCode);

  if (!worker) {
    await ctx.reply('⚠️ تعذر العثور على بيانات العامل المرتبط برابط الدعوة.', {
      reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
    });
    return;
  }

  if (worker.status === 'TERMINATED') {
    await ctx.reply('⛔ لا يمكن تفعيل هذا الحساب: تم إنهاء خدمة هذا السجل الوظيفي.', {
      reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
    });
    return;
  }

  // الحماية من هبوط الأدوار الإدارية (Admin Account Takeover Protection)
  const currentRole = ctx.effectiveRole || ctx.dbUser?.role || 'GUEST';
  if (ADMIN_ROLES.includes(currentRole) || ctx.isRealSuperAdmin) {
    const adminPreviewCard =
      `🛡️ *[درع حماية الأدوار الإدارية]*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `أنت مسجل حالياً بصلاحية إدارية: *${getRoleTitle(currentRole)}*.\n` +
      `لا يمكن ربط هذا العامل بحسابك الإداري منعاً لاختلاط الصلاحيات أو خفض الرتبة.`;

    await ctx.reply(adminPreviewCard, {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
    });
    return;
  }

  if (worker.telegramId && worker.telegramId !== telegramId) {
    await ctx.reply('⚠️ *تنبيه:* هذا السجل الوظيفي مرتبط بالفعل بحساب تليجرام آخر معتمد.', {
      reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
    });
    return;
  }

  if (worker.telegramId && worker.telegramId === telegramId) {
    await ctx.reply('✅ حسابك مفعل ومربوط بالفعل بهذا السجل الوظيفي.', {
      reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
    });
    return;
  }

  // فحص ما إذا كان هناك طلب معلق بالفعل لنفس العامل ونفس المستخدم
  const existingPending = await guestJoinRepo.findPendingApplicationForWorker(worker.id, telegramId);

  if (existingPending) {
    const text =
      `⏳ *طلبك قيد المراجعة الإدارية بالفعل*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `يوجد لديك طلب معلق سابق برقم التذكرة: \`${existingPending.ticketNumber}\`.\n` +
      `يرجى انتظار موافقة واعتماد إدارة المنظومة.`;
    if (ctx.callbackQuery?.message) {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
      }).catch(async () => {
        await ctx.reply(text, {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
        });
      });
    }
    return;
  }

  // إنشاء تذكرة موافقة رقمية رسمية
  const applicantName = `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim() || 'بدون اسم';
  const applicantUsername = ctx.from.username ? `@${ctx.from.username}` : 'لا يوجد معرف';
  const notes = `طلب تفعيل وربط حساب تليجرام: مقدم الطلب ${applicantName} (${applicantUsername}) للعامل ${worker.name} (#${worker.code})`;

  const ticket = await guestJoinRepo.createJoinApplication(
    telegramId,
    worker.id,
    worker.code,
    worker.name,
    notes
  );

  // إظهار إيصال التقديم للعامل موضعياً
  const receiptCard =
    `⏳ *تم إرسال طلب تفعيل وربط حسابك بنجاح للمراجعة الإدارية*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔹 *العامل المطلوب:* *${worker.name}* (\`#${worker.code}\`)\n` +
    `💼 *المسمى الوظيفي:* ${worker.jobTitle}\n` +
    `📍 *الموقع:* ${worker.site?.name || 'الموقع العام'}\n` +
    `🎫 *رقم التذكرة:* \`${ticket.ticketNumber}\`\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `تم إشعار إدارة المنظومة والموارد البشرية لمراجعة الطلب واعتماده فوراً.\n` +
    `ستصلك رسالة تأكيد هنا فور اعتماد وتفعيل حسابك.`;

  if (ctx.callbackQuery?.message) {
    await ctx.editMessageText(receiptCard, {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
    }).catch(async () => {
      await ctx.reply(receiptCard, {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
      });
    });
  } else {
    await ctx.reply(receiptCard, {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
    });
  }

  // إرسال بطاقة الاعتماد التفاعلية لمديري المنظومة
  const adminCardText =
    `🚨 *طلب اعتماد ربط حساب تليجرام جديد*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎫 *رقم التذكرة:* \`${ticket.ticketNumber}\`\n` +
    `👷 *بيانات العامل:*\n` +
    `• الاسم: *${worker.name}*\n` +
    `• الكود: \`#${worker.code}\`\n` +
    `• الوظيفة: ${worker.jobTitle}\n` +
    `• الموقع: ${worker.site?.name || 'الموقع العام'}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `📱 *بيانات مقدم الطلب (تليجرام):*\n` +
    `• الاسم: ${applicantName}\n` +
    `• المعرف: ${applicantUsername}\n` +
    `• Telegram ID: \`${telegramId.toString()}\`\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `يرجى اتخاذ القرار الإداري المناسب:`;

  const adminKb = new InlineKeyboard()
    .text('✅ موافقة واعتماد الربط', `action:approve_worker_link:${ticket.id}`)
    .text('❌ رفض الطلب', `action:reject_worker_link:${ticket.id}`);

  // 1. إرسال خاص لمديري المنظومة (Super Admins)
  const superAdminIds = await guestJoinRepo.getSuperAdminTelegramIds();
  const targetAdminIds = new Set<bigint>(superAdminIds);
  if (config.superAdminTelegramId && config.superAdminTelegramId !== 0n) {
    targetAdminIds.add(config.superAdminTelegramId);
  }

  for (const targetId of targetAdminIds) {
    try {
      await ctx.api.sendMessage(Number(targetId), adminCardText, {
        parse_mode: 'Markdown',
        reply_markup: adminKb,
      });
    } catch {
      // Ignore DM error if admin chat not started
    }
  }

  // 2. إرسال لتوبيك العمليات والموارد البشرية
  await notifyFlowOperation({
    featureKey: 'WORKFORCE',
    siteId: worker.siteId || undefined,
    hqCategory: 'WORKFORCE',
    hqCardText: adminCardText,
  }).catch(() => {});
}

/**
 * ✅ معالجة اعتماد وموافقة ربط حساب العامل من قبل الإدارة
 */
export async function handleApproveWorkerLink(ctx: MyContext): Promise<void> {
  if (!ctx.callbackQuery || !ctx.from) return;
  await ctx.answerCallbackQuery().catch(() => {});

  const data = ctx.callbackQuery.data || '';
  const ticketId = data.replace('action:approve_worker_link:', '').trim();
  const adminTelegramId = BigInt(ctx.from.id);
  const adminRole = ctx.effectiveRole || ctx.dbUser?.role || 'GUEST';

  const allowedRoles = ['SUPER_ADMIN', 'GENERAL_ADMIN'];
  if (!allowedRoles.includes(adminRole) && !ctx.isRealSuperAdmin) {
    await ctx.reply('⛔ غير مصرح لك باعتماد طلبات الربط والتفعيل.', {
      reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
    });
    return;
  }

  const adminName = `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim() || 'الإدارة';

  const guestJoinRepo = new GuestJoinRepository(prisma);
  const approvalResult = await guestJoinRepo.approveLinkingTicket({
    ticketId,
    adminTelegramId,
    adminName,
  });

  if (!approvalResult.success || !approvalResult.ticket || !approvalResult.worker) {
    await ctx.reply(`⚠️ ${approvalResult.error || 'تعذر اعتماد طلب الربط.'}`);
    return;
  }

  const { ticket, worker } = approvalResult;

  await invalidateUserCache(ticket.requestedByTelegramId);
  await invalidateUserCache(adminTelegramId);
  await syncUserCommandsScope(ctx.api, ticket.requestedByTelegramId, 'WORKER', false);

  // تحديث بطاقة الإدارة موضعياً
  const approvedText =
    `✅ *تم اعتماد وتفعيل ربط حساب العامل بنجاح*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎫 *رقم التذكرة:* \`${ticket.ticketNumber}\`\n` +
    `👷 *العامل:* *${worker.name}* (\`#${worker.code}\`)\n` +
    `🆔 *Telegram ID:* \`${ticket.requestedByTelegramId.toString()}\`\n` +
    `👤 *المعتمد:* ${adminName}\n` +
    `📅 *تاريخ الاعتماد:* ${formatDate(new Date())}`;

  if (ctx.callbackQuery?.message) {
    await ctx.editMessageText(approvedText, {
      parse_mode: 'Markdown',
    }).catch(async () => {
      await ctx.reply(approvedText, { parse_mode: 'Markdown' });
    });
  } else {
    await ctx.reply(approvedText, { parse_mode: 'Markdown' });
  }

  // إرسال إشعار فوري في الشات الخاص للعامل مع رابط فتح البوابة الذاتية
  const companyName = await systemDataService.getCompanyTradeName();
  const workerNotifyText =
    `🎉 *تهانينا يا ${worker.name}! تم اعتماد وتفعيل حسابك رسمياً من قبل الإدارة.*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🏢 *${companyName} — بوابة الخدمات الذاتية*\n` +
    `🆔 *كودك الوظيفي المعتمد:* \`#${worker.code}\`\n` +
    `💼 *الوظيفة:* ${worker.jobTitle} | 📍 *الموقع:* ${worker.site?.name || 'الموقع العام'}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `✅ أصبحت الآن متصلاً رسمياً بالبوابة الذاتية، ويمكنك متابعة مستحقاتك وسلفك وإجازاتك مباشرة.`;

  try {
    await ctx.api.sendMessage(Number(ticket.requestedByTelegramId), workerNotifyText, {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard().text('🚀 فتح البوابة الذاتية', 'action:main_menu'),
    });
  } catch {
    // Ignore push delivery failure if user blocked bot
  }
}

/**
 * ❌ معالجة رفض طلب ربط حساب العامل من قبل الإدارة
 */
export async function handleRejectWorkerLink(ctx: MyContext): Promise<void> {
  if (!ctx.callbackQuery || !ctx.from) return;
  await ctx.answerCallbackQuery().catch(() => {});

  const data = ctx.callbackQuery.data || '';
  const ticketId = data.replace('action:reject_worker_link:', '').trim();
  const adminTelegramId = BigInt(ctx.from.id);
  const adminRole = ctx.effectiveRole || ctx.dbUser?.role || 'GUEST';

  const allowedRoles = ['SUPER_ADMIN', 'GENERAL_ADMIN'];
  if (!allowedRoles.includes(adminRole) && !ctx.isRealSuperAdmin) {
    await ctx.reply('⛔ غير مصرح لك برفض طلبات الربط والتفعيل.', {
      reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
    });
    return;
  }

  const adminName = `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim() || 'الإدارة';

  const guestJoinRepo = new GuestJoinRepository(prisma);
  const rejectResult = await guestJoinRepo.rejectLinkingTicket({
    ticketId,
    adminTelegramId,
    adminName,
  });

  if (!rejectResult.success || !rejectResult.ticket) {
    await ctx.reply(`⚠️ ${rejectResult.error || 'تعذر رفض طلب الاعتماد.'}`);
    return;
  }

  const { ticket } = rejectResult;

  const rejectedText =
    `❌ *تم رفض طلب ربط الحساب*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎫 *رقم التذكرة:* \`${ticket.ticketNumber}\`\n` +
    `👤 *المدقق الإداري:* ${adminName}\n` +
    `📅 *تاريخ الرفض:* ${formatDate(new Date())}`;

  if (ctx.callbackQuery?.message) {
    await ctx.editMessageText(rejectedText, {
      parse_mode: 'Markdown',
    }).catch(async () => {
      await ctx.reply(rejectedText, { parse_mode: 'Markdown' });
    });
  } else {
    await ctx.reply(rejectedText, { parse_mode: 'Markdown' });
  }

  // إشعار مقدم الطلب بأدب
  const workerNotifyText =
    `ℹ️ *إشعار بخصوص طلب تفعيل الحساب*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `نعتذر منك، تم رفض طلب ربط حسابك بالتذكرة رقم \`${ticket.ticketNumber}\` من قبل إدارة المنظومة.\n` +
    `يرجى مراجعة إدارة الموارد البشرية أو مشرف الموقع للتأكد من بياناتك.`;

  try {
    await ctx.api.sendMessage(Number(ticket.requestedByTelegramId), workerNotifyText, {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
    });
  } catch {
    // Ignore push failure
  }
}

/**
 * 🔓 معالجة الإلغاء الإداري لربط التيليجرام للعامل
 */
export async function handleAdminUnlinkWorker(ctx: MyContext): Promise<void> {
  if (!ctx.callbackQuery || !ctx.from) return;
  await ctx.answerCallbackQuery().catch(() => {});

  const data = ctx.callbackQuery.data || '';
  const workerId = data.replace(/^(?:action:worker:unlink_telegram|act:wrk:unlink):/, '').trim();
  const adminTelegramId = BigInt(ctx.from.id);
  const adminRole = ctx.effectiveRole || ctx.dbUser?.role || 'GUEST';

  const allowedRoles = ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'];
  if (!allowedRoles.includes(adminRole) && !ctx.isRealSuperAdmin) {
    if (ctx.editMessageText) {
      await ctx.editMessageText('⛔ غير مصرح لك بإلغاء ربط حسابات العاملين.', {
        reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
      });
    } else if (ctx.reply) {
      await ctx.reply('⛔ غير مصرح لك بإلغاء ربط حسابات العاملين.', {
        reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
      });
    }
    return;
  }

  const guestJoinRepo = new GuestJoinRepository(prisma);
  const result = await guestJoinRepo.unlinkWorkerAccount(workerId, adminTelegramId);

  if (!result.success) {
    if (ctx.editMessageText) {
      await ctx.editMessageText(`ℹ️ ${result.message}`, {
        reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
      });
    } else if (ctx.reply) {
      await ctx.reply(`ℹ️ ${result.message}`, {
        reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
      });
    }
    return;
  }

  if (result.unlinkedTelegramId) {
    await invalidateUserCache(result.unlinkedTelegramId);
    await syncUserCommandsScope(ctx.api, result.unlinkedTelegramId, 'GUEST', false);

    try {
      await ctx.api.sendMessage(
        Number(result.unlinkedTelegramId),
        '⚠️ *تنبيه أمني:* تم إلغاء ربط حساب التليجرام الخاص بك بالسجل الوظيفي من قبل الإدارة.\n' +
        'إذا لم تكن على علم بهذا الإجراء، يرجى مراجعة إدارة الموارد البشرية.',
        {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu'),
        }
      );
    } catch {
      // Ignore message failure
    }
  }

  const confirmText =
    `✅ *تم إلغاء ربط حساب التليجرام بنجاح*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `👷 *العامل:* *${result.workerName}* (\`#${result.workerCode}\`)\n` +
    (result.unlinkedTelegramId ? `🆔 *معرف التليجرام الملغى:* \`${result.unlinkedTelegramId.toString()}\`\n` : '') +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `أصبح السجل الوظيفي متاحاً للربط بحساب جديد عبر رابط الدعوة أو طلب الانضمام.`;

  if (ctx.callbackQuery?.message) {
    await ctx.editMessageText(confirmText, {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .text('◀️ العودة لبطاقة العامل', `action:worker:view:${workerId}`)
        .row()
        .text('🏠 القائمة الرئيسية', 'action:main_menu'),
    }).catch(async () => {
      await ctx.reply(confirmText, {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('◀️ العودة لبطاقة العامل', `action:worker:view:${workerId}`)
          .row()
          .text('🏠 القائمة الرئيسية', 'action:main_menu'),
      });
    });
  } else {
    await ctx.reply(confirmText, {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .text('◀️ العودة لبطاقة العامل', `action:worker:view:${workerId}`)
        .row()
        .text('🏠 القائمة الرئيسية', 'action:main_menu'),
    });
  }
}
