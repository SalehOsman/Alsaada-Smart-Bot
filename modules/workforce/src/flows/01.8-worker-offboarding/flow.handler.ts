import type { Bot } from 'grammy';
import type { WorkforceModuleContext } from '../../shared/module.types.js';
import type { WorkerOffboardingService } from './flow.service.js';
import type {
  TerminationReason,
  WorkerOffboardingState,
  OffboardStep,
  ClearancePayoutOption,
  NegativeBalanceAction,
} from './flow.types.js';
import {
  buildWorkerPickerKeyboard,
  buildSuperAdminHubKeyboard,
  buildDisciplinaryRadarKeyboard,
  buildPPEAuditKeyboard,
  buildSuccessKeyboard,
} from './flow.keyboard.js';
import {
  formatHubMenuHeader,
  formatWorkerSelectHeader,
  formatPPEDamagePhotoPrompt,
} from './flow.messages.js';
import {
  handlePendingDecisionsList,
  handleSettleDecision,
  handlePendingClearancesList,
} from './flow.inbox-handler.js';
import {
  executeClearanceFinalization,
  executeFieldReportSubmission,
  renderConfirmationSlip,
} from './flow.actions.js';
import {
  renderReasonStep,
  renderWorkedDaysStep,
  renderPayoutOptionStep,
  processPhotoInput,
  processWorkedDaysSelection,
  handleBackStep,
} from './flow.steps.js';
import { validateTerminationReason } from './flow.validators.js';

export class WorkerOffboardingHandler {
  private activeStates = new Map<string, WorkerOffboardingState>();

  constructor(private readonly service: WorkerOffboardingService) {}

  registerRoutes(bot: Bot<WorkforceModuleContext>): void {
    bot.callbackQuery('wizard:worker_offboard:start', async (ctx) => {
      await this.handleStartOffboarding(ctx);
    });
    bot.callbackQuery('action:wob:hub:new', async (ctx) => {
      await this.handleStartWorkerSelect(ctx);
    });
    bot.callbackQuery('action:wob:hub:pending_clearance', async (ctx) => {
      await handlePendingClearancesList(ctx, this.service, (c, t, k) => this.renderWizardStep(c, t, k));
    });
    bot.callbackQuery('action:wob:hub:pending_decisions', async (ctx) => {
      await handlePendingDecisionsList(ctx, this.service, (c, t, k) => this.renderWizardStep(c, t, k));
    });
    bot.callbackQuery(/^action:wob:pick:(.+)$/, async (ctx) => {
      if (ctx.match[1]) await this.handlePickWorker(ctx, ctx.match[1]);
    });
    bot.callbackQuery(/^action:wob:radar:(approve_all|reject_all|defer|custom)$/, async (ctx) => {
      await this.handleDisciplinaryRadarChoice(ctx, ctx.match[1] as 'approve_all' | 'reject_all' | 'defer' | 'custom');
    });
    bot.callbackQuery(/^action:wob:r:(.+)$/, async (ctx) => {
      if (ctx.match[1]) await this.handleSelectReason(ctx, ctx.match[1]);
    });
    bot.callbackQuery(/^action:wob:ppe:(clean|damage|photo)$/, async (ctx) => {
      await this.handlePPEAuditChoice(ctx, ctx.match[1] as 'clean' | 'damage' | 'photo');
    });
    bot.callbackQuery(/^action:wob:days:(\d+)$/, async (ctx) => {
      await this.handleWorkedDaysSelect(ctx, parseInt(ctx.match[1] || '0', 10));
    });
    bot.callbackQuery(/^action:wob:payout:(immediate|payroll)$/, async (ctx) => {
      await this.handlePayoutOptionSelect(ctx, ctx.match[1] === 'immediate' ? 'IMMEDIATE' : 'WITH_PAYROLL');
    });
    bot.callbackQuery(/^action:wob:neg:(write_off|blacklist)$/, async (ctx) => {
      await this.handleNegativeBalanceSelect(ctx, ctx.match[1] === 'write_off' ? 'WRITTEN_OFF' : 'BLACKLISTED');
    });
    bot.callbackQuery('action:wob:confirm', async (ctx) => {
      await this.handleConfirmOffboard(ctx);
    });
    bot.callbackQuery('action:wob:field:submit', async (ctx) => {
      await this.handleFieldReportSubmit(ctx);
    });
    bot.callbackQuery(/^action:wob:dec:(approve|reject):(.+)$/, async (ctx) => {
      const act = ctx.match[1] === 'approve' ? 'APPROVE' : 'REJECT';
      if (ctx.match[2]) {
        await handleSettleDecision(ctx, ctx.match[2], act, this.service, (c) =>
          handlePendingDecisionsList(c, this.service, (ci, t, k) => this.renderWizardStep(ci, t, k))
        );
      }
    });
    bot.callbackQuery('action:wob:back', async (ctx) => {
      await this.handleBack(ctx);
    });
    bot.callbackQuery('action:wob:cancel', async (ctx) => {
      await this.handleCancel(ctx);
    });
  }

