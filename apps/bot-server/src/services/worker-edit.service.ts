import { prisma } from '../db.js';
import { config } from '../config/env.js';
import { fastCache } from './fast-cache.service.js';
import { workerService } from './worker.service.js';
import { normalizeDigits, parseFlexibleDate } from '@alsaada/regional-engine';
import { encryptField, createBlindIndex } from '@alsaada/database';

export interface CreateEditRequestInput {
  workerId: string;
  workerCode: string;
  workerName: string;
  requesterTelegramId: bigint;
  requesterName: string;
  requesterRole: string; // 'FIELD_ADMIN' | 'WORKER'
  fieldKey: string;
  fieldName: string;
  oldValue?: string;
  newValue: string;
  reason?: string;
}

export class WorkerEditService {
  /**
   * توليد كود الطلب التسلسلي بصيغة EDT-YYMMDD-XXX
   */
  async generateNextRequestId(): Promise<string> {
    const now = new Date();
    const yy = String(now.getFullYear()).substring(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const prefix = 'EDT-' + yy + mm + dd + '-';

    const count = await prisma.workerEditRequest.count({
      where: { requestId: { startsWith: prefix } },
    });

    return prefix + String(count + 1).padStart(3, '0');
  }

  /**
   * تقديم طلب تعديل بيانات عامل (للمشرف الميداني أو العامل) بحالة PENDING
   */
  async createEditRequest(input: CreateEditRequestInput) {
    const requestId = await this.generateNextRequestId();

    const request = await prisma.workerEditRequest.create({
      data: {
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
        status: 'PENDING',
      },
    });

    return request;
  }

  /**
   * تطبيق التعديل الفوري والمباشر بواسطة السوبر أدمن (Direct Super Admin Execution)
   */
  async applyDirectSuperAdminEdit(workerId: string, fieldKey: string, newValue: string) {
    const cleanValue = newValue.trim();

    if (fieldKey === 'legacyCode') {
      return workerService.updateWorkerLegacyCode(workerId, cleanValue);
    }

    const dataToUpdate: any = {};

    if (fieldKey === 'name') {
      dataToUpdate.name = cleanValue;
    } else if (fieldKey === 'nickname') {
      dataToUpdate.nickname = cleanValue;
      const worker = await prisma.worker.findUnique({ where: { id: workerId }, select: { aliases: true } });
      if (worker) {
        const aliases = (worker.aliases || []).filter((a) => a !== cleanValue);
        aliases.push(cleanValue);
        dataToUpdate.aliases = aliases;
      }
    } else if (fieldKey === 'phone') {
      const cleanPhone = normalizeDigits(cleanValue.replace(/[\s-]/g, ''));
      dataToUpdate.phoneBlindIndex = createBlindIndex(cleanPhone, config.blindIndexSalt);
      dataToUpdate.phoneEncrypted = config.databaseEncryptionKey
        ? encryptField(cleanPhone, config.databaseEncryptionKey)
        : cleanPhone;
    } else if (fieldKey === 'emergencyPhone') {
      const cleanEm = normalizeDigits(cleanValue.replace(/[\s-]/g, ''));
      dataToUpdate.emergencyPhoneEncrypted = config.databaseEncryptionKey
        ? encryptField(cleanEm, config.databaseEncryptionKey)
        : cleanEm;
    } else if (fieldKey === 'walletNumber') {
      const cleanWallet = normalizeDigits(cleanValue.replace(/[\s-]/g, ''));
      dataToUpdate.accountNumberEncrypted = config.databaseEncryptionKey
        ? encryptField(cleanWallet, config.databaseEncryptionKey)
        : cleanWallet;
    } else if (fieldKey === 'walletType') {
      dataToUpdate.walletType = cleanValue;
    } else if (fieldKey === 'drivingLicense') {
      dataToUpdate.drivingLicense = cleanValue;
    } else if (fieldKey === 'militaryStatus') {
      dataToUpdate.militaryStatus = cleanValue;
    } else if (fieldKey === 'maritalStatus') {
      dataToUpdate.maritalStatus = cleanValue;
    } else if (fieldKey === 'previousInsuranceStatus') {
      dataToUpdate.previousInsuranceStatus = cleanValue;
    } else if (fieldKey === 'idCardExpiryDate') {
      const parsedExp = parseFlexibleDate(cleanValue);
      dataToUpdate.idCardExpiryDate = parsedExp.isValid ? parsedExp.date : new Date(cleanValue);
    } else if (fieldKey === 'jobTitle') {
      dataToUpdate.jobTitle = cleanValue;
    } else if (fieldKey === 'siteId') {
      dataToUpdate.siteId = cleanValue;
    } else if (fieldKey === 'address') {
      dataToUpdate.address = cleanValue;
    }

    const updated = await prisma.worker.update({
      where: { id: workerId },
      data: dataToUpdate,
      include: { site: true, jobRef: true, department: true },
    });

    await fastCache.invalidate('workers:all:active');
    await fastCache.invalidate('workers:all:picker');
    return { success: true, worker: updated };
  }

  /**
   * اعتماد وتطبيق طلب تعديل معلق ذرياً بواسطة السوبر أدمن
   */
  async approveEditRequest(requestId: string, adminTelegramId: bigint) {
    const request = await prisma.workerEditRequest.findUnique({
      where: { requestId },
      include: { worker: true },
    });

    if (!request) {
      throw new Error('طلب التعديل غير موجود.');
    }

    if (request.status !== 'PENDING') {
      throw new Error('الطلب تم البت فيه مسبقاً بحالة: ' + request.status);
    }

    // 1. تطبيق التعديل على سجل العامل
    await this.applyDirectSuperAdminEdit(request.workerId, request.fieldKey, request.newValue);

    // 2. تحديث حالة الطلب
    const updatedRequest = await prisma.workerEditRequest.update({
      where: { id: request.id },
      data: {
        status: 'APPROVED',
        reviewedByAdminId: adminTelegramId,
        reviewedAt: new Date(),
      },
    });

    return updatedRequest;
  }

  /**
   * رفض طلب التعديل بواسطة السوبر أدمن
   */
  async rejectEditRequest(requestId: string, adminTelegramId: bigint, reason?: string) {
    const request = await prisma.workerEditRequest.findUnique({
      where: { requestId },
    });

    if (!request) {
      throw new Error('طلب التعديل غير موجود.');
    }

    if (request.status !== 'PENDING') {
      throw new Error('الطلب تم البت فيه مسبقاً بحالة: ' + request.status);
    }

    const updatedRequest = await prisma.workerEditRequest.update({
      where: { id: request.id },
      data: {
        status: 'REJECTED',
        reviewedByAdminId: adminTelegramId,
        reviewedAt: new Date(),
        reviewNotes: reason || 'تم الرفض بواسطة المدير العام',
      },
    });

    return updatedRequest;
  }

  /**
   * جلب كافة الطلبات المعلقة للسوبر أدمن
   */
  async getPendingRequests() {
    return prisma.workerEditRequest.findMany({
      where: { status: 'PENDING' },
      include: { worker: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const workerEditService = new WorkerEditService();
