import { encryptField, decryptField, createBlindIndex } from '@alsaada/database';
import { createHash } from 'node:crypto';
import type { WorkerSelfEditRepository } from './flow.repository.js';
import type { WorkerSelfEditInput, WorkerSelfEditResult } from './flow.types.js';
import {
  validateWorkerSelfEditField,
  isForbiddenFinancialField,
  validateFieldValue,
} from './flow.validators.js';

function normalizeKeyToHex(key: string): string {
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return key;
  }
  return createHash('sha256').update(key).digest('hex');
}

export class WorkerSelfEditService {
  private readonly normalizedKeyHex: string;

  constructor(
    private readonly repository: WorkerSelfEditRepository,
    private readonly encryptionKey: string = 'alsaada-default-key-min-32-chars-long!'
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

  async getWorker(workerId: string) {
    return this.repository.getWorkerById(workerId);
  }

  async getWorkerByTelegramId(telegramId: bigint) {
    return this.repository.getWorkerByTelegramId(telegramId);
  }

  async executeSelfEdit(input: WorkerSelfEditInput): Promise<WorkerSelfEditResult> {
    if (isForbiddenFinancialField(input.field)) {
      throw new Error('محاولة تعديل حقل مالي محظور قطيعاً (Zero Financial Mutation).');
    }

    if (!validateWorkerSelfEditField(input.field)) {
      throw new Error('الحقل المطلوب تعديله غير متاح للتعديل الذاتي.');
    }

    const val = validateFieldValue(input.field, input.newValue);
    if (!val.isValid || !val.sanitizedValue) {
      throw new Error(val.error || 'القيمة المدخلة غير صالحة.');
    }

    const worker = await this.repository.getWorkerById(input.workerId);
    if (!worker) {
      throw new Error('لم يتم العثور على سجل العامل في المنظومة.');
    }

    const sanitized = val.sanitizedValue;
    const updatePayload: Record<string, string> = {};

    if (input.field === 'phone') {
      updatePayload['phoneEncrypted'] = encryptField(sanitized, this.normalizedKeyHex);
      updatePayload['phoneBlindIndex'] = createBlindIndex(sanitized, this.normalizedKeyHex);
    } else if (input.field === 'emergencyPhone') {
      updatePayload['emergencyPhoneEncrypted'] = encryptField(sanitized, this.normalizedKeyHex);
    } else if (input.field === 'accountNumber') {
      updatePayload['accountNumberEncrypted'] = encryptField(sanitized, this.normalizedKeyHex);
    } else {
      updatePayload[input.field] = sanitized;
    }

    return this.repository.updateWorkerField({
      ...input,
      newValue: sanitized,
      updatePayload,
    });
  }
}
