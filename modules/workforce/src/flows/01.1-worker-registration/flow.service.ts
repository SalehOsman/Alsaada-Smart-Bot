import { createHmac } from 'node:crypto';
import { encryptField, createBlindIndex, normalizeKeyToHex } from '@alsaada/database';
import { normalizeDigits, formatDateDMY, extractFirstTwoNames } from '@alsaada/regional-engine';
import { normalizeEgyptianPhone } from '@alsaada/core-components';
import { WorkerRegistrationRepository } from './flow.repository.js';
import { validateWorkerIdentification } from './flow.validators.js';
import type {
  CreateWorkerInput,
  WorkerValidationResult,
  PendingWorkerWizardState,
  RegisteredWorkerResult,
  WorkerWizardStateStore,
  WorkerWizardStep,
  WorkerDuplicateCheckResult,
} from './flow.types.js';

export function generateWorkerInviteToken(workerCode: string, secretKey: string): string {
  return createHmac('sha256', secretKey)
    .update(`invite:${workerCode.trim()}`)
    .digest('hex')
    .substring(0, 16);
}

export function verifyWorkerInviteToken(workerCode: string, token: string, secretKey: string): boolean {
  if (!token || !secretKey || !workerCode) return false;
  const expected = generateWorkerInviteToken(workerCode, secretKey);
  return expected === token.trim();
}

export class InMemoryWorkerWizardStateStore implements WorkerWizardStateStore {
  private readonly store = new Map<string, PendingWorkerWizardState>();

  async get(telegramId: bigint): Promise<PendingWorkerWizardState | null> {
    return this.store.get(telegramId.toString()) || null;
  }

  async set(telegramId: bigint, state: PendingWorkerWizardState): Promise<void> {
    this.store.set(telegramId.toString(), state);
  }

  async delete(telegramId: bigint): Promise<void> {
    this.store.delete(telegramId.toString());
  }
}

export class WorkerRegistrationService {
  private readonly normalizedKeyHex: string;

  constructor(
    private readonly repository: WorkerRegistrationRepository,
    private readonly stateStore: WorkerWizardStateStore = new InMemoryWorkerWizardStateStore(),
    private readonly encryptionKey: string = 'alsaada-default-key-min-32-chars-long!',
    private readonly blindIndexSalt: string = 'alsaada-blind-index-salt-secret',
    private readonly botUsername: string = 'Alsaada_HRtest_Bot'
  ) {
    this.normalizedKeyHex = normalizeKeyToHex(this.encryptionKey);
  }

  validateId(
    idType: 'NATIONAL_ID' | 'PASSPORT',
    rawId: string,
    extra?: { birthDate?: Date | undefined; gender?: 'MALE' | 'FEMALE' | undefined }
  ): WorkerValidationResult {
    return validateWorkerIdentification(idType, rawId, extra);
  }

  async checkDuplicate(
    idType: 'NATIONAL_ID' | 'PASSPORT',
    idNumber: string
  ): Promise<WorkerDuplicateCheckResult> {
    const cleanId = normalizeDigits(idNumber.trim().toUpperCase().replace(/[\s-]/g, ''));
    const blindIndex = createBlindIndex(cleanId, this.blindIndexSalt);
    return this.repository.findExistingWorkerByBlindIndex(idType, blindIndex);
  }

