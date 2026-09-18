import type { Bot } from 'grammy';
import type { WorkerSupervisorProfileKey } from '@alsaada/rbac';
import type { SettingsModuleContext } from '../../shared/module.types.js';
import type { UserRbacService } from './flow.service.js';
import {
  buildUserDirectoryKeyboard,
  buildUserDetailKeyboard,
  buildRoleSelectionKeyboard,
  buildWorkerSupervisorProfilesKeyboard,
  buildWorkerCandidatesKeyboard,
  buildPreviewConfirmKeyboard,
  buildConflictConfirmKeyboard,
  buildLinkSuccessKeyboard,
  buildCancelBackKeyboard,
} from './flow.keyboard.js';
import {
  formatUserDirectoryHeader,
  formatUserDetailCard,
  formatPromptEnterTelegramId,
  formatLivePreviewCard,
  formatConflictWarningCard,
  formatDirectLinkSuccess,
  formatRoleChangedMessage,
} from './flow.messages.js';
import { showModalAlert, DISABLED_LINK_PREVIEWS } from '@alsaada/core-components';
import { logUserRbacTelemetry } from './flow.telemetry.js';
import { validateTelegramId } from './flow.validators.js';

export class UserRbacHandler {
  constructor(private readonly service: UserRbacService) {}

  registerRoutes(bot: Bot<SettingsModuleContext>): void {
    bot.callbackQuery('action:settings:user_rbac', (ctx) => this.handleOpenDirectory(ctx, 1));
    bot.callbackQuery(/^urb:p:(\d+)$/, (ctx) => this.handleOpenDirectory(ctx, parseInt(ctx.match[1] || '1', 10)));
    bot.callbackQuery(/^urb:u:(\d+)$/, (ctx) => this.handleOpenUserCard(ctx, BigInt(ctx.match[1] || '0')));
    bot.callbackQuery(/^urb:r:(\d+)$/, (ctx) => this.handlePromptRoleChange(ctx, BigInt(ctx.match[1] || '0')));
    bot.callbackQuery(/^urb:sr:(\d+):([A-Z_]+)$/, (ctx) => this.handleApplyRoleChange(ctx, BigInt(ctx.match[1] || '0'), ctx.match[2] || ''));
    bot.callbackQuery(/^urb:prm:(\d+)$/, (ctx) => this.handlePromptSupervisorProfile(ctx, BigInt(ctx.match[1] || '0')));
    bot.callbackQuery(/^urb:sp:(\d+):([A-Z_]+)$/, (ctx) => this.handleApplySupervisorProfile(ctx, BigInt(ctx.match[1] || '0'), ctx.match[2] as WorkerSupervisorProfileKey));
    bot.callbackQuery(/^urb:tb:(\d+)$/, (ctx) => this.handleToggleBan(ctx, BigInt(ctx.match[1] || '0')));
    bot.callbackQuery(/^urb:rv:(\d+)$/, (ctx) => this.handleRevokeUser(ctx, BigInt(ctx.match[1] || '0')));
    bot.callbackQuery('urb:lw', (ctx) => this.handleListUnlinkedWorkers(ctx));
    bot.callbackQuery(/^urb:w:([0-9a-fA-F-]+)$/, (ctx) => this.handlePromptWorkerTelegramId(ctx, ctx.match[1] || ''));
    bot.callbackQuery('urb:s', (ctx) => this.handlePromptSearch(ctx));
    bot.callbackQuery(/^urb:cp:([^:]+):(\d+)$/, (ctx) => this.handleExecuteLink(ctx, ctx.match[1] || '', BigInt(ctx.match[2] || '0'), false));
    bot.callbackQuery(/^urb:cc:([^:]+):(\d+)$/, (ctx) => this.handleExecuteLink(ctx, ctx.match[1] || '', BigInt(ctx.match[2] || '0'), true));
  }

