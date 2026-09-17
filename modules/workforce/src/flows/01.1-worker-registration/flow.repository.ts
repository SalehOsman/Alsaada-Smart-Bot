import { PrismaClient, Prisma } from '@alsaada/database';
import type {
  CreateWorkerInput,
  WorkerLookupOption,
  JobTitleLookupOption,
  WorkerDuplicateCheckResult,
} from './flow.types.js';

export interface AtomicWorkerCreationPayload {
  input: CreateWorkerInput;
  code: string;
  nationalIdEncrypted: string | null;
  nationalIdBlindIndex: string | null;
  passportNumberEncrypted: string | null;
  passportBlindIndex: string | null;
  phoneEncrypted: string;
  phoneBlindIndex: string;
  accountNumberEncrypted: string | null;
  emergencyPhoneEncrypted: string | null;
  aliases: string[];
  resolvedNickname: string;
  actorTelegramId?: bigint | undefined;
  actorRole?: string | undefined;
}

export class WorkerRegistrationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getCompanyTradeName(): Promise<string> {
    try {
      const profile = await this.prisma.companyProfile.findFirst({
        include: { tenant: true },
      });
      if (profile?.tradeName && profile.tradeName.trim().length > 0) {
        return profile.tradeName.trim();
      }
      if (profile?.legalName && profile.legalName.trim().length > 0) {
        return profile.legalName.trim();
      }
      if (profile?.tenant?.name && profile.tenant.name.trim().length > 0) {
        return profile.tenant.name.trim();
      }
      const tenant = await this.prisma.tenant.findFirst({
        where: { isActive: true },
        select: { name: true },
        orderBy: { createdAt: 'asc' },
      });
      if (tenant?.name && tenant.name.trim().length > 0) {
        return tenant.name.trim();
      }
    } catch {
      // Fallback
    }
    return 'المنظومة المؤسسية';
  }

  async findExistingWorkerByBlindIndex(
    idType: 'NATIONAL_ID' | 'PASSPORT',
    blindIndex: string
  ): Promise<WorkerDuplicateCheckResult> {
    if (idType === 'NATIONAL_ID') {
      const existing = await this.prisma.worker.findFirst({
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
            siteName: existing.site?.name ?? undefined,
          },
        };
      }
    } else {
      const existing = await this.prisma.worker.findFirst({
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
            siteName: existing.site?.name ?? undefined,
          },
        };
      }
    }

    return { isDuplicate: false, existingWorker: null };
  }

  async generateNextWorkerCode(deptCode?: string, jobCode?: string): Promise<string> {
    const prefix = deptCode && jobCode ? `${deptCode.toUpperCase()}-${jobCode.toUpperCase()}` : 'WRK';

    const workers = await this.prisma.worker.findMany({
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
    const padded = String(nextSeq).padStart(3, '0');
    return `${prefix}-${padded}`;
  }

  async getJobTitleWithDepartment(jobTitleId: string): Promise<{ jobCode: string; deptCode: string } | null> {
    const job = await this.prisma.jobTitle.findUnique({
      where: { id: jobTitleId },
      include: { department: true },
    });
    if (!job) return null;
    return {
      jobCode: job.code,
      deptCode: job.department?.code || 'OP',
    };
  }

  async listActiveJobs(): Promise<JobTitleLookupOption[]> {
    const jobs = await this.prisma.jobTitle.findMany({
      where: { isActive: true },
      include: { department: true },
      orderBy: { order: 'asc' },
    });
    return jobs.map((j) => ({
      id: j.id,
      code: j.code,
      name: j.name,
      departmentCode: j.department?.code || 'GEN',
      baseSalary: Number(j.baseSalary || 0),
      additionalSalary: Number(j.additionalSalary || 0),
      workDays: j.workDays ?? 20,
      restDays: j.restDays ?? 10,
      shiftNature: j.shiftNature ?? 'دورة قياسية (20+10)',
    }));
  }

  async findJobTitleById(jobTitleId: string) {
    return this.prisma.jobTitle.findUnique({
      where: { id: jobTitleId },
      include: { department: true },
    });
  }

  async findExistingWorkerByPhoneBlindIndex(blindIndex: string): Promise<WorkerDuplicateCheckResult> {
    const existing = await this.prisma.worker.findFirst({
      where: {
        phoneBlindIndex: blindIndex,
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
          siteName: existing.site?.name ?? undefined,
        },
      };
    }
    return { isDuplicate: false, existingWorker: null };
  }

  async listActiveSites(): Promise<WorkerLookupOption[]> {
    const sites = await this.prisma.site.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, code: true, name: true },
    });
    return sites;
  }

  async createWorkerAtomic(payload: AtomicWorkerCreationPayload) {
    const execute = async (tx: Prisma.TransactionClient) => {
      const basicNum = Number(payload.input.basicSalary ?? 0);
      const addNum = Number(payload.input.additionalSalary ?? payload.input.fixedAllowances ?? 0);
      const grossNum = basicNum + addNum;
      const dailyWageNum = Number((grossNum / 30).toFixed(2));

      const createData: Prisma.WorkerUncheckedCreateInput = {
        code: payload.code,
        legacyCode: payload.input.legacyCode?.trim() || null,
        name: payload.input.name.trim(),
        nickname: payload.resolvedNickname,
        aliases: payload.aliases,
        idType: payload.input.idType,
        nationality: payload.input.nationality || (payload.input.idType === 'NATIONAL_ID' ? 'مصر' : 'وافد'),
        nationalIdEncrypted: payload.nationalIdEncrypted ?? null,
        nationalIdBlindIndex: payload.nationalIdBlindIndex ?? null,
        passportNumberEncrypted: payload.passportNumberEncrypted ?? null,
        passportBlindIndex: payload.passportBlindIndex ?? null,
        birthDate: payload.input.birthDate || new Date('1990-01-01'),
        gender: payload.input.gender || 'MALE',
        governorateCode: payload.input.governorateCode || '88',
        jobTitle: payload.input.jobTitleName || 'عامل',
        jobTitleId: payload.input.jobTitleId ?? null,
        departmentId: payload.input.departmentId ?? null,
        siteId: payload.input.siteId ?? null,
        hireDate: payload.input.hireDate || new Date(),
        contractType: payload.input.contractType || 'PERMANENT',
        shiftSystem: payload.input.shiftSystem || '20_WORK_10_REST',
        dailyWage: new Prisma.Decimal(dailyWageNum),
        basicSalary: new Prisma.Decimal(basicNum),
        additionalSalary: new Prisma.Decimal(addNum),
        fixedAllowances: new Prisma.Decimal(payload.input.fixedAllowances ?? 0),
        paymentMethod: payload.input.paymentMethod || 'CASH_SITE',
        accountNumberEncrypted: payload.accountNumberEncrypted ?? null,
        walletType: payload.input.walletType ?? null,
        drivingLicense: payload.input.drivingLicense ?? null,
        militaryStatus: payload.input.militaryStatus ?? null,
        maritalStatus: payload.input.maritalStatus ?? null,
        previousInsuranceStatus: payload.input.previousInsuranceStatus ?? null,
        idCardFrontPath: payload.input.idCardFrontPath ?? null,
        idCardBackPath: payload.input.idCardBackPath ?? null,
        idCardExpiryDate: payload.input.idCardExpiryDate || null,
        address: payload.input.address?.trim() || null,
        phoneEncrypted: payload.phoneEncrypted,
        phoneBlindIndex: payload.phoneBlindIndex,
        emergencyContactName: payload.input.emergencyContactName ?? null,
        emergencyPhoneEncrypted: payload.emergencyPhoneEncrypted ?? null,
        status: 'ACTIVE',
      };
      const worker = (await tx.worker.create({
        data: createData,
        include: {
          site: true,
          department: true,
          jobRef: true,
        },
      })) as Prisma.WorkerGetPayload<{
        include: {
          site: true;
          department: true;
          jobRef: true;
        };
      }>;

      // Automatically register ID Card / Passport photos in WorkerDocument table
      if (tx.workerDocument) {
        if (createData.idCardFrontPath) {
          const isPassport = worker.idType === 'PASSPORT';
          await tx.workerDocument.create({
            data: {
              workerId: worker.id,
              title: isPassport ? 'صورة جواز السفر' : 'صورة بطاقة الرقم القومي (الوجه الأمامي)',
              category: isPassport ? 'PASSPORT' : 'NATIONAL_ID',
              fileName: createData.idCardFrontPath.split('/').pop() || `${worker.code}_front.jpg`,
              fileType: 'image/jpeg',
              fileUri: createData.idCardFrontPath,
              uploadedBy: payload.actorTelegramId || null,
            },
          });
        }
        if (createData.idCardBackPath) {
          await tx.workerDocument.create({
            data: {
              workerId: worker.id,
              title: 'صورة بطاقة الرقم القومي (الظهر)',
              category: 'NATIONAL_ID',
              fileName: createData.idCardBackPath.split('/').pop() || `${worker.code}_back.jpg`,
              fileType: 'image/jpeg',
              fileUri: createData.idCardBackPath,
              uploadedBy: payload.actorTelegramId || null,
            },
          });
        }
      }

      // Record Opening Salary History (القيد الافتتاحي لتدرج الرواتب من أول يوم عمل)
      if (tx.salaryHistory) {
        const hireDate = worker.hireDate || new Date();
        const hireMonth = `${hireDate.getFullYear()}-${String(hireDate.getMonth() + 1).padStart(2, '0')}`;
        const basicSal = new Prisma.Decimal(basicNum);
        const addSal = new Prisma.Decimal(addNum);
        const grossSal = basicSal.plus(addSal);
        const changeId = `SAL-${hireMonth.replace('-', '')}-${worker.code}`;

        await tx.salaryHistory.create({
          data: {
            changeId,
            workerId: worker.id,
            previousBasicSalary: new Prisma.Decimal(0),
            previousAdditionalSalary: new Prisma.Decimal(0),
            previousGrossSalary: new Prisma.Decimal(0),
            newBasicSalary: basicSal,
            newAdditionalSalary: addSal,
            newGrossSalary: grossSal,
            effectiveMonth: hireMonth,
            effectiveDate: hireDate,
            reason: 'بداية التعاقد وتسجيل العامل بالمنظومة',
            approvedByTelegramId: payload.actorTelegramId || null,
            approvedByName: payload.actorRole || 'مسؤول النظام',
            notes: 'القيد الافتتاحي للراتب وتدرج الأجور عند التعيين',
          },
        });
      }

      // Record Worker Creation in WorkerChangeLog (توثيق قيد التعيين في سجل التعديلات)
      if (tx.workerChangeLog) {
        await tx.workerChangeLog.create({
          data: {
            changeId: `WCL-${worker.code}-INIT`,
            workerId: worker.id,
            workerCode: worker.code,
            category: 'STRUCTURAL',
            fieldKey: 'status',
            fieldNameAr: 'حالة العامل والتعيين',
            oldValue: null,
            newValue: 'ACTIVE',
            oldDisplayValue: null,
            newDisplayValue: 'نشط ميدانياً (تعيين جديد)',
            reason: 'تسجيل العامل الجديد بالمنظومة',
            actorTelegramId: payload.actorTelegramId || BigInt(0),
            actorName: payload.actorRole || 'مسؤول النظام',
            actorRole: payload.actorRole || 'SUPER_ADMIN',
          },
        });
      }

      // Audit Log
      if (tx.auditLog) {
        await tx.auditLog.create({
          data: {
            action: 'WORKER_REGISTRATION',
            entityType: 'Worker',
            entityId: worker.id,
            actorTelegramId: payload.actorTelegramId || BigInt(0),
            afterPayload: {
              workerCode: worker.code,
              workerName: worker.name,
              jobTitle: worker.jobTitle,
              siteId: worker.siteId,
              actorRole: payload.actorRole || 'SYSTEM',
            },
          },
        });
      }

      // Outbox Event for Sheets / external sync
      if (tx.outboxEvent) {
        await tx.outboxEvent.create({
          data: {
            eventType: 'WORKER_CREATED',
            aggregateId: worker.id,
            payload: {
              workerId: worker.id,
              workerCode: worker.code,
              workerName: worker.name,
              jobTitle: worker.jobTitle,
              siteName: worker.site?.name,
              hireDate: worker.hireDate.toISOString(),
            },
          },
        });
      }

      return worker;
    };

    if (typeof this.prisma.$transaction === 'function') {
      return this.prisma.$transaction(execute);
    }
    return execute(this.prisma as unknown as Prisma.TransactionClient);
  }
}
