import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { formatBreadcrumbs, formatClickToCopy } from '@alsaada/core-components';
import { TelegramGroupsRepository, UserRbacRepository } from '@alsaada/settings';
import type { MyContext } from '../types/context.js';
import { prisma } from '../db.js';
import { redis } from '../redis.js';
import { config } from '../config/env.js';

export function registerGroupManagerHandlers(bot: Bot<MyContext>): void {
  // 1. Auto-capture via my_chat_member
  bot.on('my_chat_member', async (ctx) => {
    try {
      const update = ctx.myChatMember;
      const newStatus = update.new_chat_member.status;

      // Only act when bot is added or promoted
      if (newStatus !== 'administrator' && newStatus !== 'member') {
        return;
      }

      if (!ctx.from || !ctx.chat) return;

      const actorTelegramId = BigInt(ctx.from.id);
      const isSuperAdminEnv = actorTelegramId === config.superAdminTelegramId;

      const userRbacRepo = new UserRbacRepository(prisma);
      const user = await userRbacRepo.getUserByTelegramId(actorTelegramId);

      const isSuperAdmin = isSuperAdminEnv || user?.role === 'SUPER_ADMIN';
      if (!isSuperAdmin) return;

      const chatId = ctx.chat.id.toString();
      const chatTitle = 'title' in ctx.chat ? ctx.chat.title : 'مجموعة تيليجرام';

      // Send private prompt card to the Super Admin who added the bot
      const text =
        formatBreadcrumbs(['⚙️ الإعدادات', '🏛️ المجموعات', '⚡ التقاط تلقائي']) +
        `🏛️ *تمت إضافة البوت لمجموعة جديدة*\n` +
        `────────────────────────────\n` +
        `🏷️ *اسم المجموعة:* *${chatTitle}*\n` +
        `🆔 *معرف المجموعة (Chat ID):* \`${chatId}\`\n\n` +
        `هل ترغب في اعتماد وربط هذه المجموعة بالمنظومة الآن؟`;

      const keyboard = new InlineKeyboard()
        .text('🏢 تعيين كجروب الإدارة العليا', `grp:quick_hq:${chatId}`)
        .row()
        .text('🏗️ ربط بموقع ميداني', `grp:quick_site:${chatId}`)
        .row()
        .text('❌ تجاهل الآن', 'action:main_menu');

      await ctx.api.sendMessage(ctx.from.id, text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch (err) {
      console.error('❌ [GROUP AUTO-CAPTURE ERROR]', err);
    }
  });

  // 2. Quick HQ Binding callback from auto-capture
  bot.callbackQuery(/^grp:quick_hq:(.+)$/, async (ctx) => {
    if (!ctx.from) return;
    const actorTelegramId = BigInt(ctx.from.id);
    const isSuperAdmin =
      actorTelegramId === config.superAdminTelegramId ||
      ctx.effectiveRole === 'SUPER_ADMIN';

    if (!isSuperAdmin) {
      await ctx.answerCallbackQuery({ text: '🔒 مخصص للمدير العام فقط.', show_alert: true }).catch(() => {});
      return;
    }

    const chatId = ctx.match?.[1];
    if (!chatId) return;

    await redis.set('system:hq_telegram_group_id', chatId.trim());

    await ctx.answerCallbackQuery({ text: '✅ تم اعتماد جروب الإدارة العليا.' }).catch(() => {});

    const text =
      formatBreadcrumbs(['⚙️ الإعدادات', '🏛️ المجموعات', '🏢 الإدارة العليا']) +
      `🏢 *تم اعتماد جروب الإدارة العليا بنجاح!*\n` +
      `────────────────────────────\n` +
      `🆔 *المعرف الرقمي:* ${formatClickToCopy(chatId)}\n\n` +
      `يمكنك الآن تهيئة التوبيكات الأربعة التنفيذية من مركز المجموعات.`;

    const keyboard = new InlineKeyboard()
      .text('🛠️ تهيئة وتوليد التوبيكات الآن', 'grp:hq:init')
      .row()
      .text('🏛️ إدارة المجموعات', 'action:settings:telegram_groups')
      .row()
      .text('🏠 القائمة الرئيسية', 'action:main_menu');

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  });

  // 3. Quick Site Binding Selection Matrix
  bot.callbackQuery(/^grp:quick_site:(.+)$/, async (ctx) => {
    if (!ctx.from) return;
    const actorTelegramId = BigInt(ctx.from.id);
    const isSuperAdmin =
      actorTelegramId === config.superAdminTelegramId ||
      ctx.effectiveRole === 'SUPER_ADMIN';

    if (!isSuperAdmin) {
      await ctx.answerCallbackQuery({ text: '🔒 مخصص للمدير العام فقط.', show_alert: true }).catch(() => {});
      return;
    }

    const chatId = ctx.match?.[1];
    if (!chatId) return;

    const telegramGroupsRepo = new TelegramGroupsRepository(prisma, redis);
    const sites = await telegramGroupsRepo.listSites();

    const text =
      formatBreadcrumbs(['⚙️ الإعدادات', '🏛️ المجموعات', '🏗️ اختيار الموقع']) +
      `🏗️ *ربط المجموعة بموقع ميداني*\n` +
      `────────────────────────────\n` +
      `🆔 *معرف المجموعة:* \`${chatId}\`\n\n` +
      `اختر الموقع الميداني المراد ربط هذه المجموعة به:`;

    const keyboard = new InlineKeyboard();
    for (const s of sites) {
      keyboard.text(`📍 ${s.name} (${s.code})`, `grp:qsb:${chatId}:${s.id}`).row();
    }
    keyboard.text('❌ إلغاء', 'action:settings:telegram_groups');

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  });

  // 4. Quick Site Binding Confirmation
  bot.callbackQuery(/^grp:qsb:([^:]+):([^:]+)$/, async (ctx) => {
    if (!ctx.from) return;
    const actorTelegramId = BigInt(ctx.from.id);
    const isSuperAdmin =
      actorTelegramId === config.superAdminTelegramId ||
      ctx.effectiveRole === 'SUPER_ADMIN';

    if (!isSuperAdmin) {
      await ctx.answerCallbackQuery({ text: '🔒 مخصص للمدير العام فقط.', show_alert: true }).catch(() => {});
      return;
    }

    const chatId = ctx.match?.[1];
    const siteId = ctx.match?.[2];
    if (!chatId || !siteId) return;

    const telegramGroupsRepo = new TelegramGroupsRepository(prisma, redis);
    const site = await telegramGroupsRepo.getSiteById(siteId);

    if (!site) {
      await ctx.answerCallbackQuery({ text: '❌ الموقع غير موجود.', show_alert: true }).catch(() => {});
      return;
    }

    await telegramGroupsRepo.updateSiteTelegramGroupId(siteId, chatId.trim());

    await ctx.answerCallbackQuery({ text: `✅ تم ربط موقع ${site.name}.` }).catch(() => {});

    const text =
      formatBreadcrumbs(['⚙️ الإعدادات', '🏛️ المجموعات', site.name]) +
      `✅ *تم ربط مجموعة الموقع الميداني بنجاح*\n` +
      `────────────────────────────\n` +
      `🏗️ *الموقع:* *${site.name}* (\`${site.code}\`)\n` +
      `🆔 *المعرف الرقمي:* ${formatClickToCopy(chatId)}\n\n` +
      `ستصل الآن إشعارات العمليات الميدانية لهذا الموقع حصراً إلى هذه المجموعة.`;

    const keyboard = new InlineKeyboard()
      .text('🏗️ مصفوفة المواقع', 'grp:s:list')
      .row()
      .text('🏠 القائمة الرئيسية', 'action:main_menu');

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  });

  // 5. Group Command: /setup_hq_group (Strictly Super Admin, executed in group)
  bot.command('setup_hq_group', async (ctx) => {
    if (!ctx.chat || (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup')) {
      await ctx.reply('⚠️ هذا الأمر مخصص للتنفيذ داخل مجموعة تيليجرام المراد تعيينها للإدارة العليا.');
      return;
    }

    if (!ctx.from) return;
    const actorTelegramId = BigInt(ctx.from.id);
    const isSuperAdminEnv = actorTelegramId === config.superAdminTelegramId;

    const userRbacRepo = new UserRbacRepository(prisma);
    const user = await userRbacRepo.getUserByTelegramId(actorTelegramId);

    if (!isSuperAdminEnv && user?.role !== 'SUPER_ADMIN') {
      await ctx.reply('🔒 هذا الإجراء مخصص حصرياً للمدير العام (Super Admin).');
      return;
    }

    const chatId = ctx.chat.id.toString();
    await redis.set('system:hq_telegram_group_id', chatId);

    let topicsMsg = '';
    const isForum = 'is_forum' in ctx.chat && Boolean((ctx.chat as any).is_forum);

    if (isForum) {
      try {
        const t1 = await ctx.api.createForumTopic(ctx.chat.id, '📊 الإقفالات اليومية للمواقع');
        const t2 = await ctx.api.createForumTopic(ctx.chat.id, '💰 ملخصات الرواتب والسلف والعهد');
        const t3 = await ctx.api.createForumTopic(ctx.chat.id, '🚚 تقارير إنتاج وشحن الفوسفات والمحروقات');
        const t4 = await ctx.api.createForumTopic(ctx.chat.id, '📢 التوجيهات والقرارات السيادية');

        await redis.set(
          'system:hq_topics_config',
          JSON.stringify({
            siteClosuresThreadId: t1.message_thread_id,
            financialDigestsThreadId: t2.message_thread_id,
            logisticsFuelThreadId: t3.message_thread_id,
            executiveDecreesThreadId: t4.message_thread_id,
          })
        );
        topicsMsg = '\n\n✅ تم إنشاء وتكويد التوبيكات الأربعة للإدارة العليا تلقائياً.';
      } catch {
        topicsMsg = '\n\n⚠️ تم ربط الجروب، ولكن تعذر توليد التوبيكات تلقائياً (يرجى التأكد من صلاحيات البوت كمسؤول مع إمكانية إدارة التوبيكات).';
      }
    }

    const text =
      formatBreadcrumbs(['🏢 الإدارة العليا', '✅ تم الربط']) +
      `🏢 *تم اعتماد هذه المجموعة كـ [جروب الإدارة العليا والتقارير التنفيذية]*\n` +
      `────────────────────────────\n` +
      `🆔 *المعرف الرقمي:* \`${chatId}\`\n` +
      `👤 *المعتمد:* ${ctx.from.first_name || 'المدير العام'}${topicsMsg}\n\n` +
      `📌 *ملاحظة:* هذا إشعار مقروء فقط. كافة الوظائف التفاعلية تتم حصراً عبر الشات الخاص بالبوت.`;

    // Rule 9: Zero Group Action Buttons
    await ctx.reply(text, { parse_mode: 'Markdown' });
  });

  // 6. Group Command: /bind_site [site_code] (Strictly Super Admin, executed in group)
  bot.command('bind_site', async (ctx) => {
    if (!ctx.chat || (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup')) {
      await ctx.reply('⚠️ هذا الأمر مخصص للتنفيذ داخل مجموعة تيليجرام التابعة للموقع الميداني.');
      return;
    }

    if (!ctx.from) return;
    const actorTelegramId = BigInt(ctx.from.id);
    const isSuperAdminEnv = actorTelegramId === config.superAdminTelegramId;

    const userRbacRepo = new UserRbacRepository(prisma);
    const user = await userRbacRepo.getUserByTelegramId(actorTelegramId);

    if (!isSuperAdminEnv && user?.role !== 'SUPER_ADMIN') {
      await ctx.reply('🔒 هذا الإجراء مخصص حصرياً للمدير العام (Super Admin).');
      return;
    }

    const code = ctx.match?.trim().toUpperCase();
    if (!code) {
      await ctx.reply('⚠️ يرجى تحديد كود الموقع. مثال: `/bind_site QNA`', { parse_mode: 'Markdown' });
      return;
    }

    const telegramGroupsRepo = new TelegramGroupsRepository(prisma, redis);
    const site = await telegramGroupsRepo.getSiteByCode(code);

    if (!site) {
      await ctx.reply(`❌ الموقع بالكود \`${code}\` غير مسجل بالمنظومة.`, { parse_mode: 'Markdown' });
      return;
    }

    await telegramGroupsRepo.updateSiteTelegramGroupId(site.id, ctx.chat.id.toString());

    const text =
      formatBreadcrumbs(['🏗️ الموقع الميداني', site.name, '✅ تم الربط']) +
      `🏗️ *تم ربط هذه المجموعة رسمياً بموقع: ${site.name}*\n` +
      `────────────────────────────\n` +
      `🏷️ *كود الموقع:* \`${site.code}\`\n` +
      `🆔 *المعرف الرقمي:* \`${ctx.chat.id}\`\n` +
      `👤 *المعتمد:* ${ctx.from.first_name || 'المدير العام'}\n\n` +
      `ستصل الآن إشعارات عمليات الموقع الميدانية حصراً إلى هذه المجموعة.\n` +
      `📌 *ملاحظة:* هذا إشعار مقروء فقط. كافة الوظائف التفاعلية تتم حصراً عبر الشات الخاص بالبوت.`;

    // Rule 9: Zero Group Action Buttons
    await ctx.reply(text, { parse_mode: 'Markdown' });
  });
}