  async handleOpenDirectory(ctx: SettingsModuleContext, page = 1): Promise<void> {
    if (!ctx.from) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const { users, total, totalPages } = await this.service.listUsers(page, 8);
    const text = formatUserDirectoryHeader(total, page, totalPages);
    const keyboard = buildUserDirectoryKeyboard(users, page, totalPages);

    await this.renderInPlace(ctx, text, keyboard);
  }

  async handleOpenUserCard(ctx: SettingsModuleContext, targetTelegramId: bigint): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const user = await this.service.getUser(targetTelegramId);
    if (!user) {
      if (ctx.callbackQuery) {
        await showModalAlert(ctx as unknown as { answerCallbackQuery: (opts: { text: string; show_alert: boolean }) => Promise<unknown> }, '❌ تعذر العثور على بيانات المستخدم.');
      }
      return;
    }

    const text = formatUserDetailCard(user);
    const keyboard = buildUserDetailKeyboard(user);
    await this.renderInPlace(ctx, text, keyboard);
  }

  async handlePromptRoleChange(ctx: SettingsModuleContext, targetTelegramId: bigint): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const keyboard = buildRoleSelectionKeyboard(targetTelegramId);
    const text = `🔄 *تعديل رتبة وصلاحيات العضو*\nاختر الرتبة الجديدة المطلوبة:`;
    await this.renderInPlace(ctx, text, keyboard);
  }

  async handleApplyRoleChange(ctx: SettingsModuleContext, targetTelegramId: bigint, newRole: string): Promise<void> {
    if (!ctx.from) return;
    const actorId = BigInt(ctx.from.id);

    const res = await this.service.changeUserRole(actorId, targetTelegramId, newRole);
    if (!res.success || !res.user) {
      if (ctx.callbackQuery) {
        await showModalAlert(ctx as unknown as { answerCallbackQuery: (opts: { text: string; show_alert: boolean }) => Promise<unknown> }, res.error || 'فشلت العملية.');
      }
      return;
    }

    logUserRbacTelemetry({
      action: 'CHANGE_ROLE',
      actorTelegramId: actorId,
      targetTelegramId,
      newRole,
      success: true,
    });

    if (ctx.callbackQuery) {
      await showModalAlert(ctx as unknown as { answerCallbackQuery: (opts: { text: string; show_alert: boolean }) => Promise<unknown> }, `✅ تم تعديل الرتبة إلى: ${newRole}`);
    }
    await this.handleOpenUserCard(ctx, targetTelegramId);
  }

  async handlePromptSupervisorProfile(ctx: SettingsModuleContext, targetTelegramId: bigint): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const keyboard = buildWorkerSupervisorProfilesKeyboard(targetTelegramId);
    const text = `🛡️ *ترقية وتعيين مشرف مهام ميداني (Worker Supervisor)*\nاختر قالب الصلاحيات المطلوب تطبيقه فورياً:`;
    await this.renderInPlace(ctx, text, keyboard);
  }

  async handleApplySupervisorProfile(
    ctx: SettingsModuleContext,
    targetTelegramId: bigint,
    profileKey: WorkerSupervisorProfileKey
  ): Promise<void> {
    if (!ctx.from) return;
    const actorId = BigInt(ctx.from.id);

    const res = await this.service.assignWorkerSupervisorProfile(actorId, targetTelegramId, profileKey);
    if (!res.success || !res.user) {
      if (ctx.callbackQuery) {
        await showModalAlert(ctx as unknown as { answerCallbackQuery: (opts: { text: string; show_alert: boolean }) => Promise<unknown> }, res.error || 'فشلت العملية.');
      }
      return;
    }

    logUserRbacTelemetry({
      action: 'ASSIGN_SUPERVISOR_PROFILE',
      actorTelegramId: actorId,
      targetTelegramId,
      profileKey,
      success: true,
    });

    if (ctx.callbackQuery) {
      await showModalAlert(
        ctx as unknown as { answerCallbackQuery: (opts: { text: string; show_alert: boolean }) => Promise<unknown> },
        `✅ تم تعيين قالب الصلاحيات للمشرف بنجاح!`
      );
    }
    await this.handleOpenUserCard(ctx, targetTelegramId);
  }

  async handleToggleBan(ctx: SettingsModuleContext, targetTelegramId: bigint): Promise<void> {
    if (!ctx.from) return;
    const actorId = BigInt(ctx.from.id);

    const target = await this.service.getUser(targetTelegramId);
    if (!target) return;

    const nextBan = !target.isBanned;
    const res = await this.service.toggleUserBan(actorId, targetTelegramId, nextBan);
    if (!res.success || !res.user) {
      if (ctx.callbackQuery) {
        await showModalAlert(ctx as unknown as { answerCallbackQuery: (opts: { text: string; show_alert: boolean }) => Promise<unknown> }, res.error || 'تعذر تعديل حالة الحساب.');
      }
      return;
    }

    const alertMsg = nextBan ? '🔴 تم حظر وتجميد الحساب بنجاح.' : '🟢 تم فك الحظر وتنشيط الحساب بنجاح.';
    if (ctx.callbackQuery) {
      await showModalAlert(ctx as unknown as { answerCallbackQuery: (opts: { text: string; show_alert: boolean }) => Promise<unknown> }, alertMsg);
    }
    await this.handleOpenUserCard(ctx, targetTelegramId);
  }

  async handleRevokeUser(ctx: SettingsModuleContext, targetTelegramId: bigint): Promise<void> {
    if (!ctx.from) return;
    const actorId = BigInt(ctx.from.id);

    const res = await this.service.revokeUser(actorId, targetTelegramId);
    if (!res.success) {
      if (ctx.callbackQuery) {
        await showModalAlert(ctx as unknown as { answerCallbackQuery: (opts: { text: string; show_alert: boolean }) => Promise<unknown> }, res.error || 'تعذر سحب الصلاحيات.');
      }
      return;
    }

    if (ctx.callbackQuery) {
      await showModalAlert(ctx as unknown as { answerCallbackQuery: (opts: { text: string; show_alert: boolean }) => Promise<unknown> }, '✅ تم سحب الصلاحيات وفك الارتباط وتنزيل الحساب لزائر.');
    }
    await this.handleOpenDirectory(ctx, 1);
  }

  async handleListUnlinkedWorkers(ctx: SettingsModuleContext): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const workers = await this.service.listUnlinkedWorkers();

    if (workers.length === 0) {
      const emptyText = 'ℹ️ *كافة العمال النشطين مربوطون بحسابات تيليجرام بالفعل.*';
      await this.renderInPlace(ctx, emptyText, buildCancelBackKeyboard());
      return;
    }

    const text = '👷 *اختر العامل المراد ربطه بحساب تيليجرام من القائمة أدناه:*';
    const keyboard = buildWorkerCandidatesKeyboard(workers);
    await this.renderInPlace(ctx, text, keyboard);
  }

  async handlePromptWorkerTelegramId(ctx: SettingsModuleContext, workerId: string): Promise<void> {
    if (!ctx.from) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const worker = await this.service.findWorkerById(workerId);
    if (!worker) return;

    await this.service.setPendingAction(BigInt(ctx.from.id), {
      action: 'ENTER_TELEGRAM_ID',
      targetWorkerId: worker.id,
      targetWorkerCode: worker.code,
      targetWorkerName: worker.nickname || worker.name,
      targetWorkerPhone: worker.phone || undefined,
      createdAt: Date.now(),
    });

    const text = formatPromptEnterTelegramId(worker);
    const keyboard = buildCancelBackKeyboard();
    await this.renderInPlace(ctx, text, keyboard);
  }

  async handlePromptSearch(ctx: SettingsModuleContext): Promise<void> {
    if (!ctx.from) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    await this.service.setPendingAction(BigInt(ctx.from.id), {
      action: 'SEARCH',
      createdAt: Date.now(),
    });

    const text = '🔍 *أدخل اسم المستخدم أو المعرف الرقمي أو كود العامل للبحث المباشر:*';
    await this.renderInPlace(ctx, text, buildCancelBackKeyboard());
  }

  async handleExecuteLink(
    ctx: SettingsModuleContext,
    workerId: string,
    telegramId: bigint,
    confirmConflict: boolean
  ): Promise<void> {
    if (!ctx.from) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const res = await this.service.directLinkWorker(workerId, telegramId.toString(), {
      confirmConflict,
      botUsername: ctx.me?.username || 'AlsaadaSmartBot',
    });

    if (!res.success) {
      if (res.reboundFromOldUser && res.oldWorkerName) {
        const worker = await this.service.findWorkerById(workerId);
        if (worker) {
          const warnText = formatConflictWarningCard(worker, res.oldWorkerName, telegramId);
          const warnKb = buildConflictConfirmKeyboard(workerId, telegramId);
          await this.renderInPlace(ctx, warnText, warnKb);
          return;
        }
      }
      if (ctx.callbackQuery) {
        await showModalAlert(ctx as unknown as { answerCallbackQuery: (opts: { text: string; show_alert: boolean }) => Promise<unknown> }, res.error || 'تعذر ربط العامل.');
      }
      return;
    }

    await this.service.clearPendingAction(BigInt(ctx.from.id));
    const successText = formatDirectLinkSuccess(res);
    const keyboard = buildLinkSuccessKeyboard(res.whatsAppUrl);
    await this.renderInPlace(ctx, successText, keyboard);
  }

  async handleTextInput(ctx: SettingsModuleContext, text: string): Promise<boolean> {
    if (!ctx.from) return false;
    const actorId = BigInt(ctx.from.id);
    const pending = await this.service.getPendingAction(actorId);
    if (!pending) return false;

    if (pending.action === 'SEARCH') {
      await this.service.clearPendingAction(actorId);
      const results = await this.service.searchUsers(text);
      if (results.length === 0) {
        await ctx.reply('❌ لم يتم العثور على أي نتائج مطابقة.', { reply_markup: buildCancelBackKeyboard() });
        return true;
      }
      const header = `🔍 *نتائج البحث عن (${text}):*\nعدد النتائج: \`${results.length}\``;
      const kb = buildUserDirectoryKeyboard(results, 1, 1);
      await ctx.reply(header, { parse_mode: 'Markdown', reply_markup: kb });
      return true;
    }

    if (pending.action === 'ENTER_TELEGRAM_ID' && pending.targetWorkerId) {
      const val = validateTelegramId(text);
      if (!val.isValid || !val.normalizedId) {
        await ctx.reply(`❌ ${val.error || 'معرف التليجرام غير صالح.'}\nيرجى إعادة إدخال الأرقام بشكل صحيح:`, {
          reply_markup: buildCancelBackKeyboard(),
        });
        return true;
      }

      const targetTelegramId = val.normalizedId;
      const worker = await this.service.findWorkerById(pending.targetWorkerId);
      if (!worker) {
        await ctx.reply('❌ تعذر العثور على سجل العامل.');
        return true;
      }

      // Live Profile Preview via getChat
      const preview = await this.service.previewTelegramProfile(targetTelegramId, ctx.api as unknown as { getChat: (id: number) => Promise<{ first_name?: string; last_name?: string; username?: string }> });
      if (preview.exists && preview.firstName) {
        const previewText = formatLivePreviewCard(worker, preview);
        const confirmKb = buildPreviewConfirmKeyboard(worker.id, targetTelegramId);
        await ctx.reply(previewText, { parse_mode: 'Markdown', reply_markup: confirmKb });
        return true;
      }

      // Direct Execution if profile preview is hidden or user hasn't messaged bot
      await this.handleExecuteLink(ctx, worker.id, targetTelegramId, false);
      return true;
    }

    return false;
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
