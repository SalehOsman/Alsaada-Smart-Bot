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

  async handleToggleFreezeBotAccess(ctx: SettingsModuleContext, targetTelegramId: bigint): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;
    const actorTelegramId = ctx.from?.id ? BigInt(ctx.from.id) : undefined;
    const res = await this.service.toggleFreezeBotAccess(targetTelegramId, actorTelegramId);
    if (!res.success || !res.user) {
      await showModalAlert(ctx, res.error || 'فشلت العملية.');
      return;
    }
    const state = res.user.freezeBotAccessOnLeave ? 'تفعيل حجب البوت بالإجازة 🔒' : 'إلغاء حجب البوت بالإجازة (سماح بالدخول) 🔓';
    await showModalAlert(ctx, `✅ تم ${state}`);
    await this.renderUserAssignmentCard(ctx, targetTelegramId, true, `✅ تم ${state}`);
  }

  async handleToggleEjectTelegram(ctx: SettingsModuleContext, targetTelegramId: bigint): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;
    const actorTelegramId = ctx.from?.id ? BigInt(ctx.from.id) : undefined;
    const res = await this.service.toggleEjectTelegram(targetTelegramId, actorTelegramId);
    if (!res.success || !res.user) {
      await showModalAlert(ctx, res.error || 'فشلت العملية.');
      return;
    }
    const state = res.user.ejectTelegramOnLeave ? 'تفعيل حجب التيليجرام بالإجازة 🚫' : 'إلغاء حجب التيليجرام بالإجازة (بقاء بالمجموعة) 👥';
    await showModalAlert(ctx, `✅ تم ${state}`);
    await this.renderUserAssignmentCard(ctx, targetTelegramId, true, `✅ تم ${state}`);
  }

  async handleStartLeave(ctx: SettingsModuleContext, targetTelegramId: bigint): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;
    const actorTelegramId = ctx.from?.id ? BigInt(ctx.from.id) : undefined;
    const actorName = ctx.from?.first_name || 'مدير عام';
    const res = await this.service.setLeaveStatus(targetTelegramId, true, actorTelegramId, actorName);
    if (!res.success || !res.user) {
      await showModalAlert(ctx, res.error || 'فشلت العملية.');
      return;
    }
    await showModalAlert(ctx, '🌴 تم تسجيل بدء إجازة للمشرف وإنفاذ السياسات بنجاح.');
    await this.renderUserAssignmentCard(ctx, targetTelegramId, true, '🌴 تم تسجيل بدء إجازة للمشرف بنجاح');
  }

  async handleReturnFromLeave(ctx: SettingsModuleContext, targetTelegramId: bigint): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;
    const actorTelegramId = ctx.from?.id ? BigInt(ctx.from.id) : undefined;
    const actorName = ctx.from?.first_name || 'مدير عام';
    const res = await this.service.setLeaveStatus(targetTelegramId, false, actorTelegramId, actorName);
    if (!res.success || !res.user) {
      await showModalAlert(ctx, res.error || 'فشلت العملية.');
      return;
    }
    await showModalAlert(ctx, '🟢 تم تسجيل استئناف عمل المشرف والعودة من الإجازة بنجاح.');
    await this.renderUserAssignmentCard(ctx, targetTelegramId, true, '🟢 تم تسجيل استئناف عمل المشرف بنجاح');
  }
}
