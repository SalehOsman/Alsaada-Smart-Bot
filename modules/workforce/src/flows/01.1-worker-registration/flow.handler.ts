import type { Context } from 'grammy';
import type { WorkforceModuleContext } from '../../shared/module.types.js';
import { WorkerRegistrationService } from './flow.service.js';
import { WorkerRegistrationRepository } from './flow.repository.js';
import { WorkerRegistrationMessages } from './flow.messages.js';
import { WorkerRegistrationKeyboards } from './flow.keyboard.js';
import { WorkerWizardStep, type PendingWorkerWizardState } from './flow.types.js';
import {
  validateWorkerFullName,
  validateWorkerIdentification,
  validateWorkerPhoneNumber,
  validateWorkerHireDate,
} from './flow.validators.js';
import { extractFirstTwoNames } from '@alsaada/regional-engine';

export class WorkerRegistrationHandler {
  constructor(
    private readonly service: WorkerRegistrationService,
    private readonly repository: WorkerRegistrationRepository
  ) {}

  private checkRbac(ctx: WorkforceModuleContext): boolean {
    const role = ctx.effectiveRole || 'GUEST';
    const blockedRoles = ['WORKER', 'SUPPLIER', 'GUEST'];
    return !blockedRoles.includes(role);
  }

  private async replyOrEdit(
    ctx: Context,
    text: string,
    keyboard?: ReturnType<typeof WorkerRegistrationKeyboards.docTypeKeyboard>
  ): Promise<void> {
    if (ctx.callbackQuery?.message) {
      try {
        await ctx.editMessageText(text, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
        return;
      } catch {
        // Fallback to sending new message if edit fails
      }
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async handleStart(ctx: WorkforceModuleContext): Promise<void> {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery().catch(() => {});
    }
    if (!this.checkRbac(ctx)) {
      await this.replyOrEdit(ctx, '⛔ عذراً، لا تملك الصلاحية للوصول إلى معالج تسجيل العمال.');
      return;
    }
    if (!ctx.from) return;

    const telegramId = BigInt(ctx.from.id);
    await this.service.clearDraft(telegramId);
    await this.service.pushStep(telegramId, WorkerWizardStep.DOC_TYPE);

    const text = WorkerRegistrationMessages.docTypePrompt();
    const keyboard = WorkerRegistrationKeyboards.docTypeKeyboard();
    await this.replyOrEdit(ctx, text, keyboard);
  }

  async handleDocType(ctx: WorkforceModuleContext, idType: 'NATIONAL_ID' | 'PASSPORT'): Promise<void> {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery().catch(() => {});
    }
    if (!ctx.from) return;
    const telegramId = BigInt(ctx.from.id);

    await this.service.pushStep(telegramId, WorkerWizardStep.PHOTO_FRONT, { idType });
    const text = WorkerRegistrationMessages.photoFrontPrompt(idType === 'PASSPORT');
    const keyboard = WorkerRegistrationKeyboards.photoPromptKeyboard(true);
    await this.replyOrEdit(ctx, text, keyboard);
  }

  async handleSkipPhoto(ctx: WorkforceModuleContext): Promise<void> {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery().catch(() => {});
    }
    if (!ctx.from) return;
    const telegramId = BigInt(ctx.from.id);
    const draft = await this.service.getDraft(telegramId);
    const isPassport = draft?.idType === 'PASSPORT';

    await this.service.pushStep(telegramId, WorkerWizardStep.FULL_NAME);
    const text = WorkerRegistrationMessages.namePrompt();
    const keyboard = WorkerRegistrationKeyboards.photoPromptKeyboard(true);
    await this.replyOrEdit(ctx, text, keyboard);
  }

