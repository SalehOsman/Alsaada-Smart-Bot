import type { WorkforceModuleContext } from '../../shared/module.types.js';
import type { WorkerOffboardingService } from './flow.service.js';
import type {
  TerminationReason,
  OffboardReason,
  WorkerOffboardingState,
} from './flow.types.js';
import {
  formatSuperAdminSettlementCard,
  buildClearanceWhatsAppUrl,
  formatSuccessCard,
  formatOffboardingNotification,
} from './flow.messages.js';
import {
  buildConfirmKeyboard,
  buildClearanceCompletionKeyboard,
  buildSuccessKeyboard,
} from './flow.keyboard.js';
import { logWorkerOffboardingTelemetry } from './flow.telemetry.js';
import { notifyFlowOperation } from '@alsaada/core-components';

export async function executeClearanceFinalization(
  ctx: WorkforceModuleContext,
  state: WorkerOffboardingState,
  service: WorkerOffboardingService,
  renderStep: (ctx: WorkforceModuleContext, text: string, keyboard?: unknown) => Promise<void>
): Promise<void> {
  if (!ctx.from) return;
  const uid = BigInt(ctx.from.id);
  const role = ctx.effectiveRole || 'GUEST';

  if (!state.workerId || !state.workerCode || !state.financialBreakdown) {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: '⚠️ بيانات غير مكتملة.', show_alert: true }).catch(() => {});
    return;
  }
  if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

  const start = Date.now();
  try {
    const res = await service.finalizeWorkerClearance(
      {
        workerId: state.workerId,
        workedDays: state.workedDays || 0,
        dailyRate: state.financialBreakdown.dailyRate,
        earnedSalary: state.financialBreakdown.earnedSalary,
        approvedBonuses: state.financialBreakdown.approvedBonuses,
        totalAdvances: state.financialBreakdown.totalAdvances,
        totalPenalties: state.financialBreakdown.totalPenalties,
        assetDamageDeduction: state.financialBreakdown.assetDamageDeduction,
        netSettlementAmount: state.financialBreakdown.netSettlementAmount,
        payoutOption: state.payoutOption || 'WITH_PAYROLL',
        negativeBalanceAction: state.negativeBalanceAction,
        reason: (state.reason as TerminationReason) || 'MUTUAL_AGREEMENT',
        notes: state.notes,
        photoUri: state.ppePhotoUri || undefined,
        actorTelegramId: uid,
      },
      role
    );

    logWorkerOffboardingTelemetry({
      workerId: state.workerId,
      workerCode: state.workerCode,
      reason: state.reason || 'MUTUAL_AGREEMENT',
      demotedTelegramId: res.demotedTelegramId,
      executionTimeMs: Date.now() - start,
      success: true,
      actorTelegramId: uid,
    });

    const waUrl = buildClearanceWhatsAppUrl(null, {
      clearanceNumber: res.clearanceNumber,
      workerName: res.workerName,
      workerCode: res.workerCode,
      breakdown: state.financialBreakdown,
      payoutOption: res.payoutOption,
      reason: (state.reason as TerminationReason) || 'MUTUAL_AGREEMENT',
      jobTitle: state.jobTitle,
      siteName: state.siteName,
    });

    await renderStep(
      ctx,
      formatSuccessCard(res.workerName, res.workerCode, res.clearanceNumber, Boolean(res.demotedTelegramId)),
      buildClearanceCompletionKeyboard({ whatsappUrl: waUrl })
    );

    const notif = formatOffboardingNotification(
      res.workerName,
      res.workerCode,
      state.reason || 'MUTUAL_AGREEMENT',
      res.clearanceNumber,
      state.siteName
    );

    await notifyFlowOperation({
      featureKey: 'WORKER_OFFBOARDING',
      siteId: state.siteId || undefined,
      siteCardText: notif,
      hqCategory: 'WORKFORCE',
      hqCardText: notif,
    }).catch(() => {});
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'تعذر إتمام المخالصة.';
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: `❌ ${msg}`, show_alert: true }).catch(() => {});
    else await ctx.reply(`❌ ${msg}`);
  }
}

export async function executeFieldReportSubmission(
  ctx: WorkforceModuleContext,
  state: WorkerOffboardingState,
  service: WorkerOffboardingService,
  renderStep: (ctx: WorkforceModuleContext, text: string, keyboard?: unknown) => Promise<void>
): Promise<void> {
  if (!ctx.from) return;
  const uid = BigInt(ctx.from.id);
  const role = ctx.effectiveRole || 'GUEST';

  if (!state.workerId || !state.workerCode) return;
  if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

  try {
    const repId = await service.submitFieldClearanceReport(
      {
        workerId: state.workerId,
        workedDays: state.workedDays || 0,
        reason: (state.reason as TerminationReason) || 'MUTUAL_AGREEMENT',
        ppeObservations: state.ppeObservations,
        photoUri: state.ppePhotoUri || undefined,
        notes: state.notes,
        submittedByUserId: uid,
      },
      role
    );

    const msg =
      `✅ *تم رفع تقرير إخلاء الطرف الميداني بنجاح*\n` +
      `────────────────────────────\n` +
      `رقم الطلب: \`${repId}\`\n` +
      `العامل: *${state.workerName}* (كود: \`${state.workerCode}\`)\n` +
      `الحالة: *منتهي الخدمة ميدانياً (الموقف المالي معلق)*.`;

    await renderStep(ctx, msg, buildSuccessKeyboard());
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'تعذر رفع التقرير الميداني.';
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: `❌ ${msg}`, show_alert: true }).catch(() => {});
    else await ctx.reply(`❌ ${msg}`);
  }
}

export function renderConfirmationSlip(
  state: WorkerOffboardingState
): { cardText: string; keyboard: ReturnType<typeof buildConfirmKeyboard> } {
  const mockRef = `#CLR-${new Date().getFullYear()}-${state.workerCode || '001'}`;
  const cardText = formatSuperAdminSettlementCard({
    clearanceNumber: mockRef,
    workerName: state.workerName || 'العامل',
    workerCode: state.workerCode || '',
    jobTitle: state.jobTitle,
    siteName: state.siteName,
    terminationDate: new Date(),
    reason: (state.reason as OffboardReason) || 'MUTUAL_AGREEMENT',
    breakdown: state.financialBreakdown!,
    payoutOption: state.payoutOption || 'WITH_PAYROLL',
    sha256Checksum: 'SHA256:PREVIEW-AUTO-GEN',
    hasLinkedTelegram: Boolean(state.workerTelegramId),
    notes: state.notes,
  });
  return { cardText, keyboard: buildConfirmKeyboard() };
}
