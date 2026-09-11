import type { SettingsModuleContext } from '../../shared/module.types.js';
import type { AdminAssignmentService } from './flow.service.js';
import { showModalAlert } from '@alsaada/core-components';
import {
  buildAdminAssignmentsHubKeyboard,
  buildUserAssignmentCardKeyboard,
} from './flow.keyboard.js';
import {
  formatAdminAssignmentsHub,
  formatUserAssignmentCard,
} from './flow.messages.js';

export class AdminAssignmentHandler {
  constructor(private readonly service: AdminAssignmentService) {}

  async renderAdminAssignmentsHub(ctx: SettingsModuleContext, inPlace = false, noticeText?: string): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') {
      if (ctx.callbackQuery) {
        await showModalAlert(ctx, '🔒 هذا القسم مخصص حصرياً للمدير العام.');
      } else {
        await ctx.reply('🔒 هذا القسم مخصص حصرياً للمدير العام.');
      }
      return;
    }

    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const callerId = ctx.from?.id ? BigInt(ctx.from.id) : undefined;
    const users = await this.service.listAdminUsers(callerId);
    const keyboard = buildAdminAssignmentsHubKeyboard(users, ctx.isImpersonating);
    const text = formatAdminAssignmentsHub(noticeText);

    if (inPlace && ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {
        // fallback
      }
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async renderUserAssignmentCard(
    ctx: SettingsModuleContext,
    targetTelegramId: bigint,
    inPlace = false,
    noticeText?: string
  ): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;

    // Self-modification guard
    if (ctx.from?.id && targetTelegramId === BigInt(ctx.from.id)) {
      await showModalAlert(ctx, '🚫 أمان النظام: لا يمكنك تعديل صلاحيات أو نطاق إشراف حسابك الشخصي بنفسك.');
      return;
    }

    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const user = await this.service.getUserAssignment(targetTelegramId);
    if (!user) {
      await this.renderAdminAssignmentsHub(ctx, inPlace, '❌ المشرف المطلوب غير موجود.');
      return;
    }

    const sites = await this.service.listActiveSites();
    const keyboard = buildUserAssignmentCardKeyboard(user, sites);
    const text = formatUserAssignmentCard(user, noticeText);

    if (inPlace && ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {
        // fallback
      }
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async handleSetUserSiteAssignment(
    ctx: SettingsModuleContext,
    targetTelegramId: bigint,
    siteIdOrGlobal: string
  ): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;

    const actorTelegramId = ctx.from?.id ? BigInt(ctx.from.id) : undefined;
    const res = await this.service.setAssignment(targetTelegramId, siteIdOrGlobal, actorTelegramId);
    if (!res.success || !res.user) {
      await showModalAlert(ctx, res.error || 'فشل التعيين');
      return;
    }

    const scopeName = res.user.assignedSiteName ? `موقع (${res.user.assignedSiteName})` : 'صلاحية عامة وشاملة 🌐';
    await showModalAlert(ctx, `✅ تم تحديث نطاق المشرف بنجاح إلى: ${scopeName}`);
    await this.renderUserAssignmentCard(ctx, targetTelegramId, true, `✅ تم تحديث نطاق الصلاحيات إلى: ${scopeName}`);
  }
}
