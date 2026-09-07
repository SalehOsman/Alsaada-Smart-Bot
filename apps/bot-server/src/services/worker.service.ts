import { prisma } from '../db.js';
import { config } from '../config/env.js';
import { fastCache } from './fast-cache.service.js';
import { encryptField, decryptField, createBlindIndex } from '@alsaada/database';
import { parseEgyptianNationalId } from '@alsaada/national-id-engine';
import { normalizeDigits, formatDate, extractFirstTwoNames } from '@alsaada/regional-engine';
import { normalizeEgyptianPhone } from '@alsaada/core-components';

export interface CreateWorkerInput {
  name: string;
  nickname?: string;
  legacyCode?: string; // الكود القديم إن وجد للأرشفة والمطابقة
  idType: 'NATIONAL_ID' | 'PASSPORT';
  idNumber: string;
  nationality?: string;
  birthDate?: Date;
  gender?: 'MALE' | 'FEMALE';
  governorateCode?: string;
  phone: string;
  jobTitleId?: string;
  jobTitleName: string;
  departmentId?: string;
  siteId?: string;
  siteName?: string;
  hireDate?: Date;
  shiftSystem?: string;
  dailyWage?: number;
  basicSalary?: number;
  fixedAllowances?: number;
  paymentMethod?: string;
  accountNumber?: string;
  walletType?: string;
  emergencyContactName?: string;
  emergencyPhone?: string;
  drivingLicense?: string;
  militaryStatus?: string;
  maritalStatus?: string;
  previousInsuranceStatus?: string;
  idCardFrontPath?: string;
  idCardBackPath?: string;
  notes?: string;
}

export interface WorkerValidationResult {
  isValid: boolean;
  error?: string;
  birthDate?: Date;
  age?: number;
  gender?: 'MALE' | 'FEMALE';
  genderArabic?: string;
  governorateCode?: string;
  governorateNameAr?: string;
}

export class WorkerService {
  /**
   * التحقق من صحة وثيقة الهوية (رقم قومي مصري أو جواز سفر)
   */
  validateIdentification(
    idType: 'NATIONAL_ID' | 'PASSPORT',
    rawId: string,
    extra?: { birthDate?: Date; gender?: 'MALE' | 'FEMALE' }
  ): WorkerValidationResult {
    if (!rawId || !rawId.trim()) {
      return { isValid: false, error: 'رقم الإثبات مطلوب ولا يمكن تركه فارغاً.' };
    }

    if (idType === 'NATIONAL_ID') {
      const parsed = parseEgyptianNationalId(rawId);
      if (!parsed.isValid || !parsed.info) {
        return { isValid: false, error: parsed.error || 'الرقم القومي غير صالح.' };
      }
      return {
        isValid: true,
        birthDate: parsed.info.birthDate,
        age: parsed.info.age,
        gender: parsed.info.gender,
        genderArabic: parsed.info.genderArabic,
        governorateCode: parsed.info.governorateCode,
        governorateNameAr: parsed.info.governorateNameAr,
      };
    } else {
      // جواز السفر
      const cleanPassport = normalizeDigits(rawId.trim().toUpperCase().replace(/[\s-]/g, ''));
      if (cleanPassport.length < 5 || cleanPassport.length > 20) {
        return {
          isValid: false,
          error: `رقم جواز السفر غير صحيح (يجب أن يتراوح بين 5 و 20 حرفاً ورقم).`,
        };
      }
      if (!extra?.birthDate) {
        return { isValid: false, error: 'تاريخ الميلاد إلزامي في حال تسجيل جواز السفر.' };
      }
      if (!extra?.gender) {
        return { isValid: false, error: 'تحديد النوع (ذكر / أنثى) إلزامي في حال تسجيل جواز السفر.' };
      }

      const today = new Date();
      let age = today.getFullYear() - extra.birthDate.getFullYear();
      const m = today.getMonth() - extra.birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < extra.birthDate.getDate())) {
        age--;
      }

