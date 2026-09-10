import type { Context, InlineKeyboard } from 'grammy';
import type { WorkforceModuleContext } from '../../shared/module.types.js';
import { normalizeDigits, parseFlexibleDate } from '@alsaada/regional-engine';
import { WorkerEditService } from './flow.service.js';
import { WorkerEditRepository } from './flow.repository.js';
import { WorkerEditMessages } from './flow.messages.js';
import { WorkerEditKeyboards } from './flow.keyboard.js';
import type { SalaryAdjustmentWizardState } from './flow.types.js';

export type ReplyOrEditFn = (ctx: Context, text: string, keyboard?: InlineKeyboard) => Promise<void>;
export type PickWorkerFn = (ctx: WorkforceModuleContext, workerId: string, tab?: 'PERSONAL' | 'JOB' | 'FINANCE' | 'DOCS') => Promise<void>;

export class WorkerSalaryWizardHandler {
  private readonly salaryWizardDrafts = new Map<string, SalaryAdjustmentWizardState>();

  constructor(
    private readonly service: WorkerEditService,
    private readonly repository: WorkerEditRepository,
    private readonly replyOrEdit: ReplyOrEditFn,
    private readonly pickWorker: PickWorkerFn
  ) {}

  hasSalaryDraft(userId: string): boolean {
    return this.salaryWizardDrafts.has(userId);
  }

  clearSalaryDraft(userId: string): void {
    this.salaryWizardDrafts.delete(userId);
  }

  async handleLaunchSalaryWizard(ctx: WorkforceModuleContext, workerId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const isSuper = ctx.isImpersonating ? ctx.effectiveRole === 'SUPER_ADMIN' : (ctx.effectiveRole === 'SUPER_ADMIN' || Boolean(ctx.isRealSuperAdmin));
    if (!isSuper) {
      await this.replyOrEdit(ctx, '⛔ تعديل الراتب مخصص حصرياً للمدير العام.');
      return;
    }
    const worker = await this.repository.findWorkerForEdit(workerId);
    if (!worker) {
      await this.replyOrEdit(ctx, '⚠️ لم يتم العثور على العامل.');
      return;
    }

    const currentBase = Number(worker.basicSalary || 0);
    const currentAdd = Number(worker.fixedAllowances || 0);
    const currentGross = currentBase + currentAdd;

    if (ctx.from) {
      this.salaryWizardDrafts.set(String(ctx.from.id), {
        workerId: worker.id,
        workerCode: worker.code,
        workerName: worker.name,
        currentBase,
        currentAdditional: currentAdd,
        currentAdd,
        currentGross,
        step: 'NEW_BASE',
      });
    }

    const text = WorkerEditMessages.salaryWizardStep1Basic(worker.name, currentBase);
    const kb = WorkerEditKeyboards.cancelEditKeyboard(workerId, 'FINANCE');
    await this.replyOrEdit(ctx, text, kb);
  }

  async handleSalaryEffectiveDate(ctx: WorkforceModuleContext, effOption: string, workerId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (!ctx.from) return;
    const draft = this.salaryWizardDrafts.get(String(ctx.from.id));
    if (!draft) {
      await this.pickWorker(ctx, workerId, 'FINANCE');
      return;
    }

    const now = new Date();
    if (effOption === 'CUR') {
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      draft.effectiveMonth = ym;
      draft.effectiveDate = new Date(now.getFullYear(), now.getMonth(), 1);
      draft.step = 'REASON';
      const label = `الشهر الجاري (${ym})`;
      const text = WorkerEditMessages.salaryWizardStep4Reason(draft.workerName, draft.newBase || 0, draft.newAdditional || 0, label);
      await this.replyOrEdit(ctx, text, WorkerEditKeyboards.cancelEditKeyboard(workerId, 'FINANCE'));
    } else if (effOption === 'NXT') {
      const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const ym = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
      draft.effectiveMonth = ym;
      draft.effectiveDate = nextMonthDate;
      draft.step = 'REASON';
      const label = `الشهر القادم (${ym})`;
      const text = WorkerEditMessages.salaryWizardStep4Reason(draft.workerName, draft.newBase || 0, draft.newAdditional || 0, label);
      await this.replyOrEdit(ctx, text, WorkerEditKeyboards.cancelEditKeyboard(workerId, 'FINANCE'));
    } else if (effOption === 'CST') {
      draft.step = 'EFFECTIVE_DATE';
      const text = `📅 *إدخال تاريخ سريان مخصص*\n━━━━━━━━━━━━━━━━━━━━━\n• *العامل:* ${draft.workerName}\n━━━━━━━━━━━━━━━━━━━━━\nيرجى إدخال تاريخ السريان بصيغة يوم-شهر-سنة (مثال: 01-10-2026):`;
      await this.replyOrEdit(ctx, text, WorkerEditKeyboards.cancelEditKeyboard(workerId, 'FINANCE'));
    }
  }

