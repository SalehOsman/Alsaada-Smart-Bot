import { createHash } from 'node:crypto';
import { decryptField } from '@alsaada/database';
import { normalizeDigits, formatCurrency } from '@alsaada/regional-engine';
import { normalizeEgyptianPhone } from '@alsaada/core-components';
import { WorkerDirectoryRepository } from './flow.repository.js';
import type {
  WorkerDirectoryQuery,
  WorkerDirectoryResult,
  WorkerProfile360,
} from './flow.types.js';

function normalizeKeyToHex(key: string): string {
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return key;
  }
  return createHash('sha256').update(key).digest('hex');
}

export class WorkerDirectoryService {
  private readonly normalizedKeyHex: string;

  constructor(
    private readonly repository: WorkerDirectoryRepository,
    private readonly encryptionKey: string = 'alsaada-default-key-min-32-chars-long!'
  ) {
    this.normalizedKeyHex = normalizeKeyToHex(this.encryptionKey);
  }

  async getDirectoryPage(query: WorkerDirectoryQuery): Promise<WorkerDirectoryResult> {
    return this.repository.findWorkers(query);
  }

  async getWorkerProfile360(workerId: string, viewerRole = 'GUEST'): Promise<WorkerProfile360 | null> {
    const worker = await this.repository.findWorkerById(workerId);
    if (!worker || worker.isDeleted) {
      return null;
    }

    // Decrypt phone if available
    let phone: string | undefined;
    if (worker.phoneEncrypted) {
      try {
        phone = decryptField(worker.phoneEncrypted, this.normalizedKeyHex);
      } catch {
        phone = undefined;
      }
    }

    // Decrypt emergency phone if available
    let emergencyPhone: string | undefined;
    if (worker.emergencyPhoneEncrypted) {
      try {
        emergencyPhone = decryptField(worker.emergencyPhoneEncrypted, this.normalizedKeyHex);
      } catch {
        emergencyPhone = undefined;
      }
    }

    // Decrypt and mask National ID / Passport
    let rawId = '';
    if (worker.idType === 'NATIONAL_ID' && worker.nationalIdEncrypted) {
      try {
        rawId = decryptField(worker.nationalIdEncrypted, this.normalizedKeyHex);
      } catch {
        rawId = '';
      }
    } else if (worker.idType === 'PASSPORT' && worker.passportNumberEncrypted) {
      try {
        rawId = decryptField(worker.passportNumberEncrypted, this.normalizedKeyHex);
      } catch {
        rawId = '';
      }
    }

    const idNumberMasked = rawId.length > 4
      ? '*'.repeat(Math.max(0, rawId.length - 4)) + rawId.slice(-4)
      : (rawId || '••••••••');

    // Financial RBAC masking
    const canViewFinances = ['SUPER_ADMIN', 'GENERAL_ADMIN', 'ACCOUNTANT'].includes(viewerRole);
    const dailyWageMasked = canViewFinances
      ? formatCurrency(Number(worker.dailyWage || 0))
      : '•••••• ج.م (محجوب)';

    // WhatsApp URL
    let directWhatsAppUrl: string | undefined;
    if (phone) {
      const cleanPhone = normalizeDigits(phone.replace(/\D/g, ''));
      const intlPhone = normalizeEgyptianPhone(cleanPhone) || cleanPhone;
      directWhatsAppUrl = `https://api.whatsapp.com/send?phone=${intlPhone}`;
    }

    return {
      id: worker.id,
      code: worker.code,
      legacyCode: worker.legacyCode || undefined,
      name: worker.name,
      nickname: worker.nickname || undefined,
      idType: worker.idType === 'PASSPORT' ? 'PASSPORT' : 'NATIONAL_ID',
      idNumberMasked,
      phone,
      jobTitle: worker.jobTitle,
      departmentName: worker.department?.name,
      siteName: worker.site?.name,
      hireDate: worker.hireDate,
      shiftSystem: worker.shiftSystem,
      dailyWageMasked,
      paymentMethod: worker.paymentMethod,
      drivingLicense: worker.drivingLicense || undefined,
      militaryStatus: worker.militaryStatus || undefined,
      maritalStatus: worker.maritalStatus || undefined,
      emergencyContactName: worker.emergencyContactName || undefined,
      emergencyPhone,
      idCardExpiryDate: worker.idCardExpiryDate || undefined,
      address: worker.address || undefined,
      status: worker.status,
      directWhatsAppUrl,
    };
  }
}
