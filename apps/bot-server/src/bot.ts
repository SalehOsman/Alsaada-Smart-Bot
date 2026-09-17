import dns from 'node:dns';
import https from 'node:https';

// Fix for Egyptian ISP IPv6 routing blackhole: prioritize IPv4 to eliminate 1.5s - 3s DNS timeouts
dns.setDefaultResultOrder('ipv4first');

import { Agent as UndiciAgent, setGlobalDispatcher } from 'undici';
import { Bot, InlineKeyboard } from 'grammy';
import { sequentialize } from '@grammyjs/runner';
import { MyContext } from './types/context.js';
import { config } from './config/env.js';

// Dedicated Warm Socket Pool for Outgoing Telegram API Requests
export const outgoingAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 15000,
  maxSockets: 50,
  maxFreeSockets: 15,
  timeout: 60000,
  scheduling: 'fifo',
});

// Dedicated Polling Socket Pool (Isolated from outgoing responses)
export const pollingAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 15000,
  maxSockets: 5,
  maxFreeSockets: 2,
  timeout: 60000,
  scheduling: 'fifo',
});

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
import { authMiddleware, invalidateUserCache } from './middlewares/auth.middleware.js';
import { telemetryMiddleware } from './middlewares/telemetry.middleware.js';
import { telemetryService } from './services/telemetry.service.js';
import { errorVaultService } from './services/error-vault.service.js';
import {
  handleStart,
  renderRoleHome,
  handleClaimWorker,
  handleSubmitJoinRequest,
  handleApproveWorkerLink,
  handleRejectWorkerLink,
  handleAdminUnlinkWorker,
} from './handlers/start.handler.js';
import { handlePing } from './handlers/ping.handler.js';
import { handleBoost } from './handlers/boost.handler.js';
import { handleDashboardCommand, handleSessionCallbacks } from './handlers/dashboard.handler.js';
import { DASHBOARD_REPLY_BUTTON_TEXT } from '@alsaada/rbac';
import { handleMenuPlaceholder } from './handlers/placeholder.handler.js';
import {
  handleSwitchToWorker,
  handleSwitchToFieldAdmin,
  type WorkforceModuleContext,
} from '@alsaada/workforce';
import { handleSettingsHub, type SettingsModuleContext } from '@alsaada/settings';
import { buildRegisteredModules } from './modules.registry.js';
import type { ModuleRuntimeContext } from '@alsaada/core-components';
import { prisma } from './db.js';
import { syncUserCommandsScope } from './services/command-scope.service.js';
import { getImpersonatedRole, getPersistentKeyboardMsg, clearPersistentKeyboardMsg } from './redis.js';
import { fastCache } from './services/fast-cache.service.js';
import { registerPolymorphicCommands } from './routers/command-polymorphic.router.js';
import {
  handleWorkerSubHub,
  handleMyWorkerProfile,
  handleWorkerIdCard,
  handleGuestIdentity,
} from './handlers/worker-portal.handler.js';
import { registerGroupManagerHandlers } from './handlers/group-manager.handler.js';


import {
  configureNotificationHelper,
  configureScreenTracker,
  UnifiedNotificationDispatcher,
  NotificationPolicyEngine,
  type ForumTopicConfig,
} from '@alsaada/core-components';

