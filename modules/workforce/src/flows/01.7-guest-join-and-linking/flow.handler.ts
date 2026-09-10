import type { Bot } from 'grammy';
import type { WorkforceModuleContext } from '../../shared/module.types.js';
import type { GuestJoinService } from './flow.service.js';
import type { GuestJoinState } from './flow.types.js';
import {
  buildGuestSearchCancelKeyboard,
  buildAfterSubmitKeyboard,
  buildAdminDispatchKeyboard,
} from './flow.keyboard.js';
import {
  formatSearchPrompt,
  formatApplicationSubmitted,
  formatApplicationStatus,
  formatAdminApprovalCard,
} from './flow.messages.js';
import { logGuestJoinTelemetry } from './flow.telemetry.js';

export class GuestJoinHandler {
  private activeStates = new Map<string, GuestJoinState>();

  constructor(private readonly service: GuestJoinService) {}

  registerRoutes(bot: Bot<WorkforceModuleContext>): void {
    bot.callbackQuery('wizard:guest_join:start', async (ctx) => {
      await this.handleStartGuestJoin(ctx);
    });

    bot.callbackQuery('action:guest_join:status', async (ctx) => {
      await this.handleStatusCheck(ctx);
    });

    bot.callbackQuery('action:guest_join:cancel', async (ctx) => {
      await this.handleCancel(ctx);
    });

    bot.callbackQuery(/^action:guest_join:gen:([^:]+):(\d+)$/, async (ctx) => {
      const workerCode = ctx.match[1];
      const applicantId = ctx.match[2];
      if (workerCode && applicantId) {
        await this.handleGenerateAdminLink(ctx, workerCode, BigInt(applicantId));
      }
    });
  }

  async handleStartGuestJoin(ctx: WorkforceModuleContext): Promise<void> {
    if (!ctx.from) return;
    const telegramId = BigInt(ctx.from.id);

    if (ctx.effectiveRole && ctx.effectiveRole !== 'GUEST') {
      const alreadyRegisteredMsg = 'ℹ️ حسابك مسجل ومفعل بالفعل بالمنظومة ولديك صلاحيات معتمدة.';
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: alreadyRegisteredMsg, show_alert: true }).catch(() => {});
      } else {
        await ctx.reply(alreadyRegisteredMsg);
      }
      return;
    }

    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const state: GuestJoinState = {
      step: 'SEARCH',
      applicantTelegramId: telegramId,
      applicantUsername: ctx.from.username,
      applicantFullName: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' '),
      createdAt: Date.now(),
    };
    this.activeStates.set(telegramId.toString(), state);

    const text = formatSearchPrompt();
    const keyboard = buildGuestSearchCancelKeyboard();

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {}
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async handleTextInput(ctx: WorkforceModuleContext, text: string): Promise<boolean> {
    if (!ctx.from) return false;
    const telegramId = BigInt(ctx.from.id);
    const state = this.activeStates.get(telegramId.toString());

    if (!state || state.step !== 'SEARCH') {
      return false;
    }

    const query = text.trim();
    const startTime = Date.now();

    try {
      const res = await this.service.submitJoinRequest(
        telegramId,
        query,
        state.applicantUsername,
        state.applicantFullName
      );

      this.activeStates.delete(telegramId.toString());
      logGuestJoinTelemetry({
        action: 'SUBMIT',
        workerCode: res.workerCode,
        applicantTelegramId: telegramId,
        executionTimeMs: Date.now() - startTime,
        success: true,
      });

      const successText = formatApplicationSubmitted(res.workerName, res.workerCode, res.ticketNumber);
      const keyboard = buildAfterSubmitKeyboard();
      await ctx.reply(successText, { parse_mode: 'Markdown', reply_markup: keyboard });

      return true;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'تعذر تقديم طلب الانضمام.';
      await ctx.reply(`❌ ${errMsg}\n\nيرجى إعادة إدخال الكود الوظيفي بشكل صحيح:`, {
        reply_markup: buildGuestSearchCancelKeyboard(),
      });
      return true;
    }
  }

  async handleStatusCheck(ctx: WorkforceModuleContext): Promise<void> {
    if (!ctx.from) return;
    const telegramId = BigInt(ctx.from.id);

    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const ticket = await this.service.checkApplicantStatus(telegramId);
    const text = formatApplicationStatus(Boolean(ticket), ticket?.ticketNumber, ticket?.status);
    const keyboard = buildAfterSubmitKeyboard();

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {}
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async handleGenerateAdminLink(ctx: WorkforceModuleContext, workerCode: string, applicantId: bigint): Promise<void> {
    if (!ctx.from) return;
    if (ctx.effectiveRole !== 'SUPER_ADMIN' && ctx.effectiveRole !== 'FIELD_ADMIN') {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: '🔒 غير مصرح لك بتوليد روابط الاعتماد.', show_alert: true }).catch(() => {});
      }
      return;
    }

    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const worker = await this.service.searchWorkerForGuest(workerCode);
    if (!worker) {
      await ctx.reply('❌ تعذر العثور على سجل العامل.');
      return;
    }

    const officialPhone = this.service.decryptFieldSafe(worker.phoneEncrypted) || '01000000000';
    const { whatsAppUrl, deepLink } = this.service.generateVerificationWhatsAppUrl(
      worker.code,
      worker.nickname || worker.name,
      officialPhone,
      applicantId,
      ctx.me?.username || 'AlsaadaSmartBot'
    );

    const cardText =
      formatAdminApprovalCard(
        `تليجرام: ${applicantId.toString()}`,
        applicantId,
        worker.nickname || worker.name,
        worker.code,
        officialPhone
      ) + `\n\n🔗 *رابط الدعوة المولد (صلاحية 24 ساعة):*\n\`${deepLink}\``;

    const keyboard = buildAdminDispatchKeyboard(officialPhone, whatsAppUrl);

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(cardText, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {}
    }
    await ctx.reply(cardText, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async handleCancel(ctx: WorkforceModuleContext): Promise<void> {
    if (!ctx.from) return;
    const telegramId = BigInt(ctx.from.id);
    this.activeStates.delete(telegramId.toString());

    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: '❌ تم إلغاء العملية' }).catch(() => {});
    }

    const text = '❌ *تم إلغاء تقديم طلب الانضمام.* يمكنك المحاولة مجدداً في أي وقت.';
    const keyboard = buildAfterSubmitKeyboard();

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {}
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  getActiveState(telegramId: bigint): GuestJoinState | undefined {
    return this.activeStates.get(telegramId.toString());
  }

  setActiveState(telegramId: bigint, state: GuestJoinState): void {
    this.activeStates.set(telegramId.toString(), state);
  }
}
