import { decryptField, normalizeKeyToHex } from '@alsaada/database';
import { normalizeDigits, formatCurrency } from '@alsaada/regional-engine';
import { normalizeEgyptianPhone } from '@alsaada/core-components';
import { EGYPTIAN_GOVERNORATES } from '@alsaada/national-id-engine';
import { WorkerDirectoryRepository } from './flow.repository.js';
import { WorkerDirectoryMessages } from './flow.messages.js';
import type {
  WorkerDirectoryQuery,
  WorkerDirectoryResult,
  WorkerProfile360,
} from './flow.types.js';

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

  async getWorkersSummary(): Promise<{ totalActive: number; egyptianCount: number; foreignCount: number }> {
    return this.repository.getWorkersSummary();
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

    const canViewFullId = [
      'SUPER_ADMIN',
      'GENERAL_ADMIN',
      'EXECUTIVE',
      'FIELD_ADMIN',
      'HR_MANAGER',
      'PROJECT_MANAGER',
    ].includes(viewerRole);

    const idNumberFull = canViewFullId && rawId ? rawId : undefined;
    let idNumberMasked = 'غير مسجل';
    if (rawId) {
      if (canViewFullId) {
        idNumberMasked = rawId;
      } else {
        idNumberMasked = rawId.length >= 4 ? `**********${rawId.slice(-4)}` : '**********';
      }
    }

    // Financial RBAC masking (Strict Pre-Render RBAC Masking: completely undefined if not authorized)
    const canViewFinances = ['SUPER_ADMIN', 'GENERAL_ADMIN', 'ACCOUNTANT'].includes(viewerRole);
    const basicSal = Number(worker.basicSalary || 0);
    const addSal = Number(worker.fixedAllowances || 0);
    const totalSal = basicSal + addSal > 0 ? basicSal + addSal : Number(worker.dailyWage || 0) * 30;
    const dailyWageVal = Number(worker.dailyWage || 0) > 0 ? Number(worker.dailyWage) : (totalSal > 0 ? totalSal / 30 : 0);
    const basicSalaryMasked = canViewFinances && basicSal > 0 ? formatCurrency(basicSal) : undefined;
    const additionalSalaryMasked = canViewFinances && addSal > 0 ? formatCurrency(addSal) : undefined;
    const totalSalaryMasked = canViewFinances && totalSal > 0 ? formatCurrency(totalSal) : undefined;
    const dailyWageMasked = canViewFinances && dailyWageVal > 0 ? formatCurrency(dailyWageVal) : undefined;

    // Governorate Name & Contract Type mapping
    const govCode = worker.governorateCode || '88';
    const governorateName = EGYPTIAN_GOVERNORATES[govCode]?.nameAr || govCode;

    const CONTRACT_TYPE_MAP: Record<string, string> = {
      DAILY_LABOR: 'عمالة يومية / مؤقتة',
      PERMANENT: 'عقد عمل دائم',
      SEASONAL: 'عقد عمل موسمي',
      FIXED_TERM: 'محدد المدة',
      PROBATION: 'تحت الاختبار',
    };
    const contractTypeAr = CONTRACT_TYPE_MAP[worker.contractType] || worker.contractType || 'عمالة يومية / مؤقتة';

    // WhatsApp Direct Chat URL (strictly <= 50 ASCII bytes, 100% Telegram compliant)
    let directWhatsAppUrl: string | undefined;
    if (phone) {
      const cleanDigits = normalizeDigits(phone.replace(/\D/g, ''));
      const intlDigits = cleanDigits.startsWith('2')
        ? cleanDigits
        : (cleanDigits.startsWith('0') ? `2${cleanDigits}` : `20${cleanDigits}`);
      directWhatsAppUrl = `https://api.whatsapp.com/send?phone=${intlDigits}`;
    }

    // Missing items & attachments evaluation
    const missingItems: string[] = [];
    let requiredItemsCount = 0;

    // 1. صورة وجه البطاقة / الجواز
    requiredItemsCount++;
    if (!worker.idCardFrontPath) {
      missingItems.push(worker.idType === 'PASSPORT' ? 'صورة جواز السفر' : 'صورة وجه البطاقة');
    }

    // 2. صورة ظهر البطاقة (للرقم القومي فقط)
    if (worker.idType !== 'PASSPORT') {
      requiredItemsCount++;
      if (!worker.idCardBackPath) {
        missingItems.push('صورة ظهر البطاقة');
      }
    }

    // 3. رقم هاتف العامل
    requiredItemsCount++;
    if (!phone || phone.trim() === '') {
      missingItems.push('رقم هاتف العامل');
    }

    // 4. رقم هاتف الطوارئ
    requiredItemsCount++;
    if (!emergencyPhone || emergencyPhone.trim() === '') {
      missingItems.push('رقم هاتف الطوارئ');
    }

    // 5. محل الإقامة / العنوان
    requiredItemsCount++;
    if (!worker.address || worker.address.trim() === '') {
      missingItems.push('محل الإقامة والعنوان');
    }

    // 6. الموقف التأميني / الرقم التأميني
    requiredItemsCount++;
    const hasInsurance = Boolean(
      (worker.insuranceNumber && worker.insuranceNumber.trim() !== '') ||
      (worker.insuranceStatus && worker.insuranceStatus.trim() !== '')
    );
    if (!hasInsurance) {
      missingItems.push('الموقف التأميني / الرقم التأميني');
    }

    // 7. الموقف التجنيدي (للذكور)
    if (worker.gender === 'MALE') {
      requiredItemsCount++;
      if (!worker.militaryStatus || worker.militaryStatus.trim() === '') {
        missingItems.push('الموقف التجنيدي');
      }
    }

    // 8. رخصة القيادة (إذا كانت الوظيفة قيادة أو تشغيل معدات)
    const isDrivingRole = [
      'سائق',
      'سواق',
      'معدة',
      'لودر',
      'حفار',
      'جريدر',
      'ونش',
      'تريلا',
      'قلاب',
      'شاحنة',
      'خلاطة',
    ].some((kw) => (worker.jobTitle || '').includes(kw));

    if (isDrivingRole) {
      requiredItemsCount++;
      const hasLicense = Boolean(
        worker.drivingLicense &&
        worker.drivingLicense !== 'لا توجد رخصة' &&
        worker.drivingLicense !== 'NO_LICENSE'
      );
      if (!hasLicense) {
        missingItems.push('رخصة القيادة');
      }
    }

    // 9. بيانات تحويل الراتب / الحساب أو المحفظة
    if (worker.paymentMethod && worker.paymentMethod !== 'CASH_SITE') {
      requiredItemsCount++;
      const hasPaymentInfo = Boolean(
        worker.accountNumberEncrypted || worker.instaPayHandle
      );
      if (!hasPaymentInfo) {
        missingItems.push('بيانات الحساب البنكي أو المحفظة');
      }
    }

    const completedItemsCount = Math.max(0, requiredItemsCount - missingItems.length);
    const completionPercentage = requiredItemsCount > 0
      ? Math.round((completedItemsCount / requiredItemsCount) * 100)
      : 100;
    const isProfileComplete = missingItems.length === 0;

    let missingDataWhatsAppUrl: string | undefined;
    if (!isProfileComplete && missingItems.length > 0) {
      const waText = WorkerDirectoryMessages.formatMissingDataWhatsAppMessage({
        name: worker.name,
        nickname: worker.nickname,
        missingItems,
      });
      missingDataWhatsAppUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}`;
    }

    return {
      id: worker.id,
      code: worker.code,
      legacyCode: worker.legacyCode || undefined,
      name: worker.name,
      nickname: worker.nickname || undefined,
      idType: worker.idType === 'PASSPORT' ? 'PASSPORT' : 'NATIONAL_ID',
      idNumberMasked,
      idNumberFull,
      canRevealId: Boolean(canViewFullId && rawId),
      phone,
      jobTitle: worker.jobTitle,
      departmentName: worker.department?.name,
      siteName: worker.site?.name,
      hireDate: worker.hireDate,
      shiftSystem: worker.shiftSystem,
      contractTypeAr,
      governorateName,
      dailyWageMasked,
      basicSalaryMasked,
      additionalSalaryMasked,
      totalSalaryMasked,
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
      isProfileComplete,
      completionPercentage,
      missingItems,
      missingDataWhatsAppUrl,
    };
  }
}
