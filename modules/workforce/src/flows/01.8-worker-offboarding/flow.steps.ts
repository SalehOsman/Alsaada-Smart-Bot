import type { WorkforceModuleContext } from '../../shared/module.types.js';
import type { WorkerOffboardingService } from './flow.service.js';
import type {
  WorkerOffboardingState,
  OffboardStep,
  ClearancePayoutOption,
  ClearanceProfile,
} from './flow.types.js';
import {
  formatReasonSelectHeader,
  formatPPEDamagePhotoPrompt,
  formatPayoutOptionPrompt,
  formatFieldAdminReviewCard,
  formatNegativeBalanceAlertCard,
} from './flow.messages.js';
import {
  buildReasonKeyboard,
  buildWorkedDaysKeyboard,
  buildPPEAuditKeyboard,
  buildPayoutOptionKeyboard,
  buildNegativeBalanceKeyboard,
  buildConfirmKeyboard,
  buildSuccessKeyboard,
} from './flow.keyboard.js';
import { UniversalAttachmentPipeline } from '@alsaada/core-components';

export async function renderReasonStep(
  ctx: WorkforceModuleContext,
  state: WorkerOffboardingState,
  renderStep: (ctx: WorkforceModuleContext, text: string, keyboard?: unknown) => Promise<void>
): Promise<void> {
  state.step = 'TERMINATION_REASON';
  await renderStep(
    ctx,
    formatReasonSelectHeader(state.workerName || 'العامل', state.workerCode || ''),
    buildReasonKeyboard({ includeBack: true })
  );
}

export async function renderWorkedDaysStep(
  ctx: WorkforceModuleContext,
  state: WorkerOffboardingState,
  renderStep: (ctx: WorkforceModuleContext, text: string, keyboard?: unknown) => Promise<void>
): Promise<void> {
  state.step = 'WORKED_DAYS';
  const activeLeave = state.profile?.activeLeave;
  const note = activeLeave ? `\n🏖️ *العامل في إجازة حالياً:* ${new Date(activeLeave.departureDate).toLocaleDateString('ar-EG')}` : '';
  const text = `📅 *تحديد أيام العمل الفعلية المستحقة*\n────────────────────────────\nالعامل: *${state.workerName}* (الأجر اليومي: ${state.dailyRate || 300} ج.م)${note}\n\nاختر عدد أيام العمل المستحقة:`;
  const kb = buildWorkedDaysKeyboard({
    isWorkerOnLeave: Boolean(activeLeave),
    daysBeforeLeave: activeLeave?.daysBeforeLeave,
    daysUntilExpectedReturn: activeLeave?.daysUntilExpectedReturn,
    daysUntilToday: new Date().getDate(),
  });
  await renderStep(ctx, text, kb);
}

export async function renderPayoutOptionStep(
  ctx: WorkforceModuleContext,
  state: WorkerOffboardingState,
  renderStep: (ctx: WorkforceModuleContext, text: string, keyboard?: unknown) => Promise<void>
): Promise<void> {
  state.step = 'PAYOUT_OPTION';
  const hasPending = Boolean(state.profile?.pendingDisciplinaryRecords?.length);
  const netAmount = state.financialBreakdown?.netSettlementAmount ?? 0;
  await renderStep(
    ctx,
    formatPayoutOptionPrompt(state.workerName || 'العامل', hasPending, netAmount),
    buildPayoutOptionKeyboard(hasPending)
  );
}

export async function processPhotoInput(
  ctx: WorkforceModuleContext,
  fileId: string,
  state: WorkerOffboardingState
): Promise<void> {
  try {
    const f = await ctx.api.getFile(fileId);
    if (f.file_path) {
      const token = ctx.api.token;
      const downloadUrl = `https://api.telegram.org/file/bot${token}/${f.file_path}`;
      const response = await fetch(downloadUrl);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const saveRes = UniversalAttachmentPipeline.saveAttachment({
          domain: 'CUSTODY_RECEIPT',
          referenceCode: state.workerCode || 'unknown',
          fileName: `ppe_damage_${Date.now()}.jpg`,
          fileBuffer: buffer,
        });
        if (saveRes.success) {
          state.ppePhotoUri = saveRes.relativePath;
          return;
        }
      }
    }
  } catch {}
  state.ppePhotoUri = `tg://file_id/${fileId}`;
}

