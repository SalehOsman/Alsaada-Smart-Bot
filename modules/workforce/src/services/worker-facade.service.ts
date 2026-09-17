import { prisma as centralizedPrisma, type PrismaClient, encryptField, createBlindIndex, normalizeKeyToHex } from '@alsaada/database';
import { normalizeDigits, extractFirstTwoNames } from '@alsaada/regional-engine';
import { WorkerRegistrationRepository } from '../flows/01.1-worker-registration/flow.repository.js';
import { WorkerRegistrationService } from '../flows/01.1-worker-registration/flow.service.js';
import { validateWorkerIdentification } from '../flows/01.1-worker-registration/flow.validators.js';
import type { CreateWorkerInput, WorkerValidationResult } from '../flows/01.1-worker-registration/flow.types.js';

import { WorkerEditRepository } from '../flows/01.2.D-worker-edit/flow.repository.js';
import { WorkerEditService as ModularWorkerEditService } from '../flows/01.2.D-worker-edit/flow.service.js';
import type { CreateEditRequestInput, EditableWorkerField } from '../flows/01.2.D-worker-edit/flow.types.js';

import { WorkerExportRepository } from '../flows/01.4-worker-export/flow.repository.js';
import { WorkerExportService } from '../flows/01.4-worker-export/flow.service.js';
import type {
  WorkerExportFilter,
  WorkerExportResult,
  WorkerImportResult,
} from '../flows/01.4-worker-export/flow.types.js';

import { WorkerDirectoryRepository } from '../flows/01.5-worker-directory/flow.repository.js';

let activePrismaInstance: PrismaClient | null = null;

export function setWorkforcePrisma(p: PrismaClient | any): void {
  activePrismaInstance = p;
  (globalThis as any).prisma = p;
}

let activeEncryptionKey: string | undefined = undefined;
export function setWorkforceEncryptionKey(key: string): void {
  activeEncryptionKey = key;
}

export function getWorkforcePrisma(): PrismaClient {
  return (activePrismaInstance || (globalThis as any).prisma || centralizedPrisma) as unknown as PrismaClient;
}

/**
 * 💼 WorkerService Facade
 * High-level orchestration facade over workforce registration & directory.
 */
export class WorkerService {
  private readonly customPrisma?: PrismaClient | undefined;
  private readonly customEncryptionKey?: string | undefined;
  private readonly customBlindIndexSalt?: string | undefined;
  private readonly customBotUsername?: string | undefined;

  constructor(options?: {
    prisma?: PrismaClient | undefined;
    encryptionKey?: string | undefined;
    blindIndexSalt?: string | undefined;
    botUsername?: string | undefined;
  }) {
    this.customPrisma = options?.prisma;
    this.customEncryptionKey = options?.encryptionKey;
    this.customBlindIndexSalt = options?.blindIndexSalt;
    this.customBotUsername = options?.botUsername;
  }

  private get encryptionKey(): string {
    const raw =
      this.customEncryptionKey !== undefined
        ? this.customEncryptionKey
        : activeEncryptionKey !== undefined
        ? activeEncryptionKey
        : (globalThis as any).config?.databaseEncryptionKey !== undefined
        ? (globalThis as any).config.databaseEncryptionKey
        : process.env.DATABASE_ENCRYPTION_KEY;
    if (!raw) {
      throw new Error('DATABASE_ENCRYPTION_KEY is required');
    }
    return normalizeKeyToHex(raw);
  }

  private get blindIndexSalt(): string {
    return this.customBlindIndexSalt || process.env.BLIND_INDEX_SALT || 'alsaada-blind-index-salt-secret';
  }

  private get botUsername(): string {
    return this.customBotUsername || process.env.BOT_USERNAME || 'Al_Saada_smart_bot';
  }

  private get prisma(): PrismaClient {
    return this.customPrisma || getWorkforcePrisma();
  }

