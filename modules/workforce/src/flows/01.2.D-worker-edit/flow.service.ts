import { createHash } from 'node:crypto';
import { encryptField, decryptField, createBlindIndex, Prisma } from '@alsaada/database';
import { normalizeDigits, parseFlexibleDate } from '@alsaada/regional-engine';
import { detectGovernorateFromAddress, getGovernorateCodeByName, EGYPTIAN_GOVERNORATES } from '@alsaada/national-id-engine';
import { WorkerEditRepository, type WorkerAuditInput } from './flow.repository.js';
import { FIELD_LABELS, validateFieldValue } from './flow.validators.js';
import type {
  EditableWorkerField,
  CreateEditRequestInput,
  EditExecutionResult,
  PendingEditTicket,
  SalaryHistoryRecord,
  WorkerChangeLogRecord,
} from './flow.types.js';

function normalizeKeyToHex(key: string): string {
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return key;
  }
  return createHash('sha256').update(key).digest('hex');
}

export class WorkerEditService {
  private readonly normalizedKeyHex: string;

  constructor(
    private readonly repository: WorkerEditRepository,
    private readonly encryptionKey: string = 'alsaada-default-key-min-32-chars-long!',
    private readonly blindIndexSalt: string = 'alsaada-blind-index-salt-secret'
  ) {
    this.normalizedKeyHex = normalizeKeyToHex(this.encryptionKey);
  }

  decryptFieldSafe(encrypted?: string | null): string {
    if (!encrypted) return '';
    try {
      return decryptField(encrypted, this.normalizedKeyHex);
    } catch {
      return encrypted;
    }
  }

