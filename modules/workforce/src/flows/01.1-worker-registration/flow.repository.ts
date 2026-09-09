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
    }));
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
        shiftSystem: payload.input.shiftSystem || '20_WORK_10_REST',
        dailyWage: payload.input.dailyWage || 0,
        basicSalary: payload.input.basicSalary || 0,
        fixedAllowances: payload.input.fixedAllowances || 0,
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
