import type { WorkforceModuleContext } from '../../shared/module.types.js';
import type { WorkerOffboardingService } from './flow.service.js';
import {
  buildPendingDecisionsInboxKeyboard,
  buildWorkerPickerKeyboard,
  buildSuccessKeyboard,
} from './flow.keyboard.js';
import {
  formatPendingDecisionsInboxCard,
} from './flow.messages.js';

export async function handlePendingDecisionsList(
  ctx: WorkforceModuleContext,
  service: WorkerOffboardingService,
  renderStep: (ctx: WorkforceModuleContext, text: string, keyboard?: unknown) => Promise<void>
): Promise<void> {
  if (!ctx.from) return;
  if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

  const decisions = await service.getPendingDisciplinaryDecisions();
  const summary = {
    totalCount: decisions.length,
    bonusCount: decisions.filter((d) => d.type.includes('BONUS')).length,
    penaltyCount: decisions.filter((d) => d.type.includes('PENALTY')).length,
  };

  const text = formatPendingDecisionsInboxCard(decisions, 0, decisions.length);
  const keyboard = buildPendingDecisionsInboxKeyboard(decisions);
  await renderStep(ctx, text, keyboard);
}

export async function handleSettleDecision(
  ctx: WorkforceModuleContext,
  decisionId: string,
  action: 'APPROVE' | 'REJECT',
  service: WorkerOffboardingService,
  renderList: (ctx: WorkforceModuleContext) => Promise<void>
): Promise<void> {
  if (!ctx.from) return;
  const actorId = String(ctx.from.id);
  if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

  try {
    await service.settleDisciplinaryDecision(decisionId, action, actorId);
    if (ctx.callbackQuery) {
      const actionLabel = action === 'APPROVE' ? 'تم اعتماد القرار' : 'تم استبعاد ورفض القرار';
      await ctx.answerCallbackQuery({ text: `✅ ${actionLabel} بنجاح.` }).catch(() => {});
    }
    await renderList(ctx);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'تعذر تسوية القرار.';
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: `❌ ${msg}`, show_alert: true }).catch(() => {});
    }
  }
}

export async function handlePendingClearancesList(
  ctx: WorkforceModuleContext,
  service: WorkerOffboardingService,
  renderStep: (ctx: WorkforceModuleContext, text: string, keyboard?: unknown) => Promise<void>
): Promise<void> {
  if (!ctx.from) return;
  if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

  const reports = await service.getPendingClearanceReports();
  if (!reports.length) {
    const text =
      `📬 *المخالصات الميدانية المعلقة*\n` +
      `────────────────────────────\n` +
      `لا يوجد أي تقارير إخلاء طرف ميدانية معلقة للاعتماد حالياً.`;
    const keyboard = buildSuccessKeyboard();
    await renderStep(ctx, text, keyboard);
    return;
  }

  const text =
    `📬 *المخالصات الميدانية المعلقة (عدد: ${reports.length})*\n` +
    `────────────────────────────\n` +
    `اختر العامل المعلق لاستكمال إجراءات مخالصته واعتماد المستحقات:`;
  const keyboard = buildWorkerPickerKeyboard(
    reports.map((r) => ({
      id: r.workerId,
      name: r.workerNickname || r.workerName || 'عامل',
      code: r.workerCode || '',
      siteName: r.siteName || undefined,
    }))
  );
  await renderStep(ctx, text, keyboard);
}