  async handleSalaryConfirm(ctx: WorkforceModuleContext, workerId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (!ctx.from) return;
    const draft = this.salaryWizardDrafts.get(String(ctx.from.id));
    if (!draft || draft.newBase === undefined || draft.newAdditional === undefined || !draft.effectiveDate || !draft.effectiveMonth) {
      await this.replyOrEdit(ctx, '⚠️ تعذر إتمام التعديل، بيانات المسودة غير مكتملة.');
      await this.pickWorker(ctx, workerId, 'FINANCE');
      return;
    }

    const actorId = BigInt(ctx.from.id);
    const actorName = ctx.from.first_name + (ctx.from.last_name ? ` ${ctx.from.last_name}` : '');

    const result = await this.service.applySalaryAdjustment({
      workerId: draft.workerId,
      newBase: draft.newBase,
      newAdd: draft.newAdditional,
      effectiveMonth: draft.effectiveMonth,
      effectiveDate: draft.effectiveDate,
      reason: draft.reason || 'قرار إداري معتمد',
      approvedByTelegramId: actorId,
      approvedByName: actorName,
    });

    this.salaryWizardDrafts.delete(String(ctx.from.id));

    if (result.success) {
      const text = WorkerEditMessages.salaryAdjustmentSuccess({
        workerCode: draft.workerCode,
        workerName: draft.workerName,
        newBase: draft.newBase,
        newAdd: draft.newAdditional,
        newGross: draft.newBase + draft.newAdditional,
        effectiveDateLabel: `${draft.effectiveMonth} (${draft.effectiveDate.toISOString().slice(0, 10)})`,
      });
      await this.replyOrEdit(ctx, text, WorkerEditKeyboards.directEditSuccessKeyboard(workerId, 'FINANCE'));
    } else {
      await this.replyOrEdit(ctx, `❌ تعذر قيد تعديل الراتب: ${result.error}`, WorkerEditKeyboards.cancelEditKeyboard(workerId, 'FINANCE'));
    }
  }

  async handleSalaryHistory(ctx: WorkforceModuleContext, workerId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const worker = await this.repository.findWorkerForEdit(workerId);
    if (!worker) {
      await this.replyOrEdit(ctx, '⚠️ لم يتم العثور على العامل.');
      return;
    }
    const records = await this.service.getSalaryHistory(workerId);
    const text = WorkerEditMessages.salaryHistoryTimeline(worker.name, worker.code, records);
    const kb = WorkerEditKeyboards.timelineBackKeyboard(workerId, 'FINANCE');
    await this.replyOrEdit(ctx, text, kb);
  }

  async handleWorkerChangeLog(ctx: WorkforceModuleContext, workerId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const worker = await this.repository.findWorkerForEdit(workerId);
    if (!worker) {
      await this.replyOrEdit(ctx, '⚠️ لم يتم العثور على العامل.');
      return;
    }
    const records = await this.service.getWorkerChangeLog(workerId);
    const text = WorkerEditMessages.workerChangeLogTimeline(worker.name, worker.code, records);
    const kb = WorkerEditKeyboards.timelineBackKeyboard(workerId, 'FINANCE');
    await this.replyOrEdit(ctx, text, kb);
  }

