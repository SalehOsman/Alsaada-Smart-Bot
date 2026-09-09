import { prisma } from '../db.js';
import { config } from '../config/env.js';
import { fastCache } from './fast-cache.service.js';
import { encryptField, createBlindIndex } from '@alsaada/database';
import { normalizeDigits, extractFirstTwoNames } from '@alsaada/regional-engine';
import {
  WorkerRegistrationRepository,
  WorkerRegistrationService,
  validateWorkerIdentification,
  generateWorkerInviteToken,
  verifyWorkerInviteToken,
  type CreateWorkerInput,
  type WorkerValidationResult,
} from '@alsaada/workforce';

export { generateWorkerInviteToken, verifyWorkerInviteToken };
export type { CreateWorkerInput, WorkerValidationResult };

export class WorkerService {
  private readonly repository: WorkerRegistrationRepository;
  private readonly registrationService: WorkerRegistrationService;

  constructor() {
    this.repository = new WorkerRegistrationRepository(prisma);
    this.registrationService = new WorkerRegistrationService(
      this.repository,
      undefined,
      config.databaseEncryptionKey || 'alsaada-default-key-min-32-chars-long!',
      config.blindIndexSalt || 'alsaada-blind-index-salt-secret',
      config.botUsername || 'Alsaada_HRtest_Bot'
    );
  }

  validateIdentification(
    idType: 'NATIONAL_ID' | 'PASSPORT',
    rawId: string,
    extra?: { birthDate?: Date | undefined; gender?: 'MALE' | 'FEMALE' | undefined }
  ): WorkerValidationResult {
    return validateWorkerIdentification(idType, rawId, extra);
  }

  async checkDuplicate(
    idType: 'NATIONAL_ID' | 'PASSPORT',
    idNumber: string
  ): Promise<{ isDuplicate: boolean; existingWorker?: { code: string; name: string; jobTitle: string; siteName?: string | undefined } | null | undefined }> {
    return this.registrationService.checkDuplicate(idType, idNumber);
  }

  async generateNextWorkerCode(deptCode?: string, jobCode?: string): Promise<string> {
    return this.repository.generateNextWorkerCode(deptCode || 'OP', jobCode || 'DRV');
  }

