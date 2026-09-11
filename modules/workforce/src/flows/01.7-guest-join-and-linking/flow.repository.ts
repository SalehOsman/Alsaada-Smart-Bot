import type { PrismaClient } from '@alsaada/database';
import type { ConsumeLinkingTokenResult } from './flow.types.js';

export class GuestJoinRepository {
  private static consumedTokens = new Set<string>();
  private static activeTokens = new Map<string, string>();

  constructor(private readonly prisma: PrismaClient) {}

  async findWorkerByCodeOrSearch(query: string) {
    const clean = query.trim();
    return this.prisma.worker.findFirst({
      where: {
        OR: [
          { code: clean },
          { legacyCode: clean },
          { aliases: { has: clean } },
        ],
        isDeleted: false,
      },
      include: { site: true, department: true },
    });
  }

  async findWorkerProfile(workerId?: string, telegramId?: bigint) {
    if (workerId) {
      const worker = await this.prisma.worker.findUnique({
        where: { id: workerId },
        include: { site: true, department: true },
      });
      if (worker) return worker;
    }
    if (telegramId && telegramId > 0n) {
      return this.prisma.worker.findFirst({
        where: { telegramId, isDeleted: false },
        include: { site: true, department: true },
      });
    }
    return null;
  }

  async findPendingApplication(applicantTelegramId: bigint) {
    return this.prisma.approvalTicket.findFirst({
      where: {
        ticketType: 'GUEST_JOIN_LINKING',
        requestedByTelegramId: applicantTelegramId,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createJoinApplication(
    applicantTelegramId: bigint,
    workerId: string,
    workerCode: string,
    workerName: string,
    notes?: string
  ) {
    const ticketNumber = `#TCK-JOIN-${Date.now().toString(36).toUpperCase()}`;

    const ticket = await this.prisma.approvalTicket.create({
      data: {
        ticketNumber,
        ticketType: 'GUEST_JOIN_LINKING',
        entityId: workerId,
        requestedByTelegramId: applicantTelegramId,
        status: 'PENDING',
        reviewDecisionNotes: notes || `طلب ربط حساب تليجرام للعامل ${workerName} (#${workerCode})`,
      },
    });

    return ticket;
  }

  registerActiveToken(workerCode: string, signature: string): void {
    GuestJoinRepository.activeTokens.set(workerCode, signature);
  }

  isTokenActive(workerCode: string, signature: string): boolean {
    const active = GuestJoinRepository.activeTokens.get(workerCode);
    if (!active) return true;
    return active === signature;
  }

  isTokenConsumed(signature: string): boolean {
    return GuestJoinRepository.consumedTokens.has(signature);
  }

  markTokenConsumed(signature: string, workerCode?: string): void {
    GuestJoinRepository.consumedTokens.add(signature);
    if (workerCode && GuestJoinRepository.activeTokens.get(workerCode) === signature) {
      GuestJoinRepository.activeTokens.delete(workerCode);
    }
  }

  static clearStateForTesting(): void {
    GuestJoinRepository.consumedTokens.clear();
    GuestJoinRepository.activeTokens.clear();
  }

  async linkWorkerAccount(
    workerCode: string,
    applicantTelegramId: bigint,
    applicantUsername?: string,
    signature?: string
  ): Promise<ConsumeLinkingTokenResult> {
    const worker = await this.prisma.worker.findFirst({
      where: {
        OR: [
          { code: workerCode },
          { legacyCode: workerCode },
          { aliases: { has: workerCode } },
        ],
        isDeleted: false,
      },
      include: { site: true, department: true },
    });

    if (!worker) {
      throw new Error('تعذر العثور على سجل العامل المطلوب للربط.');
    }

    if (worker.status === 'TERMINATED') {
      throw new Error('لا يمكن تفعيل أو ربط هذا الحساب: تم إنهاء خدمة هذا السجل الوظيفي بالمنظومة.');
    }

    if (worker.telegramId && worker.telegramId !== applicantTelegramId) {
      throw new Error('هذا السجل الوظيفي مرتبط بالفعل بحساب تليجرام آخر.');
    }

    if (worker.telegramId && worker.telegramId === applicantTelegramId) {
      throw new Error('حسابك مفعل ومربوط بالفعل بهذا السجل الوظيفي.');
    }

    if (signature) {
      this.markTokenConsumed(signature, worker.code);
    }

    await this.prisma.$transaction([
      this.prisma.worker.update({
        where: { id: worker.id },
        data: { telegramId: applicantTelegramId },
      }),
      this.prisma.user.upsert({
        where: { telegramId: applicantTelegramId },
        update: {
          role: 'WORKER',
          workerId: worker.id,
          isActive: true,
        },
        create: {
          telegramId: applicantTelegramId,
          username: applicantUsername || null,
          fullName: worker.name,
          role: 'WORKER',
          workerId: worker.id,
          isActive: true,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorTelegramId: applicantTelegramId,
          action: 'GUEST_ACCOUNT_LINKED_VIA_DEEPLINK',
          entityType: 'Worker',
          entityId: worker.id,
          afterPayload: {
            workerCode: worker.code,
            applicantTelegramId: applicantTelegramId.toString(),
            signature: signature || null,
          },
        },
      }),
      this.prisma.outboxEvent.create({
        data: {
          eventType: 'WORKER_ACCOUNT_LINKED_COMMITTED',
          aggregateId: worker.id,
          payload: {
            workerId: worker.id,
            workerCode: worker.code,
            telegramId: applicantTelegramId.toString(),
          },
        },
      }),
    ]);

    const ticketRepo = this.prisma.approvalTicket as { updateMany?: (args: unknown) => Promise<unknown> } | undefined;
    if (typeof ticketRepo?.updateMany === 'function') {
      await ticketRepo.updateMany({
        where: {
          entityId: worker.id,
          ticketType: 'GUEST_JOIN_LINKING',
          status: 'PENDING',
        },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedByTelegramId: applicantTelegramId,
        },
      }).catch(() => {});
    }

    return {
      success: true,
      workerId: worker.id,
      workerName: worker.nickname || worker.name,
      workerCode: worker.code,
      jobTitle: worker.jobTitle,
      siteName: worker.site?.name,
      message: 'تم تفعيل وربط الحساب بالمنظومة بنجاح تام.',
    };
  }
}
