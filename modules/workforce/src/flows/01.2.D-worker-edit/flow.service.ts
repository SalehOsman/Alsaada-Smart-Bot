import { createHash } from 'node:crypto';
import { encryptField, decryptField, createBlindIndex, Prisma } from '@alsaada/database';
import { normalizeDigits, parseFlexibleDate } from '@alsaada/regional-engine';
import { detectGovernorateFromAddress, getGovernorateCodeByName } from '@alsaada/national-id-engine';
import { WorkerEditRepository } from './flow.repository.js';
import { FIELD_LABELS, validateFieldValue } from './flow.validators.js';
import type {
  EditableWorkerField,
  CreateEditRequestInput,
  EditExecutionResult,
  PendingEditTicket,
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
    actorTelegramId?: bigint
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

    if (fieldKey === 'name') {
      dataToUpdate.name = cleanValue;
    } else if (fieldKey === 'nickname') {
      dataToUpdate.nickname = cleanValue;
      const aliases = (worker.aliases || []).filter((a) => a !== cleanValue);
      aliases.push(cleanValue);
      dataToUpdate.aliases = aliases;
    } else if (fieldKey === 'phone') {
      const cleanPhone = normalizeDigits(cleanValue.replace(/[\s-]/g, ''));
      dataToUpdate.phoneBlindIndex = createBlindIndex(cleanPhone, this.blindIndexSalt);
      dataToUpdate.phoneEncrypted = encryptField(cleanPhone, this.normalizedKeyHex);
    } else if (fieldKey === 'emergencyPhone') {
      const cleanEm = normalizeDigits(cleanValue.replace(/[\s-]/g, ''));
      dataToUpdate.emergencyPhoneEncrypted = encryptField(cleanEm, this.normalizedKeyHex);
    } else if (fieldKey === 'walletNumber') {
      const cleanWallet = normalizeDigits(cleanValue.replace(/[\s-]/g, ''));
      dataToUpdate.accountNumberEncrypted = encryptField(cleanWallet, this.normalizedKeyHex);
    } else if (fieldKey === 'drivingLicense') {
      dataToUpdate.drivingLicense = cleanValue;
    } else if (fieldKey === 'militaryStatus') {
      dataToUpdate.militaryStatus = cleanValue;
    } else if (fieldKey === 'maritalStatus') {
      dataToUpdate.maritalStatus = cleanValue;
    } else if (fieldKey === 'idCardExpiryDate') {
      const parsedExp = parseFlexibleDate(cleanValue);
      dataToUpdate.idCardExpiryDate = parsedExp.isValid && parsedExp.date ? parsedExp.date : new Date(cleanValue);
    } else if (fieldKey === 'address') {
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
      dataToUpdate.governorateCode = govCode;
    } else if (fieldKey === 'legacyCode') {
      dataToUpdate.legacyCode = cleanValue;
      const aliases = (worker.aliases || []).filter((a) => a !== cleanValue);
      aliases.push(cleanValue);
      dataToUpdate.aliases = aliases;
    } else if (fieldKey === 'bloodType') {
      dataToUpdate.bloodType = cleanValue;
    } else if (fieldKey === 'shiftSystem') {
      dataToUpdate.shiftSystem = cleanValue;
    } else if (fieldKey === 'contractType') {
      dataToUpdate.contractType = cleanValue;
    } else if (fieldKey === 'barracksUnit') {
      dataToUpdate.barracksUnit = cleanValue;
    } else if (fieldKey === 'bedNumber') {
      dataToUpdate.bedNumber = cleanValue;
    } else if (fieldKey === 'dailyWage') {
      dataToUpdate.dailyWage = new Prisma.Decimal(cleanValue);
    } else if (fieldKey === 'basicSalary') {
      dataToUpdate.basicSalary = new Prisma.Decimal(cleanValue);
    } else if (fieldKey === 'fixedAllowances') {
      dataToUpdate.fixedAllowances = new Prisma.Decimal(cleanValue);
    } else if (fieldKey === 'paymentMethod') {
      dataToUpdate.paymentMethod = cleanValue;
    } else if (fieldKey === 'walletOwnerName') {
      dataToUpdate.walletOwnerName = cleanValue;
    } else if (fieldKey === 'instaPayHandle') {
      dataToUpdate.instaPayHandle = cleanValue;
    } else if (fieldKey === 'insuranceNumber') {
      dataToUpdate.insuranceNumber = cleanValue;
    } else if (fieldKey === 'insuranceStatus') {
      dataToUpdate.insuranceStatus = cleanValue;
    } else if (fieldKey === 'canteenCigarettePolicy') {
      dataToUpdate.canteenCigarettePolicy = cleanValue;
      if (cleanValue === 'NONE') {
        dataToUpdate.cigaretteBrand = null;
        dataToUpdate.canteenItem = { disconnect: true };
      }
    } else if (fieldKey === 'cigaretteBrand') {
      dataToUpdate.cigaretteBrand = cleanValue;
    } else if (fieldKey === 'emergencyContactName') {
      dataToUpdate.emergencyContactName = cleanValue;
    } else if (fieldKey === 'ppeShoeSize') {
      dataToUpdate.ppeShoeSize = cleanValue;
    } else if (fieldKey === 'ppeUniformSize') {
      dataToUpdate.ppeUniformSize = cleanValue;
    } else if (fieldKey === 'medicalNotes') {
      dataToUpdate.medicalNotes = cleanValue;
    }

    const updated = await this.repository.updateWorkerDirect(workerId, dataToUpdate, actorTelegramId);
    const fieldName = FIELD_LABELS[fieldKey] || fieldKey;

    return {
      success: true,
      workerCode: updated.code,
      fieldName,
      newValue: cleanValue,
      isDirectExecution: true,
    };
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

    const updated = await this.repository.updateWorkerDirect(workerId, dataToUpdate, actorTelegramId);
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
