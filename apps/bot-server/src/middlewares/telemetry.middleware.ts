import type { MiddlewareFn } from 'grammy';
import type { MyContext } from '../types/context.js';
import { telemetryService } from '../services/telemetry.service.js';

/**
 * ⚡ Global APM & Breadcrumb Telemetry Middleware
 * Non-blocking silent background performance tracking & Flight Recorder
 */
export const telemetryMiddleware: MiddlewareFn<MyContext> = async (ctx, next) => {
  const telegramId = ctx.from ? BigInt(ctx.from.id) : 0n;

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

  const start = Date.now();

  try {
    await next();
  } finally {
    const executionTimeMs = Date.now() - start;

    // 2. Record performance metrics asynchronously (non-blocking)
    if (telegramId > 0n) {
      void telemetryService.recordPerformance({
        actorTelegramId: telegramId,
        callbackQueryOrCommand: actionTrigger,
        executionTimeMs,
      });
    }
  }
};
