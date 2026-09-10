import type { SettingsModuleContext } from '../../shared/module.types.js';
import type { GhostModeService } from './flow.service.js';
import {
  buildGhostModeMenuKeyboard,
  buildWorkerPickerKeyboard,
  buildSupplierPickerKeyboard,
  buildExitGhostKeyboard,
} from './flow.keyboard.js';
import {
  formatGhostModeMenu,
  formatWorkerPickerHeader,
  formatSupplierPickerHeader,
  formatImpersonateSuccess,
  formatExitGhostSuccess,
} from './flow.messages.js';

export class GhostModeHandler {
  constructor(
    private readonly service: GhostModeService,
    private readonly onStateChanged?: (telegramId: bigint) => Promise<void>
  ) {}

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

  async handlePickWorker(ctx: SettingsModuleContext): Promise<void> {
    if (!ctx.isRealSuperAdmin || !ctx.from) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const workers = await this.service.getActiveWorkers();
    const keyboard = buildWorkerPickerKeyboard(workers);
    const text = formatWorkerPickerHeader();

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {}
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async handleSelectWorker(ctx: SettingsModuleContext, workerId: string): Promise<void> {
    if (!ctx.isRealSuperAdmin || !ctx.from) return;
    const telegramId = BigInt(ctx.from.id);

    const res = await this.service.impersonateWorker(telegramId, workerId);
    if (!res.success) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: `❌ ${res.error}`, show_alert: true }).catch(() => {});
      }
      return;
    }

    ctx.effectiveRole = 'WORKER';
    ctx.isImpersonating = true;
    if (this.onStateChanged) {
      await this.onStateChanged(telegramId);
    }

    const keyboard = buildExitGhostKeyboard();
    const text = formatImpersonateSuccess('WORKER', res.workerName);

    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: '🎭 تم تقمص دور العامل' }).catch(() => {});
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {}
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async handlePickSupplier(ctx: SettingsModuleContext): Promise<void> {
    if (!ctx.isRealSuperAdmin || !ctx.from) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const suppliers = await this.service.getActiveSuppliers();
    const keyboard = buildSupplierPickerKeyboard(suppliers);
    const text = formatSupplierPickerHeader();

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {}
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async handleSelectSupplier(ctx: SettingsModuleContext, supplierId: string): Promise<void> {
    if (!ctx.isRealSuperAdmin || !ctx.from) return;
    const telegramId = BigInt(ctx.from.id);

    const res = await this.service.impersonateSupplier(telegramId, supplierId);
    if (!res.success) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: `❌ ${res.error}`, show_alert: true }).catch(() => {});
      }
      return;
    }

    ctx.effectiveRole = 'SUPPLIER';
    ctx.isImpersonating = true;
    if (this.onStateChanged) {
      await this.onStateChanged(telegramId);
    }

    const keyboard = buildExitGhostKeyboard();
    const text = formatImpersonateSuccess('SUPPLIER', res.supplierName);

    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: '🎭 تم تقمص دور المورد' }).catch(() => {});
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {}
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async handleImpersonateRole(ctx: SettingsModuleContext, roleStr: string): Promise<void> {
    if (!ctx.isRealSuperAdmin || !ctx.from) return;
    const telegramId = BigInt(ctx.from.id);

    if (roleStr === 'pick_worker') {
      return this.handlePickWorker(ctx);
    }
    if (roleStr === 'pick_supplier') {
      return this.handlePickSupplier(ctx);
    }

    const res = await this.service.impersonate(telegramId, roleStr);
    if (!res.success || !res.role) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: `❌ ${res.error}`, show_alert: true }).catch(() => {});
      }
      return;
    }

    ctx.effectiveRole = res.role;
    ctx.isImpersonating = true;
    if (this.onStateChanged) {
      await this.onStateChanged(telegramId);
    }

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
    if (this.onStateChanged) {
      await this.onStateChanged(telegramId);
    }

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