  private get registrationRepo(): WorkerRegistrationRepository {
    return new WorkerRegistrationRepository(this.prisma);
  }

  private get directoryRepo(): WorkerDirectoryRepository {
    return new WorkerDirectoryRepository(this.prisma);
  }

  private get registrationService(): WorkerRegistrationService {
    return new WorkerRegistrationService(
      this.registrationRepo,
      undefined,
      this.encryptionKey,
      this.blindIndexSalt,
      this.botUsername
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
  ): Promise<{
    isDuplicate: boolean;
    existingWorker?: { code: string; name: string; jobTitle: string; siteName?: string | undefined } | null | undefined;
  }> {
    return this.registrationService.checkDuplicate(idType, idNumber);
  }

  async generateNextWorkerCode(deptCode?: string, jobCode?: string): Promise<string> {
    return this.registrationRepo.generateNextWorkerCode(deptCode || 'OP', jobCode || 'DRV');
  }

  async createWorker(input: CreateWorkerInput) {
    if (!this.encryptionKey) {
      throw new Error(
        'SECURITY CONFIGURATION ERROR: DATABASE_ENCRYPTION_KEY is required to encrypt and store sensitive PII data'
      );
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
      const jobInfo = await this.registrationRepo.getJobTitleWithDepartment(input.jobTitleId);
      if (jobInfo) {
        deptCode = jobInfo.deptCode;
        jobCode = jobInfo.jobCode;
      }
    }

    const newCode = await this.generateNextWorkerCode(deptCode, jobCode);

    const cleanId = normalizeDigits(input.idNumber.trim().toUpperCase().replace(/[\s-]/g, ''));
    const blindIndex = createBlindIndex(cleanId, this.blindIndexSalt);

    const cleanPhone = normalizeDigits(input.phone.trim().replace(/[\s-]/g, ''));
    const phoneBlindIndex = createBlindIndex(cleanPhone, this.blindIndexSalt);
    const phoneEncrypted = encryptField(cleanPhone, this.encryptionKey);

    let nationalIdEncrypted: string | null = null;
    let nationalIdBlindIndex: string | null = null;
    let passportNumberEncrypted: string | null = null;
    let passportBlindIndex: string | null = null;

    if (input.idType === 'NATIONAL_ID') {
      nationalIdEncrypted = encryptField(cleanId, this.encryptionKey);
      nationalIdBlindIndex = blindIndex;
    } else {
      passportNumberEncrypted = encryptField(cleanId, this.encryptionKey);
      passportBlindIndex = blindIndex;
    }

    let accountNumberEncrypted: string | null = null;
    if (input.accountNumber && input.accountNumber.trim() && input.accountNumber.trim() !== '-') {
      accountNumberEncrypted = encryptField(input.accountNumber.trim(), this.encryptionKey);
    }

    let emergencyPhoneEncrypted: string | null = null;
    if (input.emergencyPhone && input.emergencyPhone.trim()) {
      emergencyPhoneEncrypted = encryptField(
        normalizeDigits(input.emergencyPhone.trim()),
        this.encryptionKey
      );
    }

    const resolvedNickname = input.nickname?.trim() || extractFirstTwoNames(input.name.trim());
    const aliasesList: string[] = [];
    if (resolvedNickname) aliasesList.push(resolvedNickname);
    if (input.legacyCode?.trim()) aliasesList.push(input.legacyCode.trim());

    const worker = await this.registrationRepo.createWorkerAtomic({
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

    const welcomeWhatsAppUrl = this.buildWorkerWelcomeWhatsAppUrl({
      name: worker.name,
      code: worker.code,
      jobTitle: worker.jobTitle,
      siteName: (worker as any).site?.name || input.siteName,
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
    companyName?: string | undefined;
    botUsername?: string | undefined;
  }): string {
    return this.registrationService.buildWelcomeWhatsAppUrl(data);
  }

  async getWorkersSummary() {
    return this.directoryRepo.getWorkersSummary();
  }

  async getRecentWorkers(limit = 10) {
    return this.prisma.worker.findMany({
      where: { isDeleted: false },
      include: { site: true, jobRef: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getAllWorkersForPicker() {
    const workers = await this.prisma.worker.findMany({
      where: { isDeleted: false, status: 'ACTIVE' },
      include: { site: true, jobRef: true },
      orderBy: { code: 'asc' },
    });

    return workers.map((w: any) => ({
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
  }

  async updateWorkerLegacyCode(
    workerId: string,
    newLegacyCode: string
  ): Promise<{ success: boolean; worker?: any; error?: string }> {
    const cleanLegacy = newLegacyCode.trim();
    if (!cleanLegacy) {
      return { success: false, error: 'كود العامل القديم لا يمكن أن يكون فارغاً.' };
    }

    const worker = await this.prisma.worker.findUnique({
      where: { id: workerId },
      select: { id: true, code: true, name: true, legacyCode: true, aliases: true },
    });

    if (!worker) {
      return { success: false, error: 'لم يتم العثور على العامل المطلوب.' };
    }

    const existing = await this.prisma.worker.findFirst({
      where: {
        id: { not: workerId },
        isDeleted: false,
        OR: [{ legacyCode: cleanLegacy }, { aliases: { has: cleanLegacy } }],
      },
      select: { code: true, name: true },
    });

    if (existing) {
      return {
        success: false,
        error: `الكود القديم (${cleanLegacy}) مسجل بالفعل للعامل (${existing.name}) بالكود (${existing.code}).`,
      };
    }

    const updatedAliases = (worker.aliases || []).filter((a: string) => a !== worker.legacyCode);
    if (!updatedAliases.includes(cleanLegacy)) {
      updatedAliases.push(cleanLegacy);
    }

    const updatedWorker = await this.prisma.worker.update({
      where: { id: workerId },
      data: {
        legacyCode: cleanLegacy,
        aliases: updatedAliases,
      },
      include: { site: true, jobRef: true, department: true },
    });

    return { success: true, worker: updatedWorker };
  }
}

/**
 * 🛠️ WorkerEditFacade
 */
export class WorkerEditFacade {
  private readonly customPrisma?: PrismaClient | undefined;
  private readonly customEncryptionKey?: string | undefined;

  constructor(options?: { prisma?: PrismaClient | undefined; encryptionKey?: string | undefined }) {
    this.customPrisma = options?.prisma;
    this.customEncryptionKey = options?.encryptionKey;
  }

  private get encryptionKey(): string {
    const raw =
      this.customEncryptionKey !== undefined
        ? this.customEncryptionKey
        : activeEncryptionKey !== undefined
        ? activeEncryptionKey
        : (globalThis as any).config?.databaseEncryptionKey !== undefined
        ? (globalThis as any).config.databaseEncryptionKey
        : process.env.DATABASE_ENCRYPTION_KEY || 'alsaada-default-key-min-32-chars-long!';
    return normalizeKeyToHex(raw);
  }

  private get prisma(): PrismaClient {
    return this.customPrisma || getWorkforcePrisma();
  }

  private get editRepo(): WorkerEditRepository {
    return new WorkerEditRepository(this.prisma);
  }

  private get modularService(): ModularWorkerEditService {
    if (!this.encryptionKey) {
      throw new Error('DATABASE_ENCRYPTION_KEY is required');
    }
    return new ModularWorkerEditService(this.editRepo, this.encryptionKey);
  }

  async generateNextRequestId(): Promise<string> {
    return this.editRepo.generateNextRequestId();
  }

  async createEditRequest(input: CreateEditRequestInput) {
    const requestId = await this.editRepo.generateNextRequestId();
    return this.editRepo.createEditTicket({
      requestId,
      workerId: input.workerId,
      workerCode: input.workerCode,
      workerName: input.workerName,
      requesterTelegramId: input.requesterTelegramId,
      requesterName: input.requesterName,
      requesterRole: input.requesterRole,
      fieldKey: input.fieldKey,
      fieldName: input.fieldName,
      oldValue: input.oldValue || '-',
      newValue: input.newValue.trim(),
      reason: input.reason?.trim() || 'طلب تعديل رسمي',
    });
  }

  async applyDirectSuperAdminEdit(
    workerId: string,
    fieldKey: EditableWorkerField | string,
    newValue: string,
    actorTelegramId?: bigint
  ): Promise<{ success: boolean; worker?: any; error?: string }> {
    if (!this.encryptionKey) {
      throw new Error('DATABASE_ENCRYPTION_KEY is required');
    }
    try {
      const result = await this.modularService.applyDirectEdit(
        workerId,
        fieldKey as EditableWorkerField,
        newValue,
        actorTelegramId
      );

      if (result.success && result.worker) {
        return {
          success: true,
          worker: result.worker,
        };
      }
    } catch {
      // Fall through to fallback
    }

    try {
      const updated = await this.prisma.worker.update({
        where: { id: workerId },
        data: { [fieldKey]: newValue } as any,
      });
      return { success: true, worker: updated };
    } catch {
      return { success: false, error: 'Failed to update worker' };
    }
  }

  async approveEditRequest(requestId: string, approverTelegramId: bigint) {
    const request = await this.editRepo.findTicketByRequestId(requestId);
    if (!request || request.status !== 'PENDING') {
      throw new Error('طلب التعديل غير موجود أو تمت معالجته مسبقاً');
    }

    await this.applyDirectSuperAdminEdit(
      request.workerId,
      request.fieldKey,
      request.newValue,
      approverTelegramId
    );

    return this.editRepo.updateTicketStatus(request.id, 'APPROVED', approverTelegramId);
  }

  async rejectEditRequest(requestId: string, rejectorTelegramId: bigint, reason?: string) {
    const request = await this.editRepo.findTicketByRequestId(requestId);
    if (!request || request.status !== 'PENDING') {
      throw new Error('طلب التعديل غير موجود أو تمت معالجته مسبقاً');
    }

    return this.editRepo.updateTicketStatus(request.id, 'REJECTED', rejectorTelegramId, reason);
  }
}

/**
 * 📊 WorkerExcelService
 */
export class WorkerExcelService {
  private readonly customPrisma?: PrismaClient | undefined;
  private readonly customEncryptionKey?: string | undefined;

  constructor(prisma?: PrismaClient | undefined, encryptionKey?: string | undefined) {
    this.customPrisma = prisma;
    this.customEncryptionKey = encryptionKey;
  }

  private get encryptionKey(): string {
    const key =
      this.customEncryptionKey ||
      activeEncryptionKey ||
      (globalThis as any).config?.databaseEncryptionKey ||
      process.env.DATABASE_ENCRYPTION_KEY ||
      'alsaada-default-key-min-32-chars-long!';
    return normalizeKeyToHex(key);
  }

  private get service(): WorkerExportService {
    const p = this.customPrisma || getWorkforcePrisma();
    return new WorkerExportService(new WorkerExportRepository(p), this.encryptionKey);
  }

  generateTemplateBuffer(): Promise<Buffer> {
    return this.service.generateTemplateBuffer();
  }

  parseAndImportExcel(buffer: Buffer): Promise<WorkerImportResult> {
    return this.service.parseAndImportExcel(buffer);
  }

  generateWorkersExportBuffer(filter: WorkerExportFilter, isSuperAdmin = false): Promise<WorkerExportResult> {
    return this.service.generateWorkersExportBuffer(filter, isSuperAdmin);
  }
}

export const workerService = new WorkerService();
export const workerEditService = new WorkerEditFacade();
export const workerExcelService = new WorkerExcelService();
