import crypto from 'node:crypto';
import { PrismaClient, Prisma } from '@alsaada/database';
import type {
  PendingEditTicket,
  SalaryHistoryRecord,
  WorkerChangeLogRecord,
  TicketCreationData,
  WorkerAuditInput,
  SalaryAdjustmentData,
} from './flow.types.js';

export type { TicketCreationData, WorkerAuditInput, SalaryAdjustmentData };

export class WorkerEditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findWorkerForEdit(workerId: string) {
    return this.prisma.worker.findUnique({
      where: { id: workerId },
      include: { site: true, jobRef: true, department: true, canteenItem: true },
    });
  }

  async getActiveCigaretteItems(siteId?: string) {
    if (siteId) {
      const siteItems = await this.prisma.canteenItem.findMany({
        where: { category: 'CIGARETTES', isActive: true, siteId },
        orderBy: { name: 'asc' },
      });
      if (siteItems.length > 0) return siteItems;
    }
    return this.prisma.canteenItem.findMany({
      where: { category: 'CIGARETTES', isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async countPendingTickets(): Promise<number> {
    return this.prisma.workerEditRequest.count({
      where: { status: 'PENDING' },
    });
  }

  async generateNextRequestId(): Promise<string> {
    const now = new Date();
    const yy = String(now.getFullYear()).substring(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const prefix = `EDT-${yy}${mm}${dd}-`;

    const count = await this.prisma.workerEditRequest.count({
      where: { requestId: { startsWith: prefix } },
    });

    return `${prefix}${String(count + 1).padStart(3, '0')}`;
  }

  async createEditTicket(data: TicketCreationData) {
    return this.prisma.workerEditRequest.create({
      data: {
        requestId: data.requestId,
        workerId: data.workerId,
        workerCode: data.workerCode,
        workerName: data.workerName,
        requesterTelegramId: data.requesterTelegramId,
        requesterName: data.requesterName,
        requesterRole: data.requesterRole,
        fieldKey: data.fieldKey,
        fieldName: data.fieldName,
        oldValue: data.oldValue,
        newValue: data.newValue,
        reason: data.reason,
        status: 'PENDING',
      },
    });
  }

  async updateWorkerDirect(
    workerId: string,
    data: Prisma.WorkerUpdateInput,
    actorTelegramId?: bigint,
    audit?: WorkerAuditInput
  ) {
    const execute = async (tx: Prisma.TransactionClient) => {
      const updated = await tx.worker.update({
        where: { id: workerId },
        data,
        include: { site: true, jobRef: true, department: true },
      });

      if (audit && 'workerChangeLog' in tx && typeof tx.workerChangeLog?.create === 'function') {
        const changeId = `CHG-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
        await tx.workerChangeLog.create({
          data: {
            changeId,
            workerId,
            workerCode: updated.code,
            category: audit.category,
            fieldKey: audit.fieldKey,
            fieldNameAr: audit.fieldNameAr,
            oldValue: audit.oldValue ?? null,
            newValue: audit.newValue ?? null,
            oldDisplayValue: audit.oldDisplayValue ?? null,
            newDisplayValue: audit.newDisplayValue ?? null,
            reason: audit.reason || 'تعديل مباشر من إدارة المنظومة',
            actorTelegramId: audit.actorTelegramId ?? actorTelegramId ?? BigInt(0),
            actorName: audit.actorName || 'إدارة النظام',
            actorRole: audit.actorRole || 'SUPER_ADMIN',
          },
        });
      }

      if (tx.auditLog) {
        await tx.auditLog.create({
          data: {
            action: 'WORKER_FIELD_EDIT',
            entityType: 'Worker',
            entityId: workerId,
            actorTelegramId: actorTelegramId || BigInt(0),
            afterPayload: {
              workerCode: updated.code,
              workerName: updated.name,
              updatedFields: Object.keys(data),
            },
          },
        });
      }

      return updated;
    };

    if (typeof this.prisma.$transaction === 'function') {
      return this.prisma.$transaction(execute);
    }
    return execute(this.prisma as unknown as Prisma.TransactionClient);
  }

  async createSalaryAdjustment(adj: SalaryAdjustmentData) {
    const execute = async (tx: Prisma.TransactionClient) => {
      // 1. Immutable SalaryHistory entry (Append-Only)
      let record: unknown = null;
      if ('salaryHistory' in tx && typeof tx.salaryHistory?.create === 'function') {
        record = await tx.salaryHistory.create({
          data: {
            changeId: adj.changeId,
            workerId: adj.workerId,
            previousBasicSalary: new Prisma.Decimal(adj.previousBasicSalary),
            previousAdditionalSalary: new Prisma.Decimal(adj.previousAdditionalSalary),
            previousGrossSalary: new Prisma.Decimal(adj.previousGrossSalary),
            newBasicSalary: new Prisma.Decimal(adj.newBasicSalary),
            newAdditionalSalary: new Prisma.Decimal(adj.newAdditionalSalary),
            newGrossSalary: new Prisma.Decimal(adj.newGrossSalary),
            effectiveMonth: adj.effectiveMonth,
            effectiveDate: adj.effectiveDate,
            reason: adj.reason,
            approvedByTelegramId: adj.approvedByTelegramId ?? null,
            approvedByName: adj.approvedByName ?? null,
            notes: adj.notes ?? null,
          },
        });
      }

      // 2. Atomic update to current Worker fields
      const updatedWorker = await tx.worker.update({
        where: { id: adj.workerId },
        data: {
          basicSalary: new Prisma.Decimal(adj.newBasicSalary),
          additionalSalary: new Prisma.Decimal(adj.newAdditionalSalary),
          dailyWage: new Prisma.Decimal((adj.newGrossSalary / 30).toFixed(2)),
        },
      });

      // 3. Isolated WorkerChangeLog entry
      await tx.workerChangeLog.create({
        data: {
          changeId: adj.changeId,
          workerId: adj.workerId,
          workerCode: adj.workerCode,
          category: 'FINANCIAL',
          fieldKey: 'salary',
          fieldNameAr: 'تعديل الراتب (الأساسي والإضافي)',
          oldValue: `${adj.previousBasicSalary}+${adj.previousAdditionalSalary}=${adj.previousGrossSalary}`,
          newValue: `${adj.newBasicSalary}+${adj.newAdditionalSalary}=${adj.newGrossSalary}`,
          oldDisplayValue: `${adj.previousGrossSalary} ج.م`,
          newDisplayValue: `${adj.newGrossSalary} ج.م`,
          reason: adj.reason,
          actorTelegramId: adj.approvedByTelegramId || BigInt(0),
          actorName: adj.approvedByName || 'المدير العام',
          actorRole: 'SUPER_ADMIN',
        },
      });

      return { record, updatedWorker };
    };

    if (typeof this.prisma.$transaction === 'function') {
      return this.prisma.$transaction(execute);
    }
    return execute(this.prisma as unknown as Prisma.TransactionClient);
  }

  async getSalaryHistory(workerId: string): Promise<SalaryHistoryRecord[]> {
    const raw = await this.prisma.salaryHistory.findMany({
      where: { workerId },
      orderBy: { effectiveDate: 'desc' },
      take: 30,
    });
    return raw.map((r) => ({
      id: r.id,
      changeId: r.changeId,
      workerId: r.workerId,
      previousBasicSalary: Number(r.previousBasicSalary || 0),
      previousAdditionalSalary: Number(r.previousAdditionalSalary || 0),
      previousGrossSalary: Number(r.previousGrossSalary || 0),
      newBasicSalary: Number(r.newBasicSalary || 0),
      newAdditionalSalary: Number(r.newAdditionalSalary || 0),
      newGrossSalary: Number(r.newGrossSalary || 0),
      effectiveMonth: r.effectiveMonth,
      effectiveDate: r.effectiveDate,
      reason: r.reason,
      approvedByName: r.approvedByName,
      createdAt: r.createdAt,
    }));
  }

  async getWorkerChangeLog(workerId: string): Promise<WorkerChangeLogRecord[]> {
    const raw = await this.prisma.workerChangeLog.findMany({
      where: { workerId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return raw.map((r) => ({
      id: r.id,
      changeId: r.changeId,
      workerId: r.workerId,
      workerCode: r.workerCode,
      category: r.category,
      fieldKey: r.fieldKey,
      fieldNameAr: r.fieldNameAr,
      oldValue: r.oldValue,
      newValue: r.newValue,
      oldDisplayValue: r.oldDisplayValue,
      newDisplayValue: r.newDisplayValue,
      reason: r.reason,
      actorName: r.actorName,
      actorRole: r.actorRole,
      createdAt: r.createdAt,
    }));
  }

  async getAllSites(): Promise<Array<{ id: string; name: string }>> {
    return this.prisma.site.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  async getAllJobTitles(): Promise<Array<{ id: string; name: string }>> {
    return this.prisma.jobTitle.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  async getAllDepartments(): Promise<Array<{ id: string; name: string }>> {
    return this.prisma.department.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  async findTicketByRequestId(requestId: string) {
    return this.prisma.workerEditRequest.findUnique({
      where: { requestId },
      include: { worker: true },
    });
  }

  async updateTicketStatus(
    id: string,
    status: 'APPROVED' | 'REJECTED',
    reviewedByAdminId: bigint,
    reviewNotes?: string
  ) {
    return this.prisma.workerEditRequest.update({
      where: { id },
      data: {
        status,
        reviewedByAdminId,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes ?? null,
      },
    });
  }

  async listPendingTickets(): Promise<PendingEditTicket[]> {
    const raw = await this.prisma.workerEditRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return raw.map((r) => ({
      id: r.id,
      requestId: r.requestId,
      workerId: r.workerId,
      workerCode: r.workerCode,
      workerName: r.workerName,
      requesterName: r.requesterName,
      requesterRole: r.requesterRole,
      fieldKey: r.fieldKey,
      fieldName: r.fieldName,
      oldValue: r.oldValue || '-',
      newValue: r.newValue,
      reason: r.reason || '-',
      createdAt: r.createdAt,
    }));
  }

  async syncWorkerUser(workerId: string, telegramId: bigint, workerName: string, siteId?: string | null): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { telegramId } });
    if (existing) {
      await this.prisma.user.update({
        where: { telegramId },
        data: {
          fullName: workerName,
          role: 'WORKER',
          workerId,
          assignedSiteId: siteId ?? null,
          isActive: true,
        },
      });
    } else {
      await this.prisma.user.create({
        data: {
          telegramId,
          fullName: workerName,
          role: 'WORKER',
          workerId,
          assignedSiteId: siteId ?? null,
          isActive: true,
        },
      });
    }
  }
}
