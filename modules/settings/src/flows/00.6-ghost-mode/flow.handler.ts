import type { SettingsModuleContext } from '../../shared/module.types.js';
import type { GhostModeService } from './flow.service.js';
import {
  buildGhostModeMenuKeyboard,
  buildExitGhostKeyboard,
} from './flow.keyboard.js';
import {
  formatGhostModeMenu,
  formatImpersonateSuccess,
  formatExitGhostSuccess,
} from './flow.messages.js';

export class GhostModeHandler {
  constructor(private readonly service: GhostModeService) {}

  async renderGhostModeMenu(ctx: SettingsModuleContext): Promise<void> {
    if (!ctx.isRealSuperAdmin) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({
          text: '🔒 خاصية المحاكاة مخصصة حصرياً للمدير العام.',
          show_alert: true,
        }).catch(() => {});
      } else {
        await ctx.reply('🔒 خاصية المحاكاة مخصصة حصرياً للمدير العام.');
      }
      return;
    }

    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const keyboard = buildGhostModeMenuKeyboard();
    const text = formatGhostModeMenu();

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {
        // fallback
      }
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async handleImpersonateRole(ctx: SettingsModuleContext, roleStr: string): Promise<void> {
    if (!ctx.isRealSuperAdmin || !ctx.from) return;
    const telegramId = BigInt(ctx.from.id);

    const res = await this.service.impersonate(telegramId, roleStr);
    if (!res.success || !res.role) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: `❌ ${res.error}`, show_alert: true }).catch(() => {});
      }
      return;
    }

    ctx.effectiveRole = res.role;
    ctx.isImpersonating = true;

    const keyboard = buildExitGhostKeyboard();
    const text = formatImpersonateSuccess(res.role);

    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: '🎭 تم تفعيل المحاكاة' }).catch(() => {});
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {
        // fallback
      }
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async handleExitImpersonate(ctx: SettingsModuleContext): Promise<void> {
    if (!ctx.from) return;
    const telegramId = BigInt(ctx.from.id);

    await this.service.exitImpersonate(telegramId);
    ctx.effectiveRole = 'SUPER_ADMIN';
    ctx.isImpersonating = false;

    const text = formatExitGhostSuccess();
    const keyboard = new (await import('grammy')).InlineKeyboard()
      .text('⚙️ العودة لمركز الإعدادات', 'menu:super_admin_settings')
      .text('🏠 القائمة الرئيسية', 'action:main_menu');

    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: '👑 تم استعادة صلاحيات المدير العام' }).catch(() => {});
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {
        // fallback
      }
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
}
