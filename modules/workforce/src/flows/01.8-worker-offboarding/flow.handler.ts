import type { Bot } from 'grammy';
import type { WorkforceModuleContext } from '../../shared/module.types.js';
import type { WorkerOffboardingService } from './flow.service.js';
import type { TerminationReason, WorkerOffboardingState } from './flow.types.js';
import {
  buildWorkerPickerKeyboard,
  buildReasonKeyboard,
  buildConfirmKeyboard,
  buildSuccessKeyboard,
} from './flow.keyboard.js';
import {
  formatWorkerSelectHeader,
  formatReasonSelectHeader,
  formatConfirmationCard,
  formatSuccessCard,
  formatOffboardingNotification,
} from './flow.messages.js';
import { validateTerminationReason } from './flow.validators.js';
import { logWorkerOffboardingTelemetry } from './flow.telemetry.js';
import { notifyFlowOperation } from '@alsaada/core-components';

export class WorkerOffboardingHandler {
  private activeStates = new Map<string, WorkerOffboardingState>();

  constructor(private readonly service: WorkerOffboardingService) {}

  registerRoutes(bot: Bot<WorkforceModuleContext>): void {
    bot.callbackQuery('wizard:worker_offboard:start', async (ctx) => {
      await this.handleStartOffboarding(ctx);
    });

    bot.callbackQuery(/^action:wob:pick:(.+)$/, async (ctx) => {
      const workerId = ctx.match[1];
      if (workerId) await this.handlePickWorker(ctx, workerId);
    });

    bot.callbackQuery(/^action:wob:r:(.+)$/, async (ctx) => {
      const reason = ctx.match[1];
      if (reason) await this.handleSelectReason(ctx, reason);
    });

    bot.callbackQuery('action:wob:confirm', async (ctx) => {
      await this.handleConfirmOffboard(ctx);
    });

    bot.callbackQuery('action:wob:cancel', async (ctx) => {
      await this.handleCancel(ctx);
    });
  }

