import type { InlineKeyboard } from 'grammy';
import type { WorkforceModuleContext } from '../../shared/module.types.js';
import { WorkerRegistrationService } from './flow.service.js';
import { WorkerRegistrationRepository } from './flow.repository.js';
import { WorkerRegistrationMessages } from './flow.messages.js';
import { WorkerRegistrationKeyboards } from './flow.keyboard.js';
import { WorkerWizardStep, type PendingWorkerWizardState, DRIVING_LICENSE_MAP, MILITARY_STATUS_MAP, INSURANCE_STATUS_MAP, MARITAL_STATUS_MAP, PAYOUT_METHOD_MAP } from './flow.types.js';
import { validateWorkerFullName, validateWorkerIdentification, validateWorkerPhoneNumber, validateWorkerHireDate } from './flow.validators.js';
import { extractFirstTwoNames, parseFlexibleDate, normalizeDigits } from '@alsaada/regional-engine';
import { notifyFlowOperation, renderInPlaceWizardStep, renderInPlaceCompletion, sendChatActionSafe } from '@alsaada/core-components';

export class WorkerRegistrationHandler {
  constructor(
    private readonly service: WorkerRegistrationService,
    private readonly repository: WorkerRegistrationRepository
  ) {}

  private checkRbac(ctx: WorkforceModuleContext): boolean {
    const role = ctx.effectiveRole || 'GUEST';
    return !['WORKER', 'SUPPLIER', 'GUEST'].includes(role);
  }

  private async renderPrompt(ctx: WorkforceModuleContext, text: string, kb?: InlineKeyboard, draft?: PendingWorkerWizardState): Promise<void> {
    const res = await renderInPlaceWizardStep(ctx, {
      prompt: text, keyboard: kb, activeMessageId: draft?.activeMessageId, chatId: draft?.chatId,
      telegramId: ctx.from ? BigInt(ctx.from.id) : undefined, flowType: 'worker_registration',
    });
    if (draft && res.messageId) { draft.activeMessageId = res.messageId; draft.chatId = res.chatId; }
  }

  private async renderStep(ctx: WorkforceModuleContext, telegramId: bigint, draft: PendingWorkerWizardState): Promise<void> {
    const jobs = draft.currentStep === WorkerWizardStep.JOB_CHOICE ? await this.repository.listActiveJobs() : [];
    const sites = draft.currentStep === WorkerWizardStep.SITE_CHOICE ? await this.repository.listActiveSites() : [];
    const prompt = WorkerRegistrationMessages.getStepPrompt(draft.currentStep, draft, ctx.effectiveRole);
    const kb = WorkerRegistrationKeyboards.getStepKeyboard(draft.currentStep, draft, jobs, sites);
    const res = await renderInPlaceWizardStep(ctx, {
      prompt, keyboard: kb, activeMessageId: draft.activeMessageId, chatId: draft.chatId,
      telegramId, flowType: 'worker_registration',
      onMessageIdUpdated: async (newId) => {
        if (newId !== draft.activeMessageId) {
          draft.activeMessageId = newId;
          await this.service.saveDraft(telegramId, { ...draft, activeMessageId: newId, chatId: ctx.chat?.id || draft.chatId });
        }
      },
    });
    if (res.messageId && res.messageId !== draft.activeMessageId) {
      draft.activeMessageId = res.messageId;
      draft.chatId = res.chatId;
    }
  }