export function createBot(): Bot<MyContext> {
  const token = config.botToken;
  if (!token || token === 'YOUR_NEW_BOT_TOKEN_HERE') {
    throw new Error('❌ [BOT FATAL] BOT_TOKEN is not set in .env. Please configure your bot token.');
  }

  const nativeFetchAdapter = (url: any, opts: any) => {
    if (opts?.signal && !(opts.signal instanceof globalThis.AbortSignal)) {
      const c = new globalThis.AbortController();
      if (opts.signal.aborted) {
        c.abort(opts.signal.reason);
      } else if (opts.signal.addEventListener) {
        opts.signal.addEventListener('abort', () => c.abort(opts.signal.reason));
      }
      opts = { ...opts, signal: c.signal };
    }
    return globalThis.fetch(url, opts);
  };

  const bot = new Bot<MyContext>(token, {
    client: {
      fetch: nativeFetchAdapter,
      baseFetchConfig: {
        compress: true,
      } as any,
    },
  });

  // Wire Circuit-Breaker Latency Watchdog Warmer to Outgoing Connection Pool
  telemetryService.setConnectionPoolWarmer(async () => {
    await bot.api.getMe().catch(() => {});
  });

  // Configure Global Multi-Channel Notification Dispatcher & Helper
  const policyEngine = new NotificationPolicyEngine({
    async get(key: string) {
      return safeRedisGet(key);
    },
    async set(key: string, val: string) {
      if (redis && redis.status === 'ready') {
        await redis.set(key, val);
      }
    },
  });

  const notificationDispatcher = new UnifiedNotificationDispatcher({
    policyEngine,
    api: bot.api,
    async hqGroupId() {
      return safeRedisGet('system:hq_telegram_group_id');
    },
    async forumConfig() {
      const raw = await safeRedisGet('system:hq_topics_config');
      if (raw) {
        try {
          return JSON.parse(raw) as ForumTopicConfig;
        } catch {}
      }
      return undefined;
    },
  });

  configureNotificationHelper({
    dispatcher: notificationDispatcher,
    async resolveSiteGroup(siteId: string) {
      const site = await prisma.site.findUnique({
        where: { id: siteId },
        select: { telegramGroupId: true },
      });
      return site?.telegramGroupId ?? null;
    },
  });

  configureScreenTracker({
    async trackActiveScreen(telegramId, chatId, messageId, flowType, isCompleted = false) {
      await screenFlowService.trackActiveScreen(telegramId, chatId, messageId, flowType, isCompleted);
    },
    async getActiveScreen(telegramId) {
      const active = await screenFlowService.getActiveScreen(telegramId);
      if (!active) return null;
      return {
        chatId: active.chatId,
        messageId: active.messageId,
        isCompleted: Boolean(active.isCompleted),
      };
    },
    async shouldRenderInPlace(ctx: unknown, requestedInPlace = true) {
      return screenFlowService.shouldRenderInPlace(ctx as any, requestedInPlace);
    },
  });

  // 0. ⚡ Automatic Screen Tracking API Transformer
  bot.api.config.use(async (prev, method, payload, signal) => {
    const res = await prev(method, payload, signal);
    if (res && typeof res === 'object' && 'message_id' in res && 'chat' in res) {
      const msg = res as { message_id: number; chat: { id: number } };
      const pl = payload as { reply_markup?: { inline_keyboard?: unknown } };
      if (pl?.reply_markup?.inline_keyboard && msg.chat.id > 0) {
        await screenFlowService.trackActiveScreen(
          BigInt(msg.chat.id),
          msg.chat.id,
          msg.message_id,
          method === 'editMessageText' ? 'edited_screen' : 'screen',
          false
        );
      }
    }
    return res;
  });

  // 1. Centralized Error Vault & Early Warning Crash Dispatcher
  bot.catch(async (err) => {
    await errorVaultService.handleGlobalBotError(err, bot.api);
  });

  // 2. ⚡ PERFORMANCE ENGINE: Pre-Routing Instant ACK Gate & Universal Stale Callback Guard
  // Must be the ABSOLUTE FIRST middleware so buttons ACK instantly (< 10ms) and modal alerts are preserved!
  bot.use(async (ctx, next) => {
    if (ctx.callbackQuery) {
      const data = ctx.callbackQuery.data || '';
      const isModalCallback = data.includes(':modal:') || data.startsWith('modal:');

      // Wrap ctx.answerCallbackQuery: If already answered with default ACK and no custom text/alert requested,
      // return immediately in 0ms so downstream handlers don't block on a redundant 600ms network round-trip!
      const origAnswer = ctx.answerCallbackQuery.bind(ctx);
      let defaultAckSent = false;
      const isFastInPlaceNavigation =
        data.startsWith('menu:') ||
        data.startsWith('action:main_menu') ||
        data.startsWith('action:back');

      ctx.answerCallbackQuery = async (textOrOptions?: any, opts?: any) => {
        const hasCustomAlert =
          (typeof textOrOptions === 'string' && textOrOptions.length > 0) ||
          (typeof textOrOptions === 'object' && (textOrOptions.text || textOrOptions.show_alert || textOrOptions.url));
        if (!hasCustomAlert && (defaultAckSent || isFastInPlaceNavigation)) {
          return true;
        }
        return origAnswer(textOrOptions, opts);
      };

      // Pre-Routing Instant ACK Gate: ACK instantly in the background (< 10ms) unless it's a modal alert or in-place navigation
      if (!isModalCallback && !isFastInPlaceNavigation) {
        defaultAckSent = true;
        void origAnswer().catch(() => {});
      }

      const { isStale } = await screenFlowService.isStaleCallback(ctx);
      if (isStale) {
        await screenFlowService.handleStaleCallback(ctx);
        return;
      }
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

  // 5. Build and Initialize Unified Module Bus (Plan 43 Microkernel)
  const runtimeContext: ModuleRuntimeContext<MyContext> = {
    prisma,
    redis,
    api: bot.api,
    telemetry: telemetryService,
    screenFlow: screenFlowService,
  };
  const { router, modules } = buildRegisteredModules(runtimeContext, {
    onImpersonationChange: async (telegramId: bigint, targetRole?: string) => {
      // 1. تفريغ كاش الصلاحيات اللحظي في L1 fastCache و L2 Redis
      await fastCache.invalidate(`auth:imp:${telegramId}`);
      await fastCache.invalidate(`auth:ent:${telegramId}`);
      // 2. حذف رسالة الكيبورد القديمة من الشات لتجنب التكرار ثم تفريغ المعرف
      const existing = await getPersistentKeyboardMsg(telegramId);
      if (existing && bot?.api) {
        void bot.api.deleteMessage(existing.chatId, existing.messageId).catch(() => {});
      }
      await clearPersistentKeyboardMsg(telegramId);
      // 3. مزامنة قائمة أوامر تليجرام الجانبية (Slash Commands)
      if (bot?.api && targetRole) {
        void syncUserCommandsScope(bot.api, telegramId, targetRole, false).catch(() => {});
      }
    },
  });

  // 5.1 Initialize and Register Module Routes
  for (const mod of modules) {
    if (mod.init) {
      void mod.init(bot, runtimeContext).catch((err: unknown) => {
        console.error(`⚠️ [MODULE BUS] Init failed for module ${mod.name}:`, err);
      });
    }
    mod.registerRoutes(bot, runtimeContext);
  }

  // Pre-indexed target module resolver on callback queries
  bot.on('callback_query:data', async (ctx, next) => {
    const data = ctx.callbackQuery.data;
    router.resolveByCallback(data);
    return next();
  });

  const workforceMod = modules.find((m) => m.name === 'workforce') as any;
  const settingsMod = modules.find((m) => m.name === 'settings') as any;

  // 5.2 Register Polymorphic Commands (/profile, /leave, /advance, /help, /apply, /status)
  registerPolymorphicCommands(bot, {
    renderAdminProfile: async (ctx, inPlace) => {
      if (settingsMod?.handlers?.adminProfileHandler) {
        await settingsMod.handlers.adminProfileHandler.renderAdminProfile(ctx as any, inPlace);
      }
    },
    startGuestJoin: async (ctx) => {
      if (workforceMod?.handlers?.guestJoinHandler) {
        await workforceMod.handlers.guestJoinHandler.handleStartGuestJoin(ctx as any);
      }
    },
    checkGuestStatus: async (ctx) => {
      if (workforceMod?.handlers?.guestJoinHandler) {
        await workforceMod.handlers.guestJoinHandler.handleStatusCheck(ctx as any);
      }
    },
  });

  // 5.3 Register Group Management & Dynamic Binding Handlers
  registerGroupManagerHandlers(bot);

  // 6. Pending Input Interceptors (Location, Text, Photo, Document via Unified Module Bus)
  bot.on(['message:location', 'message:venue'], async (ctx, next) => {
    const loc = ctx.message?.location;
    if (loc) {
      for (const mod of modules) {
        if (mod.onLocationInput && (await mod.onLocationInput(ctx, loc))) {
          return;
        }
      }
    }
    return next();
  });

  bot.on('message:text', async (ctx, next) => {
    // Central Garbage Collection Hook: When switching context via top-level commands (/start, /sites, /menu, /cancel),
    // automatically delete user command message and clean up any dangling unfinished flow
    if (ctx.message.text.startsWith('/')) {
      await screenFlowService.cleanupIncomingUserMessage(ctx);
      await screenFlowService.cleanupUnfinishedFlow(ctx);
      return next();
    }

    // If message is a persistent keyboard navigation button, clean up unfinished flow & ephemeral inputs
    const isNav = /القائمة الرئيسية|إعدادات النظام|🖥️ فتح لوحة التحكم|ملفي (الشخصي|وإعداداتي)|فحص الكفاءة|التبديل لحسابي كعامل|العودة لبوابة الإشراف|بطاقة معرفي|قسيمة راتبي|كشف حسابي|لوحة المؤشرات|فواتيري ومستخلصاتي|إنهاء وضع المحاكاة|العودة كمدير عام|🚜 تسجيل منسوب/.test(ctx.message.text);
    if (isNav) {
      await screenFlowService.cleanupIncomingUserMessage(ctx);
      await screenFlowService.cleanupUnfinishedFlow(ctx);
      return next();
    }

    // Unified module bus text input delegation loop
    const text = ctx.message.text.trim();
    for (const mod of modules) {
      if (mod.onTextInput && (await mod.onTextInput(ctx, text))) {
        return;
      }
    }

    // Silent user message deletion for unrecognized text to keep chat clean
    await screenFlowService.cleanupIncomingUserMessage(ctx);
    return next();
  });

  bot.on('message:photo', async (ctx, next) => {
    const photos = ctx.message.photo;
    const bestPhoto = photos[photos.length - 1];
    if (bestPhoto) {
      for (const mod of modules) {
        if (mod.onPhotoInput && (await mod.onPhotoInput(ctx, bestPhoto.file_id))) {
          return;
        }
      }
    }
    return next();
  });

  bot.on('message:document', async (ctx, next) => {
    const doc = ctx.message.document;
    if (doc) {
      for (const mod of modules) {
        if (mod.onDocumentInput && (await mod.onDocumentInput(ctx, doc))) {
          return;
        }
      }
    }
    return next();
  });

  // 7. Base Commands
  bot.command('start', handleStart);
  bot.command(['menu', 'keyboard', 'k', 'home'], async (ctx) => {
    await screenFlowService.ensurePersistentKeyboard(ctx, undefined, true);
    await renderRoleHome(ctx, false);
  });
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
  bot.command(['boost', 'turbo'], handleBoost);
  bot.callbackQuery('action:boost:refresh', handleBoost);

  // 8. Persistent Bottom Reply Keyboard Button Handlers
  bot.hears(/إنهاء وضع المحاكاة|العودة كمدير عام/, async (ctx) => {
    if (settingsMod?.handlers?.ghostModeHandler) {
      await settingsMod.handlers.ghostModeHandler.handleExitImpersonate(ctx as any);
    } else {
      await screenFlowService.ensurePersistentKeyboard(ctx, undefined, true);
    }
  });
  bot.hears(/القائمة الرئيسية/, async (ctx) => {
    if (ctx.from) await clearAllPendingUserActions(BigInt(ctx.from.id));
    await screenFlowService.ensurePersistentKeyboard(ctx, undefined, false);
    await renderRoleHome(ctx, false);
  });
  bot.hears(/إعدادات النظام/, async (ctx) => {
    await handleSettingsHub(ctx as any);
  });
  bot.hears(/ملفي (الشخصي|وإعداداتي)/, async (ctx) => {
    if (ctx.from) await clearAllPendingUserActions(BigInt(ctx.from.id));
    if (settingsMod?.handlers?.adminProfileHandler) {
      await settingsMod.handlers.adminProfileHandler.renderAdminProfile(ctx as any, false);
    }
  });
  bot.hears(/فحص الكفاءة/, handlePing);
  bot.hears(/التبديل لحسابي كعامل/, async (ctx) => {
    await handleSwitchToWorker(ctx as unknown as WorkforceModuleContext);
    await screenFlowService.ensurePersistentKeyboard(ctx, undefined, true);
  });
  bot.hears(/العودة لبوابة الإشراف/, async (ctx) => {
    await handleSwitchToFieldAdmin(ctx as unknown as WorkforceModuleContext);
    await screenFlowService.ensurePersistentKeyboard(ctx, undefined, true);
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
  bot.hears(/🚜 تسجيل منسوب/, async (ctx) => {
    await ctx.reply(
      '🚜 *خدمة تسجيل منسوب السولار الميداني (تحت التجهيز)*\nسيتم إتاحة تسجيل قراءات الخزانات فور تفعيل موديول الوقود والمحروقات.',
      { parse_mode: 'Markdown' }
    );
  });
  bot.hears(DASHBOARD_REPLY_BUTTON_TEXT, handleDashboardCommand);

  // 9. Navigation Callbacks
  bot.callbackQuery(/^sess_/, handleSessionCallbacks);
  bot.callbackQuery('action:main_menu', async (ctx) => {
    await ctx.answerCallbackQuery();
    const inPlace = await screenFlowService.shouldRenderInPlace(ctx, true);
    await renderRoleHome(ctx, inPlace);
  });
  bot.callbackQuery(/^action:claim_worker:(.+)$/, handleClaimWorker);
  bot.callbackQuery(/^(?:action:submit_join_request|act:sub_join):(.+)$/, handleSubmitJoinRequest);
  bot.callbackQuery(/^action:approve_worker_link:(.+)$/, handleApproveWorkerLink);
  bot.callbackQuery(/^action:reject_worker_link:(.+)$/, handleRejectWorkerLink);
  bot.callbackQuery(/^(?:action:worker:unlink_telegram|act:wrk:unlink):(.+)$/, handleAdminUnlinkWorker);

  // Worker Portal Sub-Hubs & Identity Cards
  bot.callbackQuery(/^menu:worker_sub:(profile|finance|attendance|custody|support)$/, async (ctx) => {
    const hub = ctx.match[1] as 'profile' | 'finance' | 'attendance' | 'custody' | 'support';
    await handleWorkerSubHub(ctx, hub);
  });
  bot.callbackQuery('action:worker:my_profile', handleMyWorkerProfile);
  bot.callbackQuery('action:worker:id_card', handleWorkerIdCard);

  // Guest Actions & Identity
  bot.callbackQuery(/^(menu|action):guest:identity$/, handleGuestIdentity);
  bot.callbackQuery('menu:guest:register', async (ctx) => {
    if (workforceMod?.handlers?.guestJoinHandler) {
      await workforceMod.handlers.guestJoinHandler.handleStartGuestJoin(ctx as any);
    }
  });
  bot.callbackQuery('action:guest_join:status', async (ctx) => {
    if (workforceMod?.handlers?.guestJoinHandler) {
      await workforceMod.handlers.guestJoinHandler.handleStatusCheck(ctx as any);
    }
  });

  // 10. Sub-Menu Placeholders (Catch-all for unbuilt domain buttons)
  bot.callbackQuery(/^menu:.+$/, handleMenuPlaceholder);

  // 11. ⚡ Keep-Alive Socket Warmer: Telegram Bot API closes idle connections after 55s.
  // Periodically pulse Telegram API every 20s so user clicks NEVER suffer a cold 2s TLS handshake!
  const keepAliveWarmer = setInterval(() => {
    bot.api.getMe().catch(() => {});
  }, 20000);
  if (typeof keepAliveWarmer.unref === 'function') {
    keepAliveWarmer.unref();
  }

  return bot;
}