export async function handleBackStep(
  ctx: WorkforceModuleContext,
  state: WorkerOffboardingState,
  renderStep: (ctx: WorkforceModuleContext, text: string, keyboard?: unknown) => Promise<void>,
  onRestart: (ctx: WorkforceModuleContext) => Promise<void>,
  onWorkerSelect: (ctx: WorkforceModuleContext) => Promise<void>
): Promise<void> {
  if (!state.backStack?.length) {
    await onRestart(ctx);
    return;
  }
  const prev = state.backStack.pop();
  if (prev === 'INIT' || prev === 'HUB_SELECT') await onRestart(ctx);
  else if (prev === 'WORKER_SELECT') await onWorkerSelect(ctx);
  else if (prev === 'PENDING_RADAR' || prev === 'TERMINATION_REASON') await renderReasonStep(ctx, state, renderStep);
  else if (prev === 'PPE_AUDIT' || prev === 'PPE_PHOTO_UPLOAD') {
    state.step = 'PPE_AUDIT';
    await renderStep(
      ctx,
      `🦺 *فحص عهد ومهمات الوقاية*\n────────────────────────────\nالعامل: *${state.workerName}*`,
      buildPPEAuditKeyboard(Boolean(state.profile?.ppeAssets?.length))
    );
  } else if (prev === 'WORKED_DAYS') await renderWorkedDaysStep(ctx, state, renderStep);
  else await onRestart(ctx);
}

export async function processWorkedDaysSelection(
  ctx: WorkforceModuleContext,
  state: WorkerOffboardingState,
  service: WorkerOffboardingService,
  renderStep: (ctx: WorkforceModuleContext, text: string, keyboard?: unknown) => Promise<void>
): Promise<void> {
  const role = ctx.effectiveRole || 'GUEST';
  if (role === 'FIELD_ADMIN') {
    state.step = 'CONFIRMATION';
    const card = formatFieldAdminReviewCard({
      workerName: state.workerName || 'العامل',
      workerCode: state.workerCode || '',
      jobTitle: state.jobTitle,
      siteName: state.siteName,
      reason: state.reason || 'MUTUAL_AGREEMENT',
      workedDays: state.workedDays || 0,
      ppeObservations: state.ppeObservations,
      leaveStatusText: state.profile?.activeLeave ? 'في إجازة نشطة' : 'على رأس العمل',
      submitterName: ctx.from?.first_name || '',
      notes: state.notes,
    });
    await renderStep(ctx, card, buildConfirmKeyboard());
    return;
  }

  if (!state.profile && state.workerId) {
    state.profile = await service.getWorkerClearanceProfile(state.workerId, role);
  }
  if (!state.profile) return;
  const breakdown = service.calculateFinancialClearance(state.profile, {
    workedDays: state.workedDays || 0,
    assetDamageDeduction: state.ppeDeductions || 0,
    selectedDisciplinaryDecisions: state.customSelectedDecisionIds,
  });
  state.financialBreakdown = breakdown;

  if (breakdown.isNegativeBalance) {
    state.step = 'NEGATIVE_BALANCE_RADAR';
    const card = formatNegativeBalanceAlertCard({
      workerName: state.workerName || 'العامل',
      workerCode: state.workerCode || '',
      breakdown,
      jobTitle: state.jobTitle,
      siteName: state.siteName,
    });
    await renderStep(ctx, card, buildNegativeBalanceKeyboard());
    return;
  }
  await renderPayoutOptionStep(ctx, state, renderStep);
}

