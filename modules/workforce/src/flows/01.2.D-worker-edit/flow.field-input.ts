import type { Context, InlineKeyboard } from 'grammy';
import type { WorkforceModuleContext } from '../../shared/module.types.js';
import type { WorkerEditService } from './flow.service.js';
import type { WorkerEditRepository } from './flow.repository.js';
import { WorkerEditMessages } from './flow.messages.js';
import { WorkerEditKeyboards, PICKER_OPTIONS } from './flow.keyboard.js';
import { FIELD_KEY_SHORT_MAP, FIELD_LABELS, validateFieldValue, getReturnTab } from './flow.validators.js';
import type { PendingWorkerEditState, WorkerProfileTab } from './flow.types.js';
import type { WorkerSalaryWizardHandler } from './flow.salary-wizard.js';

export class WorkerFieldInputHandler {
  constructor(
    private readonly service: WorkerEditService,
    private readonly repository: WorkerEditRepository,
    private readonly replyOrEdit: (ctx: Context, text: string, kb?: InlineKeyboard) => Promise<void>,
    private readonly handlePickWorker: (ctx: WorkforceModuleContext, workerId: string, tab?: WorkerProfileTab) => Promise<void>,
    private readonly isSuperAdmin: (ctx: WorkforceModuleContext) => boolean,
    private readonly salaryWizard: WorkerSalaryWizardHandler,
    private readonly editDrafts: Map<string, PendingWorkerEditState>
  ) {}

  async handleSelectPickerValue(
    ctx: WorkforceModuleContext,
    fieldShort: string,
    optIdxStr: string,
    workerId: string
  ): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const fieldKey = FIELD_KEY_SHORT_MAP[fieldShort];
    const options = PICKER_OPTIONS[fieldShort];
    const idx = parseInt(optIdxStr, 10);
    const chosen = options?.[idx];
    if (!fieldKey || !chosen) {
      await this.replyOrEdit(ctx, '⚠️ خيار غير صالح.');
      return;
    }
    const returnTab = getReturnTab(fieldShort);
    const worker = await this.repository.findWorkerForEdit(workerId);
    if (!worker) {
      await this.replyOrEdit(ctx, '⚠️ لم يتم العثور على العامل.');
      return;
    }

    const isSuper = this.isSuperAdmin(ctx);
    const actorId = ctx.from ? BigInt(ctx.from.id) : BigInt(0);
    const actorName = (ctx.from?.first_name || 'المستخدم') + (ctx.from?.last_name ? ` ${ctx.from.last_name}` : '');
    const requesterRole = ctx.effectiveRole || 'FIELD_ADMIN';

