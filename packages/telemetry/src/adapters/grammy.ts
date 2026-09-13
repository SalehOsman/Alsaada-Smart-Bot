/**
 * Al-Saada Enterprise Telemetry - grammY Bot Adapter
 * Pure duck-typed adapter with zero runtime dependency on grammy.
 * Compliance: Plan 19 Section 3 & explorer_adapters_spec
 */

import type { Context, MiddlewareFn } from 'grammy';
import { runWithTelemetryContext } from '../context.js';
import { TelemetryLogger } from '../logger.js';
import type {
  GrammyTelemetryOptions,
  TelegramStructuralContext,
  TelemetryActor,
  TelemetryContext,
} from '../types.js';

export type { GrammyTelemetryOptions, TelegramStructuralContext };

const defaultLogger = new TelemetryLogger();

/**
 * Determine a concise action trigger label from Telegram Context.
 */
export function resolveTelegramActionTrigger(ctx: TelegramStructuralContext): string {
  if (ctx.callbackQuery?.data) {
    return `cb:${ctx.callbackQuery.data}`;
  }
  if (ctx.message?.text) {
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) {
      return `cmd:${text.split(/\s+/)[0]}`;
    }
    return `msg:${text.slice(0, 35)}`;
  }
  if (ctx.message?.document) return 'doc:upload';
  if (ctx.message?.photo) return 'photo:upload';
  if (ctx.message?.location) return 'loc:share';
  return 'unknown_update';
}

/**
 * Extract actor information from Telegram Context.
 */
export function extractTelegramActor(ctx: TelegramStructuralContext): TelemetryActor {
  const telegramId = ctx.from?.id !== undefined ? String(ctx.from.id) : undefined;
  const role = ctx.effectiveRole || ctx.dbUser?.role || 'GUEST';
  const userId = ctx.dbUser?.id;
  const siteId = ctx.dbUser?.assignedSiteId || undefined;

  return {
    telegramId,
    userId,
    role,
    siteId,
  };
}

/**
 * Enterprise grammY Telemetry Middleware.
 * Establishes Trace ID, AsyncLocalStorage context, flight-recorder breadcrumbs,
 * APM performance metrics, and structured JSON error logs.
 */
export function telemetryMiddleware<
  C extends Context & TelegramStructuralContext = Context & TelegramStructuralContext,
>(options: GrammyTelemetryOptions = {}): MiddlewareFn<C> {
  const service = options.service || 'bot-server';
  const component = options.component || 'bot:gateway';

  return async (ctx: C, next: () => Promise<void>): Promise<void> => {
    // 1. Establish or reuse Trace ID
    const traceId = ctx.traceId || globalThis.crypto.randomUUID();
    ctx.traceId = traceId;

    const telegramId = ctx.from?.id !== undefined ? BigInt(ctx.from.id) : 0n;
    const actionTrigger = resolveTelegramActionTrigger(ctx);
    const actor = options.extractActor ? options.extractActor(ctx) : extractTelegramActor(ctx);

    // 2. Flight recorder breadcrumb callback
    if (telegramId > 0n && options.onBreadcrumb) {
      try {
        await options.onBreadcrumb(telegramId, actionTrigger);
      } catch {}
    }

    const startTime = Date.now();

    const telemetryCtx: TelemetryContext = {
      traceId,
      service,
      component,
      action: actionTrigger,
      actor,
      startTime,
    };

    // 3. Execute inside AsyncLocalStorage scope
    await runWithTelemetryContext(telemetryCtx, async () => {
      let errorOccurred: unknown = undefined;

      try {
        await next();
      } catch (err) {
        errorOccurred = err;

        // Structured error log
        defaultLogger.error(
          err instanceof Error ? err.message : String(err),
          {
            traceId,
            service,
            component,
            action: actionTrigger,
            actor,
            durationMs: Date.now() - startTime,
            error: err,
          }
        );

        throw err;
      } finally {
        const executionTimeMs = Date.now() - startTime;

        // Performance callback
        if (telegramId > 0n && options.onPerformance) {
          try {
            await options.onPerformance({
              actorTelegramId: telegramId,
              action: actionTrigger,
              executionTimeMs,
              error: errorOccurred,
            });
          } catch {}
        }
      }
    });
  };
}
