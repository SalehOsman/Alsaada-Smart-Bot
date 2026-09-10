import type { PrismaClient } from '@alsaada/database';
import type { WorkerOffboardingInput, WorkerOffboardingResult } from './flow.types.js';

export class WorkerOffboardingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getActiveWorkers(siteId?: string, take = 10) {
    return this.prisma.worker.findMany({
      where: {
        isDeleted: false,
        status: { in: ['ACTIVE', 'ON_LEAVE'] },
        ...(siteId ? { siteId } : {}),
      },
      take,
      orderBy: { code: 'asc' },
      select: {
        id: true,
        name: true,
        nickname: true,
        code: true,
        jobTitle: true,
        telegramId: true,
        site: { select: { name: true } },
      },
    });
  }

  async getWorkerById(workerId: string) {
    return this.prisma.worker.findUnique({
      where: { id: workerId },
      include: { site: true, department: true },
    });
  }

  async terminateWorker(input: WorkerOffboardingInput): Promise<WorkerOffboardingResult> {
    const worker = await this.prisma.worker.findUnique({
      where: { id: input.workerId },
    });

    if (!worker) {
      throw new Error('لم يتم العثور على سجل العامل المطلوب إنهاء خدمته.');
    }

    const clearanceReferenceId = `CLR-${Date.now().toString(36).toUpperCase()}`;
    let targetTelegramId = worker.telegramId;
    if (!targetTelegramId) {
      const linkedUser = await this.prisma.user.findFirst({
        where: { workerId: input.workerId },
        select: { telegramId: true },
      });
      if (linkedUser) {
        targetTelegramId = linkedUser.telegramId;
      }
    }

    const ops: unknown[] = [
      this.prisma.worker.update({
        where: { id: input.workerId },
        data: {
          status: 'TERMINATED',
          telegramId: null,
          terminationDate: new Date(),
          terminationReason: input.reason,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorTelegramId: input.actorTelegramId,
          action: 'WORKER_TERMINATED_OFFBOARDED',
          entityType: 'Worker',
          entityId: input.workerId,
          afterPayload: {
            reason: input.reason,
            notes: input.notes || null,
            clearanceReferenceId,
            demotedTelegramId: targetTelegramId ? targetTelegramId.toString() : null,
          },
        },
      }),
      this.prisma.outboxEvent.create({
        data: {
          eventType: 'WORKER_OFFBOARDED_COMMITTED',
          aggregateId: input.workerId,
          payload: {
            workerId: input.workerId,
            workerCode: input.workerCode,
            clearanceReferenceId,
            demotedTelegramId: targetTelegramId ? targetTelegramId.toString() : null,
          },
        },
      }),
      this.prisma.user.updateMany({
        where: {
          OR: [
            ...(targetTelegramId ? [{ telegramId: targetTelegramId }] : []),
            { workerId: input.workerId },
          ],
        },
        data: {
          role: 'GUEST',
          workerId: null,
          assignedSiteId: null,
        },
      }),
    ];

    const txFn = this.prisma.$transaction as (arg: unknown) => Promise<unknown>;
    await txFn(ops);

    return {
      success: true,
      clearanceReferenceId,
      workerName: worker.nickname || worker.name,
      workerCode: worker.code,
      demotedTelegramId: targetTelegramId || null,
      message: 'تم اعتماد المخالصة وإنهاء الخدمة وهبوط الحساب لدور زائر بنجاح.',
    };
  }
}