  async applyDirectEdit(
    workerId: string,
    fieldKey: EditableWorkerField,
    newValue: string,
    actorTelegramId?: bigint,
    actorName?: string
  ): Promise<EditExecutionResult> {
    const val = validateFieldValue(fieldKey, newValue);
    if (!val.isValid || !val.cleanValue) {
      return { success: false, isDirectExecution: true, error: val.error || 'القيمة غير صالحة' };
    }

    const cleanValue = val.cleanValue;
    const worker = await this.repository.findWorkerForEdit(workerId);
    if (!worker) {
      return { success: false, isDirectExecution: true, error: 'لم يتم العثور على العامل المطلوب' };
    }

    const dataToUpdate: Prisma.WorkerUpdateInput = {};
    let oldDisplayVal = '';
    let newDisplayVal = cleanValue;

    if (fieldKey === 'name') {
      oldDisplayVal = worker.name;
      dataToUpdate.name = cleanValue;
    } else if (fieldKey === 'nickname') {
      oldDisplayVal = worker.nickname || '';
      dataToUpdate.nickname = cleanValue;
      const aliases = (worker.aliases || []).filter((a: string) => a !== cleanValue);
      aliases.push(cleanValue);
      dataToUpdate.aliases = aliases;
    } else if (fieldKey === 'nationalId') {
      const cleanNatId = normalizeDigits(cleanValue.replace(/[\s-]/g, ''));
      oldDisplayVal = '••••••••••••';
      newDisplayVal = cleanNatId;
      dataToUpdate.nationalIdBlindIndex = createBlindIndex(cleanNatId, this.blindIndexSalt);
      dataToUpdate.nationalIdEncrypted = encryptField(cleanNatId, this.normalizedKeyHex);
    } else if (fieldKey === 'phone') {
      const cleanPhone = normalizeDigits(cleanValue.replace(/[\s-]/g, ''));
      oldDisplayVal = this.decryptFieldSafe(worker.phoneEncrypted);
      dataToUpdate.phoneBlindIndex = createBlindIndex(cleanPhone, this.blindIndexSalt);
      dataToUpdate.phoneEncrypted = encryptField(cleanPhone, this.normalizedKeyHex);
    } else if (fieldKey === 'emergencyPhone') {
      const cleanEm = normalizeDigits(cleanValue.replace(/[\s-]/g, ''));
      oldDisplayVal = this.decryptFieldSafe(worker.emergencyPhoneEncrypted);
      dataToUpdate.emergencyPhoneEncrypted = encryptField(cleanEm, this.normalizedKeyHex);
    } else if (fieldKey === 'walletNumber') {
      const cleanWallet = normalizeDigits(cleanValue.replace(/[\s-]/g, ''));
      oldDisplayVal = this.decryptFieldSafe(worker.accountNumberEncrypted);
      dataToUpdate.accountNumberEncrypted = encryptField(cleanWallet, this.normalizedKeyHex);
    } else if (fieldKey === 'drivingLicense') {
      oldDisplayVal = worker.drivingLicense || '';
      dataToUpdate.drivingLicense = cleanValue;
    } else if (fieldKey === 'militaryStatus') {
      oldDisplayVal = worker.militaryStatus || '';
      dataToUpdate.militaryStatus = cleanValue;
    } else if (fieldKey === 'maritalStatus') {
      oldDisplayVal = worker.maritalStatus || '';
      dataToUpdate.maritalStatus = cleanValue;
    } else if (fieldKey === 'idCardExpiryDate') {
      oldDisplayVal = worker.idCardExpiryDate ? worker.idCardExpiryDate.toISOString().slice(0, 10) : '';
      const parsedExp = parseFlexibleDate(cleanValue);
      dataToUpdate.idCardExpiryDate = parsedExp.isValid && parsedExp.date ? parsedExp.date : new Date(cleanValue);
    } else if (fieldKey === 'address') {
      oldDisplayVal = worker.address || '';
      dataToUpdate.address = cleanValue;
      const detectedGov = detectGovernorateFromAddress(cleanValue);
      if (detectedGov) {
        const govCode = getGovernorateCodeByName(detectedGov);
        if (govCode) {
          dataToUpdate.governorateCode = govCode;
        }
      }
    } else if (fieldKey === 'governorateCode') {
      const govCode = getGovernorateCodeByName(cleanValue) || cleanValue;
      oldDisplayVal = EGYPTIAN_GOVERNORATES[worker.governorateCode || '']?.nameAr || worker.governorateCode || '';
      newDisplayVal = EGYPTIAN_GOVERNORATES[govCode]?.nameAr || govCode;
      dataToUpdate.governorateCode = govCode;
    } else if (fieldKey === 'legacyCode') {
      oldDisplayVal = worker.legacyCode || '';
      dataToUpdate.legacyCode = cleanValue;
      const aliases = (worker.aliases || []).filter((a: string) => a !== cleanValue);
      aliases.push(cleanValue);
      dataToUpdate.aliases = aliases;
    } else if (fieldKey === 'jobTitleId') {
      oldDisplayVal = worker.jobRef?.name || worker.jobTitle || '';
      dataToUpdate.jobRef = { connect: { id: cleanValue } };
    } else if (fieldKey === 'siteId') {
      oldDisplayVal = worker.site?.name || '';
      dataToUpdate.site = { connect: { id: cleanValue } };
    } else if (fieldKey === 'departmentId') {
      oldDisplayVal = worker.department?.name || '';
      dataToUpdate.department = { connect: { id: cleanValue } };
    } else if (fieldKey === 'hireDate') {
      oldDisplayVal = worker.hireDate ? worker.hireDate.toISOString().slice(0, 10) : '';
      const parsedHire = parseFlexibleDate(cleanValue);
      dataToUpdate.hireDate = parsedHire.isValid && parsedHire.date ? parsedHire.date : new Date(cleanValue);
    } else if (fieldKey === 'status') {
      oldDisplayVal = worker.status || '';
      dataToUpdate.status = cleanValue;
    } else if (fieldKey === 'shiftSystem') {
      oldDisplayVal = worker.shiftSystem || '';
      dataToUpdate.shiftSystem = cleanValue;
    } else if (fieldKey === 'contractType') {
      oldDisplayVal = worker.contractType || '';
      dataToUpdate.contractType = cleanValue;
    } else if (fieldKey === 'barracksUnit') {
      oldDisplayVal = worker.barracksUnit || '';
      dataToUpdate.barracksUnit = cleanValue;
    } else if (fieldKey === 'bedNumber') {
      oldDisplayVal = worker.bedNumber || '';
      dataToUpdate.bedNumber = cleanValue;
    } else if (fieldKey === 'dailyWage') {
      oldDisplayVal = String(worker.dailyWage || 0);
      dataToUpdate.dailyWage = new Prisma.Decimal(cleanValue);
    } else if (fieldKey === 'basicSalary') {
      oldDisplayVal = String(worker.basicSalary || 0);
      dataToUpdate.basicSalary = new Prisma.Decimal(cleanValue);
    } else if (fieldKey === 'fixedAllowances') {
      oldDisplayVal = String(worker.fixedAllowances || 0);
      dataToUpdate.fixedAllowances = new Prisma.Decimal(cleanValue);
    } else if (fieldKey === 'paymentMethod') {
      oldDisplayVal = worker.paymentMethod || '';
      dataToUpdate.paymentMethod = cleanValue;
    } else if (fieldKey === 'walletOwnerName') {
      oldDisplayVal = worker.walletOwnerName || '';
      dataToUpdate.walletOwnerName = cleanValue;
    } else if (fieldKey === 'instaPayHandle') {
      oldDisplayVal = worker.instaPayHandle || '';
      dataToUpdate.instaPayHandle = cleanValue;
    } else if (fieldKey === 'insuranceNumber') {
      oldDisplayVal = worker.insuranceNumber || '';
      dataToUpdate.insuranceNumber = cleanValue;
    } else if (fieldKey === 'insuranceStatus') {
      oldDisplayVal = worker.insuranceStatus || '';
      dataToUpdate.insuranceStatus = cleanValue;
    } else if (fieldKey === 'canteenCigarettePolicy') {
      oldDisplayVal = worker.canteenCigarettePolicy || '';
      dataToUpdate.canteenCigarettePolicy = cleanValue;
      if (cleanValue === 'NONE') {
        dataToUpdate.cigaretteBrand = null;
        dataToUpdate.canteenItem = { disconnect: true };
      }
    } else if (fieldKey === 'cigaretteBrand') {
      oldDisplayVal = worker.cigaretteBrand || '';
      dataToUpdate.cigaretteBrand = cleanValue;
    } else if (fieldKey === 'emergencyContactName') {
      oldDisplayVal = worker.emergencyContactName || '';
      dataToUpdate.emergencyContactName = cleanValue;
    } else if (fieldKey === 'ppeShoeSize') {
      oldDisplayVal = worker.ppeShoeSize || '';
      dataToUpdate.ppeShoeSize = cleanValue;
    } else if (fieldKey === 'ppeUniformSize') {
      oldDisplayVal = worker.ppeUniformSize || '';
      dataToUpdate.ppeUniformSize = cleanValue;
    } else if (fieldKey === 'medicalNotes') {
      oldDisplayVal = worker.medicalNotes || '';
      dataToUpdate.medicalNotes = cleanValue;
    }

    let category = 'FINANCIAL';
    if (['name', 'nickname', 'nationalId', 'idCardExpiryDate', 'governorateCode', 'address', 'militaryStatus', 'maritalStatus', 'legacyCode'].includes(fieldKey)) {
      category = 'PERSONAL';
    } else if (['jobTitleId', 'siteId', 'departmentId', 'hireDate', 'status', 'shiftSystem', 'contractType', 'drivingLicense', 'barracksUnit', 'bedNumber'].includes(fieldKey)) {
      category = 'JOB';
    } else if (['phone', 'emergencyPhone', 'emergencyContactName', 'ppeShoeSize', 'ppeUniformSize', 'medicalNotes'].includes(fieldKey)) {
      category = 'CONTACT';
    }

    const fieldName = FIELD_LABELS[fieldKey] || fieldKey;

    const audit: WorkerAuditInput = {
      category,
      fieldKey,
      fieldNameAr: fieldName,
      oldValue: oldDisplayVal,
      newValue: cleanValue,
      oldDisplayValue: oldDisplayVal,
      newDisplayValue: newDisplayVal,
      reason: 'تعديل مباشر من إدارة المنظومة',
      actorTelegramId: actorTelegramId ?? 0n,
      actorName: actorName || 'المدير العام',
      actorRole: 'SUPER_ADMIN',
    };

    const updated = await this.repository.updateWorkerDirect(workerId, dataToUpdate, actorTelegramId, audit);

    return {
      success: true,
      workerCode: updated.code,
      fieldName,
      newValue: cleanValue,
      isDirectExecution: true,
      worker: updated,
    };
  }

