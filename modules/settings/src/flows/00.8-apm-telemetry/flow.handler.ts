import type { SettingsModuleContext } from '../../shared/module.types.js';
import type { ApmTelemetryService } from './flow.service.js';
import {
  buildApmDashboardKeyboard,
  buildSlowOpsKeyboard,
  buildServicesHealthKeyboard,
  buildAlertPolicyKeyboard,
} from './flow.keyboard.js';
import {
  formatApmDashboard,
  formatSlowOperationsList,
  formatServicesHealthCard,
  formatAlertPolicyCard,
} from './flow.messages.js';

export class ApmTelemetryHandler {
  constructor(private readonly service: ApmTelemetryService) {}

  async renderApmDashboard(ctx: SettingsModuleContext, inPlace = false, noticeText?: string): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const summary = await this.service.getApmSummary();
    const keyboard = buildApmDashboardKeyboard(ctx.isImpersonating);
    const text = formatApmDashboard(summary, noticeText);

    if (inPlace && ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {}
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async renderSlowOperations(ctx: SettingsModuleContext, inPlace = false): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const ops = await this.service.getSlowOperations();
    const keyboard = buildSlowOpsKeyboard();
    const text = formatSlowOperationsList(ops);

    if (inPlace && ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {}
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async renderServicesHealth(ctx: SettingsModuleContext, inPlace = false): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const health = await this.service.checkServicesHealth(ctx.api);
    const keyboard = buildServicesHealthKeyboard();
    const text = formatServicesHealthCard(health);

    if (inPlace && ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {}
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async renderAlertPolicy(ctx: SettingsModuleContext, inPlace = false): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const currentPolicy = await this.service.getAlertPolicy();
    const keyboard = buildAlertPolicyKeyboard(currentPolicy);
    const text = formatAlertPolicyCard(currentPolicy);

    if (inPlace && ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {}
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async handleSetAlertPolicy(ctx: SettingsModuleContext, policyStr: string): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;

    const res = await this.service.setAlertPolicy(policyStr);
    if (!res.success) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: `❌ ${res.error}`, show_alert: true }).catch(() => {});
      }
      return;
    }

    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: `✅ تم تعيين سياسة الإنذارات: ${res.policy}` }).catch(() => {});
    }

    await this.renderAlertPolicy(ctx, true);
  }
}
