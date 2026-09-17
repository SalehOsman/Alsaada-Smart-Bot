import crypto from 'node:crypto';
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

  async findPendingApplicationForWorker(workerId: string, applicantTelegramId: bigint) {
    return this.prisma.approvalTicket.findFirst({
      where: {
        ticketType: 'GUEST_JOIN_LINKING',
        entityId: workerId,
        requestedByTelegramId: applicantTelegramId,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findTicketById(ticketId: string) {
    return this.prisma.approvalTicket.findUnique({
      where: { id: ticketId },
    });
  }

  async findWorkerById(workerId: string) {
    return this.prisma.worker.findUnique({
      where: { id: workerId },
      include: { site: true },
    });
  }

  async getSuperAdminTelegramIds(): Promise<bigint[]> {
    const superAdmins = await this.prisma.user.findMany({
      where: { role: 'SUPER_ADMIN', isActive: true },
      select: { telegramId: true },
    });
    return superAdmins.map((s) => s.telegramId).filter((id): id is bigint => id !== null && id !== undefined);
  }

  async approveLinkingTicket(params: {
    ticketId: string;
    adminTelegramId: bigint;
    adminName: string;
  }): Promise<{
    success: boolean;
    ticket?: {
      id: string;
      ticketNumber: string;
      requestedByTelegramId: bigint;
      entityId: string;
    };
    worker?: {
      id: string;
      code: string;
      name: string;
      nickname: string | null;
      jobTitle: string;
      site?: { name: string } | null;
    };
    error?: string;
  }> {
    const ticket = await this.prisma.approvalTicket.findUnique({
      where: { id: params.ticketId },
    });

    if (!ticket) {
      return { success: false, error: 'لم يتم العثور على تذكرة الاعتماد المطلوبة.' };
    }

    if (ticket.status !== 'PENDING') {
      const statusAr = ticket.status === 'APPROVED' ? 'تمت الموافقة عليها مسبقاً' : 'تم رفضها مسبقاً';
      return { success: false, error: `هذه التذكرة غير معلقة (${statusAr}).` };
    }

    const worker = await this.prisma.worker.findUnique({
      where: { id: ticket.entityId },
      include: { site: true },
    });

    if (!worker) {
      return { success: false, error: 'لم يتم العثور على سجل العامل المرتبط بالتذكرة.' };
    }

    if (worker.telegramId && worker.telegramId !== ticket.requestedByTelegramId) {
      return { success: false, error: 'هذا السجل الوظيفي مرتبط بالفعل بحساب تليجرام آخر.' };
    }

    await this.prisma.$transaction([
      this.prisma.approvalTicket.update({
        where: { id: ticket.id },
        data: {
          status: 'APPROVED',
          reviewedByTelegramId: params.adminTelegramId,
          reviewedAt: new Date(),
          reviewDecisionNotes: `${ticket.reviewDecisionNotes || ''}\n[اعتمد بواسطة: ${params.adminName} (${params.adminTelegramId})]`.trim(),
        },
      }),
      this.prisma.worker.update({
        where: { id: worker.id },
        data: { telegramId: ticket.requestedByTelegramId },
      }),
      this.prisma.user.upsert({
        where: { telegramId: ticket.requestedByTelegramId },
        update: {
          role: 'WORKER',
          workerId: worker.id,
          isActive: true,
        },
        create: {
          telegramId: ticket.requestedByTelegramId,
          fullName: worker.name,
          role: 'WORKER',
          workerId: worker.id,
          isActive: true,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorTelegramId: params.adminTelegramId,
          action: 'WORKER_ACCOUNT_LINK_APPROVED',
          entityType: 'Worker',
          entityId: worker.id,
          afterPayload: {
            ticketNumber: ticket.ticketNumber,
            workerCode: worker.code,
            linkedTelegramId: ticket.requestedByTelegramId.toString(),
            approvedBy: params.adminTelegramId.toString(),
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
            telegramId: ticket.requestedByTelegramId.toString(),
            ticketNumber: ticket.ticketNumber,
          },
        },
      }),
    ]);

    return {
      success: true,
      ticket: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        requestedByTelegramId: ticket.requestedByTelegramId,
        entityId: ticket.entityId,
      },
      worker: {
        id: worker.id,
        code: worker.code,
        name: worker.name,
        nickname: worker.nickname,
        jobTitle: worker.jobTitle,
        site: worker.site,
      },
    };
  }

  async rejectLinkingTicket(params: {
    ticketId: string;
    adminTelegramId: bigint;
    adminName: string;
  }): Promise<{
    success: boolean;
    ticket?: {
      id: string;
      ticketNumber: string;
      requestedByTelegramId: bigint;
      entityId: string;
    };
    workerName?: string;
    workerCode?: string;
    error?: string;
  }> {
    const ticket = await this.prisma.approvalTicket.findUnique({
      where: { id: params.ticketId },
    });

    if (!ticket) {
      return { success: false, error: 'لم يتم العثور على تذكرة الاعتماد المطلوبة.' };
    }

    if (ticket.status !== 'PENDING') {
      const statusAr = ticket.status === 'APPROVED' ? 'تمت الموافقة عليها مسبقاً' : 'تم رفضها مسبقاً';
      return { success: false, error: `هذه التذكرة غير معلقة (${statusAr}).` };
    }

    const worker = await this.prisma.worker.findUnique({
      where: { id: ticket.entityId },
      select: { name: true, nickname: true, code: true },
    });

    await this.prisma.$transaction([
      this.prisma.approvalTicket.update({
        where: { id: ticket.id },
        data: {
          status: 'REJECTED',
          reviewedByTelegramId: params.adminTelegramId,
          reviewedAt: new Date(),
          reviewDecisionNotes: `${ticket.reviewDecisionNotes || ''}\n[رُفض بواسطة: ${params.adminName} (${params.adminTelegramId})]`.trim(),
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorTelegramId: params.adminTelegramId,
          action: 'WORKER_ACCOUNT_LINK_REJECTED',
          entityType: 'Worker',
          entityId: ticket.entityId,
          afterPayload: {
            ticketNumber: ticket.ticketNumber,
            rejectedBy: params.adminTelegramId.toString(),
          },
        },
      }),
    ]);

    return {
      success: true,
      ticket: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        requestedByTelegramId: ticket.requestedByTelegramId,
        entityId: ticket.entityId,
      },
      workerName: worker?.nickname || worker?.name || 'العامل',
      workerCode: worker?.code || '',
    };
  }

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

  async createJoinApplication(
    applicantTelegramId: bigint,
    workerId: string,
    workerCode: string,
    workerName: string,
    notes?: string
  ) {
    const randomSuffix = crypto.randomUUID().replace(/-/g, '').slice(0, 4).toUpperCase();
    const ticketNumber = `#TCK-JOIN-${Date.now().toString(36).toUpperCase()}-${randomSuffix}`;

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

  async unlinkWorkerAccount(
    workerId: string,
    actorTelegramId?: bigint
  ): Promise<{
    success: boolean;
    workerId: string;
    workerName: string;
    workerCode: string;
    unlinkedTelegramId?: bigint | null;
    message: string;
  }> {
    const worker = await this.prisma.worker.findUnique({
      where: { id: workerId },
    });

    if (!worker) {
      throw new Error('تعذر العثور على سجل العامل المطلوب لإلغاء الربط.');
    }

    const previousTelegramId = worker.telegramId;
    if (!previousTelegramId) {
      return {
        success: false,
        workerId: worker.id,
        workerName: worker.nickname || worker.name,
        workerCode: worker.code,
        message: 'العامل غير مرتبط بأي حساب تليجرام حالياً.',
      };
    }

    await this.prisma.$transaction([
      this.prisma.worker.update({
        where: { id: worker.id },
        data: { telegramId: null },
      }),
      this.prisma.user.updateMany({
        where: {
          telegramId: previousTelegramId,
          workerId: worker.id,
        },
        data: {
          workerId: null,
        },
      }),
      this.prisma.user.updateMany({
        where: {
          telegramId: previousTelegramId,
          role: 'WORKER',
        },
        data: {
          role: 'GUEST',
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorTelegramId: actorTelegramId || 0n,
          action: 'WORKER_TELEGRAM_UNLINKED',
          entityType: 'Worker',
          entityId: worker.id,
          afterPayload: {
            workerCode: worker.code,
            unlinkedTelegramId: previousTelegramId.toString(),
          },
        },
      }),
      this.prisma.approvalTicket.updateMany({
        where: {
          entityId: worker.id,
          ticketType: 'GUEST_JOIN_LINKING',
          status: 'PENDING',
        },
        data: {
          status: 'REJECTED',
          reviewDecisionNotes: 'تم إلغاء الطلب تلقائياً لفك ربط حساب العامل إدارياً',
          reviewedAt: new Date(),
          reviewedByTelegramId: actorTelegramId || 0n,
        },
      }),
      this.prisma.outboxEvent.create({
        data: {
          eventType: 'WORKER_ACCOUNT_UNLINKED',
          aggregateId: worker.id,
          payload: {
            workerId: worker.id,
            workerCode: worker.code,
            previousTelegramId: previousTelegramId.toString(),
          },
        },
      }),
    ]);

    return {
      success: true,
      workerId: worker.id,
      workerName: worker.nickname || worker.name,
      workerCode: worker.code,
      unlinkedTelegramId: previousTelegramId,
      message: `تم إلغاء ربط حساب التليجرام للعامل ${worker.nickname || worker.name} بنجاح.`,
    };
  }
}
