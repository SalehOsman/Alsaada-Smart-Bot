import type { Context, InlineKeyboard } from 'grammy';
import type { WorkforceModuleContext } from '../../shared/module.types.js';
import { WorkerEditService } from './flow.service.js';
import { WorkerEditRepository } from './flow.repository.js';
import { WorkerEditMessages, CONTRACT_TYPE_LABELS } from './flow.messages.js';
import { WorkerEditKeyboards } from './flow.keyboard.js';
import { FIELD_KEY_SHORT_MAP, FIELD_LABELS, getReturnTab } from './flow.validators.js';
import type { PendingWorkerEditState, WorkerProfileTab, WorkerCardView } from './flow.types.js';
import { EGYPTIAN_GOVERNORATES } from '@alsaada/national-id-engine';
import { WorkerSalaryWizardHandler } from './flow.salary-wizard.js';
import { WorkerTicketHandler } from './flow.ticket-handler.js';
import { WorkerCigaretteHandler } from './flow.cigarette-handler.js';
import { WorkerEntityPickersHandler } from './flow.entity-pickers.js';
import { WorkerFieldInputHandler } from './flow.field-input.js';
import { WorkerEditDraftStore, type MinimalRedisDraftClient } from './flow.draft-store.js';

export class WorkerEditHandler {
  readonly draftStore: WorkerEditDraftStore;
  readonly salaryWizard: WorkerSalaryWizardHandler;
  readonly cigaretteHandler: WorkerCigaretteHandler;
  readonly ticketHandler: WorkerTicketHandler;
  readonly entityPickersHandler: WorkerEntityPickersHandler;
  readonly fieldInputHandler: WorkerFieldInputHandler;

  hasActiveDraft(userId: string): boolean {
    const editDraft = this.draftStore.get(userId);
    const hasFieldEdit = Boolean(editDraft && editDraft.fieldKey);
    return hasFieldEdit || this.salaryWizard.hasSalaryDraft(userId);
  }

  clearDraft(userId: string): void {
    this.draftStore.delete(userId);
    this.salaryWizard.clearSalaryDraft(userId);
  }

  constructor(
    private readonly service: WorkerEditService,
    private readonly repository: WorkerEditRepository,
    redisOrDraftStore?: WorkerEditDraftStore | MinimalRedisDraftClient
  ) {
    this.draftStore =
      redisOrDraftStore instanceof WorkerEditDraftStore
        ? redisOrDraftStore
        : new WorkerEditDraftStore(redisOrDraftStore);

    const r = async (c: Context, t: string, k?: InlineKeyboard): Promise<void> => {
      await this.replyOrEdit(c, t, k);
    };
    const p = (c: WorkforceModuleContext, i: string, b?: WorkerProfileTab) => this.handlePickWorker(c, i, b);
    const sa = (c: WorkforceModuleContext) => this.isSuperAdmin(c);

    this.salaryWizard = new WorkerSalaryWizardHandler(service, repository, r, p);
    this.cigaretteHandler = new WorkerCigaretteHandler(service, repository, r, p, this.draftStore, sa);
    this.ticketHandler = new WorkerTicketHandler(service, r, sa);
    this.entityPickersHandler = new WorkerEntityPickersHandler(service, r, p, sa);
    this.fieldInputHandler = new WorkerFieldInputHandler(service, repository, r, p, sa, this.salaryWizard, this.draftStore);
  }

  private checkRbac(ctx: WorkforceModuleContext): boolean {
    const role = ctx.effectiveRole || 'GUEST';
    return !['WORKER', 'SUPPLIER', 'GUEST'].includes(role);
  }

  private isSuperAdmin(ctx: WorkforceModuleContext): boolean {
    return ctx.isImpersonating ? ctx.effectiveRole === 'SUPER_ADMIN' : (ctx.effectiveRole === 'SUPER_ADMIN' || Boolean(ctx.isRealSuperAdmin));
  }