  async handleSalaryWizardTextInput(ctx: WorkforceModuleContext, rawText: string): Promise<boolean> {
    if (!ctx.from) return false;
    const uid = String(ctx.from.id);
    const salDraft = this.salaryWizardDrafts.get(uid);
    if (!salDraft) return false;

    await ctx.deleteMessage().catch(() => {});
    const clean = rawText.trim();

    if (salDraft.step === 'NEW_BASE') {
      const digits = normalizeDigits(clean.replace(/,/g, ''));
      const val = parseFloat(digits);
      if (isNaN(val) || val <= 0) {
        await this.replyOrEdit(ctx, '⚠️ يرجى إدخال قيمة عددية صحيحة أكبر من الصفر للراتب الأساسي.', WorkerEditKeyboards.cancelEditKeyboard(salDraft.workerId, 'FINANCE'));
        return true;
      }
      salDraft.newBase = val;
      salDraft.step = 'NEW_ADDITIONAL';
      const text = WorkerEditMessages.salaryWizardStep2Additional(salDraft.workerName, val, salDraft.currentAdd);
      await this.replyOrEdit(ctx, text, WorkerEditKeyboards.cancelEditKeyboard(salDraft.workerId, 'FINANCE'));
      return true;
    }

    if (salDraft.step === 'NEW_ADDITIONAL') {
      const digits = normalizeDigits(clean.replace(/,/g, ''));
      const val = parseFloat(digits);
      if (isNaN(val) || val < 0) {
        await this.replyOrEdit(ctx, '⚠️ يرجى إدخال قيمة عددية أكبر من أو تساوي الصفر للراتب الإضافي.', WorkerEditKeyboards.cancelEditKeyboard(salDraft.workerId, 'FINANCE'));
        return true;
      }
      salDraft.newAdditional = val;
      salDraft.step = 'EFFECTIVE_DATE';
      const text = WorkerEditMessages.salaryWizardStep3EffectiveDate(salDraft.workerName, salDraft.newBase || 0, val);
      await this.replyOrEdit(ctx, text, WorkerEditKeyboards.salaryEffectiveDateKeyboard(salDraft.workerId));
      return true;
    }

    if (salDraft.step === 'EFFECTIVE_DATE') {
      const parsed = parseFlexibleDate(clean);
      if (!parsed.isValid || !parsed.date) {
        await this.replyOrEdit(ctx, '⚠️ صيغة التاريخ غير صالحة. يرجى إدخال التاريخ بصيغة يوم-شهر-سنة (مثال: 01-10-2026):', WorkerEditKeyboards.cancelEditKeyboard(salDraft.workerId, 'FINANCE'));
        return true;
      }
      salDraft.effectiveDate = parsed.date;
      salDraft.effectiveMonth = `${parsed.date.getFullYear()}-${String(parsed.date.getMonth() + 1).padStart(2, '0')}`;
      salDraft.step = 'REASON';
      const label = `${salDraft.effectiveMonth} (${clean})`;
      const text = WorkerEditMessages.salaryWizardStep4Reason(salDraft.workerName, salDraft.newBase || 0, salDraft.newAdditional || 0, label);
      await this.replyOrEdit(ctx, text, WorkerEditKeyboards.cancelEditKeyboard(salDraft.workerId, 'FINANCE'));
      return true;
    }

    if (salDraft.step === 'REASON') {
      salDraft.reason = clean;
      salDraft.step = 'CONFIRM';
      const label = `${salDraft.effectiveMonth} (${salDraft.effectiveDate ? salDraft.effectiveDate.toISOString().slice(0, 10) : ''})`;
      const text = WorkerEditMessages.salaryWizardConfirmCard({
        workerName: salDraft.workerName,
        workerCode: salDraft.workerCode,
        currentBase: salDraft.currentBase,
        currentAdd: salDraft.currentAdd,
        currentGross: salDraft.currentGross,
        newBase: salDraft.newBase || 0,
        newAdd: salDraft.newAdditional || 0,
        newGross: (salDraft.newBase || 0) + (salDraft.newAdditional || 0),
        effectiveDateLabel: label,
        reason: clean,
      });
      await this.replyOrEdit(ctx, text, WorkerEditKeyboards.salaryConfirmKeyboard(salDraft.workerId));
      return true;
    }

    return true;
  }
}
