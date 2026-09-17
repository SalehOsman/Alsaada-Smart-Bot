import { createHmac } from 'node:crypto';
import { encryptField, createBlindIndex, normalizeKeyToHex } from '@alsaada/database';
import { normalizeDigits, formatDateDMY, extractFirstTwoNames } from '@alsaada/regional-engine';
import { normalizeEgyptianPhone } from '@alsaada/core-components';
import { aiVisionEngine, type AiVisionScanResult } from '@alsaada/ai-vision-engine';
import { WorkerRegistrationRepository } from './flow.repository.js';
import { validateWorkerIdentification } from './flow.validators.js';
import { workerStorageService } from '../../services/worker-storage.service.js';
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
  async get(id: bigint): Promise<PendingWorkerWizardState | null> { return this.store.get(id.toString()) || null; }
  async set(id: bigint, state: PendingWorkerWizardState): Promise<void> { this.store.set(id.toString(), state); }
  async delete(id: bigint): Promise<void> { this.store.delete(id.toString()); }
}

export interface MinimalRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  del(key: string): Promise<number | unknown>;
}

export class RedisWorkerWizardStateStore implements WorkerWizardStateStore {
  private readonly prefix = 'pending:worker_wizard:user:';
  private readonly defaultTtl = 1800;

  constructor(
    private readonly redis: MinimalRedisClient,
    private readonly fallbackStore: WorkerWizardStateStore = new InMemoryWorkerWizardStateStore()
  ) {}

  async get(id: bigint): Promise<PendingWorkerWizardState | null> {
    try {
      const raw = await this.redis.get(`${this.prefix}${id}`);
      if (raw) return JSON.parse(raw) as PendingWorkerWizardState;
    } catch {}
    return this.fallbackStore.get(id);
  }

  async set(id: bigint, state: PendingWorkerWizardState, ttl: number = this.defaultTtl): Promise<void> {
    try {
      await this.redis.set(`${this.prefix}${id}`, JSON.stringify(state), 'EX', ttl);
    } catch {
      await this.fallbackStore.set(id, state, ttl);
    }
  }

  async delete(id: bigint): Promise<void> {
    try { await this.redis.del(`${this.prefix}${id}`); } catch {}
    await this.fallbackStore.delete(id);
  }
}

export class WorkerRegistrationService {
  private readonly normalizedKeyHex: string;

