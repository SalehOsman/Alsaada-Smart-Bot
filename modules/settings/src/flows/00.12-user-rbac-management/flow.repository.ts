import type { PrismaClient } from '@alsaada/database';
import type { Redis } from 'ioredis';
import { WORKER_SUPERVISOR_PROFILES, type WorkerSupervisorProfileKey } from '@alsaada/rbac';
import type {
  UserListItemDto,
  UserDetailDto,
  WorkerCandidateDto,
  DirectLinkResult,
  PendingUserRbacAction,
} from './flow.types.js';

export class UserRbacRepository {
  private readonly localPending = new Map<string, PendingUserRbacAction>();
  private readonly userInclude = {
    worker: { select: { id: true, code: true, name: true, nickname: true } },
    assignedSite: { select: { id: true, name: true } },
  } as const;
  private readonly siteSelect = { site: { select: { id: true, name: true } } } as const;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis?: Redis | null
  ) {}

  private toUserListItem(r: {
    id: string;
    telegramId: bigint;
    fullName: string;
    username: string | null;
    role: string;
    isActive: boolean;
    isBanned: boolean;
    workerId: string | null;
    assignedSiteId: string | null;
    createdAt: Date;
    worker?: { code: string; name: string; nickname?: string | null } | null;
    assignedSite?: { name: string } | null;
  }): UserListItemDto {
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
      createdAt: r.createdAt,
    };
  }

  private toWorkerCandidate(w: {
    id: string;
    code: string;
    name: string;
    nickname?: string | null;
    telegramId?: bigint | null;
    siteId?: string | null;
    site?: { name: string } | null;
  }): WorkerCandidateDto {
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

  private pendingKey(id: bigint): string {
    return `user_rbac:pending:${id.toString()}`;
  }

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

  private async finishUserMutation(telegramId: bigint): Promise<UserDetailDto> {
    await this.invalidateUserCache(telegramId);
    const user = await this.getUserByTelegramId(telegramId);
    if (!user) throw new Error('المستخدم غير موجود.');
    return user;
  }

  async countActiveSuperAdmins(): Promise<number> {
    return this.prisma.user.count({
      where: { role: 'SUPER_ADMIN', isActive: true, isBanned: false, isDeleted: false },
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
        include: this.userInclude,
        orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      users: records.map((r) => this.toUserListItem(r)),
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
      include: this.userInclude,
      take: 10,
    });

    return records.map((r) => this.toUserListItem(r));
  }

  async getUserByTelegramId(telegramId: bigint): Promise<UserDetailDto | null> {
    const r = await this.prisma.user.findUnique({
      where: { telegramId },
      include: this.userInclude,
    });
    if (!r || r.isDeleted) return null;

    return {
      ...this.toUserListItem(r),
      phoneEncrypted: r.phoneEncrypted,
      approvedBySuperAdminId: r.approvedBySuperAdminId,
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
    return this.finishUserMutation(telegramId);
  }

  async toggleUserBan(telegramId: bigint, isBanned: boolean): Promise<UserDetailDto> {
    await this.prisma.user.update({
      where: { telegramId },
      data: { isBanned, isActive: !isBanned },
    });
    return this.finishUserMutation(telegramId);
  }

  async assignWorkerSupervisorProfile(
    actorTelegramId: bigint,
    targetTelegramId: bigint,
    profileKey: WorkerSupervisorProfileKey,
    siteId?: string | null
  ): Promise<UserDetailDto> {
    const profile = WORKER_SUPERVISOR_PROFILES[profileKey];
    if (!profile) {
      throw new Error('قالب صلاحيات المشرف غير صالح.');
    }

    const user = await this.prisma.user.findUnique({ where: { telegramId: targetTelegramId } });
    if (!user) throw new Error('المستخدم المطلوب غير موجود.');

    await this.prisma.$transaction(async (tx) => {
      // 1. Update user role and optional site
      await tx.user.update({
        where: { telegramId: targetTelegramId },
        data: {
          role: 'WORKER_SUPERVISOR',
          assignedSiteId: siteId !== undefined ? siteId : user.assignedSiteId,
          isActive: true,
        },
      });

      // 2. Clear old custom user permissions
      await tx.botMenuPermission.deleteMany({
        where: { scopeType: 'USER', scopeId: user.id },
      });

      // 3. Grant profile permissions to user scope
      for (const perm of profile.permissions) {
        for (const act of perm.actions) {
          await tx.botMenuPermission.create({
            data: {
              scopeType: 'USER',
              scopeId: user.id,
              featureKey: perm.permissionKey,
              action: act,
              policy: 'ALLOW',
            },
          });
        }
      }
    });

    // Notify Redis Pub/Sub for sub-5ms invalidation
    if (this.redis) {
      try {
        await this.redis.publish(
          'channel:rbac:sync',
          JSON.stringify({
            eventType: 'USER_PERMISSION_MUTATED',
            scopeType: 'USER',
            scopeId: user.id,
            timestamp: Date.now(),
          })
        );
      } catch {}
    }

    return this.finishUserMutation(targetTelegramId);
  }

  async revokeUser(telegramId: bigint): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { telegramId } });
    if (!user) return;

    await this.prisma.$transaction(async (tx) => {
      if (user.workerId) {
        await tx.worker.update({ where: { id: user.workerId }, data: { telegramId: null } });
      }
      // Remove custom user permissions
      await tx.botMenuPermission.deleteMany({
        where: { scopeType: 'USER', scopeId: user.id },
      });
      await tx.user.update({
        where: { telegramId },
        data: { role: 'GUEST', workerId: null, assignedSiteId: null, isActive: false },
      });
    });

    if (this.redis) {
      try {
        await this.redis.publish(
          'channel:rbac:sync',
          JSON.stringify({
            eventType: 'USER_REVOKED',
            scopeType: 'USER',
            scopeId: user.id,
            timestamp: Date.now(),
          })
        );
      } catch {}
    }

    await this.invalidateUserCache(telegramId);
  }

  async findWorkerById(workerId: string): Promise<WorkerCandidateDto | null> {
    const w = await this.prisma.worker.findUnique({
      where: { id: workerId },
      include: this.siteSelect,
    });
    return !w || w.isDeleted ? null : this.toWorkerCandidate(w);
  }

  async findWorkerByTelegramId(telegramId: bigint): Promise<WorkerCandidateDto | null> {
    const w = await this.prisma.worker.findFirst({
      where: { telegramId, isDeleted: false },
      include: this.siteSelect,
    });
    return w ? this.toWorkerCandidate(w) : null;
  }

  async listUnlinkedWorkers(siteId?: string): Promise<WorkerCandidateDto[]> {
    const records = await this.prisma.worker.findMany({
      where: {
        isDeleted: false,
        telegramId: null,
        status: 'ACTIVE',
        ...(siteId ? { siteId } : {}),
      },
      include: this.siteSelect,
      orderBy: { code: 'asc' },
      take: 50,
    });
    return records.map((w) => this.toWorkerCandidate(w));
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

    const conflictWorker = await this.findWorkerByTelegramId(telegramId);
    if (conflictWorker && conflictWorker.id !== workerId && !options?.confirmConflict) {
      const conflictName = conflictWorker.nickname || conflictWorker.name;
      return {
        success: false,
        workerCode: worker.code,
        workerName: worker.nickname || worker.name,
        telegramId,
        reboundFromOldUser: true,
        oldWorkerName: conflictName,
        error: `معرف التليجرام مربوط بالفعل بالعامل (${conflictName} - كود: ${conflictWorker.code}).`,
      };
    }

    await this.prisma.$transaction(async (tx) => {
      if (conflictWorker && conflictWorker.id !== workerId) {
        await tx.worker.update({ where: { id: conflictWorker.id }, data: { telegramId: null } });
      }
      await tx.worker.update({ where: { id: worker.id }, data: { telegramId } });

      const existingUser = await tx.user.findUnique({ where: { telegramId } });
      const userData = {
        fullName: worker.name,
        role: 'WORKER',
        workerId: worker.id,
        assignedSiteId: worker.siteId ?? null,
        isActive: true,
        isBanned: false,
      };

      if (existingUser) {
        await tx.user.update({ where: { telegramId }, data: userData });
      } else {
        await tx.user.create({ data: { telegramId, ...userData } });
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
    if (this.redis) {
      await this.redis.set(this.pendingKey(actorTelegramId), JSON.stringify(action), 'EX', 900);
    }
    this.localPending.set(actorTelegramId.toString(), action);
  }

  async getPendingAction(actorTelegramId: bigint): Promise<PendingUserRbacAction | null> {
    if (this.redis) {
      const raw = await this.redis.get(this.pendingKey(actorTelegramId));
      if (raw) {
        try {
          return JSON.parse(raw) as PendingUserRbacAction;
        } catch {}
      }
    }
    return this.localPending.get(actorTelegramId.toString()) || null;
  }

  async clearPendingAction(actorTelegramId: bigint): Promise<void> {
    if (this.redis) {
      await this.redis.del(this.pendingKey(actorTelegramId));
    }
    this.localPending.delete(actorTelegramId.toString());
  }
}