  async applySalaryAdjustment(params: {
    workerId: string;
    newBase: number;
    newAdd: number;
    effectiveMonth: string;
    effectiveDate: Date;
    reason: string;
    approvedByTelegramId?: bigint;
    approvedByName?: string;
  }): Promise<{ success: boolean; error?: string; changeId?: string }> {
    const worker = await this.repository.findWorkerForEdit(params.workerId);
    if (!worker) {
      return { success: false, error: 'العامل غير موجود.' };
    }

    const prevBase = Number(worker.basicSalary || 0);
    const prevAdd = Number(worker.fixedAllowances || 0);
    const prevGross = prevBase + prevAdd;
    const newGross = params.newBase + params.newAdd;
    const changeId = `SAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    await this.repository.createSalaryAdjustment({
      changeId,
      workerId: worker.id,
      workerCode: worker.code,
      workerName: worker.name,
      previousBasicSalary: prevBase,
      previousAdditionalSalary: prevAdd,
      previousGrossSalary: prevGross,
      newBasicSalary: params.newBase,
      newAdditionalSalary: params.newAdd,
      newGrossSalary: newGross,
      effectiveMonth: params.effectiveMonth,
      effectiveDate: params.effectiveDate,
      reason: params.reason,
      approvedByTelegramId: params.approvedByTelegramId ?? 0n,
      approvedByName: params.approvedByName || null,
    });

    return { success: true, changeId };
  }

  async getSalaryHistory(workerId: string): Promise<SalaryHistoryRecord[]> {
    return this.repository.getSalaryHistory(workerId);
  }

  async getWorkerChangeLog(workerId: string): Promise<WorkerChangeLogRecord[]> {
    return this.repository.getWorkerChangeLog(workerId);
  }

  async getAllSites(): Promise<Array<{ id: string; name: string }>> {
    return this.repository.getAllSites();
  }

  async getAllJobTitles(): Promise<Array<{ id: string; name: string }>> {
    return this.repository.getAllJobTitles();
  }

  async getAllDepartments(): Promise<Array<{ id: string; name: string }>> {
    return this.repository.getAllDepartments();
  }

  async submitEditTicket(input: CreateEditRequestInput): Promise<EditExecutionResult> {
    const val = validateFieldValue(input.fieldKey, input.newValue);
    if (!val.isValid || !val.cleanValue) {
      return { success: false, isDirectExecution: false, error: val.error || 'القيمة غير صالحة' };
    }

    const requestId = await this.repository.generateNextRequestId();
    const ticket = await this.repository.createEditTicket({
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
      newValue: val.cleanValue,
      reason: input.reason?.trim() || 'طلب تعديل رسمي',
    });

    return {
      success: true,
      workerCode: input.workerCode,
      fieldName: input.fieldName,
      newValue: val.cleanValue,
      isDirectExecution: false,
      ticketId: ticket.requestId,
    };
  }

  async approveTicket(requestId: string, adminTelegramId: bigint): Promise<EditExecutionResult> {
    const ticket = await this.repository.findTicketByRequestId(requestId);
    if (!ticket) {
      return { success: false, isDirectExecution: true, error: 'طلب التعديل غير موجود.' };
    }
    if (ticket.status !== 'PENDING') {
      return { success: false, isDirectExecution: true, error: `الطلب تم البت فيه مسبقاً بحالة: ${ticket.status}` };
    }

    const directResult = await this.applyDirectEdit(
      ticket.workerId,
      ticket.fieldKey as EditableWorkerField,
      ticket.newValue,
      adminTelegramId
    );

    if (directResult.success) {
      await this.repository.updateTicketStatus(ticket.id, 'APPROVED', adminTelegramId);
    }

    return directResult;
  }

  async rejectTicket(requestId: string, adminTelegramId: bigint, reason?: string): Promise<{ success: boolean; error?: string }> {
    const ticket = await this.repository.findTicketByRequestId(requestId);
    if (!ticket) {
      return { success: false, error: 'طلب التعديل غير موجود.' };
    }
    if (ticket.status !== 'PENDING') {
      return { success: false, error: `الطلب تم البت فيه مسبقاً بحالة: ${ticket.status}` };
    }

    await this.repository.updateTicketStatus(ticket.id, 'REJECTED', adminTelegramId, reason);
    return { success: true };
  }

  async applyCigaretteAllocation(
    workerId: string,
    policy: string,
    brandName?: string | null,
    canteenItemId?: string | null,
    actorTelegramId?: bigint
  ): Promise<EditExecutionResult> {
    const worker = await this.repository.findWorkerForEdit(workerId);
    if (!worker) {
      return { success: false, isDirectExecution: true, error: 'لم يتم العثور على العامل المطلوب' };
    }

    const dataToUpdate: Prisma.WorkerUpdateInput = {
      canteenCigarettePolicy: policy,
      cigaretteBrand: brandName || null,
    };

    if (canteenItemId) {
      dataToUpdate.canteenItem = { connect: { id: canteenItemId } };
    } else if (policy === 'NONE') {
      dataToUpdate.canteenItem = { disconnect: true };
    }

    const updated = await this.repository.updateWorkerDirect(workerId, dataToUpdate, actorTelegramId, {
      category: 'FINANCIAL',
      fieldKey: 'canteenCigarettePolicy',
      fieldNameAr: 'مخصص السجائر المعتمد',
      oldValue: worker.canteenCigarettePolicy || 'بدون مخصص',
      newValue: policy === 'NONE' ? 'بدون مخصص' : `${policy} (${brandName || 'غير محدد'})`,
      reason: 'تعديل مخصص السجائر',
      actorTelegramId: actorTelegramId ?? 0n,
      actorRole: 'SUPER_ADMIN',
    });

    return {
      success: true,
      workerCode: updated.code,
      fieldName: 'مخصص السجائر المعتمد',
      newValue: policy === 'NONE' ? 'بدون مخصص' : `${policy} (${brandName || 'غير محدد'})`,
      isDirectExecution: true,
    };
  }

  async getCigaretteItems(siteId?: string) {
    return this.repository.getActiveCigaretteItems(siteId);
  }

  async listPendingTickets(): Promise<PendingEditTicket[]> {
    return this.repository.listPendingTickets();
  }
}
