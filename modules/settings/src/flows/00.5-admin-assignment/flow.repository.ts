import type { PrismaClient } from '@alsaada/database';
import type { AdminAssignmentDto, SiteOptionDto } from './flow.types.js';

export class AdminAssignmentRepository {
  private readonly includeRelations = {
    assignedSite: true,
    supervisorLifecycleLogs: {
      take: 1,
      orderBy: { createdAt: 'desc' as const },
    },
  } as const;

  constructor(private readonly prisma: PrismaClient) {}

  private toDto(u: {
    id: string;
    telegramId: bigint;
    fullName: string | null;
    role: string;
    assignedSiteId: string | null;
    isActive: boolean;
    freezeBotAccessOnLeave: boolean;
    ejectTelegramOnLeave: boolean;
    assignedSite?: { name: string } | null;
    supervisorLifecycleLogs?: Array<{ actionType: string }> | null;
  }): AdminAssignmentDto {
    const lastLog = u.supervisorLifecycleLogs?.[0];
    const isOnLeave = lastLog?.actionType === 'LEAVE_START';
    const status = isOnLeave ? 'ON_LEAVE' : u.isActive ? 'ACTIVE' : 'INACTIVE';

    return {
      id: u.id,
      telegramId: u.telegramId,
      fullName: u.fullName || 'بدون اسم',
      role: u.role,
      assignedSiteId: u.assignedSiteId,
      assignedSiteName: u.assignedSite?.name ?? null,
      isOnLeave,
      freezeBotAccessOnLeave: u.freezeBotAccessOnLeave,
      ejectTelegramOnLeave: u.ejectTelegramOnLeave,
      status,
    };
  }

  async listAdminUsers(excludeTelegramId?: bigint): Promise<AdminAssignmentDto[]> {
    const users = await this.prisma.user.findMany({
      where: {
        role: { in: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'ACCOUNTANT', 'EXECUTIVE'] },
        ...(excludeTelegramId ? { telegramId: { not: excludeTelegramId } } : {}),
      },
      include: this.includeRelations,
      orderBy: { fullName: 'asc' },
    });

    return users.map((u) => this.toDto(u));
  }

  async countActiveSuperAdmins(): Promise<number> {
    return this.prisma.user.count({
      where: {
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });
  }

  async getUserAssignment(telegramId: bigint): Promise<AdminAssignmentDto | null> {
    const u = await this.prisma.user.findUnique({
      where: { telegramId },
      include: this.includeRelations,
    });
    if (!u) return null;

    return this.toDto(u);
  }

  async listActiveSites(): Promise<SiteOptionDto[]> {
    const sites = await this.prisma.site.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        code: true,
        name: true,
        _count: {
          select: {
            workers: {
              where: { isDeleted: false },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return sites.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      workersCount: s._count?.workers ?? 0,
    }));
  }

  async setAssignment(telegramId: bigint, siteId: string | null): Promise<AdminAssignmentDto> {
    const updated = await this.prisma.user.update({
      where: { telegramId },
      data: { assignedSiteId: siteId },
      include: this.includeRelations,
    });

    return this.toDto(updated);
  }

  async toggleFreezeBotAccessOnLeave(telegramId: bigint): Promise<AdminAssignmentDto | null> {
    const user = await this.prisma.user.findUnique({ where: { telegramId } });
    if (!user) return null;

    const updated = await this.prisma.user.update({
      where: { telegramId },
      data: { freezeBotAccessOnLeave: !user.freezeBotAccessOnLeave },
      include: this.includeRelations,
    });

    return this.toDto(updated);
  }

  async toggleEjectTelegramOnLeave(telegramId: bigint): Promise<AdminAssignmentDto | null> {
    const user = await this.prisma.user.findUnique({ where: { telegramId } });
    if (!user) return null;

    const updated = await this.prisma.user.update({
      where: { telegramId },
      data: { ejectTelegramOnLeave: !user.ejectTelegramOnLeave },
      include: this.includeRelations,
    });

    return this.toDto(updated);
  }

  async setLeaveStatus(
    telegramId: bigint,
    isOnLeave: boolean,
    actorTelegramId?: bigint,
    actorName?: string
  ): Promise<AdminAssignmentDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { telegramId },
      include: this.includeRelations,
    });
    if (!user) return null;

    return this.prisma.$transaction(async (tx) => {
      // 1. Audit in SupervisorLifecycleLog
      await tx.supervisorLifecycleLog.create({
        data: {
          userId: user.id,
          workerId: user.workerId,
          actionType: isOnLeave ? 'LEAVE_START' : 'LEAVE_RETURN',
          previousSiteId: user.assignedSiteId,
          telegramGroupId: user.assignedSite?.telegramGroupId ?? null,
          telegramTopicId: user.assignedSite?.telegramTopicId ?? null,
          telegramAction: isOnLeave
            ? user.ejectTelegramOnLeave
              ? 'KICKED'
              : 'SKIPPED_POLICY'
            : 'INVITE_SENT',
          notes: isOnLeave
            ? `تسجيل بدء إجازة للمشرف (حجب بوت: ${user.freezeBotAccessOnLeave}، حجب تيليجرام: ${user.ejectTelegramOnLeave})`
            : 'تسجيل عودة من الإجازة واستئناف العمل الميداني',
          actorTelegramId: actorTelegramId ?? 0n,
        },
      });

      // 2. Update user state
      const updated = await tx.user.update({
        where: { telegramId },
        data: {
          isActive: !isOnLeave || !user.freezeBotAccessOnLeave,
        },
        include: { assignedSite: true },
      });

      // 3. Enforce Telegram group policy if site has telegramGroupId
      if (user.assignedSite?.telegramGroupId) {
        if (isOnLeave && user.ejectTelegramOnLeave) {
          await tx.telegramEnforcementTask.create({
            data: {
              siteId: user.assignedSiteId || '',
              telegramId: user.telegramId,
              chatId: user.assignedSite.telegramGroupId,
              taskType: 'KICK_MEMBER',
            },
          });
        } else if (!isOnLeave) {
          await tx.telegramEnforcementTask.create({
            data: {
              siteId: user.assignedSiteId || '',
              telegramId: user.telegramId,
              chatId: user.assignedSite.telegramGroupId,
              taskType: 'GENERATE_INVITE',
            },
          });
        }
      }

      return {
        id: updated.id,
        telegramId: updated.telegramId,
        fullName: updated.fullName || 'بدون اسم',
        role: updated.role,
        assignedSiteId: updated.assignedSiteId,
        assignedSiteName: updated.assignedSite?.name ?? null,
        isOnLeave,
        freezeBotAccessOnLeave: updated.freezeBotAccessOnLeave,
        ejectTelegramOnLeave: updated.ejectTelegramOnLeave,
        status: isOnLeave ? 'ON_LEAVE' : updated.isActive ? 'ACTIVE' : 'INACTIVE',
      };
    });
  }
}