      return {
        isValid: true,
        birthDate: extra.birthDate,
        age: Math.max(0, age),
        gender: extra.gender,
        genderArabic: extra.gender === 'MALE' ? 'ذكر' : 'أنثى',
        governorateCode: '88', // وافد / خارج الجمهورية
        governorateNameAr: 'خارج الجمهورية (وافد)',
      };
    }
  }

  /**
   * فحص الازدواجية في قاعدة البيانات لمنع تكرار تسجيل العامل
   */
  async checkDuplicate(
    idType: 'NATIONAL_ID' | 'PASSPORT',
    idNumber: string
  ): Promise<{ isDuplicate: boolean; existingWorker?: { code: string; name: string; jobTitle: string; siteName?: string } | null }> {
    const cleanId = normalizeDigits(idNumber.trim().toUpperCase().replace(/[\s-]/g, ''));
    const blindIndex = createBlindIndex(cleanId, config.blindIndexSalt);

    if (idType === 'NATIONAL_ID') {
      const existing = await prisma.worker.findFirst({
        where: {
          nationalIdBlindIndex: blindIndex,
          isDeleted: false,
        },
        include: { site: true },
      });

      if (existing) {
        return {
          isDuplicate: true,
          existingWorker: {
            code: existing.code,
            name: existing.name,
            jobTitle: existing.jobTitle,
            siteName: existing.site?.name,
          },
        };
      }
    } else {
      const existing = await prisma.worker.findFirst({
        where: {
          passportBlindIndex: blindIndex,
          isDeleted: false,
        },
        include: { site: true },
      });

      if (existing) {
        return {
          isDuplicate: true,
          existingWorker: {
            code: existing.code,
            name: existing.name,
            jobTitle: existing.jobTitle,
            siteName: existing.site?.name,
          },
        };
      }
    }

    return { isDuplicate: false, existingWorker: null };
  }

  /**
   * توليد كود العامل الذكي القادم وفقاً للقسم والوظيفة (e.g. OP-DRV-001 أو WRK-001)
   */
  async generateNextWorkerCode(deptCode?: string, jobCode?: string): Promise<string> {
    const prefix = deptCode && jobCode ? `${deptCode.toUpperCase()}-${jobCode.toUpperCase()}` : 'WRK';

    const workers = await prisma.worker.findMany({
      where: {
        code: { startsWith: `${prefix}-` },
      },
      select: { code: true },
    });

    let maxSeq = 0;
    const regex = new RegExp(`^${prefix}-(\\d+)$`, 'i');
    for (const w of workers) {
      const match = w.code.match(regex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }

    const nextSeq = maxSeq + 1;
    const padded = String(nextSeq).padStart(3, '0'); // 3 أرقام مثل OP-DRV-001
    return `${prefix}-${padded}`;
  }

  /**
   * تسجيل وحفظ عامل جديد في المنظومة
   */
  async createWorker(input: CreateWorkerInput) {
    // 1. التحقق من الهوية
    const valResult = this.validateIdentification(input.idType, input.idNumber, {
      birthDate: input.birthDate,
      gender: input.gender,
    });
    if (!valResult.isValid) {
      throw new Error(valResult.error || 'بيانات إثبات الشخصية غير صالحة.');
    }

    // 2. فحص الازدواجية
    const dupCheck = await this.checkDuplicate(input.idType, input.idNumber);
    if (dupCheck.isDuplicate && dupCheck.existingWorker) {
      throw new Error(
        `تعارض: العامل مسجل مسبقاً بكود (${dupCheck.existingWorker.code}) والاسم (${dupCheck.existingWorker.name}).`
      );
    }

    // 3. كود الوظيفة والقسم لتوليد الكود الهيكلي
    let deptCode = 'OP';
    let jobCode = 'DRV';

    if (input.jobTitleId) {
      const job = await prisma.jobTitle.findUnique({
        where: { id: input.jobTitleId },
        include: { department: true },
      });
      if (job) {
        jobCode = job.code;
        deptCode = job.department.code;
      }
    }

    const newCode = await this.generateNextWorkerCode(deptCode, jobCode);

    // 4. التشفير والفهارس العمياء
    const cleanId = normalizeDigits(input.idNumber.trim().toUpperCase().replace(/[\s-]/g, ''));
    const blindIndex = createBlindIndex(cleanId, config.blindIndexSalt);

    const cleanPhone = normalizeDigits(input.phone.trim().replace(/[\s-]/g, ''));
    const phoneBlindIndex = createBlindIndex(cleanPhone, config.blindIndexSalt);
    const phoneEncrypted = config.databaseEncryptionKey
      ? encryptField(cleanPhone, config.databaseEncryptionKey)
      : cleanPhone;

    let nationalIdEncrypted: string | null = null;
    let nationalIdBlindIndex: string | null = null;
    let passportNumberEncrypted: string | null = null;
    let passportBlindIndex: string | null = null;

    if (input.idType === 'NATIONAL_ID') {
      nationalIdEncrypted = config.databaseEncryptionKey
        ? encryptField(cleanId, config.databaseEncryptionKey)
        : cleanId;
      nationalIdBlindIndex = blindIndex;
    } else {
      passportNumberEncrypted = config.databaseEncryptionKey
        ? encryptField(cleanId, config.databaseEncryptionKey)
        : cleanId;
      passportBlindIndex = blindIndex;
    }

    const emergencyPhoneEncrypted = input.emergencyPhone && config.databaseEncryptionKey
      ? encryptField(input.emergencyPhone, config.databaseEncryptionKey)
      : input.emergencyPhone;

    const accountNumberEncrypted = input.accountNumber && config.databaseEncryptionKey
      ? encryptField(input.accountNumber, config.databaseEncryptionKey)
      : input.accountNumber;

    // تجميع الأكواد القديمة وأسماء الشهرة في قائمة aliases
    const aliasesList: string[] = [];
    const resolvedNickname = input.nickname?.trim() || extractFirstTwoNames(input.name.trim());
    if (resolvedNickname) aliasesList.push(resolvedNickname);
    if (input.legacyCode && input.legacyCode.trim()) aliasesList.push(input.legacyCode.trim());

    // 5. حفظ السجل بقاعدة البيانات
    const worker = await prisma.worker.create({
      data: {
        code: newCode,
        name: input.name.trim(),
        nickname: resolvedNickname,
        aliases: aliasesList,
        idType: input.idType,
        nationality: input.nationality || (input.idType === 'NATIONAL_ID' ? 'مصر' : 'وافد'),
        nationalIdEncrypted,
        nationalIdBlindIndex,
        passportNumberEncrypted,
        passportBlindIndex,
        birthDate: valResult.birthDate || new Date('1990-01-01'),
        gender: valResult.gender || 'MALE',
        governorateCode: valResult.governorateCode || '88',
        jobTitle: input.jobTitleName,
        jobTitleId: input.jobTitleId,
        departmentId: input.departmentId,
        siteId: input.siteId,
        hireDate: input.hireDate || new Date(),
        shiftSystem: input.shiftSystem || '20_WORK_10_REST',
        dailyWage: input.dailyWage || 0,
        basicSalary: input.basicSalary || 0,
        fixedAllowances: input.fixedAllowances || 0,
        paymentMethod: input.paymentMethod || 'CASH_SITE',
        accountNumberEncrypted,
        walletType: input.walletType,
        drivingLicense: input.drivingLicense,
        militaryStatus: input.militaryStatus,
        maritalStatus: input.maritalStatus,
        previousInsuranceStatus: input.previousInsuranceStatus,
        idCardFrontPath: input.idCardFrontPath,
        idCardBackPath: input.idCardBackPath,
        phoneEncrypted,
        phoneBlindIndex,
        emergencyContactName: input.emergencyContactName,
        emergencyPhoneEncrypted,
        status: 'ACTIVE',
      },
      include: {
        site: true,
        department: true,
        jobRef: true,
      },
    });

    // 6. تطهير الكاش
    await fastCache.invalidate('workers:all:active');
    await fastCache.invalidate('workers:summary:count');

    // 7. إنشاء رابط الترحيب عبر واتساب
    const welcomeWhatsAppUrl = this.buildWorkerWelcomeWhatsAppUrl({
      name: worker.name,
      code: worker.code,
      jobTitle: worker.jobTitle,
      siteName: worker.site?.name,
      phone: cleanPhone,
    });

    return { worker, welcomeWhatsAppUrl };
  }

  /**
   * إنشاء رابط دعوة ترحيبي رسمي للعامل عبر واتساب
   */
  buildWorkerWelcomeWhatsAppUrl(data: {
    name: string;
    code: string;
    jobTitle: string;
    siteName?: string;
    phone: string;
  }): string {
    const intlPhone = normalizeEgyptianPhone(data.phone) || data.phone.replace(/\D/g, '');
    const siteLine = data.siteName ? `• *الموقع المخصص:* ${data.siteName}` : '';
    const text =
      `*شركة السعادة للمقاولات العامة والتعدين*\n` +
      `*إشعار تسجيل وتعيين عامل جديد*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `أهلاً بك زميلنا العزيز/ *${data.name}*\n` +
      `🔖 *كودك الوظيفي المعتمد:* \`${data.code}\`\n` +
      `💼 *الوظيفة:* ${data.jobTitle}\n` +
      (siteLine ? `${siteLine}\n` : '') +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `تم قيد بياناتك بنجاح في المنظومة الذكية للشركة.\n` +
      `نتمنى لك دوام التوفيق والنجاح والسلامة في مواقع العمل.`;

    const encoded = encodeURIComponent(text);
    return intlPhone
      ? `https://api.whatsapp.com/send?phone=${intlPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
  }

  /**
   * جلب إحصائيات القوى العاملة (سريعة من الكاش)
   */
  async getWorkersSummary() {
    return fastCache.rememberSWR('workers:summary:count', 300, async () => {
      const [totalActive, egyptianCount, foreignCount] = await Promise.all([
        prisma.worker.count({ where: { isDeleted: false, status: 'ACTIVE' } }),
        prisma.worker.count({ where: { isDeleted: false, status: 'ACTIVE', idType: 'NATIONAL_ID' } }),
        prisma.worker.count({ where: { isDeleted: false, status: 'ACTIVE', idType: 'PASSPORT' } }),
      ]);
      return { totalActive, egyptianCount, foreignCount };
    });
  }

  /**
   * جلب قائمة مختصرة بأحدث العمال المسجلين
   */
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
}

export const workerService = new WorkerService();