  async handleTextInput(ctx: WorkforceModuleContext, textInput: string): Promise<void> {
    if (!ctx.from) return;
    const telegramId = BigInt(ctx.from.id);
    const draft = await this.service.getDraft(telegramId);
    if (!draft) return;

    await ctx.deleteMessage().catch(() => {});
    const cleanText = textInput.trim();

    switch (draft.currentStep) {
      case WorkerWizardStep.FULL_NAME: {
        const val = validateWorkerFullName(cleanText);
        if (!val.isValid) {
          await this.replyOrEdit(ctx, `⚠️ ${val.error || 'الاسم غير صالح'}`, WorkerRegistrationKeyboards.interactiveErrorKeyboard('name'));
          return;
        }
        const firstTwo = extractFirstTwoNames(cleanText);
        await this.service.pushStep(telegramId, WorkerWizardStep.NICKNAME, { name: cleanText, nickname: firstTwo });
        const prompt = WorkerRegistrationMessages.nicknamePrompt(cleanText);
        const kb = WorkerRegistrationKeyboards.nicknameSuggestionKeyboard(firstTwo);
        await this.replyOrEdit(ctx, prompt, kb);
        break;
      }

      case WorkerWizardStep.NICKNAME: {
        await this.service.pushStep(telegramId, WorkerWizardStep.ID_NUMBER, { nickname: cleanText });
        const prompt = WorkerRegistrationMessages.idNumberPrompt(draft.idType === 'PASSPORT');
        await this.replyOrEdit(ctx, prompt, WorkerRegistrationKeyboards.photoPromptKeyboard(true));
        break;
      }

      case WorkerWizardStep.ID_NUMBER: {
        const val = validateWorkerIdentification(draft.idType || 'NATIONAL_ID', cleanText, {
          birthDate: new Date('1990-01-01'),
          gender: 'MALE',
        });
        if (!val.isValid) {
          await this.replyOrEdit(ctx, `⚠️ ${val.error || 'رقم الإثبات غير صالح'}`, WorkerRegistrationKeyboards.interactiveErrorKeyboard('id_number'));
          return;
        }
        const dup = await this.service.checkDuplicate(draft.idType || 'NATIONAL_ID', cleanText);
        if (dup.isDuplicate) {
          await this.replyOrEdit(
            ctx,
            `⚠️ العامل مسجل مسبقاً في النظام باسم: *${dup.existingWorker?.name}* وكود: *${dup.existingWorker?.code}*`,
            WorkerRegistrationKeyboards.interactiveErrorKeyboard('id_number')
          );
          return;
        }
        await this.service.pushStep(telegramId, WorkerWizardStep.PHONE, { idNumber: cleanText });
        const prompt = WorkerRegistrationMessages.phonePrompt(draft.name || '');
        await this.replyOrEdit(ctx, prompt, WorkerRegistrationKeyboards.photoPromptKeyboard(true));
        break;
      }

      case WorkerWizardStep.PHONE: {
        const val = validateWorkerPhoneNumber(cleanText);
        if (!val.isValid || !val.normalized) {
          await this.replyOrEdit(ctx, `⚠️ ${val.error || 'رقم الهاتف غير صالح'}`, WorkerRegistrationKeyboards.interactiveErrorKeyboard('phone'));
          return;
        }
        await this.service.pushStep(telegramId, WorkerWizardStep.PAYOUT_METHOD_CHOICE, { phone: val.normalized });
        const prompt = WorkerRegistrationMessages.payoutMethodPrompt();
        const kb = WorkerRegistrationKeyboards.payoutMethodKeyboard();
        await this.replyOrEdit(ctx, prompt, kb);
        break;
      }

      case WorkerWizardStep.START_DATE_CHOICE: {
        const val = validateWorkerHireDate(cleanText);
        if (!val.isValid || !val.date) {
          await this.replyOrEdit(ctx, `⚠️ ${val.error || 'صيغة التاريخ غير صالحة'}`, WorkerRegistrationKeyboards.interactiveErrorKeyboard('start_date'));
          return;
        }
        const updated = await this.service.pushStep(telegramId, WorkerWizardStep.CONFIRMATION, { hireDate: cleanText });
        const card = WorkerRegistrationMessages.confirmationCard(updated);
        const kb = WorkerRegistrationKeyboards.confirmationKeyboard();
        await this.replyOrEdit(ctx, card, kb);
        break;
      }

      default:
        break;
    }
  }

  async handlePayoutChoice(ctx: WorkforceModuleContext, payoutMethod: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (!ctx.from) return;
    const telegramId = BigInt(ctx.from.id);

    await this.service.pushStep(telegramId, WorkerWizardStep.JOB_CHOICE, { paymentMethod: payoutMethod });
    const jobs = await this.repository.listActiveJobs();
    const prompt = WorkerRegistrationMessages.jobChoicePrompt();
    const kb = WorkerRegistrationKeyboards.optionsGridKeyboard(jobs, 'job');
    await this.replyOrEdit(ctx, prompt, kb);
  }