  private async replyOrEdit(ctx: Context, text: string, keyboard?: InlineKeyboard): Promise<number | undefined> {
    const opts = { parse_mode: 'Markdown' as const, ...(keyboard ? { reply_markup: keyboard } : {}) };
    if (ctx.callbackQuery?.message) {
      try {
        const res = await ctx.editMessageText(text, opts);
        if (typeof res === 'object' && res && 'message_id' in res) {
          return res.message_id;
        }
        return ctx.callbackQuery.message.message_id;
      } catch {
        // Fallback to regular reply if in-place edit fails
      }
    }
    const sent = await ctx.reply(text, opts);
    return sent.message_id;
  }


  private renderTab(worker: WorkerCardView, tab: WorkerProfileTab, isSuperAdmin: boolean): { text: string; kb: InlineKeyboard } {
    const textMap = {
      PERSONAL: WorkerEditMessages.tab1PersonalCard,
      JOB: WorkerEditMessages.tab2JobCard,
      FINANCE: WorkerEditMessages.tab3FinanceCard,
      DOCS: WorkerEditMessages.tab4DocsCard,
    };
    const text = (textMap[tab] || WorkerEditMessages.tab1PersonalCard)(worker, isSuperAdmin);
    const kb = WorkerEditKeyboards.workerProfileTabsKeyboard(worker.id, tab, isSuperAdmin, worker);
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
    let activeTab = tab;
    if (activeTab === 'FINANCE' && !isSuper) {
      activeTab = 'PERSONAL';
    }
    if (ctx.from) {
      this.draftStore.set(String(ctx.from.id), {
        workerId: worker.id,
        workerCode: worker.code,
        workerName: worker.name,
        currentTab: activeTab,
        isSuperAdmin: isSuper,
      });
    }

    const rawNatId = this.service.decryptFieldSafe(worker.nationalIdEncrypted || worker.passportNumberEncrypted);
    const govName = worker.governorateCode ? (EGYPTIAN_GOVERNORATES[worker.governorateCode]?.nameAr || worker.governorateCode) : null;
    const contractTypeAr = worker.contractType ? (CONTRACT_TYPE_LABELS[worker.contractType] || worker.contractType) : null;

    const workerView: WorkerCardView = {
      ...worker,
      nationalId: rawNatId || null,
      governorateName: govName,
      contractTypeAr,
      phone: this.service.decryptFieldSafe(worker.phoneEncrypted) || null,
      emergencyPhone: this.service.decryptFieldSafe(worker.emergencyPhoneEncrypted) || null,
      accountNumber: this.service.decryptFieldSafe(worker.accountNumberEncrypted) || null,
    };

    const { text, kb } = this.renderTab(workerView, activeTab, isSuper);
    await this.replyOrEdit(ctx, text, kb);
  }

  async handleSwitchTab(ctx: WorkforceModuleContext, tab: WorkerProfileTab, workerId: string): Promise<void> {
    await this.handlePickWorker(ctx, workerId, tab);
  }

