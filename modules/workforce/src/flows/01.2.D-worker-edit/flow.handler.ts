import type { Context } from 'grammy';
import type { WorkforceModuleContext } from '../../shared/module.types.js';
import { WorkerEditService } from './flow.service.js';
import { WorkerEditRepository } from './flow.repository.js';
import { WorkerEditMessages } from './flow.messages.js';
import { WorkerEditKeyboards } from './flow.keyboard.js';
import { FIELD_KEY_SHORT_MAP, FIELD_LABELS, validateFieldValue } from './flow.validators.js';
import type { EditableWorkerField, PendingWorkerEditState } from './flow.types.js';

export class WorkerEditHandler {
  private readonly editDrafts = new Map<string, PendingWorkerEditState>();

  hasActiveDraft(userId: string): boolean {
    return this.editDrafts.has(userId);
  }

  constructor(
    private readonly service: WorkerEditService,
    private readonly repository: WorkerEditRepository
  ) {}

  private checkRbac(ctx: WorkforceModuleContext): boolean {
    const role = ctx.effectiveRole || 'GUEST';
    const blockedRoles = ['WORKER', 'SUPPLIER', 'GUEST'];
    return !blockedRoles.includes(role);
  }

  private isSuperAdmin(ctx: WorkforceModuleContext): boolean {
    const role = ctx.effectiveRole || 'GUEST';
    return role === 'SUPER_ADMIN' || Boolean(ctx.isRealSuperAdmin);
  }

