import { decryptField, normalizeKeyToHex } from '@alsaada/database';
import { normalizeDigits, formatCurrency } from '@alsaada/regional-engine';
import { EGYPTIAN_GOVERNORATES } from '@alsaada/national-id-engine';
import { WorkerDirectoryRepository } from './flow.repository.js';
import { WorkerDirectoryMessages } from './flow.messages.js';
import { workerStorageService } from '../../services/worker-storage.service.js';
import type {
  WorkerDirectoryQuery,
  WorkerDirectoryResult,
  WorkerProfile360,
  WorkerDocumentItem,
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
    const rawDailyWage = Number(worker.dailyWage || 0);
    const dailyWageVal = rawDailyWage > 0 ? rawDailyWage : (totalSal > 0 ? totalSal / 30 : 0);
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
      const companyName = await this.repository.getCompanyTradeName();
      const waText = WorkerDirectoryMessages.formatMissingDataWhatsAppMessage({
        name: worker.name,
        nickname: worker.nickname,
        missingItems,
        companyName,
      });
      missingDataWhatsAppUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}`;
    }

    const latestScore = (worker as { commitmentScores?: Array<{ tier: string; totalScore: number }> }).commitmentScores?.[0];
    let commitmentBadge: string | undefined;
    if (latestScore) {
      const tierBadge = latestScore.tier === 'COMMITTED' ? '🟢' : latestScore.tier === 'MODERATE' ? '🟡' : latestScore.tier === 'PROBATION' ? '⚪' : '🔴';
      const tierArabic = latestScore.tier === 'COMMITTED' ? 'ملتزم' : latestScore.tier === 'MODERATE' ? 'متوسط الالتزام' : latestScore.tier === 'PROBATION' ? 'حديث تعيين' : 'قيد المتابعة';
      commitmentBadge = `${tierBadge} ${tierArabic} (${latestScore.totalScore}/100)`;
    } else {
      commitmentBadge = '🟢 ملتزم (100/100)';
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
      telegramId: worker.telegramId || undefined,
      documentsCount: await this.repository.countWorkerDocuments(worker.id),
      commitmentBadge,
    };
  }

  async getWorkerDocuments(workerId: string): Promise<WorkerDocumentItem[]> {
    return this.repository.findWorkerDocuments(workerId);
  }

  async getDocumentById(docId: string) {
    return this.repository.findDocumentById(docId);
  }

  async addWorkerDocument(params: {
    workerId: string;
    workerCode: string;
    originalFileName: string;
    fileBuffer: Buffer;
    title: string;
    category: string;
    mimeType?: string | undefined;
    uploadedBy?: bigint | null | undefined;
  }) {
    const saved = workerStorageService.saveWorkerAttachmentLocally(
      params.workerCode,
      params.originalFileName,
      params.fileBuffer
    );

    return this.repository.createDocument({
      workerId: params.workerId,
      title: params.title,
      category: params.category,
      fileName: saved.fileName,
      fileType: params.mimeType || 'application/octet-stream',
      fileUri: saved.localPath,
      fileSizeBytes: BigInt(params.fileBuffer.length),
      uploadedBy: params.uploadedBy ?? null,
    });
  }

  async deleteWorkerDocument(
    docId: string,
    actorRole: string
  ): Promise<{ success: boolean; error?: string; workerId?: string }> {
    if (actorRole !== 'SUPER_ADMIN') {
      return { success: false, error: 'غير مصرح: حذف المستندات محصور حصراً بالسوبر أدمن.' };
    }

    const doc = await this.repository.findDocumentById(docId);
    if (!doc) {
      return { success: false, error: 'المستند غير موجود أو تم حذفه مسبقاً.' };
    }

    workerStorageService.deleteWorkerAttachmentLocally(doc.fileUri);
    await this.repository.deleteDocument(docId);

    return { success: true, workerId: doc.workerId };
  }
}
