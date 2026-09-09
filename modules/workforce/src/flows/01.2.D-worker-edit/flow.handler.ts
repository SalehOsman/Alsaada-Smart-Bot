import type { Context, InlineKeyboard } from 'grammy';
import type { WorkforceModuleContext } from '../../shared/module.types.js';
import { WorkerEditService } from './flow.service.js';
import { WorkerEditRepository } from './flow.repository.js';
import { WorkerEditMessages } from './flow.messages.js';
import { WorkerEditKeyboards, POLICY_SHORT_TO_CODE, PICKER_OPTIONS } from './flow.keyboard.js';
import { FIELD_KEY_SHORT_MAP, FIELD_LABELS, validateFieldValue, getReturnTab } from './flow.validators.js';
import type { PendingWorkerEditState, WorkerProfileTab, WorkerCardView } from './flow.types.js';

export class WorkerEditHandler {
  private readonly editDrafts = new Map<string, PendingWorkerEditState>();

  hasActiveDraft(userId: string): boolean {
    const draft = this.editDrafts.get(userId);
    return Boolean(draft && draft.fieldKey);
  }

  clearDraft(userId: string): void {
    this.editDrafts.delete(userId);
  }

  constructor(
    private readonly service: WorkerEditService,
    private readonly repository: WorkerEditRepository
  ) {}

  private checkRbac(ctx: WorkforceModuleContext): boolean {
    const role = ctx.effectiveRole || 'GUEST';
    return !['WORKER', 'SUPPLIER', 'GUEST'].includes(role);
  }

  private isSuperAdmin(ctx: WorkforceModuleContext): boolean {
    return ctx.effectiveRole === 'SUPER_ADMIN' || Boolean(ctx.isRealSuperAdmin);
  }

  private async replyOrEdit(ctx: Context, text: string, keyboard?: InlineKeyboard): Promise<void> {
    const opts = { parse_mode: 'Markdown' as const, ...(keyboard ? { reply_markup: keyboard } : {}) };
    if (ctx.callbackQuery?.message) {
      try {
        await ctx.editMessageText(text, opts);
        return;
      } catch {
        // Fallback to regular reply if in-place edit fails
      }
    }
    await ctx.reply(text, opts);
  }

  private renderTab(worker: WorkerCardView, tab: WorkerProfileTab, isSuperAdmin: boolean): { text: string; kb: InlineKeyboard } {
    const textMap = { PERSONAL: WorkerEditMessages.tab1PersonalCard, JOB: WorkerEditMessages.tab2JobCard, FINANCE: WorkerEditMessages.tab3FinanceCard, DOCS: WorkerEditMessages.tab4DocsCard };
    const text = (textMap[tab] || WorkerEditMessages.tab1PersonalCard)(worker, isSuperAdmin);
    const kb = WorkerEditKeyboards.workerProfileTabsKeyboard(worker.id, tab, isSuperAdmin);
    return { text, kb };
  }

  async handlePickWorker(ctx: WorkforceModuleContext, workerId: string, tab: WorkerProfileTab = 'PERSONAL'): Promise<void> {
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
    const isSuper = this.isSuperAdmin(ctx);
    if (ctx.from) {
      this.editDrafts.set(String(ctx.from.id), { workerId: worker.id, workerCode: worker.code, workerName: worker.name, currentTab: tab, isSuperAdmin: isSuper });
    }
    const rawNatId = this.service.decryptFieldSafe(worker.nationalIdEncrypted || worker.passportNumberEncrypted);
    const workerView: WorkerCardView = {
      ...worker,
      nationalId: rawNatId,
      phone: this.service.decryptFieldSafe(worker.phoneEncrypted),
      emergencyPhone: this.service.decryptFieldSafe(worker.emergencyPhoneEncrypted),
      accountNumber: this.service.decryptFieldSafe(worker.accountNumberEncrypted),
    };
    const { text, kb } = this.renderTab(workerView, tab, isSuper);
    await this.replyOrEdit(ctx, text, kb);
  }

  async handleSwitchTab(ctx: WorkforceModuleContext, tab: WorkerProfileTab, workerId: string): Promise<void> {
    await this.handlePickWorker(ctx, workerId, tab);
  }

