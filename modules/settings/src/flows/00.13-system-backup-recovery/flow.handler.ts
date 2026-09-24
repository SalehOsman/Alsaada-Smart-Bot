import type { Bot } from 'grammy';
import type { SettingsModuleContext } from '../../shared/module.types.js';
import type { SystemBackupRecoveryService } from './flow.service.js';
import {
  buildBackupMainMenuKeyboard,
  buildBackupInProgressKeyboard,
  buildBackupCompletionKeyboard,
  buildBackupListKeyboard,
} from './flow.keyboard.js';
import {
  formatBackupStatusCard,
  formatBackupInProgressCard,
  formatBackupSuccessCard,
  formatDisasterRecoveryDrillCard,
  formatBackupListCard,
} from './flow.messages.js';
import { DISABLED_LINK_PREVIEWS } from '@alsaada/core-components';
import { logBackupEvent, logBackupError } from './flow.telemetry.js';

export class SystemBackupRecoveryHandler {
  constructor(private readonly service: SystemBackupRecoveryService) {}

  registerRoutes(bot: Bot<SettingsModuleContext>): void {
    // Direct Slash Commands (Admins only)
    bot.command('backup', (ctx) => this.handleBackupCommand(ctx));
    bot.command('backup_status', (ctx) => this.handleStatusCommand(ctx));

    // Callback queries
    bot.callbackQuery('action:settings:backup_recovery', (ctx) => this.handleOpenHub(ctx));
    bot.callbackQuery('bck:status', (ctx) => this.handleOpenHub(ctx));
    bot.callbackQuery('bck:now', (ctx) => this.handleTriggerBackup(ctx));
    bot.callbackQuery('bck:drill', (ctx) => this.handleTriggerDrill(ctx));
    bot.callbackQuery('bck:list', (ctx) => this.handleOpenList(ctx));
    bot.callbackQuery('bck:back', (ctx) => this.handleBackToSettings(ctx));
  }

  private isAuthorized(ctx: SettingsModuleContext): boolean {
    const role = ctx.effectiveRole || (ctx.dbUser?.role as string | undefined) || 'GUEST';
    return ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(role);
  }

  async handleOpenHub(ctx: SettingsModuleContext): Promise<void> {
    if (!this.isAuthorized(ctx)) {
      if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: 'غير مصرح لك بالوصول', show_alert: true });
      return;
    }

    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    try {
      const stats = await this.service.getBackupStatus();
      const text = formatBackupStatusCard(stats);
      const keyboard = buildBackupMainMenuKeyboard();
      await this.renderInPlace(ctx, text, keyboard);
      logBackupEvent('open_hub_success');
    } catch (err) {
      logBackupError('open_hub_failed', err);
      await this.renderInPlace(ctx, '⚠️ تعذر تحميل بيانات النسخ الاحتياطي حالياً.', buildBackupMainMenuKeyboard());
    }
  }

  /**
   * Asynchronous Telegram Flow:
   * Responds in <500ms with in-progress message and edits in-place upon completion,
   * completely preventing Telegram 10s Webhook timeouts!
   */
  async handleTriggerBackup(ctx: SettingsModuleContext): Promise<void> {
    if (!this.isAuthorized(ctx)) {
      if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: 'غير مصرح لك بالوصول', show_alert: true });
      return;
    }

    // Acknowledge immediately (< 50ms)
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    // In-place edit immediately (< 500ms) to show in-progress card
    const inProgressText = formatBackupInProgressCard();
    const inProgressKb = buildBackupInProgressKeyboard();
    await this.renderInPlace(ctx, inProgressText, inProgressKb);

    logBackupEvent('backup_started_async');

    // Run backup asynchronously
    try {
      const result = await this.service.executeBackupNow();
      const successText = formatBackupSuccessCard(result);
      const completionKb = buildBackupCompletionKeyboard(result.backupId);

      // In-place update to completion card
      await this.renderInPlace(ctx, successText, completionKb);
      logBackupEvent('backup_completed_async', { backupId: result.backupId });
    } catch (err: unknown) {
      logBackupError('backup_failed_async', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      const errorText = `❌ *فشلت عملية النسخ الاحتياطي*\n\nالخطأ: \`${errMsg}\``;
      await this.renderInPlace(ctx, errorText, buildBackupMainMenuKeyboard());
    }
  }

  async handleTriggerDrill(ctx: SettingsModuleContext): Promise<void> {
    if (!this.isAuthorized(ctx)) {
      if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: 'غير مصرح لك بالوصول', show_alert: true });
      return;
    }

    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    await this.renderInPlace(
      ctx,
      '⏳ *جاري تشغيل تدريب استعادة الكوارث الآلي (DR Drill)...*\n\nيتم الآن اختبار التشفير والهاش واستعادة دفاتر الأستاذ في بيئة معزولة...',
      buildBackupInProgressKeyboard(),
    );

    try {
      const drillResult = await this.service.runDrill();
      const cardText = formatDisasterRecoveryDrillCard(drillResult);
      const keyboard = buildBackupMainMenuKeyboard();
      await this.renderInPlace(ctx, cardText, keyboard);
      logBackupEvent('drill_completed', { ok: drillResult.ok });
    } catch (err: unknown) {
      logBackupError('drill_failed', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      await this.renderInPlace(ctx, `❌ فشل التدريب: \`${errMsg}\``, buildBackupMainMenuKeyboard());
    }
  }

  async handleOpenList(ctx: SettingsModuleContext): Promise<void> {
    if (!this.isAuthorized(ctx)) {
      if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: 'غير مصرح لك بالوصول', show_alert: true });
      return;
    }

    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    try {
      const items = await this.service.listRecentBackups();
      const text = formatBackupListCard(items);
      const keyboard = buildBackupListKeyboard(items);
      await this.renderInPlace(ctx, text, keyboard);
      logBackupEvent('list_snapshots');
    } catch (err) {
      logBackupError('list_snapshots_failed', err);
      await this.renderInPlace(ctx, '⚠️ تعذر قراءة سجل اللقطات.', buildBackupMainMenuKeyboard());
    }
  }

  async handleBackupCommand(ctx: SettingsModuleContext): Promise<void> {
    await this.handleTriggerBackup(ctx);
  }

  async handleStatusCommand(ctx: SettingsModuleContext): Promise<void> {
    await this.handleOpenHub(ctx);
  }

  async handleBackToSettings(ctx: SettingsModuleContext): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    // Redirect to system settings sub-menu
    const { handleSettingsSubCategory } = await import('../../shared/settings-hub.js');
    await handleSettingsSubCategory(ctx, 'system');
  }

  private async renderInPlace(ctx: SettingsModuleContext, text: string, keyboard: unknown): Promise<void> {
    if (ctx.callbackQuery?.message) {
      try {
        await ctx.editMessageText(text, {
          parse_mode: 'Markdown',
          reply_markup: keyboard as import('grammy').InlineKeyboard,
          link_preview_options: DISABLED_LINK_PREVIEWS,
        });
        return;
      } catch {}
    }
    await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard as import('grammy').InlineKeyboard,
      link_preview_options: DISABLED_LINK_PREVIEWS,
    });
  }
}
