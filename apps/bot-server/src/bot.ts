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
import { dynamicMenuService } from './services/dynamic-menu.service.js';
import { authMiddleware, invalidateUserCache } from './middlewares/auth.middleware.js';

import { telemetryMiddleware } from './middlewares/telemetry.middleware.js';
import { telemetryService } from './services/telemetry.service.js';
import { errorVaultService } from './services/error-vault.service.js';
import { telegramGroupEnforcer } from './services/telegram-group-enforcer.service.js';
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
import { handleSettingsHub } from '@alsaada/settings';
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

export async function createBot(): Promise<Bot<MyContext>> {
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
      apiRoot: config.telegramApiRoot,
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

  // Initialize Dynamic Bot Catalog Pub/Sub Synchronization Listener
  dynamicMenuService.initializeSyncListener();


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

  // 2.5 🛡️ In-Memory Rate Limiting / Debounce Middleware
  const userRateLimits = new Map<string, number[]>();
  const userLastCallback = new Map<string, number>();

  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of userLastCallback.entries()) {
      if (now - timestamp > 60000) userLastCallback.delete(key);
    }
    for (const [key, limits] of userRateLimits.entries()) {
      const lastLimit = limits[limits.length - 1];
      if (limits.length === 0 || (lastLimit !== undefined && now - lastLimit > 60000)) {
        userRateLimits.delete(key);
      }
    }
  }, 60000).unref();

  bot.use(async (ctx, next) => {
    const key = ctx.chat?.id.toString() || ctx.from?.id.toString();
    if (!key) return next();

    const now = Date.now();

    if (ctx.callbackQuery) {
      const last = userLastCallback.get(key) || 0;
      if (now - last < 400) {
        await ctx.answerCallbackQuery({ text: '⏳ يرجى التمهل...', show_alert: false }).catch(() => {});
        return;
      }
      userLastCallback.set(key, now);
    }

    const limits = userRateLimits.get(key) || [];
    const windowStart = now - 1000;
    const currentLimits = limits.filter((t) => t > windowStart);
    currentLimits.push(now);
    userRateLimits.set(key, currentLimits);

    if (currentLimits.length > 5) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: '⏳ يرجى التمهل...', show_alert: false }).catch(() => {});
      }
      return; // Drop flooded requests
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

  // 4.0.2. 🛡️ Dynamic Feature Gate & Maintenance Modal Alert Guard (Plan-71 / NEW-85)
  bot.use(async (ctx, next) => {
    if (ctx.callbackQuery?.data) {
      const data = ctx.callbackQuery.data;
      const check = await dynamicMenuService.verifyCallbackAccess(data, ctx.effectiveRole);
      if (check.found && !check.allowed) {
        const alertText = check.maintenanceMessage || 'عذراً، هذه الوظيفة موقوفة مؤقتاً تحت الصيانة المجدولة.';
        await ctx.answerCallbackQuery({
          text: alertText,
          show_alert: true,
        }).catch(() => {});
        return; // Halt: intercepted so inactive/maintenance features do not run!
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
  const { router, modules, loader } = await buildRegisteredModules(runtimeContext, {
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
    const isNav = loader.getNavigationRegex().test(ctx.message.text);
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
    if (!ctx.workerId) {
      await ctx.reply(
        '⚠️ *عذراً، حسابك غير مرتبط بملف عامل ميداني.*\n\nيرجى التواصل مع مشرف الموقع للحصول على كود الدعوة الخاص بك لربط حسابك الوظيفي.',
        { parse_mode: 'Markdown' }
      );
      return;
    }
    const worker = await prisma.worker.findUnique({
      where: { id: ctx.workerId },
      select: { 
        basicSalary: true, 
        additionalSalary: true, 
        name: true, 
        jobTitle: true,
        customAllowances: { where: { isActive: true } },
        dutyRosters: { where: { status: 'PRESENT' } },
        leaves: { where: { status: 'APPROVED' } }
      }
    });
    if (!worker) return;

    const allowances = worker.customAllowances.reduce((acc, curr) => acc + Number(curr.amount), 0);
    const presentDays = worker.dutyRosters.length;
    const leaveDays = worker.leaves.length;

    await ctx.reply(
      `🧾 *قسيمة راتبي*\n\nالاسم: ${worker.name}\nالوظيفة: ${worker.jobTitle}\n\nالراتب الأساسي: ${worker.basicSalary} ج.م\nالراتب الإضافي: ${worker.additionalSalary} ج.م\nالبدلات: ${allowances} ج.م\n\nأيام الحضور: ${presentDays}\nأيام الإجازات المعتمدة: ${leaveDays}\n\n_سيتم دمج تفاصيل الحضور والانصراف والمكافآت فور إغلاق دورة الرواتب الشهرية._`,
      { parse_mode: 'Markdown' }
    );
  });
  bot.hears(/كشف حسابي/, async (ctx) => {
    if (!ctx.workerId) {
      await ctx.reply('⚠️ *عذراً، حسابك غير مرتبط بملف عامل.*', { parse_mode: 'Markdown' });
      return;
    }

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const ledgers = await prisma.financialLedger.findMany({
      where: {
        workerId: ctx.workerId,
        transactionType: { in: ['ADVANCE_CASH', 'WITHDRAWAL_CIGARETTES', 'WITHDRAWAL_PURCHASES'] },
        accountingMonth: currentMonth,
        isDeleted: false
      }
    });

    const cashAdvances = ledgers.filter(l => l.transactionType === 'ADVANCE_CASH').reduce((acc, l) => acc + Number(l.amount), 0);
    const canteenWithdrawals = ledgers.filter(l => l.transactionType === 'WITHDRAWAL_CIGARETTES' || l.transactionType === 'WITHDRAWAL_PURCHASES').reduce((acc, l) => acc + Number(l.amount), 0);

    if (cashAdvances === 0 && canteenWithdrawals === 0) {
      await ctx.reply('📊 *كشف حسابي*\n\nلا توجد سلف أو مسحوبات (كانتين/نقدي) مسجلة لك خلال الشهر الحالي.\n\n_يتم تحديث الرصيد لحظياً بعد كل عملية سحب._', { parse_mode: 'Markdown' });
      return;
    }

    await ctx.reply(
      `📊 *كشف حسابي لشهر ${currentMonth}*\n\nسلف نقدية: ${cashAdvances} ج.م\nمسحوبات (كانتين/عينية): ${canteenWithdrawals} ج.م\n\n_يتم تحديث الرصيد لحظياً بعد كل عملية سحب._`,
      { parse_mode: 'Markdown' }
    );
  });
  bot.hears(/لوحة المؤشرات/, handleDashboardCommand);
  bot.hears(/فواتيري ومستخلصاتي/, async (ctx) => {
    if (ctx.effectiveRole !== 'SUPPLIER') {
      await ctx.reply('⚠️ *عذراً، هذه البوابة مخصصة للموردين المعتمدين فقط.*', { parse_mode: 'Markdown' });
      return;
    }
    
    if (!ctx.from?.id) return;
    
    const supplier = await prisma.supplier.findUnique({
      where: { telegramId: BigInt(ctx.from.id) },
      include: { invoices: { take: 5, orderBy: { invoiceDate: 'desc' } } }
    });
    
    if (!supplier) {
        await ctx.reply('⚠️ *عذراً، حسابك غير مرتبط بملف مورد.*', { parse_mode: 'Markdown' });
        return;
    }

    if (supplier.invoices.length === 0) {
      await ctx.reply('🧾 *بوابة مستخلصات الموردين*\n\nلا توجد فواتير مسجلة للمراجعة.', { parse_mode: 'Markdown' });
      return;
    }
    
    let text = `🧾 *بوابة مستخلصات الموردين*\n\n`;
    for (const inv of supplier.invoices) {
        const date = inv.invoiceDate.toISOString().split('T')[0];
        text += `فاتورة: ${inv.invoiceNumber} | التاريخ: ${date} | الإجمالي: ${inv.totalAmount} ج.م | الحالة: ${inv.paymentStatus}\n`;
    }
    
    await ctx.reply(text, { parse_mode: 'Markdown' });
  });
  bot.hears(/🚜 تسجيل منسوب/, async (ctx) => {
    await ctx.reply(
      '🚜 *تسجيل منسوب*\n\nيرجى التوجه إلى وحدة القياس بالموقع ورفع صورة واضحة لشريط القياس والمؤشر الخاص بالخزان لإتمام المطابقة الميدانية.',
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

  // 11. 🛡️ Telegram Group Enforcer & Join Request Security
  telegramGroupEnforcer.setBot(bot);

  // Group Migration Listener (Normal group converted to Supergroup)
  bot.on('message:migrate_to_chat_id', async (ctx) => {
    const oldChatId = ctx.chat.id;
    const newChatId = ctx.message.migrate_to_chat_id;
    await telegramGroupEnforcer.handleGroupMigration(oldChatId, newChatId);
  });

  // Single-use Invite Link Join Request Guard
  bot.on('chat_join_request', async (ctx) => {
    const userId = ctx.chatJoinRequest.user_chat_id;
    const chatId = ctx.chatJoinRequest.chat.id;

    try {
      const authorizedUser = await prisma.user.findFirst({
        where: {
          telegramId: BigInt(userId),
          isActive: true,
          isBanned: false,
          assignedSite: {
            telegramGroupId: BigInt(chatId),
          },
        },
      });

      if (authorizedUser) {
        await ctx.approveChatJoinRequest(userId);
        console.log(`✅ [JOIN REQUEST] Approved supervisor/worker ${userId} for group ${chatId}`);
      } else {
        await ctx.declineChatJoinRequest(userId);
        console.warn(`🛡️ [JOIN REQUEST] Declined unauthorized user ${userId} for group ${chatId}`);
      }
    } catch (err: any) {
      console.error(`❌ [JOIN REQUEST] Error handling join request for ${userId} in ${chatId}:`, err.message);
    }
  });

  // 12. ⚡ Keep-Alive Socket Warmer: Telegram Bot API closes idle connections after 55s.
  // Periodically pulse Telegram API every 20s so user clicks NEVER suffer a cold 2s TLS handshake!
  const keepAliveWarmer = setInterval(() => {
    bot.api.getMe().catch(() => {});
  }, 20000);
  if (typeof keepAliveWarmer.unref === 'function') {
    keepAliveWarmer.unref();
  }

  return bot;
}