  async handleSelectField(ctx: WorkforceModuleContext, fieldShort: string, workerId: string): Promise<void> {
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
    const returnTab = getReturnTab(fieldShort);
    const fieldName = FIELD_LABELS[fieldKey];
    if (ctx.from) {
      this.editDrafts.set(String(ctx.from.id), {
        workerId: worker.id,
        workerCode: worker.code,
        workerName: worker.name,
        currentTab: returnTab,
        fieldKey,
        fieldName,
        isSuperAdmin: this.isSuperAdmin(ctx),
      });
    }
    const text = WorkerEditMessages.inputNewValuePrompt(fieldName);
    const kb = WorkerEditKeyboards.cancelEditKeyboard(workerId, returnTab);
    await this.replyOrEdit(ctx, text, kb);
  }

  async handleOpenPicker(ctx: WorkforceModuleContext, fieldShort: string, workerId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const fieldKey = FIELD_KEY_SHORT_MAP[fieldShort];
    const worker = await this.repository.findWorkerForEdit(workerId);
    if (!worker || !fieldKey) {
      await this.replyOrEdit(ctx, '⚠️ لم يتم العثور على العامل أو الحقل.');
      return;
    }
    const returnTab = getReturnTab(fieldShort);
    const fieldName = FIELD_LABELS[fieldKey];
    const text = `📋 *تحديد ${fieldName}*\n━━━━━━━━━━━━━━━━━━━━━\n• *العامل:* ${worker.name}\n━━━━━━━━━━━━━━━━━━━━━\nاختر القيمة المناسبة:`;
    const kb = WorkerEditKeyboards.discretePickerKeyboard(fieldShort, workerId, returnTab);
    await this.replyOrEdit(ctx, text, kb);
  }

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
    const superAdmin = this.isSuperAdmin(ctx);
    const actorId = ctx.from ? BigInt(ctx.from.id) : BigInt(0);