  private async replyOrEdit(
    ctx: Context,
    text: string,
    keyboard?: ReturnType<typeof WorkerEditKeyboards.fieldsSelectionKeyboard>
  ): Promise<void> {
    if (ctx.callbackQuery?.message) {
      try {
        await ctx.editMessageText(text, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
        return;
      } catch {
        // Fallback to sending new message
      }
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async handlePickWorker(ctx: WorkforceModuleContext, workerId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (!this.checkRbac(ctx)) {
      await this.replyOrEdit(ctx, '⛔ عذراً، لا تملك الصلاحية لتعديل بيانات العمال.');
      return;
    }

    const worker = await this.repository.findWorkerForEdit(workerId);
    if (!worker) {
      await this.replyOrEdit(ctx, '⚠️ لم يتم العثور على العامل.');
      return;
    }

    if (ctx.from) {
      this.editDrafts.set(String(ctx.from.id), {
        workerId: worker.id,
        workerCode: worker.code,
        workerName: worker.name,
        isSuperAdmin: this.isSuperAdmin(ctx),
      });
    }

    const text = WorkerEditMessages.selectFieldPrompt(worker.name, worker.code);
    const keyboard = WorkerEditKeyboards.fieldsSelectionKeyboard(worker.id);
    await this.replyOrEdit(ctx, text, keyboard);
  }

  async handleSelectField(
    ctx: WorkforceModuleContext,
    fieldShort: string,
    workerId: string
  ): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const fieldKey = FIELD_KEY_SHORT_MAP[fieldShort];
    if (!fieldKey) {
      await this.replyOrEdit(ctx, '⚠️ الحقل المطلوب تعديله غير مدعوم.');
      return;
    }

    const worker = await this.repository.findWorkerForEdit(workerId);
    if (!worker) {
      await this.replyOrEdit(ctx, '⚠️ لم يتم العثور على العامل.');
      return;
    }

    const fieldName = FIELD_LABELS[fieldKey];
    if (ctx.from) {
      this.editDrafts.set(String(ctx.from.id), {
        workerId: worker.id,
        workerCode: worker.code,
        workerName: worker.name,
        fieldKey,
        fieldName,
        isSuperAdmin: this.isSuperAdmin(ctx),
      });
    }

    const text = WorkerEditMessages.inputNewValuePrompt(fieldName);
    const keyboard = WorkerEditKeyboards.cancelEditKeyboard();
    await this.replyOrEdit(ctx, text, keyboard);
  }

  async handleTextInput(ctx: WorkforceModuleContext, rawText: string): Promise<void> {
    if (!ctx.from) return;
    const draft = this.editDrafts.get(String(ctx.from.id));
    if (!draft || !draft.fieldKey) return;

    await ctx.deleteMessage().catch(() => {});
    const cleanText = rawText.trim();
    const val = validateFieldValue(draft.fieldKey, cleanText);
    if (!val.isValid || !val.cleanValue) {
      await this.replyOrEdit(ctx, `⚠️ ${val.error || 'القيمة المدخلة غير صالحة.'}`, WorkerEditKeyboards.cancelEditKeyboard());
      return;
    }

    const telegramId = BigInt(ctx.from.id);
    const superAdmin = draft.isSuperAdmin;

    if (superAdmin) {
      const result = await this.service.applyDirectEdit(
        draft.workerId,
        draft.fieldKey,
        val.cleanValue,
        telegramId
      );
      this.editDrafts.delete(String(ctx.from.id));

      if (result.success) {
        const text = WorkerEditMessages.directEditSuccess({
          workerCode: result.workerCode || draft.workerCode,
          workerName: draft.workerName,
          fieldName: draft.fieldName || draft.fieldKey,
          newValue: val.cleanValue,
        });
        const kb = WorkerEditKeyboards.directEditSuccessKeyboard();
        await this.replyOrEdit(ctx, text, kb);
      } else {
        await this.replyOrEdit(ctx, `❌ خطأ أثناء تطبيق التعديل: ${result.error}`, WorkerEditKeyboards.cancelEditKeyboard());
      }
    } else {
      const result = await this.service.submitEditTicket({
        workerId: draft.workerId,
        workerCode: draft.workerCode,
        workerName: draft.workerName,
        requesterTelegramId: telegramId,
        requesterName: ctx.from.first_name || 'مشرف موقع',
        requesterRole: ctx.effectiveRole || 'FIELD_ADMIN',
        fieldKey: draft.fieldKey,
        fieldName: draft.fieldName || draft.fieldKey,
        newValue: val.cleanValue,
      });
      this.editDrafts.delete(String(ctx.from.id));

      if (result.success && result.ticketId) {
        const text = WorkerEditMessages.ticketSubmitted({
          ticketId: result.ticketId,
          workerName: draft.workerName,
          fieldName: draft.fieldName || draft.fieldKey,
          newValue: val.cleanValue,
        });
        const kb = WorkerEditKeyboards.directEditSuccessKeyboard();
        await this.replyOrEdit(ctx, text, kb);
      } else {
        await this.replyOrEdit(ctx, `❌ خطأ أثناء إرسال الطلب: ${result.error}`, WorkerEditKeyboards.cancelEditKeyboard());
      }
    }
  }

  async handlePendingTicketsList(ctx: WorkforceModuleContext): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (!this.isSuperAdmin(ctx)) {
      await this.replyOrEdit(ctx, '⛔ هذه الشاشة حصرية للمدير العام.');
      return;
    }

    const tickets = await this.service.listPendingTickets();
    if (tickets.length === 0) {
      await this.replyOrEdit(ctx, '✅ لا توجد أي طلبات تعديل معلقة حالياً.');
      return;
    }

    const text = WorkerEditMessages.pendingTicketsHeader(tickets.length);
    const keyboard = WorkerEditKeyboards.pendingTicketsListKeyboard(tickets);
    await this.replyOrEdit(ctx, text, keyboard);
  }

  async handleReviewTicket(ctx: WorkforceModuleContext, ticketId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const tickets = await this.service.listPendingTickets();
    const ticket = tickets.find((t) => t.requestId === ticketId);
    if (!ticket) {
      await this.replyOrEdit(ctx, '⚠️ لم يتم العثور على الطلب المطلوب أو تم البت فيه مسبقاً.');
      return;
    }

    const text = WorkerEditMessages.reviewTicketCard(ticket);
    const keyboard = WorkerEditKeyboards.ticketReviewKeyboard(ticket.requestId);
    await this.replyOrEdit(ctx, text, keyboard);
  }

  async handleApproveTicket(ctx: WorkforceModuleContext, ticketId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (!ctx.from) return;
    const adminId = BigInt(ctx.from.id);
    const result = await this.service.approveTicket(ticketId, adminId);

    if (result.success) {
      await this.replyOrEdit(ctx, `✅ تم اعتماد وتطبيق التعديل للطلب \`${ticketId}\` فورياً بنجاح.`);
    } else {
      await this.replyOrEdit(ctx, `❌ تعذر اعتماد الطلب: ${result.error}`);
    }
  }

  async handleRejectTicket(ctx: WorkforceModuleContext, ticketId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (!ctx.from) return;
    const adminId = BigInt(ctx.from.id);
    const result = await this.service.rejectTicket(ticketId, adminId);

    if (result.success) {
      await this.replyOrEdit(ctx, `❌ تم رفض طلب التعديل \`${ticketId}\`.`);
    } else {
      await this.replyOrEdit(ctx, `❌ تعذر رفض الطلب: ${result.error}`);
    }
  }

  async handleCancel(ctx: WorkforceModuleContext): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (ctx.from) {
      this.editDrafts.delete(String(ctx.from.id));
    }
    await this.replyOrEdit(ctx, '❌ تم إلغاء تعديل بيانات العامل.');
  }
}
