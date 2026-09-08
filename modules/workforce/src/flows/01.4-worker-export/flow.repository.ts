import { PrismaClient, Prisma } from '@alsaada/database';
import type {
  DepartmentSummary,
  JobTitleSummary,
  SiteSummary,
  WorkerExportEntity,
} from './flow.types.js';

export class WorkerExportRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getActiveJobs(): Promise<JobTitleSummary[]> {
    const jobs = await this.prisma.jobTitle.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, code: true },
    });
    return jobs;
  }

  async getActiveSites(): Promise<SiteSummary[]> {
    const sites = await this.prisma.site.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, code: true },
    });
    return sites;
  }

  async getDepartments(): Promise<DepartmentSummary[]> {
    const depts = await this.prisma.department.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, code: true },
    });
    return depts;
  }

  async getDepartmentById(id: string): Promise<DepartmentSummary | null> {
    return this.prisma.department.findUnique({
      where: { id },
      select: { id: true, name: true, code: true },
    });
  }

  async getJobTitleById(id: string): Promise<JobTitleSummary | null> {
    return this.prisma.jobTitle.findUnique({
      where: { id },
      select: { id: true, name: true, code: true },
    });
  }

  async getWorkersForExport(
    whereClause: Prisma.WorkerWhereInput
  ): Promise<WorkerExportEntity[]> {
    const workers = await this.prisma.worker.findMany({
      where: {
        ...whereClause,
        isDeleted: false,
        status: 'ACTIVE',
      },
      include: {
        site: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        jobRef: { select: { id: true, name: true } },
      },
      orderBy: { code: 'asc' },
    });
    return workers as unknown as WorkerExportEntity[];
  }

  async saveImportedWorkersAtomic(
    workersData: Array<{
      worker: Prisma.WorkerCreateInput;
      auditPayload: Prisma.InputJsonValue;
    }>
  ): Promise<{ createdCount: number; createdCodes: string[] }> {
    const execute = async (tx: PrismaClient) => {
      const createdCodes: string[] = [];
      for (const item of workersData) {
        const created = await tx.worker.create({
          data: item.worker,
        });
        createdCodes.push(created.code);

        if (tx.auditLog) {
          await tx.auditLog.create({
            data: {
              actorTelegramId: BigInt(0),
              action: 'EXCEL_BULK_IMPORT',
              entityType: 'Worker',
              entityId: created.id,
              afterPayload: item.auditPayload,
            },
          });
        }

        if (tx.outboxEvent) {
          await tx.outboxEvent.create({
            data: {
              eventType: 'WORKER_REGISTERED_FROM_EXCEL',
              aggregateId: created.id,
              payload: {
                workerId: created.id,
                workerCode: created.code,
                fullName: created.name,
                siteId: created.siteId,
              },
            },
          });
        }
      }
      return {
        createdCount: createdCodes.length,
        createdCodes,
      };
    };

    if (typeof this.prisma.$transaction === 'function') {
      return this.prisma.$transaction(async (tx) => execute(tx as PrismaClient));
    }
    return execute(this.prisma);
  }
}
