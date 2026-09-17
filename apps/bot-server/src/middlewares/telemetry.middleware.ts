import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { MiddlewareFn } from 'grammy';
import type { MyContext } from '../types/context.js';
import { telemetryService } from '../services/telemetry.service.js';

export const requestTimingStorage = new AsyncLocalStorage<{
  telegramNetworkTimeMs: number;
}>();

/**
 * ⚡ Global APM & Breadcrumb Telemetry Middleware
 * Non-blocking silent background performance tracking & Flight Recorder
 * Measures net internal execution time separate from Telegram network round-trips.
 */
export const telemetryMiddleware: MiddlewareFn<MyContext> = async (ctx, next) => {
  const telegramId = ctx.from ? BigInt(ctx.from.id) : 0n;

  // Assign or preserve traceId
  const traceId = ctx.traceId || crypto.randomUUID();
  ctx.traceId = traceId;

  // Determine user action trigger label
  let actionTrigger = 'unknown_update';
  if (ctx.callbackQuery?.data) {
    actionTrigger = `cb:${ctx.callbackQuery.data}`;
  } else if (ctx.message?.text) {
    actionTrigger = `msg:${ctx.message.text.slice(0, 35)}`;
  } else if (ctx.message?.document) {
    actionTrigger = 'doc:upload';
  } else if (ctx.message?.photo) {
    actionTrigger = 'photo:upload';
  } else if (ctx.message?.location) {
    actionTrigger = 'loc:share';
  }

  // 1. Record flight recorder breadcrumb
  if (telegramId > 0n) {
    void telemetryService.recordBreadcrumb(telegramId, actionTrigger);
  }

  // Install timing transformer once on API client to measure external Telegram network latency
  if (ctx.api?.config?.use && !Reflect.get(ctx.api, '__timingTransformerInstalled')) {
    Reflect.set(ctx.api, '__timingTransformerInstalled', true);
    ctx.api.config.use(async (prev, method, payload, signal) => {
      const activeStore = requestTimingStorage.getStore();
      if (!activeStore) {
        return prev(method, payload, signal);
      }
      const apiStart = Date.now();
      try {
        return await prev(method, payload, signal);
      } finally {
        activeStore.telegramNetworkTimeMs += Date.now() - apiStart;
      }
    });
  }

  const timingStore = { telegramNetworkTimeMs: 0 };
  const start = Date.now();

  try {
    await requestTimingStorage.run(timingStore, async () => {
      await next();
    });
  } finally {
    const totalExecutionTimeMs = Date.now() - start;
    const effectiveNetworkTimeMs = Math.min(totalExecutionTimeMs, timingStore.telegramNetworkTimeMs);
    const internalExecutionTimeMs = Math.max(0, totalExecutionTimeMs - effectiveNetworkTimeMs);

    // 2. Record performance metrics asynchronously (non-blocking)
    if (telegramId > 0n) {
      void telemetryService.recordPerformance({
        actorTelegramId: telegramId,
        callbackQueryOrCommand: actionTrigger,
        executionTimeMs: totalExecutionTimeMs,
        internalExecutionTimeMs,
        telegramNetworkTimeMs: effectiveNetworkTimeMs,
        traceId,
        ...(ctx.module ? { module: ctx.module } : {}),
        ...(ctx.flowId ? { flowId: ctx.flowId } : {}),
        cacheSource: ctx.cacheSource || 'DB_QUERY',
      });
    }
  }
};
