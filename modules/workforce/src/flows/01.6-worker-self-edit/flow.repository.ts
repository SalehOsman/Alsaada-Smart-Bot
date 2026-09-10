import type { PrismaClient } from '@alsaada/database';
import type { WorkerSelfEditInput, WorkerSelfEditResult } from './flow.types.js';

export class WorkerSelfEditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getWorkerById(workerId: string) {
    return this.prisma.worker.findUnique({
      where: { id: workerId },
      include: { site: true, department: true },
    });
  }

  async getWorkerByTelegramId(telegramId: bigint) {
    return this.prisma.worker.findFirst({
      where: { telegramId, isDeleted: false },
      include: { site: true, department: true },
    });
  }

  async updateWorkerField(input: WorkerSelfEditInput): Promise<WorkerSelfEditResult> {
    const referenceId = `WSE-${Date.now().toString(36).toUpperCase()}`;

    const updateData: Record<string, string> = input.updatePayload ? { ...input.updatePayload } : {};
    if (!input.updatePayload) {
      if (input.field === 'phone') {
        updateData['phoneEncrypted'] = input.newValue;
      } else if (input.field === 'emergencyPhone') {
        updateData['emergencyPhoneEncrypted'] = input.newValue;
      } else if (input.field === 'accountNumber') {
        updateData['accountNumberEncrypted'] = input.newValue;
      } else {
        updateData[input.field] = input.newValue;
      }
    }

    await this.prisma.$transaction([
      this.prisma.worker.update({
        where: { id: input.workerId },
        data: updateData,
      }),
      this.prisma.auditLog.create({
        data: {
          actorTelegramId: input.actorTelegramId,
          action: 'WORKER_SELF_EDIT',
          entityType: 'Worker',
          entityId: input.workerId,
          afterPayload: {
            field: input.field,
            newValue: input.newValue,
            reason: input.reason || 'تحديث ذاتي من العامل',
          },
        },
      }),
      this.prisma.outboxEvent.create({
        data: {
          eventType: 'WORKER_SELF_EDIT_COMMITTED',
          aggregateId: input.workerId,
          payload: {
            workerId: input.workerId,
            workerCode: input.workerCode,
            field: input.field,
            newValue: input.newValue,
            referenceId,
          },
        },
      }),
    ]);

    return {
      success: true,
      referenceId,
      message: 'تم حفظ البيانات الجديدة وتوثيقها جنائياً بنجاح.',
      updatedField: input.field,
      newValue: input.newValue,
    };
  }
}
