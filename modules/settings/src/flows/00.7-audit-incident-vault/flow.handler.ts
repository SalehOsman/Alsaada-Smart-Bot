import type { SettingsModuleContext } from '../../shared/module.types.js';
import type { AuditIncidentVaultService } from './flow.service.js';
import {
  buildAuditVaultHubKeyboard,
  buildUnresolvedErrorsKeyboard,
  buildErrorDetailKeyboard,
  buildPurgeConfirmationKeyboard,
} from './flow.keyboard.js';
import {
  formatAuditVaultHub,
  formatUserJourneyTimeline,
  formatUnresolvedErrorsList,
  formatErrorDetailCard,
  formatPurgeSummary,
} from './flow.messages.js';

export class AuditIncidentVaultHandler {
  private awaitingJourneyInput = new Set<string>();

  constructor(private readonly service: AuditIncidentVaultService) {}

  async renderAuditVaultHub(ctx: SettingsModuleContext, inPlace = false, noticeText?: string): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    if (ctx.from) this.awaitingJourneyInput.delete(ctx.from.id.toString());

    const keyboard = buildAuditVaultHubKeyboard(ctx.isImpersonating);
    const text = formatAuditVaultHub(noticeText);

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

  async handlePromptJourney(ctx: SettingsModuleContext): Promise<void> {
    if (!ctx.isRealSuperAdmin || !ctx.from) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    this.awaitingJourneyInput.add(ctx.from.id.toString());

    const keyboard = new (await import('grammy')).InlineKeyboard()
      .text('❌ إلغاء والعودة', 'action:settings:audit_vault');

    const text =
      `🔍 *تتبع مسار مستخدم محدد (User Audit Journey Inspector)*\n` +
      `────────────────────────────\n` +
      `💬 *أرسل الآن معرف التيليجرام أو كود العامل في رسالة:*\n` +
      `(مثال: \`7594239391\` أو \`OP-01\`)\n\n` +
      `سيقوم النظام فورياً بجلب آخر 10 إجراءات قام بها مع أوقات استجابتها بالميلي ثانية.`;

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {}
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async handleJourneyInput(ctx: SettingsModuleContext): Promise<boolean> {
    if (!ctx.from || !ctx.message?.text) return false;
    const userId = ctx.from.id.toString();
    if (!this.awaitingJourneyInput.has(userId)) return false;

    this.awaitingJourneyInput.delete(userId);
    const input = ctx.message.text.trim();
    await ctx.deleteMessage().catch(() => {});

    const res = await this.service.getUserJourney(input);
    if (res.error) {
      await ctx.reply(`❌ ${res.error}`);
      return true;
    }

    const keyboard = new (await import('grammy')).InlineKeyboard()
      .text('🔍 فحص مستخدم آخر', 'action:audit:journey_prompt')
      .row()
      .text('🔙 العودة لكنسول التحقيق الجنائي', 'action:settings:audit_vault');

    const text = formatUserJourneyTimeline(res.target, res.steps);
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    return true;
  }

  async renderUnresolvedErrorsList(ctx: SettingsModuleContext, page = 1, inPlace = false): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const { total, errors } = await this.service.listUnresolvedErrors(page, 5);
    const keyboard = buildUnresolvedErrorsKeyboard(errors, page, total, 5);
    const text = formatUnresolvedErrorsList(total, page);

    if (inPlace && ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {}
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async renderErrorDetail(ctx: SettingsModuleContext, errorId: string, inPlace = false): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const err = await this.service.getErrorById(errorId);
    if (!err) {
      await this.renderUnresolvedErrorsList(ctx, 1, inPlace);
      return;
    }

    const keyboard = buildErrorDetailKeyboard(errorId);
    const text = formatErrorDetailCard(err);

    if (inPlace && ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
        return;
      } catch {}
    }
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
  }

  async handleResolveError(ctx: SettingsModuleContext, errorId: string): Promise<void> {
    if (!ctx.isRealSuperAdmin || !ctx.from) return;
    const telegramId = BigInt(ctx.from.id);

    await this.service.resolveError(errorId, telegramId);
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: '✅ تم اعتماد الإصلاح وإغلاق العطل بنجاح.' }).catch(() => {});
    }

    await this.renderUnresolvedErrorsList(ctx, 1, true);
  }

  async handlePromptPurge(ctx: SettingsModuleContext): Promise<void> {
    if (!ctx.isRealSuperAdmin) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const keyboard = buildPurgeConfirmationKeyboard();
    const text =
      `🧹 *أرشفة وتطهير السجلات (Log Purge & Archival Utility)*\n` +
      `────────────────────────────\n` +
      `⚠️ *تحذير:* سيؤدي هذا الإجراء إلى حذف جميع سجلات الأعطال البرمجية المحلولة وسجلات قياس الأداء APM الأقدم من 30 يوماً بشكل نهائي لحماية مساحة قاعدة البيانات.\n\n` +
      `هل ترغب في الاستمرار؟`;

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {}
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async handleConfirmPurge(ctx: SettingsModuleContext): Promise<void> {
    if (!ctx.isRealSuperAdmin) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const res = await this.service.purgeOldLogs(30);
    const notice = formatPurgeSummary(res);

    await this.renderAuditVaultHub(ctx, true, notice);
  }
}