  async createWorker(input: CreateWorkerInput) {
    if (!config.databaseEncryptionKey) {
      throw new Error('SECURITY CONFIGURATION ERROR: DATABASE_ENCRYPTION_KEY is required to encrypt and store sensitive PII data');
    }

    const valResult = this.validateIdentification(input.idType, input.idNumber, {
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

    const newCode = await this.generateNextWorkerCode(deptCode, jobCode);

    const cleanId = normalizeDigits(input.idNumber.trim().toUpperCase().replace(/[\s-]/g, ''));
    const blindIndex = createBlindIndex(cleanId, config.blindIndexSalt);

    const cleanPhone = normalizeDigits(input.phone.trim().replace(/[\s-]/g, ''));
    const phoneBlindIndex = createBlindIndex(cleanPhone, config.blindIndexSalt);
    const phoneEncrypted = encryptField(cleanPhone, config.databaseEncryptionKey);

    let nationalIdEncrypted: string | null = null;
    let nationalIdBlindIndex: string | null = null;
    let passportNumberEncrypted: string | null = null;
    let passportBlindIndex: string | null = null;

    if (input.idType === 'NATIONAL_ID') {
      nationalIdEncrypted = encryptField(cleanId, config.databaseEncryptionKey);
      nationalIdBlindIndex = blindIndex;
    } else {
      passportNumberEncrypted = encryptField(cleanId, config.databaseEncryptionKey);
      passportBlindIndex = blindIndex;
    }

    let accountNumberEncrypted: string | null = null;
    if (input.accountNumber && input.accountNumber.trim() && input.accountNumber.trim() !== '-') {
      accountNumberEncrypted = encryptField(input.accountNumber.trim(), config.databaseEncryptionKey);
    }

    let emergencyPhoneEncrypted: string | null = null;
    if (input.emergencyPhone && input.emergencyPhone.trim()) {
      emergencyPhoneEncrypted = encryptField(normalizeDigits(input.emergencyPhone.trim()), config.databaseEncryptionKey);
    }

    const resolvedNickname = input.nickname?.trim() || extractFirstTwoNames(input.name.trim());
    const aliasesList: string[] = [];
    if (resolvedNickname) aliasesList.push(resolvedNickname);
    if (input.legacyCode?.trim()) aliasesList.push(input.legacyCode.trim());

    const worker = await this.repository.createWorkerAtomic({
      code: newCode,
      input,
      resolvedNickname,
      aliases: aliasesList,
      nationalIdEncrypted,
      nationalIdBlindIndex,
      passportNumberEncrypted,
      passportBlindIndex,
      phoneEncrypted,
      phoneBlindIndex,
      accountNumberEncrypted,
      emergencyPhoneEncrypted,
    });

    await fastCache.invalidate('workers:all:active');
    await fastCache.invalidate('workers:summary:count');

    const welcomeWhatsAppUrl = this.buildWorkerWelcomeWhatsAppUrl({
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

    return { worker, welcomeWhatsAppUrl };
  }

  buildWorkerWelcomeWhatsAppUrl(data: {
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
    botUsername?: string | undefined;
  }): string {
    return this.registrationService.buildWelcomeWhatsAppUrl(data);
  }

  async getWorkersSummary() {
    return fastCache.rememberSWR('workers:summary:count', 300, async () => {
      const [totalActive, egyptianCount, foreignCount] = await Promise.all([
        prisma.worker.count({ where: { status: 'ACTIVE', isDeleted: false } }),
        prisma.worker.count({
          where: {
            status: 'ACTIVE',
            isDeleted: false,
            idType: 'NATIONAL_ID',
          },
        }),
        prisma.worker.count({
          where: {
            status: 'ACTIVE',
            isDeleted: false,
            idType: 'PASSPORT',
          },
        }),
      ]);
      return { totalActive, egyptianCount, foreignCount };
    });
  }

  async getRecentWorkers(limit = 10) {
    return fastCache.rememberSWR(`workers:recent:${limit}`, 180, async () => {
      return prisma.worker.findMany({
        where: { isDeleted: false },
        include: { site: true, jobRef: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    });
  }

  async getAllWorkersForPicker() {
    return fastCache.rememberSWR('workers:all:picker', 120, async () => {
      const workers = await prisma.worker.findMany({
        where: { isDeleted: false, status: 'ACTIVE' },
        include: { site: true, jobRef: true },
        orderBy: { code: 'asc' },
      });

      return workers.map((w) => ({
        id: w.id,
        code: w.code,
        legacyCode: w.legacyCode || undefined,
        aliases: w.aliases || [],
        name: w.name,
        nickname: w.nickname || undefined,
        jobTitle: w.jobTitle,
        siteLocation: w.site?.name || undefined,
        dailyWage: Number(w.dailyWage),
      }));
    });
  }

  async updateWorkerLegacyCode(workerId: string, newLegacyCode: string): Promise<{ success: boolean; worker?: any; error?: string }> {
    const cleanLegacy = newLegacyCode.trim();
    if (!cleanLegacy) {
      return { success: false, error: 'كود العامل القديم لا يمكن أن يكون فارغاً.' };
    }

    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      select: { id: true, code: true, name: true, legacyCode: true, aliases: true },
    });

    if (!worker) {
      return { success: false, error: 'لم يتم العثور على العامل المطلوب.' };
    }

    const existing = await prisma.worker.findFirst({
      where: {
        id: { not: workerId },
        isDeleted: false,
        OR: [
          { legacyCode: cleanLegacy },
          { aliases: { has: cleanLegacy } },
        ],
      },
      select: { code: true, name: true },
    });

    if (existing) {
      return {
        success: false,
        error: `الكود القديم (${cleanLegacy}) مسجل بالفعل للعامل (${existing.name}) بالكود (${existing.code}).`,
      };
    }

    const updatedAliases = (worker.aliases || []).filter((a) => a !== worker.legacyCode);
    if (!updatedAliases.includes(cleanLegacy)) {
      updatedAliases.push(cleanLegacy);
    }

    const updatedWorker = await prisma.worker.update({
      where: { id: workerId },
      data: {
        legacyCode: cleanLegacy,
        aliases: updatedAliases,
      },
      include: { site: true, jobRef: true, department: true },
    });

    await fastCache.invalidate('workers:all:active');
    await fastCache.invalidate('workers:all:picker');
    return { success: true, worker: updatedWorker };
  }
}

export const workerService = new WorkerService();