  async handleStartOffboarding(ctx: WorkforceModuleContext): Promise<void> {
    if (!ctx.from) return;
    const role = ctx.effectiveRole || 'GUEST';
    if (!['SUPER_ADMIN', 'FIELD_ADMIN', 'GENERAL_ADMIN', 'ACCOUNTANT'].includes(role)) {
      if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: '🔒 غير مصرح لك بإنهاء خدمة العاملين.', show_alert: true }).catch(() => {});
      return;
    }
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (role === 'SUPER_ADMIN') {
      const [clearances, decisions] = await Promise.all([
        this.service.getPendingClearanceReports().catch(() => []),
        this.service.getPendingDisciplinaryDecisions().catch(() => []),
      ]);
      await this.renderWizardStep(ctx, formatHubMenuHeader(clearances.length, decisions.length), buildSuperAdminHubKeyboard(clearances.length, decisions.length));
      return;
    }
    await this.handleStartWorkerSelect(ctx);
  }

  async handleStartWorkerSelect(ctx: WorkforceModuleContext): Promise<void> {
    if (!ctx.from) return;
    const role = ctx.effectiveRole || 'GUEST';
    const siteId = role === 'FIELD_ADMIN' ? ctx.assignedSiteId || undefined : undefined;
    const workers = await this.service.getActiveWorkers(siteId);
    if (!workers.length) {
      const msg = 'ℹ️ لا يوجد عمالة نشطة متاحة في نطاقك الميداني حالياً لإجراء المخالصة.';
      if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: msg, show_alert: true }).catch(() => {});
      else await ctx.reply(msg);
      return;
    }
    const state: WorkerOffboardingState = { step: 'WORKER_SELECT', createdAt: Date.now(), backStack: ['INIT'] };
    this.activeStates.set(BigInt(ctx.from.id).toString(), state);
    const kb = buildWorkerPickerKeyboard(workers.map((w) => ({ id: w.id, name: w.nickname || w.name, code: w.code, nickname: w.nickname, jobTitle: w.jobTitle || undefined, siteName: w.site?.name })));
    await this.renderWizardStep(ctx, formatWorkerSelectHeader(), kb);
  }

  async handlePickWorker(ctx: WorkforceModuleContext, workerId: string): Promise<void> {
    if (!ctx.from) return;
    const uid = BigInt(ctx.from.id).toString();
    const role = ctx.effectiveRole || 'GUEST';
    const state = this.activeStates.get(uid) || { step: 'WORKER_SELECT', createdAt: Date.now(), backStack: ['INIT'] };
    const profile = await this.service.getWorkerClearanceProfile(workerId, role);
    if (!profile) {
      if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: '❌ تعذر العثور على سجل العامل.', show_alert: true }).catch(() => {});
      return;
    }
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    state.workerId = profile.worker.id;
    state.workerCode = profile.worker.code;
    state.workerName = profile.worker.nickname || profile.worker.name;
    state.workerTelegramId = profile.worker.telegramId;
    state.jobTitle = profile.worker.jobTitle || undefined;
    state.siteName = profile.worker.siteName || undefined;
    state.siteId = profile.worker.siteId || undefined;
    state.dailyRate = profile.worker.dailyWage || undefined;
    state.profile = profile;
    this.pushStep(state, 'WORKER_SELECT');

    if (role === 'SUPER_ADMIN' && Boolean(profile.pendingDisciplinaryRecords?.length)) {
      state.step = 'PENDING_RADAR';
      this.activeStates.set(uid, state);
      const text = `⚖️ *رادار القرارات والجزاءات المعلقة*\n────────────────────────────\nالعامل: *${state.workerName}* (كود: \`${state.workerCode}\`)\nيوجد *${profile.pendingDisciplinaryRecords.length}* قرار معلق لم يتم اعتماده.\n\nاختر الإجراء الإداري:`;
      await this.renderWizardStep(ctx, text, buildDisciplinaryRadarKeyboard(true, { isSuperAdmin: true }));
      return;
    }
    await renderReasonStep(ctx, state, (c, t, k) => this.renderWizardStep(c, t, k));
  }

  async handleDisciplinaryRadarChoice(ctx: WorkforceModuleContext, action: 'approve_all' | 'reject_all' | 'defer' | 'custom'): Promise<void> {
    if (!ctx.from) return;
    const state = this.activeStates.get(BigInt(ctx.from.id).toString());
    if (!state?.workerId) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    state.selectedDisciplinaryAction = action === 'approve_all' ? 'APPROVE_ALL' : action === 'reject_all' ? 'REJECT_ALL' : action === 'defer' ? 'DEFER' : 'CUSTOM';
    this.pushStep(state, 'PENDING_RADAR');
    await renderReasonStep(ctx, state, (c, t, k) => this.renderWizardStep(c, t, k));
  }

  async handleSelectReason(ctx: WorkforceModuleContext, reasonStr: string): Promise<void> {
    if (!ctx.from) return;
    const uid = BigInt(ctx.from.id).toString();
    const state = this.activeStates.get(uid);
    if (!state?.workerId || !validateTerminationReason(reasonStr)) {
      if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: '⚠️ سبب غير صالح.', show_alert: true }).catch(() => {});
      return;
    }
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    state.reason = reasonStr as TerminationReason;
    this.pushStep(state, 'TERMINATION_REASON');
    state.step = 'PPE_AUDIT';
    this.activeStates.set(uid, state);
    const hasAssets = Boolean(state.profile?.ppeAssets?.length);
    const text = `🦺 *فحص عهد ومهمات الوقاية*\n────────────────────────────\nالعامل: *${state.workerName}*\nعدد العهد المسجلة: *${state.profile?.ppeAssets?.length || 0}* عهدة.\n\nاختر موقف استرداد العهد الميداني:`;
    await this.renderWizardStep(ctx, text, buildPPEAuditKeyboard(hasAssets));
  }

  async handlePPEAuditChoice(ctx: WorkforceModuleContext, choice: 'clean' | 'damage' | 'photo'): Promise<void> {
    if (!ctx.from) return;
    const state = this.activeStates.get(BigInt(ctx.from.id).toString());
    if (!state) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (choice === 'photo') {
      state.step = 'PPE_PHOTO_UPLOAD';
      this.activeStates.set(BigInt(ctx.from.id).toString(), state);
      await this.renderWizardStep(ctx, formatPPEDamagePhotoPrompt(state.workerName || 'العامل'));
      return;
    }
    state.ppeObservations = choice === 'clean' ? 'تم استرداد كافة العهد بحالة سليمة.' : 'يوجد تلفيات أو فقدان في مهمات الوقاية.';
    state.ppeDeductions = choice === 'clean' ? 0 : 250;
    this.pushStep(state, 'PPE_AUDIT');
    await renderWorkedDaysStep(ctx, state, (c, t, k) => this.renderWizardStep(c, t, k));
  }

  async handleWorkedDaysSelect(ctx: WorkforceModuleContext, days: number): Promise<void> {
    if (!ctx.from) return;
    const uid = BigInt(ctx.from.id).toString();
    const state = this.activeStates.get(uid);
    if (!state?.workerId) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    state.workedDays = days;
    this.pushStep(state, 'WORKED_DAYS');
    await processWorkedDaysSelection(ctx, state, this.service, (c, t, k) => this.renderWizardStep(c, t, k));
  }

  async handleNegativeBalanceSelect(ctx: WorkforceModuleContext, action: NegativeBalanceAction): Promise<void> {
    if (!ctx.from) return;
    const state = this.activeStates.get(BigInt(ctx.from.id).toString());
    if (!state) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    state.negativeBalanceAction = action;
    this.pushStep(state, 'NEGATIVE_BALANCE_RADAR');
    await renderPayoutOptionStep(ctx, state, (c, t, k) => this.renderWizardStep(c, t, k));
  }

  async handlePayoutOptionSelect(ctx: WorkforceModuleContext, option: ClearancePayoutOption): Promise<void> {
    if (!ctx.from) return;
    const uid = BigInt(ctx.from.id).toString();
    const state = this.activeStates.get(uid);
    if (!state?.financialBreakdown) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const hasPending = Boolean(state.profile?.pendingDisciplinaryRecords?.length);
    state.payoutOption = hasPending ? 'WITH_PAYROLL' : option;
    this.pushStep(state, 'PAYOUT_OPTION');
    state.step = 'CONFIRMATION';
    this.activeStates.set(uid, state);
    const { cardText, keyboard } = renderConfirmationSlip(state);
    await this.renderWizardStep(ctx, cardText, keyboard);
  }

  async handleConfirmOffboard(ctx: WorkforceModuleContext): Promise<void> {
    if (!ctx.from) return;
    const uid = BigInt(ctx.from.id).toString();
    const state = this.activeStates.get(uid);
    if (!state) return;
    await executeClearanceFinalization(ctx, state, this.service, (c, t, k) => this.renderWizardStep(c, t, k));
    this.activeStates.delete(uid);
  }

  async handleFieldReportSubmit(ctx: WorkforceModuleContext): Promise<void> {
    if (!ctx.from) return;
    const uid = BigInt(ctx.from.id).toString();
    const state = this.activeStates.get(uid);
    if (!state) return;
    await executeFieldReportSubmission(ctx, state, this.service, (c, t, k) => this.renderWizardStep(c, t, k));
    this.activeStates.delete(uid);
  }

  isWaitingForPhoto(uid: string): boolean {
    return this.activeStates.get(uid)?.step === 'PPE_PHOTO_UPLOAD';
  }

  async handlePhotoInput(ctx: WorkforceModuleContext, fileId: string): Promise<void> {
    if (!ctx.from) return;
    const uid = BigInt(ctx.from.id).toString();
    const state = this.activeStates.get(uid);
    if (state?.step !== 'PPE_PHOTO_UPLOAD') return;
    await processPhotoInput(ctx, fileId, state);
    await ctx.reply('✅ تم حفظ صورة العهد التالفة بنجاح.');
    this.pushStep(state, 'PPE_PHOTO_UPLOAD');
    await renderWorkedDaysStep(ctx, state, (c, t, k) => this.renderWizardStep(c, t, k));
  }

  isWaitingForText(uid: string): boolean {
    return this.activeStates.get(uid)?.step === 'WORKED_DAYS';
  }

  async handleTextInput(ctx: WorkforceModuleContext, text: string): Promise<void> {
    if (!ctx.from) return;
    const state = this.activeStates.get(BigInt(ctx.from.id).toString());
    if (state?.step !== 'WORKED_DAYS') return;
    const days = parseInt(text.trim(), 10);
    if (!isNaN(days) && days >= 0 && days <= 31) await this.handleWorkedDaysSelect(ctx, days);
    else await ctx.reply('⚠️ يرجى إدخال عدد أيام صحيح بين 0 و 31.');
  }

  private pushStep(state: WorkerOffboardingState, step: OffboardStep): void {
    if (!state.backStack) state.backStack = [];
    state.backStack.push(step);
  }

  async handleBack(ctx: WorkforceModuleContext): Promise<void> {
    if (!ctx.from) return;
    const state = this.activeStates.get(BigInt(ctx.from.id).toString());
    if (!state || !state.backStack?.length) {
      await this.handleCancel(ctx);
      return;
    }
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    await handleBackStep(
      ctx,
      state,
      (c, t, k) => this.renderWizardStep(c, t, k),
      (c) => this.handleStartOffboarding(c),
      (c) => this.handleStartWorkerSelect(c)
    );
  }

  async handleCancel(ctx: WorkforceModuleContext): Promise<void> {
    if (!ctx.from) return;
    this.activeStates.delete(BigInt(ctx.from.id).toString());
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: '❌ تم إلغاء المخالصة' }).catch(() => {});
    await this.renderWizardStep(ctx, '❌ *تم إلغاء إجراءات إنهاء الخدمة والمخالصة.*', buildSuccessKeyboard());
  }

  private async renderWizardStep(ctx: WorkforceModuleContext, text: string, keyboard?: unknown): Promise<void> {
    const extra = keyboard ? { parse_mode: 'Markdown' as const, reply_markup: keyboard as ReturnType<typeof buildSuccessKeyboard> } : { parse_mode: 'Markdown' as const };
    if (ctx.callbackQuery?.message) {
      try {
        await ctx.editMessageText(text, extra);
        return;
      } catch {}
    }
    await ctx.reply(text, extra);
  }

  getActiveState(telegramId: bigint): WorkerOffboardingState | undefined {
    return this.activeStates.get(telegramId.toString());
  }

  setActiveState(telegramId: bigint, state: WorkerOffboardingState): void {
    this.activeStates.set(telegramId.toString(), state);
  }
}