    if (isSuper) {
      await this.service.applyDirectEdit(workerId, fieldKey, chosen.value, actorId, actorName);
      await this.handlePickWorker(ctx, workerId, returnTab);
    } else {
      const fieldName = FIELD_LABELS[fieldKey] || fieldKey;
      const ticketRes = await this.service.submitEditTicket({
        workerId,
        workerCode: worker.code,
        workerName: worker.name,
        requesterTelegramId: actorId,
        requesterName: actorName,
        requesterRole,
        fieldKey,
        fieldName,
        oldValue: '-',
        newValue: chosen.value,
        reason: 'طلب تعديل من واجهة الإشراف الميداني',
      });
      if (ticketRes.success) {
        const text = WorkerEditMessages.ticketSubmitted({
          ticketId: ticketRes.ticketId || '',
          workerName: worker.name,
          fieldName,
          newValue: chosen.value,
        });
        await this.replyOrEdit(ctx, text, WorkerEditKeyboards.directEditSuccessKeyboard(workerId, returnTab));
      } else {
        const errKb = WorkerEditKeyboards.cancelEditKeyboard(workerId, returnTab);
        await this.replyOrEdit(ctx, `❌ خطأ في إرسال طلب التعديل: ${ticketRes.error}`, errKb);
      }
    }
  }

  async handleTextInput(ctx: WorkforceModuleContext, rawText: string): Promise<void> {
    if (!ctx.from) return;
    const uid = String(ctx.from.id);

    // 1. Check if user is in Salary Wizard
    if (await this.salaryWizard.handleSalaryWizardTextInput(ctx, rawText)) {
      return;
    }

    // 2. Check if user is in field edit draft
    const draft = this.editDrafts.get(uid);
    if (!draft || !draft.fieldKey) return;

    await ctx.deleteMessage().catch(() => {});
    const cleanText = rawText.trim();
    const val = validateFieldValue(draft.fieldKey, cleanText);
    const returnTab = draft.currentTab || 'PERSONAL';

    if (!val.isValid || !val.cleanValue) {
      const errKb = WorkerEditKeyboards.cancelEditKeyboard(draft.workerId, returnTab);
      const errMsg = `⚠️ ${val.error || 'القيمة المدخلة غير صالحة.'}`;
      if (draft.promptMsgId && ctx.chat) {
        try {
          await ctx.api.editMessageText(ctx.chat.id, draft.promptMsgId, errMsg, { parse_mode: 'Markdown', reply_markup: errKb });
          return;
        } catch {}
      }
      await this.replyOrEdit(ctx, errMsg, errKb);
      return;
    }

    const isSuper = this.isSuperAdmin(ctx);
    const telegramId = BigInt(ctx.from.id);
    const actorName = (ctx.from.first_name || 'المستخدم') + (ctx.from.last_name ? ` ${ctx.from.last_name}` : '');
    const requesterRole = ctx.effectiveRole || 'FIELD_ADMIN';
    let resText = '';
    let resKb: InlineKeyboard;

    if (isSuper) {
      const result = await this.service.applyDirectEdit(draft.workerId, draft.fieldKey, val.cleanValue, telegramId, actorName);
      if (result.success) {
        resText = WorkerEditMessages.directEditSuccess({
          workerCode: result.workerCode || draft.workerCode,
          workerName: draft.workerName,
          fieldName: draft.fieldName || draft.fieldKey,
          newValue: val.cleanValue,
        });
        resKb = WorkerEditKeyboards.directEditSuccessKeyboard(draft.workerId, returnTab);
      } else {
        resText = `❌ خطأ أثناء تطبيق التعديل: ${result.error}`;
        resKb = WorkerEditKeyboards.cancelEditKeyboard(draft.workerId, returnTab);
      }
    } else {
      const ticketRes = await this.service.submitEditTicket({
        workerId: draft.workerId,
        workerCode: draft.workerCode,
        workerName: draft.workerName,
        requesterTelegramId: telegramId,
        requesterName: actorName,
        requesterRole,
        fieldKey: draft.fieldKey,
        fieldName: draft.fieldName || draft.fieldKey,
        oldValue: draft.oldValue || '-',
        newValue: val.cleanValue,
        reason: 'طلب تعديل من واجهة الإشراف الميداني',
      });
      if (ticketRes.success) {
        resText = WorkerEditMessages.ticketSubmitted({
          ticketId: ticketRes.ticketId || '',
          workerName: draft.workerName,
          fieldName: draft.fieldName || draft.fieldKey,
          newValue: val.cleanValue,
        });
        resKb = WorkerEditKeyboards.directEditSuccessKeyboard(draft.workerId, returnTab);
      } else {
        resText = `❌ خطأ في إرسال طلب التعديل: ${ticketRes.error}`;
        resKb = WorkerEditKeyboards.cancelEditKeyboard(draft.workerId, returnTab);
      }
    }

    this.editDrafts.delete(uid);

    if (draft.promptMsgId && ctx.chat) {
      try {
        await ctx.api.editMessageText(ctx.chat.id, draft.promptMsgId, resText, { parse_mode: 'Markdown', reply_markup: resKb });
        return;
      } catch {}
    }
    await this.replyOrEdit(ctx, resText, resKb);
  }
}