  async handleStartOffboarding(ctx: WorkforceModuleContext): Promise<void> {
    if (!ctx.from) return;
    const telegramId = BigInt(ctx.from.id);

    const allowedRoles = ['SUPER_ADMIN', 'FIELD_ADMIN', 'GENERAL_ADMIN', 'ACCOUNTANT'];
    if (!ctx.effectiveRole || !allowedRoles.includes(ctx.effectiveRole)) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: '🔒 غير مصرح لك بإنهاء خدمة العاملين.', show_alert: true }).catch(() => {});
      }
      return;
    }

    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const siteId = ctx.assignedSiteId || undefined;
    const workers = await this.service.getActiveWorkers(siteId);
    if (!workers.length) {
      const noWorkersMsg = 'ℹ️ لا يوجد عمالة نشطة متاحة في نطاقك الميداني حالياً لإجراء المخالصة.';
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: noWorkersMsg, show_alert: true }).catch(() => {});
      } else {
        await ctx.reply(noWorkersMsg);
      }
      return;
    }

    const state: WorkerOffboardingState = {
      step: 'WORKER_SELECT',
      createdAt: Date.now(),
    };
    this.activeStates.set(telegramId.toString(), state);

    const text = formatWorkerSelectHeader();
    const keyboard = buildWorkerPickerKeyboard(
      workers.map((w) => ({
        id: w.id,
        name: w.nickname || w.name,
        code: w.code,
      }))
    );

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {}
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async handlePickWorker(ctx: WorkforceModuleContext, workerId: string): Promise<void> {
    if (!ctx.from) return;
    const telegramId = BigInt(ctx.from.id);
    const state = this.activeStates.get(telegramId.toString());

    if (!state) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: '⚠️ انتهت الجلسة. يرجى البدء مجدداً.', show_alert: true }).catch(() => {});
      }
      return;
    }

    const worker = await this.service.getWorkerById(workerId);
    if (!worker) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: '❌ تعذر العثور على سجل العامل.', show_alert: true }).catch(() => {});
      }
      return;
    }

    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    state.workerId = worker.id;
    state.workerCode = worker.code;
    state.workerName = worker.nickname || worker.name;
    state.workerTelegramId = worker.telegramId;
    state.jobTitle = worker.jobTitle;
    state.siteName = worker.site?.name;
    state.siteId = worker.siteId || worker.site?.id || undefined;
    state.step = 'REASON_SELECT';
    this.activeStates.set(telegramId.toString(), state);

    const text = formatReasonSelectHeader(state.workerName, state.workerCode);
    const keyboard = buildReasonKeyboard();

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {}
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async handleSelectReason(ctx: WorkforceModuleContext, reasonStr: string): Promise<void> {
    if (!ctx.from) return;
    const telegramId = BigInt(ctx.from.id);
    const state = this.activeStates.get(telegramId.toString());

    if (!state || !state.workerId || !validateTerminationReason(reasonStr)) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: '⚠️ سبب غير صالح أو بيانات غير مكتملة.', show_alert: true }).catch(() => {});
      }
      return;
    }

    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    state.reason = reasonStr as TerminationReason;
    state.step = 'CONFIRM';
    this.activeStates.set(telegramId.toString(), state);

    const text = formatConfirmationCard(
      state.workerName || 'العامل',
      state.workerCode || '',
      state.reason,
      Boolean(state.workerTelegramId),
      state.notes
    );
    const keyboard = buildConfirmKeyboard();

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {}
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async handleConfirmOffboard(ctx: WorkforceModuleContext): Promise<void> {
    if (!ctx.from) return;
    const telegramId = BigInt(ctx.from.id);
    const state = this.activeStates.get(telegramId.toString());

    if (!state || !state.workerId || !state.workerCode || !state.reason) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: '⚠️ بيانات المخالصة غير مكتملة.', show_alert: true }).catch(() => {});
      }
      return;
    }

    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const startTime = Date.now();
    try {
      const res = await this.service.executeOffboarding({
        workerId: state.workerId,
        workerCode: state.workerCode,
        reason: state.reason,
        notes: state.notes,
        actorTelegramId: telegramId,
      });

      const savedReason = state.reason;
      const savedSiteName = state.siteName;
      const savedSiteId = state.siteId;

      this.activeStates.delete(telegramId.toString());
      logWorkerOffboardingTelemetry({
        workerId: state.workerId,
        workerCode: state.workerCode,
        reason: state.reason,
        demotedTelegramId: res.demotedTelegramId,
        executionTimeMs: Date.now() - startTime,
        success: true,
        actorTelegramId: telegramId,
      });

      const successText = formatSuccessCard(
        res.workerName,
        res.workerCode,
        res.clearanceReferenceId,
        Boolean(res.demotedTelegramId)
      );
      const keyboard = buildSuccessKeyboard();

      if (ctx.callbackQuery) {
        try {
          await ctx.editMessageText(successText, { parse_mode: 'Markdown', reply_markup: keyboard });
        } catch {
          await ctx.reply(successText, { parse_mode: 'Markdown', reply_markup: keyboard });
        }
      } else {
        await ctx.reply(successText, { parse_mode: 'Markdown', reply_markup: keyboard });
      }

      // Safe, non-blocking flow notification
      const notifText = formatOffboardingNotification(
        res.workerName,
        res.workerCode,
        savedReason,
        res.clearanceReferenceId,
        savedSiteName
      );

      await notifyFlowOperation({
        featureKey: 'WORKER_OFFBOARDING',
        siteId: savedSiteId || undefined,
        siteCardText: notifText,
        hqCategory: 'WORKFORCE',
        hqCardText: notifText,
      }).catch(() => {});
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'تعذر إتمام المخالصة.';
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: `❌ ${errMsg}`, show_alert: true }).catch(() => {});
      } else {
        await ctx.reply(`❌ ${errMsg}`);
      }
    }
  }

  async handleCancel(ctx: WorkforceModuleContext): Promise<void> {
    if (!ctx.from) return;
    const telegramId = BigInt(ctx.from.id);
    this.activeStates.delete(telegramId.toString());

    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: '❌ تم إلغاء المخالصة' }).catch(() => {});
    }

    const text = '❌ *تم إلغاء إجراءات إنهاء الخدمة والمخالصة.*';
    const keyboard = buildSuccessKeyboard();

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {}
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  getActiveState(telegramId: bigint): WorkerOffboardingState | undefined {
    return this.activeStates.get(telegramId.toString());
  }

  setActiveState(telegramId: bigint, state: WorkerOffboardingState): void {
    this.activeStates.set(telegramId.toString(), state);
  }
}