  private async handleChoiceStep(ctx: WorkforceModuleContext, nextStep: WorkerWizardStep, updates: Partial<PendingWorkerWizardState> = {}): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (!ctx.from) return;
    const telegramId = BigInt(ctx.from.id);
    const upd = await this.service.pushStep(telegramId, nextStep, updates);
    const state: PendingWorkerWizardState = { ...upd, currentStep: upd?.currentStep ?? nextStep };
    await this.renderStep(ctx, telegramId, state);
  }

  private async deleteUserMsg(ctx: WorkforceModuleContext): Promise<void> {
    if (ctx.chat && ctx.message?.message_id && ctx.api) await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id).catch(() => {});
  }

  async handleStart(ctx: WorkforceModuleContext): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (!this.checkRbac(ctx)) return this.renderPrompt(ctx, '⛔ عذراً، لا تملك الصلاحية للوصول إلى معالج تسجيل العمال.');
    if (!ctx.from) return;
    const telegramId = BigInt(ctx.from.id);
    await this.service.clearDraft(telegramId);
    await this.handleChoiceStep(ctx, WorkerWizardStep.DOC_TYPE, { activeMessageId: ctx.callbackQuery?.message?.message_id, chatId: ctx.chat?.id });
  }

  handleDocType(ctx: WorkforceModuleContext, idType: 'NATIONAL_ID' | 'PASSPORT') {
    return this.handleChoiceStep(ctx, WorkerWizardStep.PHOTO_FRONT, { idType });
  }

  async handleSkipPhoto(ctx: WorkforceModuleContext): Promise<void> {
    if (!ctx.from) return;
    const draft = await this.service.getDraft(BigInt(ctx.from.id));
    const next = draft?.currentStep === WorkerWizardStep.PHOTO_BACK && draft.frontPhotoFileId
      ? WorkerWizardStep.AI_CONFIRMATION : WorkerWizardStep.FULL_NAME;
    return this.handleChoiceStep(ctx, next);
  }

  async handlePhotoInput(ctx: WorkforceModuleContext, fileId: string): Promise<void> {
    if (!ctx.from) return;
    await this.deleteUserMsg(ctx);
    const draft = await this.service.getDraft(BigInt(ctx.from.id));
    if (!draft) return;
    await this.renderPrompt(ctx, WorkerRegistrationMessages.aiProcessingPrompt(), WorkerRegistrationKeyboards.processingKeyboard(), draft);
    void sendChatActionSafe(ctx, 'typing');
    const isFront = draft.currentStep === WorkerWizardStep.PHOTO_FRONT;
    const isPass = draft.idType === 'PASSPORT';
    const expected = isFront ? (isPass ? 'PASSPORT' : 'NATIONAL_ID_FRONT') : 'NATIONAL_ID_BACK';
    const buf = ctx.api ? await this.service.downloadTelegramPhotoBuffer(ctx.api, fileId) : null;
    if (!buf) {
      await this.renderPrompt(ctx, '⚠️ تعذر تنزيل الصورة من تليجرام بسبب ضعف الاتصال. يرجى إعادة المحاولة أو المتابعة يدوياً.', WorkerRegistrationKeyboards.photoPromptKeyboard(true), draft);
      return;
    }
    const scan = await this.service.scanIdentityPhoto(buf, 'image/jpeg', expected);
    if (!scan.isValid) {
      await this.renderPrompt(ctx, scan.userErrorMessage || '⚠️ تعذر فحص الصورة.', WorkerRegistrationKeyboards.photoPromptKeyboard(true), draft);
      return;
    }
    const upd = isFront ? this.service.applyAiFrontScan(draft, scan, fileId) : this.service.applyAiBackScan(draft, scan, fileId);
    const b64 = isFront ? { frontPhotoBase64: buf.toString('base64') } : { backPhotoBase64: buf.toString('base64') };
    const next = isFront && !isPass ? WorkerWizardStep.PHOTO_BACK : WorkerWizardStep.AI_CONFIRMATION;
    return this.handleChoiceStep(ctx, next, { ...upd, ...b64 });
  }

  async handleAiApprove(ctx: WorkforceModuleContext): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (!ctx.from) return;
    const draft = await this.service.getDraft(BigInt(ctx.from.id));
    if (!draft) return;
    const approved = this.service.approveAiDraft(draft);
    if (!approved.idNumber || approved.idNumber.length < 5 || !approved.name) {
      await this.renderPrompt(ctx, '⚠️ بيانات الهوية غير مكتملة (الاسم أو رقم الإثبات مفقود). يرجى تعديل الاسم أو الرقم أدناه، أو المتابعة يدوياً.', WorkerRegistrationKeyboards.aiConfirmationKeyboard(), draft);
      return;
    }
    const dup = await this.service.checkDuplicate(approved.idType || 'NATIONAL_ID', approved.idNumber);
    if (dup.isDuplicate) {
      await this.renderPrompt(ctx, `⚠️ العامل مسجل مسبقاً باسم: *${dup.existingWorker?.name}* وكود: *${dup.existingWorker?.code}*`, WorkerRegistrationKeyboards.interactiveErrorKeyboard('id_number'), draft);
      return;
    }
    await this.handleChoiceStep(ctx, WorkerWizardStep.PHONE, approved);
  }

  handleAiEdit(ctx: WorkforceModuleContext, field: 'name' | 'id' | 'address' | 'expiry') {
    const map = { name: WorkerWizardStep.AI_EDIT_NAME, id: WorkerWizardStep.AI_EDIT_ID, address: WorkerWizardStep.AI_EDIT_ADDRESS, expiry: WorkerWizardStep.AI_EDIT_EXPIRY };
    return this.handleChoiceStep(ctx, map[field] || WorkerWizardStep.AI_CONFIRMATION);
  }

  async handleTextInput(ctx: WorkforceModuleContext, textInput: string): Promise<void> {
    if (!ctx.from) return;
    await this.deleteUserMsg(ctx);
    const draft = await this.service.getDraft(BigInt(ctx.from.id));
    if (!draft) return;
    const clean = textInput.trim();

    switch (draft.currentStep) {
      case WorkerWizardStep.AI_EDIT_NAME: {
        const val = validateWorkerFullName(clean);
        if (!val.isValid) return this.renderPrompt(ctx, `⚠️ ${val.error || 'الاسم غير صالح'}`, WorkerRegistrationKeyboards.textInputKeyboard(true), draft);
        const ai = { ...draft.aiDetectedData, name: clean };
        return this.handleChoiceStep(ctx, WorkerWizardStep.AI_CONFIRMATION, { name: clean, nickname: extractFirstTwoNames(clean), aiDetectedData: ai });
      }
      case WorkerWizardStep.AI_EDIT_ID: {
        const norm = normalizeDigits(clean);
        const isPass = draft.idType === 'PASSPORT';
        const dDate = draft.birthDate ? (parseFlexibleDate(draft.birthDate).date || new Date('1990-01-01')) : new Date('1990-01-01');
        const val = validateWorkerIdentification(draft.idType || 'NATIONAL_ID', norm, { birthDate: dDate, gender: draft.gender || 'MALE' });
        if (!val.isValid) return this.renderPrompt(ctx, `⚠️ ${val.error || 'رقم الإثبات غير صالح'}`, WorkerRegistrationKeyboards.textInputKeyboard(true), draft);
        const dup = await this.service.checkDuplicate(draft.idType || 'NATIONAL_ID', norm);
        if (dup.isDuplicate) return this.renderPrompt(ctx, `⚠️ العامل مسجل مسبقاً باسم: *${dup.existingWorker?.name}* وكود: *${dup.existingWorker?.code}*`, WorkerRegistrationKeyboards.textInputKeyboard(true), draft);
        const ai = {
          ...draft.aiDetectedData,
          nationalId: isPass ? undefined : norm, passportNumber: isPass ? norm : undefined,
          birthDate: val.birthDate ? val.birthDate.toISOString().substring(0, 10) : draft.birthDate,
          age: val.age ?? draft.aiDetectedData?.age, gender: val.gender || draft.gender,
          governorateCode: val.governorateCode || draft.governorateCode, governorateName: val.governorateNameAr || draft.aiDetectedData?.governorateName,
        };
        return this.handleChoiceStep(ctx, WorkerWizardStep.AI_CONFIRMATION, { idNumber: norm, birthDate: ai.birthDate, gender: ai.gender, governorateCode: ai.governorateCode, aiDetectedData: ai });
      }
      case WorkerWizardStep.AI_EDIT_ADDRESS:
        return this.handleChoiceStep(ctx, WorkerWizardStep.AI_CONFIRMATION, { address: clean, aiDetectedData: { ...draft.aiDetectedData, address: clean } });
      case WorkerWizardStep.AI_EDIT_EXPIRY: {
        const norm = normalizeDigits(clean);
        const p = parseFlexibleDate(norm);
        const exp = p.isValid ? p.formattedDMY : norm;
        return this.handleChoiceStep(ctx, WorkerWizardStep.AI_CONFIRMATION, { expiryDate: exp, aiDetectedData: { ...draft.aiDetectedData, expiryDate: exp } });
      }
      case WorkerWizardStep.FULL_NAME: {
        const val = validateWorkerFullName(clean);
        if (!val.isValid) return this.renderPrompt(ctx, `⚠️ ${val.error || 'الاسم غير صالح'}`, WorkerRegistrationKeyboards.interactiveErrorKeyboard('name'), draft);
        return this.handleChoiceStep(ctx, WorkerWizardStep.NICKNAME, { name: clean, nickname: extractFirstTwoNames(clean) });
      }
      case WorkerWizardStep.NICKNAME:
        return this.handleChoiceStep(ctx, WorkerWizardStep.ID_NUMBER, { nickname: clean && clean !== '-' && clean !== 'تخطي' ? clean : draft.nickname });
      case WorkerWizardStep.ID_NUMBER: {
        const norm = normalizeDigits(clean);
        const dDate = draft.birthDate ? (parseFlexibleDate(draft.birthDate).date || new Date('1990-01-01')) : new Date('1990-01-01');
        const val = validateWorkerIdentification(draft.idType || 'NATIONAL_ID', norm, { birthDate: dDate, gender: draft.gender || 'MALE' });
        if (!val.isValid) return this.renderPrompt(ctx, `⚠️ ${val.error || 'رقم الإثبات غير صالح'}`, WorkerRegistrationKeyboards.interactiveErrorKeyboard('id_number'), draft);
        const dup = await this.service.checkDuplicate(draft.idType || 'NATIONAL_ID', norm);
        if (dup.isDuplicate) return this.renderPrompt(ctx, `⚠️ العامل مسجل مسبقاً باسم: *${dup.existingWorker?.name}* وكود: *${dup.existingWorker?.code}*`, WorkerRegistrationKeyboards.interactiveErrorKeyboard('id_number'), draft);
        return this.handleChoiceStep(ctx, WorkerWizardStep.PHONE, {
          idNumber: norm, birthDate: val.birthDate ? val.birthDate.toISOString().substring(0, 10) : dDate.toISOString().substring(0, 10),
          gender: val.gender || draft.gender || 'MALE', governorateCode: val.governorateCode || '88',
        });
      }
      case WorkerWizardStep.PHONE: {
        const norm = normalizeDigits(clean);
        const val = validateWorkerPhoneNumber(norm);
        if (!val.isValid || !val.normalized) return this.renderPrompt(ctx, `⚠️ ${val.error || 'رقم الهاتف غير صالح'}`, WorkerRegistrationKeyboards.interactiveErrorKeyboard('phone'), draft);
        const dup = await this.service.checkPhoneOrWalletDuplicate(val.normalized);
        const warning = dup.isDuplicate && dup.existingWorker ? `الهاتف مسجل مسبقاً للعامل: ${dup.existingWorker.name} (#${dup.existingWorker.code})` : undefined;
        return this.handleChoiceStep(ctx, WorkerWizardStep.PAYOUT_TRANSFER_CHOICE, { phone: val.normalized, walletWarning: warning });
      }
      case WorkerWizardStep.CUSTOM_WALLET_INPUT: {
        const norm = normalizeDigits(clean);
        if (!norm || norm === '-' || norm === 'تخطي' || norm.length < 5) {
          return this.renderPrompt(ctx, '⚠️ رقم المحفظة أو الحساب إلزامي ولا يمكن تخطيه. أدخل الرقم المطلوب أو اضغط [ ◀️ السابق ] للاستلام نقداً.', WorkerRegistrationKeyboards.interactiveErrorKeyboard('custom_wallet'), draft);
        }
        const dup = await this.service.checkPhoneOrWalletDuplicate(norm);
        const warning = dup.isDuplicate && dup.existingWorker ? `المحفظة مسجلة للعامل: ${dup.existingWorker.name} (#${dup.existingWorker.code})` : undefined;
        return this.handleChoiceStep(ctx, WorkerWizardStep.PAYOUT_METHOD_CHOICE, { accountNumber: norm, walletWarning: warning });
      }
      case WorkerWizardStep.CUSTOM_START_DATE_INPUT:
      case WorkerWizardStep.START_DATE_CHOICE: {
        const norm = normalizeDigits(clean);
        const val = validateWorkerHireDate(norm);
        if (!val.isValid || !val.date) return this.renderPrompt(ctx, `⚠️ ${val.error || 'صيغة التاريخ غير صالحة'}`, WorkerRegistrationKeyboards.interactiveErrorKeyboard('start_date'), draft);
        return this.handleChoiceStep(ctx, WorkerWizardStep.DRIVING_LICENSE, { hireDate: val.date.toISOString().substring(0, 10) });
      }
      case WorkerWizardStep.EMERGENCY_PHONE: {
        const norm = normalizeDigits(clean);
        return this.handleChoiceStep(ctx, WorkerWizardStep.INSURANCE_STATUS, { emergencyPhone: norm && norm !== '-' && norm !== 'تخطي' ? norm : '-' });
      }
      default:
        break;
    }
  }

  handlePickNick(ctx: WorkforceModuleContext, nick: string) { return this.handleChoiceStep(ctx, WorkerWizardStep.ID_NUMBER, { nickname: nick }); }
  async handleSkipNickname(ctx: WorkforceModuleContext): Promise<void> {
    const draft = ctx.from ? await this.service.getDraft(BigInt(ctx.from.id)) : null;
    await this.handleChoiceStep(ctx, WorkerWizardStep.ID_NUMBER, { nickname: draft?.nickname || extractFirstTwoNames(draft?.name || '') });
  }

  async handlePayoutTransferChoice(ctx: WorkforceModuleContext, choice: string): Promise<void> {
    const draft = ctx.from ? await this.service.getDraft(BigInt(ctx.from.id)) : null;
    if (choice === 'yes') return this.handleChoiceStep(ctx, WorkerWizardStep.PAYOUT_METHOD_CHOICE, { accountNumber: draft?.phone, walletType: 'محفظة إلكترونية' });
    if (choice === 'no') return this.handleChoiceStep(ctx, WorkerWizardStep.CUSTOM_WALLET_INPUT);
    return this.handleChoiceStep(ctx, WorkerWizardStep.JOB_CHOICE, { paymentMethod: 'CASH_SITE', accountNumber: '-', walletType: 'نقدي / كاش' });
  }

  handleSkipWallet(ctx: WorkforceModuleContext) { return this.handleChoiceStep(ctx, WorkerWizardStep.JOB_CHOICE, { paymentMethod: 'CASH_SITE', accountNumber: '-', walletType: 'نقدي / كاش' }); }
  handlePayoutChoice(ctx: WorkforceModuleContext, m: string) { return this.handleChoiceStep(ctx, WorkerWizardStep.JOB_CHOICE, { paymentMethod: m, walletType: PAYOUT_METHOD_MAP[m]?.type || 'محفظة إلكترونية' }); }

  async handleJobChoice(ctx: WorkforceModuleContext, jobId: string): Promise<void> {
    if (!ctx.from) return;
    const jobs = await this.repository.listActiveJobs();
    const job = jobs.find((j) => j.id === jobId);
    const bSal = job?.baseSalary ?? 0, aSal = job?.additionalSalary ?? 0;
    const shift = `${job?.workDays ?? 20} يوم عمل / ${job?.restDays ?? 10} راحة`;

    if (ctx.effectiveRole === 'FIELD_ADMIN' && ctx.assignedSiteId) {
      const sites = await this.repository.listActiveSites();
      const site = sites.find((s) => s.id === ctx.assignedSiteId);
      return this.handleChoiceStep(ctx, WorkerWizardStep.START_DATE_CHOICE, {
        jobTitleId: jobId, jobTitleName: job?.name || 'عامل', basicSalary: bSal, additionalSalary: aSal,
        shiftSystem: shift, siteId: ctx.assignedSiteId, siteName: site?.name || 'الموقع الميداني',
      });
    }
    return this.handleChoiceStep(ctx, WorkerWizardStep.SITE_CHOICE, { jobTitleId: jobId, jobTitleName: job?.name || 'عامل', basicSalary: bSal, additionalSalary: aSal, shiftSystem: shift });
  }

  async handleSiteChoice(ctx: WorkforceModuleContext, siteId: string): Promise<void> {
    const sites = await this.repository.listActiveSites();
    const site = sites.find((s) => s.id === siteId);
    return this.handleChoiceStep(ctx, WorkerWizardStep.START_DATE_CHOICE, { siteId, siteName: site?.name || 'الموقع الميداني' });
  }

  async handleStartDateChoice(ctx: WorkforceModuleContext, sDate: string): Promise<void> {
    if (sDate === 'custom') return this.handleChoiceStep(ctx, WorkerWizardStep.CUSTOM_START_DATE_INPUT);
    return this.handleChoiceStep(ctx, WorkerWizardStep.DRIVING_LICENSE, { hireDate: sDate });
  }

  handleLicenseChoice(ctx: WorkforceModuleContext, k: string) { return this.handleChoiceStep(ctx, WorkerWizardStep.MILITARY_STATUS, { drivingLicense: DRIVING_LICENSE_MAP[k] || 'لا توجد رخصة قيادة' }); }
  handleMilitaryChoice(ctx: WorkforceModuleContext, k: string) { return this.handleChoiceStep(ctx, WorkerWizardStep.EMERGENCY_PHONE, { militaryStatus: MILITARY_STATUS_MAP[k] || 'أدى الخدمة العسكرية (قدوة حسنة)' }); }
  handleSkipEmergencyPhone(ctx: WorkforceModuleContext) { return this.handleChoiceStep(ctx, WorkerWizardStep.INSURANCE_STATUS, { emergencyPhone: '-' }); }
  handleInsuranceChoice(ctx: WorkforceModuleContext, k: string) { return this.handleChoiceStep(ctx, WorkerWizardStep.MARITAL_STATUS, { insuranceStatus: INSURANCE_STATUS_MAP[k] || 'غير مؤمن عليه بجهة أخرى' }); }
  handleMaritalChoice(ctx: WorkforceModuleContext, k: string) { return this.handleChoiceStep(ctx, WorkerWizardStep.CONFIRMATION, { maritalStatus: MARITAL_STATUS_MAP[k] || 'أعزب' }); }

  async handleConfirm(ctx: WorkforceModuleContext): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (!ctx.from) return;
    const telegramId = BigInt(ctx.from.id);
    const draft = await this.service.getDraft(telegramId);
    if (!draft || !draft.name || !draft.idNumber || !draft.phone) {
      await this.renderPrompt(ctx, '⚠️ بيانات المعالج غير مكتملة. يرجى البدء من جديد.', WorkerRegistrationKeyboards.interactiveErrorKeyboard('start'), draft ?? undefined);
      return;
    }
    try {
      const bSal = Number(draft.basicSalary || 0), aSal = Number(draft.additionalSalary || 0);
      const bDate = draft.birthDate ? (parseFlexibleDate(draft.birthDate).date || new Date('1990-01-01')) : new Date('1990-01-01');
      const hDate = draft.hireDate ? (parseFlexibleDate(draft.hireDate).date || new Date()) : new Date();
      const frontBuf = draft.frontPhotoBase64 ? Buffer.from(draft.frontPhotoBase64, 'base64') : undefined;
      const backBuf = draft.backPhotoBase64 ? Buffer.from(draft.backPhotoBase64, 'base64') : undefined;
      const result = await this.service.registerWorker({
        name: draft.name, nickname: draft.nickname, idType: draft.idType || 'NATIONAL_ID', idNumber: draft.idNumber, phone: draft.phone,
        birthDate: bDate, gender: draft.gender || 'MALE', governorateCode: draft.governorateCode || '88',
        jobTitleId: draft.jobTitleId, jobTitleName: draft.jobTitleName || 'عامل', siteId: draft.siteId, siteName: draft.siteName,
        paymentMethod: draft.paymentMethod || 'CASH_SITE', accountNumber: draft.accountNumber && draft.accountNumber !== '-' ? draft.accountNumber : undefined,
        walletType: draft.walletType, contractType: draft.contractType || 'PERMANENT', shiftSystem: draft.shiftSystem || '20 يوم عمل / 10 راحة',
        basicSalary: bSal, additionalSalary: aSal, dailyWage: Number(((bSal + aSal) / 30).toFixed(2)), drivingLicense: draft.drivingLicense,
        militaryStatus: draft.militaryStatus, emergencyPhone: draft.emergencyPhone && draft.emergencyPhone !== '-' ? draft.emergencyPhone : undefined,
        previousInsuranceStatus: draft.insuranceStatus, maritalStatus: draft.maritalStatus, hireDate: hDate,
        frontPhotoBuffer: frontBuf, backPhotoBuffer: backBuf,
      }, telegramId, ctx.effectiveRole || 'ADMIN');

      await this.service.clearDraft(telegramId);
      await renderInPlaceCompletion(ctx, {
        prompt: WorkerRegistrationMessages.registrationSuccess(result),
        keyboard: WorkerRegistrationKeyboards.completionKeyboard(result.welcomeWhatsAppUrl),
        activeMessageId: draft.activeMessageId, chatId: draft.chatId, telegramId, flowType: 'worker_registration',
      });
      const notif = WorkerRegistrationMessages.registrationNotification(result);
      await notifyFlowOperation({ featureKey: 'WORKER_REGISTRATION', siteId: draft.siteId || undefined, siteCardText: notif, hqCategory: 'WORKFORCE', hqCardText: notif }).catch(() => {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر حفظ ملف العامل';
      await this.renderPrompt(ctx, `❌ خطأ أثناء التسجيل: ${msg}`, WorkerRegistrationKeyboards.interactiveErrorKeyboard('confirm'), draft);
    }
  }

  async handleCancel(ctx: WorkforceModuleContext): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const draft = ctx.from ? await this.service.getDraft(BigInt(ctx.from.id)) : null;
    if (ctx.from) await this.service.clearDraft(BigInt(ctx.from.id));
    await this.renderPrompt(ctx, WorkerRegistrationMessages.cancelled(), WorkerRegistrationKeyboards.cancelExitKeyboard(), draft ?? undefined);
  }

  async handleBack(ctx: WorkforceModuleContext): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (!ctx.from) return;
    const telegramId = BigInt(ctx.from.id);
    const popped = await this.service.popStep(telegramId);
    if (!popped) return this.handleStart(ctx);
    await this.renderStep(ctx, telegramId, popped);
  }

  handleJobPage(ctx: WorkforceModuleContext, page: number) {
    if (ctx.callbackQuery) void ctx.answerCallbackQuery().catch(() => {});
    return this.repository.listActiveJobs().then((j) => this.renderPrompt(ctx, WorkerRegistrationMessages.jobChoicePrompt(), WorkerRegistrationKeyboards.optionsGridKeyboard(j, 'job', page)));
  }

  handleSitePage(ctx: WorkforceModuleContext, page: number) {
    if (ctx.callbackQuery) void ctx.answerCallbackQuery().catch(() => {});
    return this.repository.listActiveSites().then((s) => this.renderPrompt(ctx, WorkerRegistrationMessages.siteChoicePrompt(), WorkerRegistrationKeyboards.optionsGridKeyboard(s, 'site', page)));
  }

  async handleRetryStep(ctx: WorkforceModuleContext, _step: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const draft = ctx.from ? await this.service.getDraft(BigInt(ctx.from.id)) : null;
    if (draft && ctx.from) await this.renderStep(ctx, BigInt(ctx.from.id), draft);
  }
}
