import dns from 'node:dns';

// Fix for Egyptian ISP IPv6 routing blackhole: prioritize IPv4 to eliminate 1.5s - 3s DNS timeouts
dns.setDefaultResultOrder('ipv4first');

import { Agent as UndiciAgent, setGlobalDispatcher } from 'undici';
import { Bot, InlineKeyboard } from 'grammy';
import { sequentialize } from '@grammyjs/runner';
import { MyContext } from './types/context.js';
import { config } from './config/env.js';

// High-Performance TCP/TLS Connection Pool for Telegram Bot API (Reuses TLS connections for sub-second responses)
export const undiciDispatcher = new UndiciAgent({
  keepAliveTimeout: 60000,
  keepAliveMaxTimeout: 600000,
  connections: 50,
  pipelining: 1,
  connect: {
    timeout: 10000,
    keepAlive: true,
  },
});
setGlobalDispatcher(undiciDispatcher);
import { clearAllPendingUserActions, redis, safeRedisGet } from './redis.js';
import { screenFlowService } from './services/screen-flow.service.js';
import { authMiddleware } from './middlewares/auth.middleware.js';
import { telemetryMiddleware } from './middlewares/telemetry.middleware.js';
import { errorVaultService } from './services/error-vault.service.js';
import { handleStart, renderRoleHome, handleClaimWorker } from './handlers/start.handler.js';
import { handlePing } from './handlers/ping.handler.js';
import { handleMenuPlaceholder } from './handlers/placeholder.handler.js';
import {
  registerWorkforceModule,
  handleSwitchToWorker,
  handleSwitchToFieldAdmin,
  type WorkforceModuleContext,
} from '@alsaada/workforce';
import { registerSettingsModule, handleSettingsHub, type SettingsModuleContext } from '@alsaada/settings';
import { prisma } from './db.js';


