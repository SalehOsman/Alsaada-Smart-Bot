import type { SettingsModuleContext } from '../../shared/module.types.js';
import type { AdminProfileService } from './flow.service.js';
import type { AdminFieldKey } from './flow.types.js';
import {
  buildAdminProfileKeyboard,
  buildFieldAdminProfileKeyboard,
  buildCancelAdminEditKeyboard,
} from './flow.keyboard.js';
import {
  formatAdminProfileCard,
  formatFieldAdminProfileCard,
  formatEditAdminFieldPrompt,
} from './flow.messages.js';

export class AdminProfileHandler {
  constructor(private readonly service: AdminProfileService) {}

  async renderAdminProfile(ctx: SettingsModuleContext, inPlace = false, noticeText?: string): Promise<void> {
    if (!ctx.from) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const telegramId = BigInt(ctx.from.id);
    await this.service.clearPendingEdit(telegramId);

    const profile = await this.service.getProfile(telegramId);
    if (!profile) {
      await ctx.reply('⚠️ لم يتم العثور على سجل حسابك في قاعدة البيانات.');
      return;
    }

    const keyboard = buildAdminProfileKeyboard(ctx.isImpersonating);
    const text = formatAdminProfileCard(profile, noticeText);

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

  async renderFieldAdminProfile(ctx: SettingsModuleContext, inPlace = false, noticeText?: string): Promise<void> {
    if (!ctx.from) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const telegramId = BigInt(ctx.from.id);
    await this.service.clearPendingEdit(telegramId);

    const profile = await this.service.getProfile(telegramId);
    if (!profile) {
      await ctx.reply('⚠️ لم يتم العثور على سجل حسابك في قاعدة البيانات.');
      return;
    }

    const keyboard = buildFieldAdminProfileKeyboard(ctx.isImpersonating);
    const text = formatFieldAdminProfileCard(profile, noticeText);

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

  async handleStartEdit(ctx: SettingsModuleContext, fieldKey: AdminFieldKey): Promise<void> {
    if (!ctx.from || !ctx.callbackQuery) return;
    await ctx.answerCallbackQuery().catch(() => {});

    const telegramId = BigInt(ctx.from.id);
    const profile = await this.service.getProfile(telegramId);
    const currentVal = profile ? (fieldKey === 'fullName' ? profile.fullName : profile.phone) : 'غير مسجل';

    const messageId = ctx.callbackQuery.message?.message_id || 0;
    await this.service.setPendingEdit(telegramId, {
      fieldKey,
      promptMessageId: messageId,
      timestamp: Date.now(),
    });

    const keyboard = buildCancelAdminEditKeyboard();
    const text = formatEditAdminFieldPrompt(fieldKey, currentVal || 'غير مسجل');

    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard }).catch(() => ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard }));
  }

  async handleTextInput(ctx: SettingsModuleContext): Promise<boolean> {
    if (!ctx.from || !ctx.message?.text) return false;
    const telegramId = BigInt(ctx.from.id);

    const pending = await this.service.getPendingEdit(telegramId);
    if (!pending) return false;

    const val = ctx.message.text.trim();
    await ctx.deleteMessage().catch(() => {});
    await this.service.clearPendingEdit(telegramId);

    let res: { success: boolean; error?: string };
    if (pending.fieldKey === 'fullName') {
      res = await this.service.updateFullName(telegramId, val);
    } else {
      res = await this.service.updatePhone(telegramId, val);
    }

    if (!res.success) {
      await ctx.reply(`❌ فشل التحديث: ${res.error}`);
      return true;
    }

    await this.renderAdminProfile(ctx, false, `✅ تم تحديث ${pending.fieldKey === 'fullName' ? 'الاسم الرسمي' : 'رقم الهاتف'} بنجاح.`);
    return true;
  }
}
