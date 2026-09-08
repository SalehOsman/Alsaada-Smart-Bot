import { PrismaClient, Prisma } from '@alsaada/database';
import type { PendingEditTicket } from './flow.types.js';

export interface TicketCreationData {
  requestId: string;
  workerId: string;
  workerCode: string;
  workerName: string;
  requesterTelegramId: bigint;
  requesterName: string;
  requesterRole: string;
  fieldKey: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  reason: string;
}

export class WorkerEditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findWorkerForEdit(workerId: string) {
    return this.prisma.worker.findUnique({
      where: { id: workerId },
      include: { site: true, jobRef: true, department: true },
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
    actorTelegramId?: bigint
  ) {
    const execute = async (tx: Prisma.TransactionClient) => {
      const updated = await tx.worker.update({
        where: { id: workerId },
        data,
        include: { site: true, jobRef: true, department: true },
      });

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
        reviewNotes,
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
}