  constructor(
    private readonly repository: WorkerRegistrationRepository,
    private readonly stateStore: WorkerWizardStateStore = new InMemoryWorkerWizardStateStore(),
    private readonly encryptionKey: string = process.env.DATABASE_ENCRYPTION_KEY || '',
    private readonly blindIndexSalt: string = process.env.BLIND_INDEX_SALT || '',
    private readonly botUsername: string = process.env.BOT_USERNAME || 'Al_Saada_smart_bot'
  ) {
    if (!this.encryptionKey && process.env.NODE_ENV === 'production') {
      throw new Error('WorkerRegistrationService: DATABASE_ENCRYPTION_KEY is required in production.');
    }
    this.normalizedKeyHex = normalizeKeyToHex(this.encryptionKey || '0'.repeat(64));
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

  async checkPhoneOrWalletDuplicate(phoneOrWallet: string): Promise<WorkerDuplicateCheckResult> {
    let clean = normalizeDigits(phoneOrWallet.trim().replace(/[\s-]/g, ''));
    if (clean.startsWith('+20')) {
      clean = '0' + clean.substring(3);
    } else if (clean.startsWith('20') && clean.length === 12) {
      clean = '0' + clean.substring(2);
    }
    if (!clean || clean === '-' || clean.length < 9) {
      return { isDuplicate: false, existingWorker: null };
    }
    const blindIndex = createBlindIndex(clean, this.blindIndexSalt);
    return this.repository.findExistingWorkerByPhoneBlindIndex(blindIndex);
  }

  async getJobTitleDetails(jobTitleId: string) {
    return this.repository.findJobTitleById(jobTitleId);
  }

  async getCompanyTradeName(): Promise<string> {
    return this.repository.getCompanyTradeName();
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
    companyName?: string | undefined;
  }): string {
    const intlPhone = normalizeEgyptianPhone(data.phone) || data.phone.replace(/\D/g, '');
    const cleanBotUsername = this.botUsername.replace(/^@/, '').trim();
    const token = generateWorkerInviteToken(data.code, this.encryptionKey);
    const botLink = `https://t.me/${cleanBotUsername}?start=inv_${data.code}_${token}`;
    const company = (data.companyName || '').trim() || 'المنظومة المؤسسية';

    const hireDateFormatted = data.hireDate
      ? data.hireDate instanceof Date
        ? formatDateDMY(data.hireDate)
        : data.hireDate
      : undefined;

    const payoutMethodAr = (() => {
      const pm = data.payoutMethod || '';
      if (!pm || pm === 'CASH_SITE') return 'نقداً من الموقع الميداني';
      if (pm === 'INSTAPAY') return 'إنستاباي (InstaPay)';
      if (pm === 'BANK_TRANSFER' || pm === 'BANK_ACCOUNT') return 'تحويل بنكي';
      if (data.walletType && data.walletType !== 'نقدي / كاش') return data.walletType;
      if (pm.includes('CASH') || pm.includes('WALLET')) return 'محفظة إلكترونية';
      return pm;
    })();

    const siteLine = data.siteName
      ? `• *الموقع الميداني:* ${data.siteName}`
      : '• *الموقع الميداني:* الموقع العام للعمليات';
    const hireDateLine = hireDateFormatted ? `• *تاريخ مباشرة العمل:* ${hireDateFormatted}` : '';
    const shiftLine = data.shiftSystem ? `• *نظام الدوام:* ${data.shiftSystem.replace(/_/g, ' ')}` : '';
    const payoutLine = `• *وسيلة الصرف:* ${payoutMethodAr}${data.accountNumber && data.accountNumber !== '-' ? ` (رقم: ${data.accountNumber})` : ''}`;

    const details = [
      `• *الاسم الكامل:* ${data.name}`,
      `• *كودك الوظيفي المعتمد:* #${data.code}`,
      `• *المسمى الوظيفي:* ${data.jobTitle}`,
      siteLine, hireDateLine, shiftLine, payoutLine,
    ].filter(Boolean).join('\n');

    const text =
      `*${company}*\n*دعوة الانضمام لبوابة الموارد البشرية والخدمات الذاتية*\n----------------------------------------\n` +
      `أهلاً وسهلاً بك زميلنا العزيز/ *${data.name}*\nيسر إدارة الموارد البشرية تهنئتكم بالانضمام لفريق العمل، وتم قيد بياناتكم رسمياً في المنظومة الذكية للشركة:\n\n` +
      `${details}\n----------------------------------------\n• *رابط الانضمام والتفعيل المباشر بالبوت:*\n${botLink}\n----------------------------------------\n` +
      `• *أبرز خدمات ومميزات البوت للعامل:*\n- إشعارات لحظية بكل حركة مالية (سلف، مسحوبات، حوافز، مكافآت).\n- استعراض مفردات وقسيمة راتبك الشهري فور اعتمادها.\n- تقديم طلبات الإجازات ومتابعة رصيدك واستحقاقاتك.\n- تقديم طلبات السلف وتحديث بيانات المحفظة الإلكترونية.\n- متابعة مهمات الوقاية الشخصية (PPE) والتظلمات الميدانية.\n- بطاقة الهوية الرقمية وكارت العمل الميداني المعتمد.\n` +
      `----------------------------------------\n• *خطوات التفعيل السريعة:*\n1. اضغط على الرابط أعلاه ثم اضغط على زر Start (ابدأ).\n2. اضغط زر (إرسال طلب تأكيد وربط حسابي) لتقديم طلبك مباشرة لاعتماده من الإدارة.\n----------------------------------------\n` +
      `_مع تمنياتنا لك بدوام التوفيق والنجاح والسلامة في مواقع ${company}._`;

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

    let localFrontPath = input.idCardFrontPath;
    let localBackPath = input.idCardBackPath;
    if (input.frontPhotoBuffer || input.backPhotoBuffer) {
      const saved = workerStorageService.saveWorkerIdLocally(code, input.frontPhotoBuffer, input.backPhotoBuffer);
      if (saved.localFrontPath) localFrontPath = saved.localFrontPath;
      if (saved.localBackPath) localBackPath = saved.localBackPath;
    }

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

    const cleanEmergencyPhone = input.emergencyPhone && input.emergencyPhone !== '-'
      ? normalizeDigits(input.emergencyPhone.trim().replace(/[\s-]/g, ''))
      : null;
    const emergencyPhoneEncrypted = cleanEmergencyPhone
      ? encryptField(cleanEmergencyPhone, this.normalizedKeyHex)
      : null;

    const cleanAccountNumber = input.accountNumber && input.accountNumber !== '-'
      ? normalizeDigits(input.accountNumber.trim())
      : null;
    const accountNumberEncrypted = cleanAccountNumber
      ? encryptField(cleanAccountNumber, this.normalizedKeyHex)
      : null;

    const aliasesList: string[] = [];
    const resolvedNickname = input.nickname?.trim() || extractFirstTwoNames(input.name.trim());
    if (resolvedNickname) aliasesList.push(resolvedNickname);
    if (input.legacyCode?.trim()) aliasesList.push(input.legacyCode.trim());

    const basicNum = Number(input.basicSalary || 0);
    const addNum = Number(input.additionalSalary ?? input.fixedAllowances ?? 0);
    const dailyWageNum = Number(((basicNum + addNum) / 30).toFixed(2));

    const worker = await this.repository.createWorkerAtomic({
      input: {
        ...input,
        contractType: input.contractType || 'PERMANENT',
        dailyWage: dailyWageNum,
        basicSalary: basicNum,
        additionalSalary: addNum,
        birthDate: valResult.birthDate,
        gender: valResult.gender,
        governorateCode: input.governorateCode || valResult.governorateCode,
        accountNumber: cleanAccountNumber || undefined,
        emergencyPhone: cleanEmergencyPhone || undefined,
        idCardFrontPath: localFrontPath,
        idCardBackPath: localBackPath,
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

    const companyName = await this.repository.getCompanyTradeName();

    const welcomeWhatsAppUrl = this.buildWelcomeWhatsAppUrl({
      name: worker.name,
      code: worker.code,
      jobTitle: worker.jobTitle,
      siteName: worker.site?.name || input.siteName,
      hireDate: worker.hireDate,
      shiftSystem: worker.shiftSystem,
      payoutMethod: input.paymentMethod,
      walletType: input.walletType,
      accountNumber: cleanAccountNumber || undefined,
      phone: cleanPhone,
      companyName,
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
      companyName,
    };
  }

  async getDraft(id: bigint): Promise<PendingWorkerWizardState | null> { return this.stateStore.get(id); }
  async saveDraft(id: bigint, state: PendingWorkerWizardState): Promise<void> { await this.stateStore.set(id, state); }
  async clearDraft(id: bigint): Promise<void> { await this.stateStore.delete(id); }

  async pushStep(telegramId: bigint, nextStep: WorkerWizardStep, updates?: Partial<PendingWorkerWizardState>): Promise<PendingWorkerWizardState> {
    const existing = (await this.getDraft(telegramId)) || { currentStep: nextStep };
    const history = existing.previousSteps ? [...existing.previousSteps] : [];
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

  async downloadTelegramPhotoBuffer(
    api: { getFile: (fileId: string) => Promise<{ file_path?: string }>; token?: string },
    fileId: string
  ): Promise<Buffer | null> {
    try {
      const file = await api.getFile(fileId);
      const token = api.token || process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
      if (!file.file_path || !token) return null;
      const downloadUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
      const res = await fetch(downloadUrl);
      if (!res.ok) return null;
      const arrayBuf = await res.arrayBuffer();
      return Buffer.from(arrayBuf);
    } catch {
      return null;
    }
  }

  async scanIdentityPhoto(
    buffer: Buffer,
    mimeType: string,
    expectedType: 'NATIONAL_ID_FRONT' | 'NATIONAL_ID_BACK' | 'PASSPORT'
  ): Promise<AiVisionScanResult> {
    return aiVisionEngine.scanIdentityDocument(buffer, mimeType, expectedType);
  }

  applyAiFrontScan(
    draft: PendingWorkerWizardState,
    scan: AiVisionScanResult,
    fileId: string
  ): PendingWorkerWizardState {
    const isPassport = draft.idType === 'PASSPORT';
    const rawBirthDateStr = scan.birthDate ? scan.birthDate.toISOString().substring(0, 10) : draft.birthDate;
    const birthDateStr = rawBirthDateStr ? normalizeDigits(rawBirthDateStr) : undefined;
    const rawId = isPassport ? scan.passportNumber || draft.idNumber : scan.nationalIdNumber || draft.idNumber;
    const normId = rawId ? normalizeDigits(rawId) : undefined;
    const normExpiry = (scan.expiryDateStr || draft.expiryDate) ? normalizeDigits(scan.expiryDateStr || draft.expiryDate!) : undefined;

    return {
      ...draft,
      frontPhotoFileId: fileId,
      name: scan.fullName || draft.name,
      nickname: scan.fullName ? extractFirstTwoNames(scan.fullName) : draft.nickname,
      idNumber: normId,
      birthDate: birthDateStr,
      gender: scan.gender || draft.gender,
      governorateCode: scan.governorateCode ? normalizeDigits(scan.governorateCode) : draft.governorateCode,
      address: scan.address || draft.address,
      expiryDate: normExpiry,
      aiDetectedData: {
        ...draft.aiDetectedData,
        nationalId: scan.nationalIdNumber
          ? normalizeDigits(scan.nationalIdNumber)
          : (isPassport ? undefined : (draft.aiDetectedData?.nationalId ? normalizeDigits(draft.aiDetectedData.nationalId) : undefined)),
        passportNumber: scan.passportNumber
          ? normalizeDigits(scan.passportNumber)
          : (isPassport && draft.aiDetectedData?.passportNumber ? normalizeDigits(draft.aiDetectedData.passportNumber) : undefined),
        name: scan.fullName || draft.aiDetectedData?.name || draft.name,
        birthDate: birthDateStr || (draft.aiDetectedData?.birthDate ? normalizeDigits(draft.aiDetectedData.birthDate) : undefined),
        age: scan.age !== undefined ? scan.age : draft.aiDetectedData?.age,
        gender: scan.gender || draft.aiDetectedData?.gender || draft.gender,
        governorateName: scan.governorateNameAr || draft.aiDetectedData?.governorateName,
        governorateCode: scan.governorateCode
          ? normalizeDigits(scan.governorateCode)
          : (draft.aiDetectedData?.governorateCode ? normalizeDigits(draft.aiDetectedData.governorateCode) : undefined),
        address: scan.address || draft.aiDetectedData?.address || draft.address,
        expiryDate: normExpiry || (draft.aiDetectedData?.expiryDate ? normalizeDigits(draft.aiDetectedData.expiryDate) : undefined),
      },
    };
  }

  applyAiBackScan(
    draft: PendingWorkerWizardState,
    scan: AiVisionScanResult,
    fileId: string
  ): PendingWorkerWizardState {
    const rawExp = scan.expiryDateStr || draft.expiryDate || draft.aiDetectedData?.expiryDate;
    const normExpiry = rawExp ? normalizeDigits(rawExp) : undefined;
    return {
      ...draft,
      backPhotoFileId: fileId,
      expiryDate: normExpiry || draft.expiryDate,
      address: scan.address || draft.address,
      aiDetectedData: {
        ...draft.aiDetectedData,
        expiryDate: normExpiry || (draft.aiDetectedData?.expiryDate ? normalizeDigits(draft.aiDetectedData.expiryDate) : undefined),
        address: scan.address || draft.aiDetectedData?.address || draft.address,
      },
    };
  }

  approveAiDraft(draft: PendingWorkerWizardState): PendingWorkerWizardState {
    const resolvedName = draft.name || draft.aiDetectedData?.name || '';
    const rawId =
      draft.idNumber ||
      draft.aiDetectedData?.nationalId ||
      draft.aiDetectedData?.passportNumber ||
      '';
    const resolvedId = rawId ? normalizeDigits(rawId) : '';
    const resolvedNick = draft.nickname || (resolvedName ? extractFirstTwoNames(resolvedName) : undefined);
    const rawBirth = draft.birthDate || draft.aiDetectedData?.birthDate;
    const birthDate = rawBirth ? normalizeDigits(rawBirth) : undefined;
    const rawExp = draft.expiryDate || draft.aiDetectedData?.expiryDate;
    const expiryDate = rawExp ? normalizeDigits(rawExp) : undefined;
    const phone = draft.phone ? normalizeDigits(draft.phone) : undefined;
    const rawGov = draft.governorateCode || draft.aiDetectedData?.governorateCode || '88';
    const governorateCode = normalizeDigits(rawGov);

    return {
      ...draft,
      name: resolvedName,
      nickname: resolvedNick,
      idNumber: resolvedId,
      phone,
      birthDate,
      gender: draft.gender || draft.aiDetectedData?.gender || 'MALE',
      governorateCode,
      address: draft.address || draft.aiDetectedData?.address,
      expiryDate,
    };
  }
}