  async handleJobChoice(ctx: WorkforceModuleContext, jobId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (!ctx.from) return;
    const telegramId = BigInt(ctx.from.id);

    const jobs = await this.repository.listActiveJobs();
    const job = jobs.find((j) => j.id === jobId);
    await this.service.pushStep(telegramId, WorkerWizardStep.SITE_CHOICE, {
      jobTitleId: jobId,
      jobTitleName: job?.name || 'عامل',
    });

    const sites = await this.repository.listActiveSites();
    const prompt = WorkerRegistrationMessages.siteChoicePrompt();
    const kb = WorkerRegistrationKeyboards.optionsGridKeyboard(sites, 'site');
    await this.replyOrEdit(ctx, prompt, kb);
  }

  async handleSiteChoice(ctx: WorkforceModuleContext, siteId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (!ctx.from) return;
    const telegramId = BigInt(ctx.from.id);

    const sites = await this.repository.listActiveSites();
    const site = sites.find((s) => s.id === siteId);
    await this.service.pushStep(telegramId, WorkerWizardStep.START_DATE_CHOICE, {
      siteId,
      siteName: site?.name || 'الموقع الميداني',
    });

    const prompt = WorkerRegistrationMessages.startDatePrompt();
    await this.replyOrEdit(ctx, prompt, WorkerRegistrationKeyboards.photoPromptKeyboard(true));
  }

  async handleConfirm(ctx: WorkforceModuleContext): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (!ctx.from) return;
    const telegramId = BigInt(ctx.from.id);
    const draft = await this.service.getDraft(telegramId);
    if (!draft || !draft.name || !draft.idNumber || !draft.phone) {
      await this.replyOrEdit(ctx, '⚠️ بيانات المعالج غير مكتملة. يرجى البدء من جديد.', WorkerRegistrationKeyboards.interactiveErrorKeyboard('start'));
      return;
    }

    try {
      const result = await this.service.registerWorker(
        {
          name: draft.name,
          nickname: draft.nickname,
          idType: draft.idType || 'NATIONAL_ID',
          idNumber: draft.idNumber,
          phone: draft.phone,
          jobTitleId: draft.jobTitleId,
          jobTitleName: draft.jobTitleName || 'عامل',
          siteId: draft.siteId,
          siteName: draft.siteName,
          paymentMethod: draft.paymentMethod || 'CASH_SITE',
          hireDate: draft.hireDate ? new Date() : new Date(),
        },
        telegramId,
        ctx.effectiveRole || 'ADMIN'
      );

      await this.service.clearDraft(telegramId);
      const text = WorkerRegistrationMessages.registrationSuccess({
        code: result.code,
        name: result.name,
        jobTitle: result.jobTitle,
        siteName: result.siteName,
        hireDate: result.hireDate,
      });
      const kb = WorkerRegistrationKeyboards.completionKeyboard(result.welcomeWhatsAppUrl);
      await this.replyOrEdit(ctx, text, kb);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر حفظ ملف العامل';
      await this.replyOrEdit(ctx, `❌ خطأ أثناء التسجيل: ${msg}`, WorkerRegistrationKeyboards.interactiveErrorKeyboard('confirm'));
    }
  }

  async handleCancel(ctx: WorkforceModuleContext): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (ctx.from) {
      await this.service.clearDraft(BigInt(ctx.from.id));
    }
    const text = WorkerRegistrationMessages.cancelled();
    await this.replyOrEdit(ctx, text);
  }

  async handleBack(ctx: WorkforceModuleContext): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (!ctx.from) return;
    const telegramId = BigInt(ctx.from.id);
    const popped = await this.service.popStep(telegramId);
    if (!popped) {
      await this.handleStart(ctx);
      return;
    }

    if (popped.currentStep === WorkerWizardStep.DOC_TYPE) {
      await this.replyOrEdit(ctx, WorkerRegistrationMessages.docTypePrompt(), WorkerRegistrationKeyboards.docTypeKeyboard());
    } else {
      await this.replyOrEdit(ctx, `◀️ عدت للخطوة السابقة (${popped.currentStep}). أعد الإدخال:`, WorkerRegistrationKeyboards.photoPromptKeyboard(true));
    }
  }
}