  buildWelcomeWhatsAppUrl(data: {
    name: string;
    code: string;
    jobTitle: string;
    siteName?: string | undefined;
    hireDate?: Date | string | undefined;
    shiftSystem?: string | undefined;
    payoutMethod?: string | undefined;
    walletType?: string | undefined;
    accountNumber?: string | undefined;
    phone: string;
  }): string {
    const intlPhone = normalizeEgyptianPhone(data.phone) || data.phone.replace(/\D/g, '');
    const cleanBotUsername = this.botUsername.replace(/^@/, '').trim();
    const token = generateWorkerInviteToken(data.code, this.encryptionKey);
    const botLink = `https://t.me/${cleanBotUsername}?start=inv_${data.code}_${token}`;

    const hireDateFormatted = data.hireDate
      ? data.hireDate instanceof Date
        ? formatDateDMY(data.hireDate)
        : data.hireDate
      : undefined;

    const siteLine = data.siteName
      ? `📍 *الموقع الميداني:* ${data.siteName}`
      : '📍 *الموقع الميداني:* الموقع العام للعمليات';
    const hireDateLine = hireDateFormatted ? `📅 *تاريخ مباشرة العمل:* ${hireDateFormatted}` : '';
    const shiftLine = data.shiftSystem ? `🔄 *نظام الدوام:* ${data.shiftSystem.replace(/_/g, ' ')}` : '';
    const payoutLine = data.payoutMethod
      ? `💳 *وسيلة الصرف:* ${data.payoutMethod}${data.accountNumber && data.accountNumber !== '-' ? ` (رقم: ${data.accountNumber})` : ''}`
      : '';

    const details = [
      `👤 *الاسم الكامل:* ${data.name}`,
      `🆔 *كودك الوظيفي المعتمد:* \`#${data.code}\``,
      `💼 *المسمى الوظيفي:* ${data.jobTitle}`,
      siteLine,
      hireDateLine,
      shiftLine,
      payoutLine,
    ]
      .filter(Boolean)
      .join('\n');

    const text =
      `*شركة السعادة للمقاولات العامة والتعدين*\n` +
      `*دعوة الانضمام لبوابة الموارد البشرية والخدمات الذاتية*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `أهلاً وسهلاً بك زميلنا العزيز/ *${data.name}*\n` +
      `يسر إدارة الموارد البشرية تهنئتكم بالانضمام لفريق العمل، وتم قيد بياناتكم رسمياً في المنظومة الذكية للشركة:\n\n` +
      `${details}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔗 *رابط الانضمام والتفعيل المباشر بالبوت:*\n` +
      `${botLink}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `✨ *أبرز خدمات ومميزات البوت للعامل:*\n` +
      `• 🔔 إشعارات لحظية بكل حركة مالية (سلف، مسحوبات، حوافز، مكافآت).\n` +
      `• 💵 استعراض مفردات وقسيمة راتبك الشهري فور اعتمادها.\n` +
      `• 🌴 تقديم طلبات الإجازات ومتابعة رصيدك واستحقاقاتك.\n` +
      `• 📝 تقديم طلبات السلف وتحديث بيانات المحفظة الإلكترونية.\n` +
      `• 🛡️ متابعة مهمات الوقاية الشخصية (PPE) والتظلمات الميدانية.\n` +
      `• 🪪 بطاقة الهوية الرقمية وكارت العمل الميداني المعتمد.\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ *خطوات التفعيل السريعة:*\n` +
      `1️⃣ اضغط على الرابط أعلاه ثم اضغط على زر *Start (ابدأ)*.\n` +
      `2️⃣ اضغط زر *(⚡ تأكيد وربط حسابي فوراً)* لتفعيل خدماتك مباشرة دون كتابة أي بيانات.\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `_مع تمنياتنا لك بدوام التوفيق والنجاح والسلامة في مواقع شركة السعادة._`;

    const encoded = encodeURIComponent(text);
    return intlPhone
      ? `https://api.whatsapp.com/send?phone=${intlPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
  }

