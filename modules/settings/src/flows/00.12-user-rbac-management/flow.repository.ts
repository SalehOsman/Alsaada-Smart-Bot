import type { PrismaClient, Prisma } from '@alsaada/database';
import type { Redis } from 'ioredis';
import type {
  UserListItemDto,
  UserDetailDto,
  WorkerCandidateDto,
  DirectLinkResult,
  PendingUserRbacAction,
} from './flow.types.js';

export class UserRbacRepository {
  private localPending = new Map<string, PendingUserRbacAction>();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis?: Redis | null
  ) {}

  private async invalidateUserCache(telegramId: bigint): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.del(
          `cache:user:${telegramId.toString()}`,
          `auth:user:${telegramId.toString()}`,
          `auth:imp:${telegramId.toString()}`,
          `auth:ent:${telegramId.toString()}`,
          `auth:dual:${telegramId.toString()}`
        );
      } catch {}
    }
  }

  async countActiveSuperAdmins(): Promise<number> {
    return this.prisma.user.count({
      where: {
        role: 'SUPER_ADMIN',
        isActive: true,
        isBanned: false,
        isDeleted: false,
      },
    });
  }

  async listUsers(
    page = 1,
    limit = 8
  ): Promise<{ users: UserListItemDto[]; total: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const [total, records] = await Promise.all([
      this.prisma.user.count({ where: { isDeleted: false } }),
      this.prisma.user.findMany({
        where: { isDeleted: false },
        include: {
          worker: { select: { id: true, code: true, name: true, nickname: true } },
          assignedSite: { select: { id: true, name: true } },
        },
        orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    const users: UserListItemDto[] = records.map((r) => ({
      id: r.id,
      telegramId: r.telegramId,
      fullName: r.fullName,
      username: r.username,
      role: r.role,
      isActive: r.isActive,
      isBanned: r.isBanned,
      workerId: r.workerId,
      workerCode: r.worker?.code ?? undefined,
      workerName: r.worker?.nickname || r.worker?.name || undefined,
      assignedSiteId: r.assignedSiteId,
      assignedSiteName: r.assignedSite?.name ?? undefined,
      createdAt: r.createdAt,
    }));

    return {
      users,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async searchUsers(query: string): Promise<UserListItemDto[]> {
    const clean = query.trim();
    const asBigInt = /^\d+$/.test(clean) ? BigInt(clean) : null;

    const records = await this.prisma.user.findMany({
      where: {
        isDeleted: false,
        OR: [
          { fullName: { contains: clean, mode: 'insensitive' } },
          { username: { contains: clean, mode: 'insensitive' } },
          ...(asBigInt ? [{ telegramId: asBigInt }] : []),
          { worker: { code: { contains: clean, mode: 'insensitive' } } },
          { worker: { name: { contains: clean, mode: 'insensitive' } } },
        ],
      },
      include: {
        worker: { select: { id: true, code: true, name: true, nickname: true } },
        assignedSite: { select: { id: true, name: true } },
      },
      take: 10,
    });

    return records.map((r) => ({
      id: r.id,
      telegramId: r.telegramId,
      fullName: r.fullName,
      username: r.username,
      role: r.role,
      isActive: r.isActive,
      isBanned: r.isBanned,
      workerId: r.workerId,
      workerCode: r.worker?.code ?? undefined,
      workerName: r.worker?.nickname || r.worker?.name || undefined,
      assignedSiteId: r.assignedSiteId,
      assignedSiteName: r.assignedSite?.name ?? undefined,
      createdAt: r.createdAt,
    }));
  }

  async getUserByTelegramId(telegramId: bigint): Promise<UserDetailDto | null> {
    const r = await this.prisma.user.findUnique({
      where: { telegramId },
      include: {
        worker: { select: { id: true, code: true, name: true, nickname: true } },
        assignedSite: { select: { id: true, name: true } },
      },
    });
    if (!r || r.isDeleted) return null;

    return {
      id: r.id,
      telegramId: r.telegramId,
      fullName: r.fullName,
      username: r.username,
      role: r.role,
      isActive: r.isActive,
      isBanned: r.isBanned,
      workerId: r.workerId,
      workerCode: r.worker?.code ?? undefined,
      workerName: r.worker?.nickname || r.worker?.name || undefined,
      assignedSiteId: r.assignedSiteId,
      assignedSiteName: r.assignedSite?.name ?? undefined,
      phoneEncrypted: r.phoneEncrypted,
      approvedBySuperAdminId: r.approvedBySuperAdminId,
      createdAt: r.createdAt,
    };
  }

  async changeUserRole(
    telegramId: bigint,
    newRole: string,
    assignedSiteId?: string | null
  ): Promise<UserDetailDto> {
    await this.prisma.user.update({
      where: { telegramId },
      data: {
        role: newRole,
        assignedSiteId: assignedSiteId !== undefined ? assignedSiteId : null,
        isActive: true,
      },
    });

    await this.invalidateUserCache(telegramId);
    const user = await this.getUserByTelegramId(telegramId);
    if (!user) throw new Error('المستخدم غير موجود.');
    return user;
  }

  async toggleUserBan(telegramId: bigint, isBanned: boolean): Promise<UserDetailDto> {
    await this.prisma.user.update({
      where: { telegramId },
      data: {
        isBanned,
        isActive: !isBanned,
      },
    });

    await this.invalidateUserCache(telegramId);
    const user = await this.getUserByTelegramId(telegramId);
    if (!user) throw new Error('المستخدم غير موجود.');
    return user;
  }

  async revokeUser(telegramId: bigint): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { telegramId } });
    if (!user) return;

    await this.prisma.$transaction(async (tx) => {
      if (user.workerId) {
        await tx.worker.update({
          where: { id: user.workerId },
          data: { telegramId: null },
        });
      }

      await tx.user.update({
        where: { telegramId },
        data: {
          role: 'GUEST',
          workerId: null,
          assignedSiteId: null,
          isActive: false,
        },
      });
    });
  }

  async findWorkerById(workerId: string): Promise<WorkerCandidateDto | null> {
    const w = await this.prisma.worker.findUnique({
      where: { id: workerId },
      include: { site: { select: { id: true, name: true } } },
    });
    if (!w || w.isDeleted) return null;
    return {
      id: w.id,
      code: w.code,
      name: w.name,
      nickname: w.nickname,
      telegramId: w.telegramId,
      siteId: w.siteId,
      siteName: w.site?.name ?? undefined,
    };
  }

  async findWorkerByTelegramId(telegramId: bigint): Promise<WorkerCandidateDto | null> {
    const w = await this.prisma.worker.findFirst({
      where: { telegramId, isDeleted: false },
      include: { site: { select: { id: true, name: true } } },
    });
    if (!w) return null;
    return {
      id: w.id,
      code: w.code,
      name: w.name,
      nickname: w.nickname,
      telegramId: w.telegramId,
      siteId: w.siteId,
      siteName: w.site?.name ?? undefined,
    };
  }

  async listUnlinkedWorkers(): Promise<WorkerCandidateDto[]> {
    const records = await this.prisma.worker.findMany({
      where: {
        isDeleted: false,
        telegramId: null,
        status: 'ACTIVE',
      },
      include: { site: { select: { id: true, name: true } } },
      orderBy: { code: 'asc' },
      take: 50,
    });
    return records.map((w) => ({
      id: w.id,
      code: w.code,
      name: w.name,
      nickname: w.nickname,
      telegramId: w.telegramId,
      siteId: w.siteId,
      siteName: w.site?.name ?? undefined,
    }));
  }

  async atomicDirectLinkWorker(
    workerId: string,
    telegramId: bigint,
    options?: { confirmConflict?: boolean | undefined; telegramName?: string | undefined }
  ): Promise<DirectLinkResult> {
    const worker = await this.findWorkerById(workerId);
    if (!worker) {
      return {
        success: false,
        workerCode: '',
        workerName: '',
        telegramId,
        error: 'سجل العامل المطلوب غير موجود بالمنظومة.',
      };
    }

    // 1. Conflict Check: Is this telegramId already bound to another worker?
    const conflictWorker = await this.findWorkerByTelegramId(telegramId);
    if (conflictWorker && conflictWorker.id !== workerId) {
      if (!options?.confirmConflict) {
        return {
          success: false,
          workerCode: worker.code,
          workerName: worker.nickname || worker.name,
          telegramId,
          reboundFromOldUser: true,
          oldWorkerName: conflictWorker.nickname || conflictWorker.name,
          error: `معرف التليجرام مربوط بالفعل بالعامل (${conflictWorker.nickname || conflictWorker.name} - كود: ${conflictWorker.code}).`,
        };
      }
    }

    // 2. Atomic DB Transaction
    await this.prisma.$transaction(async (tx) => {
      // Clean transfer if rebinding from old worker
      if (conflictWorker && conflictWorker.id !== workerId) {
        await tx.worker.update({
          where: { id: conflictWorker.id },
          data: { telegramId: null },
        });
      }

      // Bind worker
      await tx.worker.update({
        where: { id: worker.id },
        data: { telegramId },
      });

      // Upsert User record
      const existingUser = await tx.user.findUnique({ where: { telegramId } });
      if (existingUser) {
        await tx.user.update({
          where: { telegramId },
          data: {
            fullName: worker.name,
            role: 'WORKER',
            workerId: worker.id,
            assignedSiteId: worker.siteId ?? null,
            isActive: true,
            isBanned: false,
          },
        });
      } else {
        await tx.user.create({
          data: {
            telegramId,
            fullName: worker.name,
            role: 'WORKER',
            workerId: worker.id,
            assignedSiteId: worker.siteId ?? null,
            isActive: true,
            isBanned: false,
          },
        });
      }
    });

    await this.invalidateUserCache(telegramId);

    return {
      success: true,
      workerCode: worker.code,
      workerName: worker.nickname || worker.name,
      telegramId,
      telegramName: options?.telegramName,
      reboundFromOldUser: Boolean(conflictWorker && conflictWorker.id !== workerId),
      oldWorkerName: conflictWorker ? conflictWorker.nickname || conflictWorker.name : undefined,
    };
  }

  async setPendingAction(actorTelegramId: bigint, action: PendingUserRbacAction): Promise<void> {
    const key = `user_rbac:pending:${actorTelegramId.toString()}`;
    if (this.redis) {
      await this.redis.set(key, JSON.stringify(action), 'EX', 900);
    }
    this.localPending.set(actorTelegramId.toString(), action);
  }

  async getPendingAction(actorTelegramId: bigint): Promise<PendingUserRbacAction | null> {
    const key = `user_rbac:pending:${actorTelegramId.toString()}`;
    if (this.redis) {
      const raw = await this.redis.get(key);
      if (raw) {
        try {
          return JSON.parse(raw) as PendingUserRbacAction;
        } catch {}
      }
    }
    return this.localPending.get(actorTelegramId.toString()) || null;
  }

  async clearPendingAction(actorTelegramId: bigint): Promise<void> {
    const key = `user_rbac:pending:${actorTelegramId.toString()}`;
    if (this.redis) {
      await this.redis.del(key);
    }
    this.localPending.delete(actorTelegramId.toString());
  }
}
