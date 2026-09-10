import type { SettingsModuleContext } from '../../shared/module.types.js';
import type { CorporateProfileService } from './flow.service.js';
import type { CompanyFieldKey } from './flow.types.js';
import {
  buildCorporateProfileKeyboard,
  buildCancelCompanyEditKeyboard,
} from './flow.keyboard.js';
import {
  formatCorporateProfileCard,
  formatEditFieldPrompt,
  formatEditSuccessNotice,
} from './flow.messages.js';

export class CorporateProfileHandler {
  constructor(private readonly service: CorporateProfileService) {}

  async renderCard(
    ctx: SettingsModuleContext,
    inPlace = false,
    noticeText?: string
  ): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({
          text: '🔒 هذا القسم مخصص حصرياً للمدير العام.',
          show_alert: true,
        }).catch(() => {});
      } else {
        await ctx.reply('🔒 هذا القسم مخصص حصرياً للمدير العام.');
      }
      return;
    }

    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery().catch(() => {});
    }

    if (ctx.from) {
      await this.service.clearPendingEdit(BigInt(ctx.from.id));
    }

    const profile = await this.service.getProfile();
    const keyboard = buildCorporateProfileKeyboard(ctx.isImpersonating);
    const text = formatCorporateProfileCard(profile, noticeText);

    if (inPlace && ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
        return;
      } catch {
        // fallback
      }
    }

    await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  async handleStartEdit(ctx: SettingsModuleContext, fieldKey: CompanyFieldKey): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;
    if (!ctx.from || !ctx.callbackQuery) return;

    await ctx.answerCallbackQuery().catch(() => {});

    const profile = await this.service.getProfile();
    const currentValue = profile ? (profile[fieldKey] || 'غير محدد') : 'غير محدد';
    const messageId = ctx.callbackQuery.message?.message_id;
    if (!messageId) return;

    await this.service.setPendingEdit(BigInt(ctx.from.id), fieldKey, messageId);

    const keyboard = buildCancelCompanyEditKeyboard();
    const text = formatEditFieldPrompt(fieldKey, currentValue);

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch {
      await ctx.reply(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    }
  }

  async handleTextInput(ctx: SettingsModuleContext): Promise<boolean> {
    if (!ctx.from || !ctx.message?.text) return false;
    const telegramId = BigInt(ctx.from.id);

    const pending = await this.service.getPendingEdit(telegramId);
    if (!pending) return false;

    const newValue = ctx.message.text.trim();
    const result = await this.service.updateField(pending.fieldKey, newValue);

    // Delete user input message to keep chat clean
    await ctx.deleteMessage().catch(() => {});
    await this.service.clearPendingEdit(telegramId);

    if (!result.success) {
      await ctx.reply(`❌ ${result.error || 'حدث خطأ أثناء التحديث.'}`);
      return true;
    }

    const notice = formatEditSuccessNotice(pending.fieldKey, newValue);
    await this.renderCard(ctx, false, notice);
    return true;
  }
}