    if (superAdmin) {
      await this.service.applyDirectEdit(workerId, fieldKey, chosen.value, actorId);
    } else if (ctx.from) {
      const worker = await this.repository.findWorkerForEdit(workerId);
      if (worker) {
        await this.service.submitEditTicket({
          workerId,
          workerCode: worker.code,
          workerName: worker.name,
          requesterTelegramId: actorId,
          requesterName: ctx.from.first_name || 'مشرف موقع',
          requesterRole: ctx.effectiveRole || 'FIELD_ADMIN',
          fieldKey,
          fieldName: FIELD_LABELS[fieldKey],
          newValue: chosen.value,
        });
      }
    }
    await this.handlePickWorker(ctx, workerId, returnTab);
  }

  async handleCigaretteStart(ctx: WorkforceModuleContext, workerId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const worker = await this.repository.findWorkerForEdit(workerId);
    if (!worker) {
      await this.replyOrEdit(ctx, '⚠️ لم يتم العثور على العامل.');
      return;
    }
    const text = WorkerEditMessages.selectCigarettePolicyPrompt(worker.name, worker.canteenCigarettePolicy);
    const kb = WorkerEditKeyboards.cigarettePolicyKeyboard(workerId);
    await this.replyOrEdit(ctx, text, kb);
  }

  async handleCigaretteSelectPolicy(ctx: WorkforceModuleContext, pShort: string, workerId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const policy = POLICY_SHORT_TO_CODE[pShort] || pShort;
    const worker = await this.repository.findWorkerForEdit(workerId);
    if (!worker) {
      await this.replyOrEdit(ctx, '⚠️ لم يتم العثور على العامل.');
      return;
    }
    const actorId = ctx.from ? BigInt(ctx.from.id) : BigInt(0);
    if (policy === 'NONE') {
      await this.service.applyCigaretteAllocation(workerId, 'NONE', null, null, actorId);
      await this.handlePickWorker(ctx, workerId, 'FINANCE');
      return;
    }
    if (ctx.from) {
      this.editDrafts.set(String(ctx.from.id), {
        workerId,
        workerCode: worker.code,
        workerName: worker.name,
        selectedPolicy: policy,
        step: 'SELECT_BRAND',
        isSuperAdmin: this.isSuperAdmin(ctx),
      });
    }
    const items = await this.service.getCigaretteItems(worker.siteId || undefined);
    const text = WorkerEditMessages.selectCigaretteBrandPrompt(worker.name, policy);
    const kb = WorkerEditKeyboards.cigaretteBrandKeyboard(workerId, items);
    await this.replyOrEdit(ctx, text, kb);
  }

  async handleCigaretteSelectBrand(ctx: WorkforceModuleContext, idxStr: string, workerId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const worker = await this.repository.findWorkerForEdit(workerId);
    if (!worker) {
      await this.replyOrEdit(ctx, '⚠️ لم يتم العثور على العامل.');
      return;
    }
    const draft = ctx.from ? this.editDrafts.get(String(ctx.from.id)) : undefined;
    const policy = draft?.selectedPolicy || 'ONE_PACK_DAILY';
    const items = await this.service.getCigaretteItems(worker.siteId || undefined);
    const item = items[parseInt(idxStr, 10)];
    const actorId = ctx.from ? BigInt(ctx.from.id) : BigInt(0);
    if (item) {
      await this.service.applyCigaretteAllocation(workerId, policy, item.name, item.id, actorId);
    }
    if (ctx.from) this.editDrafts.delete(String(ctx.from.id));
    await this.handlePickWorker(ctx, workerId, 'FINANCE');
  }

  async handleTextInput(ctx: WorkforceModuleContext, rawText: string): Promise<void> {
    if (!ctx.from) return;
    const draft = this.editDrafts.get(String(ctx.from.id));
    if (!draft || !draft.fieldKey) return;

    await ctx.deleteMessage().catch(() => {});
    const cleanText = rawText.trim();
    const val = validateFieldValue(draft.fieldKey, cleanText);
    const returnTab = draft.currentTab || 'PERSONAL';

    if (!val.isValid || !val.cleanValue) {
      const errKb = WorkerEditKeyboards.cancelEditKeyboard(draft.workerId, returnTab);
      await this.replyOrEdit(ctx, `⚠️ ${val.error || 'القيمة المدخلة غير صالحة.'}`, errKb);
      return;
    }

    const telegramId = BigInt(ctx.from.id);
    const superAdmin = draft.isSuperAdmin;

    if (superAdmin) {
      const result = await this.service.applyDirectEdit(draft.workerId, draft.fieldKey, val.cleanValue, telegramId);
      this.editDrafts.delete(String(ctx.from.id));
      if (result.success) {
        const text = WorkerEditMessages.directEditSuccess({
          workerCode: result.workerCode || draft.workerCode,
          workerName: draft.workerName,
          fieldName: draft.fieldName || draft.fieldKey,
          newValue: val.cleanValue,
        });
        await this.replyOrEdit(ctx, text, WorkerEditKeyboards.directEditSuccessKeyboard(draft.workerId, returnTab));
      } else {
        const errKb = WorkerEditKeyboards.cancelEditKeyboard(draft.workerId, returnTab);
        await this.replyOrEdit(ctx, `❌ خطأ أثناء تطبيق التعديل: ${result.error}`, errKb);
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
        await this.replyOrEdit(ctx, text, WorkerEditKeyboards.directEditSuccessKeyboard(draft.workerId, returnTab));
      } else {
        const errKb = WorkerEditKeyboards.cancelEditKeyboard(draft.workerId, returnTab);
        await this.replyOrEdit(ctx, `❌ خطأ أثناء إرسال الطلب: ${result.error}`, errKb);
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
    await this.replyOrEdit(ctx, text, WorkerEditKeyboards.pendingTicketsListKeyboard(tickets));
  }

  async handleReviewTicket(ctx: WorkforceModuleContext, ticketId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const tickets = await this.service.listPendingTickets();
    const ticket = tickets.find((t) => t.requestId === ticketId);
    if (!ticket) {
      await this.replyOrEdit(ctx, '⚠️ لم يتم العثور على الطلب المطلوب أو تم البت فيه مسبقاً.');
      return;
    }
    await this.replyOrEdit(ctx, WorkerEditMessages.reviewTicketCard(ticket), WorkerEditKeyboards.ticketReviewKeyboard(ticket.requestId));
  }

  async handleApproveTicket(ctx: WorkforceModuleContext, ticketId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (!ctx.from) return;
    const result = await this.service.approveTicket(ticketId, BigInt(ctx.from.id));
    const msg = result.success
      ? `✅ تم اعتماد وتطبيق التعديل للطلب \`${ticketId}\` فورياً بنجاح.`
      : `❌ تعذر اعتماد الطلب: ${result.error}`;
    await this.replyOrEdit(ctx, msg);
  }

  async handleRejectTicket(ctx: WorkforceModuleContext, ticketId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (!ctx.from) return;
    const result = await this.service.rejectTicket(ticketId, BigInt(ctx.from.id));
    const msg = result.success
      ? `❌ تم رفض طلب التعديل \`${ticketId}\`.`
      : `❌ تعذر رفض الطلب: ${result.error}`;
    await this.replyOrEdit(ctx, msg);
  }

  async handleCancel(ctx: WorkforceModuleContext): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (ctx.from) this.editDrafts.delete(String(ctx.from.id));
    await this.replyOrEdit(ctx, '❌ تم إلغاء تعديل بيانات العامل.');
  }
}
