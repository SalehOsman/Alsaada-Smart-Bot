import type { SettingsModuleContext } from '../../shared/module.types.js';
import type { EmergencyCacheService } from './flow.service.js';
import {
  buildEmergencyCacheKeyboard,
  buildConfirmMaintenanceKeyboard,
} from './flow.keyboard.js';
import {
  formatEmergencyCacheHub,
  formatMaintenancePromptCard,
  formatPrewarmSummary,
} from './flow.messages.js';

export class EmergencyCacheHandler {
  constructor(private readonly service: EmergencyCacheService) {}

  async renderEmergencyCacheHub(ctx: SettingsModuleContext, inPlace = false, noticeText?: string): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const status = await this.service.getMaintenanceStatus();
    const keyboard = buildEmergencyCacheKeyboard(status.isMaintenanceActive, ctx.isImpersonating);
    const text = formatEmergencyCacheHub(status, noticeText);

    if (inPlace && ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {}
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async handlePromptConfirmMaintenance(ctx: SettingsModuleContext): Promise<void> {
    if (!ctx.isRealSuperAdmin) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const keyboard = buildConfirmMaintenanceKeyboard();
    const text = formatMaintenancePromptCard();

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {}
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async handleToggleMaintenance(ctx: SettingsModuleContext): Promise<void> {
    if (!ctx.isRealSuperAdmin) return;

    const res = await this.service.toggleMaintenanceStatus();
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: res.notice }).catch(() => {});
    }

    await this.renderEmergencyCacheHub(ctx, true, res.notice);
  }

  async handlePrewarm(ctx: SettingsModuleContext): Promise<void> {
    if (!ctx.isRealSuperAdmin) return;
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: '⚡ جارٍ إعادة تدفئة الذاكرة اللحظية...' }).catch(() => {});
    }

    const res = await this.service.prewarmCache();
    const notice = formatPrewarmSummary(res);

    await this.renderEmergencyCacheHub(ctx, true, notice);
  }
}