  async registerWorker(
    input: CreateWorkerInput,
    actorTelegramId?: bigint,
    actorRole?: string
  ): Promise<RegisteredWorkerResult> {
    const valResult = this.validateId(input.idType, input.idNumber, {
      birthDate: input.birthDate,
      gender: input.gender,
    });
    if (!valResult.isValid) {
      throw new Error(valResult.error || 'بيانات إثبات الشخصية غير صالحة.');
    }

    const dupCheck = await this.checkDuplicate(input.idType, input.idNumber);
    if (dupCheck.isDuplicate && dupCheck.existingWorker) {
      throw new Error(
        `تعارض: العامل مسجل مسبقاً بكود (${dupCheck.existingWorker.code}) والاسم (${dupCheck.existingWorker.name}).`
      );
    }

    let deptCode = 'OP';
    let jobCode = 'DRV';
    if (input.jobTitleId) {
      const jobInfo = await this.repository.getJobTitleWithDepartment(input.jobTitleId);
      if (jobInfo) {
        deptCode = jobInfo.deptCode;
        jobCode = jobInfo.jobCode;
      }
    }

    const code = await this.repository.generateNextWorkerCode(deptCode, jobCode);

    const cleanId = normalizeDigits(input.idNumber.trim().toUpperCase().replace(/[\s-]/g, ''));
    const blindIndex = createBlindIndex(cleanId, this.blindIndexSalt);

    const cleanPhone = normalizeDigits(input.phone.trim().replace(/[\s-]/g, ''));
    const phoneBlindIndex = createBlindIndex(cleanPhone, this.blindIndexSalt);
    const phoneEncrypted = encryptField(cleanPhone, this.normalizedKeyHex);

    let nationalIdEncrypted: string | null = null;
    let nationalIdBlindIndex: string | null = null;
    let passportNumberEncrypted: string | null = null;
    let passportBlindIndex: string | null = null;

    if (input.idType === 'NATIONAL_ID') {
      nationalIdEncrypted = encryptField(cleanId, this.normalizedKeyHex);
      nationalIdBlindIndex = blindIndex;
    } else {
      passportNumberEncrypted = encryptField(cleanId, this.normalizedKeyHex);
      passportBlindIndex = blindIndex;
    }

    const emergencyPhoneEncrypted = input.emergencyPhone
      ? encryptField(input.emergencyPhone, this.normalizedKeyHex)
      : null;

    const accountNumberEncrypted = input.accountNumber
      ? encryptField(input.accountNumber, this.normalizedKeyHex)
      : null;

    const aliasesList: string[] = [];
    const resolvedNickname = input.nickname?.trim() || extractFirstTwoNames(input.name.trim());
    if (resolvedNickname) aliasesList.push(resolvedNickname);
    if (input.legacyCode?.trim()) aliasesList.push(input.legacyCode.trim());

    const worker = await this.repository.createWorkerAtomic({
      input: {
        ...input,
        birthDate: valResult.birthDate,
        gender: valResult.gender,
        governorateCode: input.governorateCode || valResult.governorateCode,
      },
      code,
      nationalIdEncrypted,
      nationalIdBlindIndex,
      passportNumberEncrypted,
      passportBlindIndex,
      phoneEncrypted,
      phoneBlindIndex,
      accountNumberEncrypted,
      emergencyPhoneEncrypted,
      aliases: aliasesList,
      resolvedNickname,
      actorTelegramId,
      actorRole,
    });

    const welcomeWhatsAppUrl = this.buildWelcomeWhatsAppUrl({
      name: worker.name,
      code: worker.code,
      jobTitle: worker.jobTitle,
      siteName: worker.site?.name || input.siteName,
      hireDate: worker.hireDate,
      shiftSystem: worker.shiftSystem,
      payoutMethod: input.paymentMethod,
      walletType: input.walletType,
      accountNumber: input.accountNumber,
      phone: cleanPhone,
    });

    return {
      id: worker.id,
      code: worker.code,
      name: worker.name,
      nickname: worker.nickname || undefined,
      jobTitle: worker.jobTitle,
      siteName: worker.site?.name,
      hireDate: worker.hireDate,
      shiftSystem: worker.shiftSystem,
      welcomeWhatsAppUrl,
    };
  }

  async getDraft(telegramId: bigint): Promise<PendingWorkerWizardState | null> {
    return this.stateStore.get(telegramId);
  }

  async saveDraft(telegramId: bigint, state: PendingWorkerWizardState): Promise<void> {
    await this.stateStore.set(telegramId, state);
  }

  async clearDraft(telegramId: bigint): Promise<void> {
    await this.stateStore.delete(telegramId);
  }

  async pushStep(telegramId: bigint, nextStep: WorkerWizardStep, updates?: Partial<PendingWorkerWizardState>): Promise<PendingWorkerWizardState> {
    const existing = (await this.getDraft(telegramId)) || { currentStep: nextStep };
    const history = existing.previousSteps || [];
    if (existing.currentStep && existing.currentStep !== nextStep) {
      history.push(existing.currentStep);
    }
    const updated: PendingWorkerWizardState = {
      ...existing,
      ...updates,
      currentStep: nextStep,
      previousSteps: history,
    };
    await this.saveDraft(telegramId, updated);
    return updated;
  }

  async popStep(telegramId: bigint): Promise<PendingWorkerWizardState | null> {
    const existing = await this.getDraft(telegramId);
    if (!existing || !existing.previousSteps || existing.previousSteps.length === 0) {
      return null;
    }
    const history = [...existing.previousSteps];
    const prevStep = history.pop();
    if (!prevStep) return null;

    const updated: PendingWorkerWizardState = {
      ...existing,
      currentStep: prevStep,
      previousSteps: history,
    };
    await this.saveDraft(telegramId, updated);
    return updated;
  }
}