  async handleSelectField(ctx: WorkforceModuleContext, fieldShort: string, workerId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const returnTab = getReturnTab(fieldShort);
    if (returnTab === 'FINANCE' && !this.isSuperAdmin(ctx)) {
      await this.replyOrEdit(ctx, '⛔ تعديل البيانات المالية مخصص حصرياً للمدير العام.');
      return;
    }
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
      this.draftStore.set(String(ctx.from.id), {
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
    const promptMsgId = await this.replyOrEdit(ctx, text, kb);
    if (ctx.from && promptMsgId) {
      const currentDraft = this.draftStore.get(String(ctx.from.id));
      if (currentDraft) {
        currentDraft.promptMsgId = promptMsgId;
      }
    }
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
    return this.fieldInputHandler.handleSelectPickerValue(ctx, fieldShort, optIdxStr, workerId);
  }


  // ═══════════════════════════════════════════════════════════════
  // 💼 Entity Pickers: Job Titles, Sites, Departments
  // ═══════════════════════════════════════════════════════════════

  async handleOpenJobPicker(ctx: WorkforceModuleContext, workerId: string): Promise<void> {
    return this.entityPickersHandler.handleOpenJobPicker(ctx, workerId);
  }

  async handleSetJob(ctx: WorkforceModuleContext, jobId: string, workerId: string): Promise<void> {
    return this.entityPickersHandler.handleSetJob(ctx, jobId, workerId);
  }

  async handleOpenSitePicker(ctx: WorkforceModuleContext, workerId: string): Promise<void> {
    return this.entityPickersHandler.handleOpenSitePicker(ctx, workerId);
  }

  async handleSetSite(ctx: WorkforceModuleContext, siteId: string, workerId: string): Promise<void> {
    return this.entityPickersHandler.handleSetSite(ctx, siteId, workerId);
  }

  async handleOpenDeptPicker(ctx: WorkforceModuleContext, workerId: string): Promise<void> {
    return this.entityPickersHandler.handleOpenDeptPicker(ctx, workerId);
  }

  async handleSetDept(ctx: WorkforceModuleContext, deptId: string, workerId: string): Promise<void> {
    return this.entityPickersHandler.handleSetDept(ctx, deptId, workerId);
  }

  // ═══════════════════════════════════════════════════════════════
  // 💰 معالج تعديل الراتب المتزامن (Salary Adjustment Wizard)
  // ═══════════════════════════════════════════════════════════════

  async handleSalaryWizardStart(ctx: WorkforceModuleContext, workerId: string): Promise<void> {
    return this.salaryWizard.handleLaunchSalaryWizard(ctx, workerId);
  }

  async handleSalaryEffectiveDate(ctx: WorkforceModuleContext, effOption: string, workerId: string): Promise<void> {
    return this.salaryWizard.handleSalaryEffectiveDate(ctx, effOption, workerId);
  }

  async handleSalaryConfirm(ctx: WorkforceModuleContext, workerId: string): Promise<void> {
    return this.salaryWizard.handleSalaryConfirm(ctx, workerId);
  }

  async handleSalaryHistory(ctx: WorkforceModuleContext, workerId: string): Promise<void> {
    return this.salaryWizard.handleSalaryHistory(ctx, workerId);
  }

  async handleWorkerChangeLog(ctx: WorkforceModuleContext, workerId: string): Promise<void> {
    return this.salaryWizard.handleWorkerChangeLog(ctx, workerId);
  }

  // ═══════════════════════════════════════════════════════════════
  // 🚬 سياسة ومخصص السجائر
  // ═══════════════════════════════════════════════════════════════

  async handleCigaretteStart(ctx: WorkforceModuleContext, workerId: string): Promise<void> {
    return this.cigaretteHandler.handleCigaretteStart(ctx, workerId);
  }

  async handleCigaretteSelectPolicy(ctx: WorkforceModuleContext, pShort: string, workerId: string): Promise<void> {
    return this.cigaretteHandler.handleCigaretteSelectPolicy(ctx, pShort, workerId);
  }

  async handleCigaretteSelectBrand(ctx: WorkforceModuleContext, idxStr: string, workerId: string): Promise<void> {
    return this.cigaretteHandler.handleCigaretteSelectBrand(ctx, idxStr, workerId);
  }

  // ═══════════════════════════════════════════════════════════════
  // 📝 معالجة المدخلات النصية
  // ═══════════════════════════════════════════════════════════════

  async handleTextInput(ctx: WorkforceModuleContext, rawText: string): Promise<void> {
    return this.fieldInputHandler.handleTextInput(ctx, rawText);
  }


  async handlePendingTicketsList(ctx: WorkforceModuleContext): Promise<void> {
    return this.ticketHandler.handlePendingTicketsList(ctx);
  }

  async handleReviewTicket(ctx: WorkforceModuleContext, ticketId: string): Promise<void> {
    return this.ticketHandler.handleReviewTicket(ctx, ticketId);
  }

  async handleApproveTicket(ctx: WorkforceModuleContext, ticketId: string): Promise<void> {
    return this.ticketHandler.handleApproveTicket(ctx, ticketId);
  }

  async handleRejectTicket(ctx: WorkforceModuleContext, ticketId: string): Promise<void> {
    return this.ticketHandler.handleRejectTicket(ctx, ticketId);
  }

  async handleCancel(ctx: WorkforceModuleContext): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (ctx.from) this.clearDraft(String(ctx.from.id));
    await this.replyOrEdit(ctx, '❌ تم إلغاء التعديل.');
  }
}

