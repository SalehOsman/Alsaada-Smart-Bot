import { createHash } from 'node:crypto';
import { encryptField, createBlindIndex, Prisma } from '@alsaada/database';
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

  async listPendingTickets(): Promise<PendingEditTicket[]> {
    return this.repository.listPendingTickets();
  }
}
