import type { Bot } from 'grammy';
import type { WorkforceModuleContext } from '../../shared/module.types.js';
import type { WorkerSelfEditService } from './flow.service.js';
import type { EditablePersonalField, WorkerSelfEditState } from './flow.types.js';
import {
  buildFieldPickerKeyboard,
  buildConfirmKeyboard,
  buildSuccessKeyboard,
} from './flow.keyboard.js';
import {
  formatFieldSelectionHeader,
  formatInputPrompt,
  formatConfirmation,
  formatSuccess,
} from './flow.messages.js';
import { validateWorkerSelfEditField } from './flow.validators.js';
import { logWorkerSelfEditTelemetry } from './flow.telemetry.js';

export class WorkerSelfEditHandler {
  private activeStates = new Map<string, WorkerSelfEditState>();

  constructor(private readonly service: WorkerSelfEditService) {}

  registerRoutes(bot: Bot<WorkforceModuleContext>): void {
    bot.callbackQuery('wizard:worker_self_edit:start', async (ctx) => {
      await this.handleStartSelfEdit(ctx);
    });

    bot.callbackQuery(/^action:wse:f:(.+)$/, async (ctx) => {
      const field = ctx.match[1];
      if (field) await this.handlePickField(ctx, field);
    });

    bot.callbackQuery('action:wse:confirm', async (ctx) => {
      await this.handleConfirm(ctx);
    });

    bot.callbackQuery('action:wse:cancel', async (ctx) => {
      await this.handleCancel(ctx);
    });
  }

  async handleStartSelfEdit(ctx: WorkforceModuleContext): Promise<void> {
    if (!ctx.from) return;
    const telegramId = BigInt(ctx.from.id);

    let workerId = ctx.workerId;
    let worker = workerId ? await this.service.getWorker(workerId) : null;
    if (!worker) {
      worker = await this.service.getWorkerByTelegramId(telegramId);
      if (worker) workerId = worker.id;
    }

    if (!worker || !workerId) {
      const msg = '❌ لا يوجد سجل عامل مرتبط بهذا الحساب لاستخدام خدمة التحديث الذاتي.';
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: msg, show_alert: true }).catch(() => {});
      } else {
        await ctx.reply(msg);
      }
      return;
    }

    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const state: WorkerSelfEditState = {
      step: 'FIELD_SELECT',
      workerId,
      workerCode: worker.code,
      workerName: worker.nickname || worker.name,
      createdAt: Date.now(),
    };
    this.activeStates.set(telegramId.toString(), state);

    const text = formatFieldSelectionHeader(state.workerName, state.workerCode);
    const keyboard = buildFieldPickerKeyboard();

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {}
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async handlePickField(ctx: WorkforceModuleContext, fieldKey: string): Promise<void> {
    if (!ctx.from) return;
    const telegramId = BigInt(ctx.from.id);
    const state = this.activeStates.get(telegramId.toString());

    if (!state || !validateWorkerSelfEditField(fieldKey)) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: '⚠️ الجلسة منتهية أو الحقل غير متاح.', show_alert: true }).catch(() => {});
      }
      return;
    }

    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    state.selectedField = fieldKey;
    state.step = 'INPUT';
    this.activeStates.set(telegramId.toString(), state);

    const worker = await this.service.getWorker(state.workerId);
    let currVal = '';
    if (worker) {
      if (fieldKey === 'phone') {
        currVal = this.service.decryptFieldSafe(worker.phoneEncrypted);
      } else if (fieldKey === 'emergencyPhone') {
        currVal = this.service.decryptFieldSafe(worker.emergencyPhoneEncrypted);
      } else if (fieldKey === 'accountNumber') {
        currVal = this.service.decryptFieldSafe(worker.accountNumberEncrypted);
      } else {
        currVal = String((worker as Record<string, unknown>)[fieldKey] || '');
      }
    }
    state.oldValue = currVal;

    const text = formatInputPrompt(fieldKey, currVal);
    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown' });
        return;
      } catch {}
    }
    await ctx.reply(text, { parse_mode: 'Markdown' });
  }

  async handleTextInput(ctx: WorkforceModuleContext, text: string): Promise<boolean> {
    if (!ctx.from) return false;
    const telegramId = BigInt(ctx.from.id);
    const state = this.activeStates.get(telegramId.toString());

    if (!state || state.step !== 'INPUT' || !state.selectedField) {
      return false;
    }

    state.newValue = text.trim();
    state.step = 'CONFIRM';
    this.activeStates.set(telegramId.toString(), state);

    const confirmText = formatConfirmation(
      state.selectedField,
      state.oldValue || '',
      state.newValue,
      state.reason
    );
    const keyboard = buildConfirmKeyboard();

    await ctx.reply(confirmText, { parse_mode: 'Markdown', reply_markup: keyboard });
    return true;
  }

  async handleConfirm(ctx: WorkforceModuleContext): Promise<void> {
    if (!ctx.from) return;
    const telegramId = BigInt(ctx.from.id);
    const state = this.activeStates.get(telegramId.toString());

    if (!state || !state.selectedField || !state.newValue) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: '⚠️ بيانات الطلب غير مكتملة أو منتهية الصلاحية.', show_alert: true }).catch(() => {});
      }
      return;
    }

    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const startTime = Date.now();
    try {
      const res = await this.service.executeSelfEdit({
        workerId: state.workerId,
        workerCode: state.workerCode,
        workerName: state.workerName,
        field: state.selectedField,
        newValue: state.newValue,
        reason: state.reason,
        actorTelegramId: telegramId,
      });

      this.activeStates.delete(telegramId.toString());
      logWorkerSelfEditTelemetry({
        workerId: state.workerId,
        workerCode: state.workerCode,
        field: state.selectedField,
        executionTimeMs: Date.now() - startTime,
        success: true,
        actorTelegramId: telegramId,
      });

      const successText = formatSuccess(res.message, res.referenceId);
      const keyboard = buildSuccessKeyboard();

      if (ctx.callbackQuery) {
        try {
          await ctx.editMessageText(successText, { parse_mode: 'Markdown', reply_markup: keyboard });
          return;
        } catch {}
      }
      await ctx.reply(successText, { parse_mode: 'Markdown', reply_markup: keyboard });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'تعذر حفظ التعديل.';
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
      await ctx.answerCallbackQuery({ text: '❌ تم إلغاء تعديل البيانات' }).catch(() => {});
    }

    const keyboard = buildSuccessKeyboard();
    const text = '❌ *تم إلغاء عملية تعديل البيانات ذاتياً.*';

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {}
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  getActiveState(telegramId: bigint): WorkerSelfEditState | undefined {
    return this.activeStates.get(telegramId.toString());
  }

  setActiveState(telegramId: bigint, state: WorkerSelfEditState): void {
    this.activeStates.set(telegramId.toString(), state);
  }
}
