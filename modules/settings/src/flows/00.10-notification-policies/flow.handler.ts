import { showModalAlert } from '@alsaada/core-components';
import type { SettingsModuleContext } from '../../shared/module.types.js';
import type { NotificationPoliciesService } from './flow.service.js';
import type { PolicyScope } from './flow.types.js';
import {
  buildPoliciesHubKeyboard,
  buildScopeDepartmentsKeyboard,
  buildDepartmentDetailKeyboard,
} from './flow.keyboard.js';
import {
  formatPoliciesHubMessage,
  formatScopeDepartmentsMessage,
  formatDepartmentDetailMessage,
} from './flow.messages.js';

export class NotificationPoliciesHandler {
  constructor(private readonly service: NotificationPoliciesService) {}

  private isSuperAdmin(ctx: SettingsModuleContext): boolean {
    return Boolean(
      ctx.isRealSuperAdmin &&
      ctx.effectiveRole === 'SUPER_ADMIN' &&
      !ctx.isImpersonating
    );
  }

  async renderPoliciesHub(ctx: SettingsModuleContext, inPlace = false): Promise<void> {
    if (!this.isSuperAdmin(ctx)) {
      await showModalAlert(ctx, '🔒 هذا القسم مخصص حصرياً للمدير العام.');
      return;
    }

    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const text = formatPoliciesHubMessage();
    const keyboard = buildPoliciesHubKeyboard();

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

  async renderScopeDepartments(
    ctx: SettingsModuleContext,
    scope: PolicyScope,
    inPlace = false
  ): Promise<void> {
    if (!this.isSuperAdmin(ctx)) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const summaries = await this.service.getScopeDepartmentSummaries(scope);
    const text = formatScopeDepartmentsMessage(scope, summaries);
    const keyboard = buildScopeDepartmentsKeyboard(scope, summaries);

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

  async renderDepartmentDetail(
    ctx: SettingsModuleContext,
    scope: PolicyScope,
    departmentKey: string,
    inPlace = false
  ): Promise<void> {
    if (!this.isSuperAdmin(ctx)) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const detail = await this.service.getDepartmentDetail(scope, departmentKey);
    const text = formatDepartmentDetailMessage(detail);
    const keyboard = buildDepartmentDetailKeyboard(detail);

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

  async handleToggleFeature(
    ctx: SettingsModuleContext,
    scope: PolicyScope,
    featureKey: string
  ): Promise<void> {
    if (!this.isSuperAdmin(ctx)) return;

    const nextState = await this.service.toggleFeaturePolicy(scope, featureKey);
    const deptKey = featureKey.split(':')[0] || 'canteen';

    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({
        text: nextState ? '🟢 تم تفعيل الإشعار' : '🔴 تم تعطيل الإشعار',
      }).catch(() => {});
    }

    await this.renderDepartmentDetail(ctx, scope, deptKey, true);
  }

  async handleToggleSilent(
    ctx: SettingsModuleContext,
    scope: PolicyScope,
    featureKey: string
  ): Promise<void> {
    if (!this.isSuperAdmin(ctx)) return;

    const nextSilent = await this.service.toggleFeatureSilent(featureKey);
    const deptKey = featureKey.split(':')[0] || 'canteen';

    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({
        text: nextSilent ? '🔕 تم التبديل للنمط الصامت' : '🔔 تم التبديل لنمط الرنين',
      }).catch(() => {});
    }

    await this.renderDepartmentDetail(ctx, scope, deptKey, true);
  }

  async handleResetScope(ctx: SettingsModuleContext, scope: PolicyScope): Promise<void> {
    if (!this.isSuperAdmin(ctx)) return;

    await this.service.resetScopeToDefaults(scope);
    await showModalAlert(ctx, '🔄 تمت استعادة الإعدادات الافتراضية لهذا المسار بنجاح.');
    await this.renderScopeDepartments(ctx, scope, true);
  }
}