export function createBot(): Bot<MyContext> {
  const token = config.botToken;
  if (!token || token === 'YOUR_NEW_BOT_TOKEN_HERE') {
    throw new Error('❌ [BOT FATAL] BOT_TOKEN is not set in .env. Please configure your bot token.');
  }

  const bot = new Bot<MyContext>(token, {
    client: {
      baseFetchConfig: {
        compress: true,
        dispatcher: undiciDispatcher,
      } as any,
    },
  });

  // 1. Centralized Error Vault & Early Warning Crash Dispatcher
  bot.catch(async (err) => {
    await errorVaultService.handleGlobalBotError(err, bot.api);
  });

  // 2. ⚡ PERFORMANCE ENGINE: Universal Stale Callback Guard & Instant Button ACK
  // Must be the ABSOLUTE FIRST middleware so stale clicks are trapped and valid buttons ACK instantly!
  bot.use(async (ctx, next) => {
    if (ctx.callbackQuery) {
      const { isStale } = await screenFlowService.isStaleCallback(ctx);
      if (isStale) {
        await screenFlowService.handleStaleCallback(ctx);
        return;
      }
      // Fire answerCallbackQuery in the background instantly without awaiting
      void ctx.answerCallbackQuery().catch(() => {});
    }
    return next();
  });

  // 3. ⚡ PERFORMANCE ENGINE: Parallel Per-User Concurrency (Zero queuing / No cross-user blocking)
  bot.use(sequentialize((ctx) => ctx.chat?.id.toString() || ctx.from?.id.toString() || 'global'));

  // 4. Authentication & Zero-Trust RBAC Middleware
  bot.use(authMiddleware);

  // 4.0. ⚡ APM Performance & User Breadcrumbs Telemetry Middleware
  bot.use(telemetryMiddleware);

  // 4.0.1. 🚧 Emergency Maintenance Mode Guard (Super Admin bypass)
  bot.use(async (ctx, next) => {
    const isMaintenance = await safeRedisGet('system:maintenance_mode');
    if (isMaintenance === '1' || isMaintenance === 'true') {
      const isSuperAdmin =
        ctx.effectiveRole === 'SUPER_ADMIN' ||
        (ctx.from && BigInt(ctx.from.id) === config.superAdminTelegramId);
      if (!isSuperAdmin) {
        const maintenanceMsg =
          '🚧 *النظام في وضع الصيانة والتحديث الفوري*\n\n' +
          'عزيزي المستخدم، تجري إدارة المنظومة أعمال صيانة وتحديث مجدولة لرفع كفاءة الخدمة واستقرار العمليات.\n' +
          'سيعود البوت للعمل تلقائياً فور انتهاء التحديث خلال دقائق.\n\n' +
          'نشكر حسن تعاونكم وتفهمكم.';
        if (ctx.callbackQuery) {
          await ctx.answerCallbackQuery({ text: '🚧 النظام في وضع الصيانة المجدولة حالياً.', show_alert: true }).catch(() => {});
        } else {
          await ctx.reply(maintenanceMsg, { parse_mode: 'Markdown' }).catch(() => {});
        }
        return;
      }
    }
    return next();
  });

  // 4.1. 🧹 Universal Main Menu Invalidation & Automatic Deletion Interceptor
  // When user clicks ANY section from the main menu, delete the main menu message immediately
  // and ensure destination screens are sent cleanly as separate standalone cards.
  bot.use(async (ctx, next) => {
    if (ctx.callbackQuery && ctx.from) {
      const active = await screenFlowService.getActiveScreen(BigInt(ctx.from.id));
      if (
        active &&
        active.flowType === 'main_menu' &&
        ctx.callbackQuery.message?.message_id === active.messageId
      ) {
        await screenFlowService.cleanupMainMenuIfActive(ctx);
      }
    }
    return next();
  });

  // 5. Register Domain Modules (Doc 21 Modular Monolith)
  registerWorkforceModule(bot as unknown as Bot<WorkforceModuleContext>, {
    prisma,
    encryptionKey: config.databaseEncryptionKey,
  });

  const settingsHandlers = registerSettingsModule(
    bot as unknown as Bot<SettingsModuleContext>,
    {
      prisma,
      redis,
      encryptionKey: config.databaseEncryptionKey,
    }
  );

  // 6. Pending Input Interceptors (Location, Text Inputs)
  bot.on('message:location', async (ctx, next) => {
    if (await settingsHandlers.handleLocationInput(ctx as any)) return;
    return next();
  });

  bot.on('message:text', async (ctx, next) => {
    // If the message is a slash command (e.g. /cancel, /start), do not intercept as raw text input
    if (ctx.message.text.startsWith('/')) {
      return next();
    }

    // If message is a persistent keyboard navigation button, clean up unfinished flow & ephemeral inputs
    const isNav = /القائمة الرئيسية|إعدادات النظام|ملفي (الشخصي|وإعداداتي)|فحص الكفاءة|التبديل لحسابي كعامل|العودة لبوابة الإشراف|بطاقة معرفي|قسيمة راتبي|كشف حسابي|لوحة المؤشرات|فواتيري ومستخلصاتي/.test(ctx.message.text);
    if (isNav) {
      await screenFlowService.cleanupIncomingUserMessage(ctx);
      await screenFlowService.cleanupUnfinishedFlow(ctx);
      return next();
    }

    if (await settingsHandlers.handleTextInput(ctx as any)) return;

    // Silent user message deletion for unrecognized text to keep chat clean
    await screenFlowService.cleanupIncomingUserMessage(ctx);
    return next();
  });

  // 7. Base Commands
  bot.command('start', handleStart);
  bot.command(['cancel', 'abort', 'clear'], async (ctx) => {
    if (!ctx.from) return;
    const telegramId = BigInt(ctx.from.id);
    await screenFlowService.cleanupIncomingUserMessage(ctx);
    await screenFlowService.cleanupUnfinishedFlow(ctx);
    const keyboard = new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu');
    const sent = await ctx.reply(
      '❌ *تم إلغاء المعاملة الحالية والتراجع بنجاح.*\nتم إفراغ كافة البيانات المؤقتة، ويمكنك بدء إجراء جديد من القائمة الرئيسية أو الأوامر الجانبية.',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
    if (ctx.chat) {
      await screenFlowService.trackActiveScreen(telegramId, ctx.chat.id, sent.message_id, 'cancel', false);
    }
  });
  bot.command(['ping', 'health', 'speed'], handlePing);

  // 8. Persistent Bottom Reply Keyboard Button Handlers
  bot.hears(/القائمة الرئيسية/, async (ctx) => {
    if (ctx.from) await clearAllPendingUserActions(BigInt(ctx.from.id));
    await renderRoleHome(ctx, false);
  });
  bot.hears(/إعدادات النظام/, async (ctx) => {
    await handleSettingsHub(ctx as any);
  });
  bot.hears(/ملفي (الشخصي|وإعداداتي)/, async (ctx) => {
    if (ctx.from) await clearAllPendingUserActions(BigInt(ctx.from.id));
    await settingsHandlers.adminProfileHandler.renderAdminProfile(ctx as any, false);
  });
  bot.hears(/فحص الكفاءة/, handlePing);
  bot.hears(/التبديل لحسابي كعامل/, async (ctx) => {
    await handleSwitchToWorker(ctx as unknown as WorkforceModuleContext);
  });
  bot.hears(/العودة لبوابة الإشراف/, async (ctx) => {
    await handleSwitchToFieldAdmin(ctx as unknown as WorkforceModuleContext);
  });
  bot.hears(/بطاقة معرفي/, async (ctx) => {
    if (ctx.from) await clearAllPendingUserActions(BigInt(ctx.from.id));
    await ctx.reply(
      `🆔 *بطاقة المعرف الرقمي الخاصة بك*\n` +
      `────────────────────────────\n` +
      `🔹 المعرف: \`${ctx.from?.id}\`\n` +
      `🔹 الاسم: *${ctx.from?.first_name || ''} ${ctx.from?.last_name || ''}*\n` +
      `🔹 الصفة: *${ctx.effectiveRole || 'GUEST'}*\n\n` +
      `يرجى تزويد إدارة المنظومة بهذا المعرف عند طلب اعتماد الصلاحيات.`,
      { parse_mode: 'Markdown' }
    );
  });
  bot.hears(/قسيمة راتبي/, async (ctx) => {
    await ctx.reply('🧾 *خدمة قسائم الرواتب (تحت التجهيز)*\nسيتم عرض مفردات الراتب والبدلات فور ربط محرك الرواتب المالي.', { parse_mode: 'Markdown' });
  });
  bot.hears(/كشف حسابي/, async (ctx) => {
    await ctx.reply('📊 *خدمة كشف الحساب والمسحوبات (تحت التجهيز)*\nسيتم استعراض السلف والمسحوبات فور اعتماد الربط المحاسبي.', { parse_mode: 'Markdown' });
  });
  bot.hears(/لوحة المؤشرات/, async (ctx) => {
    await ctx.reply('📊 *لوحة المؤشرات التنفيذية*\nمؤشرات السيولة والإنتاجية تحت التجهيز.', { parse_mode: 'Markdown' });
  });
  bot.hears(/فواتيري ومستخلصاتي/, async (ctx) => {
    await ctx.reply('🧾 *بوابة مستخلصات الموردين*\nعرض الفواتير المعتمدة تحت التجهيز.', { parse_mode: 'Markdown' });
  });

  // 9. Navigation Callbacks
  bot.callbackQuery('action:main_menu', async (ctx) => {
    await ctx.answerCallbackQuery();
    const inPlace = await screenFlowService.shouldRenderInPlace(ctx, true);
    await renderRoleHome(ctx, inPlace);
  });
  bot.callbackQuery(/^action:claim_worker:(.+)$/, handleClaimWorker);

  // 10. Sub-Menu Placeholders (Catch-all for unbuilt domain buttons)
  bot.callbackQuery(/^menu:.+$/, handleMenuPlaceholder);

  return bot;
}
