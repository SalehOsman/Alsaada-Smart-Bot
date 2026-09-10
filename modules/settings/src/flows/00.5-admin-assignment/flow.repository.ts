import type { PrismaClient } from '@alsaada/database';
import type { AdminAssignmentDto, SiteOptionDto } from './flow.types.js';

export class AdminAssignmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listAdminUsers(): Promise<AdminAssignmentDto[]> {
    const users = await this.prisma.user.findMany({
      where: {
        role: { in: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'ACCOUNTANT', 'EXECUTIVE'] },
      },
      include: { assignedSite: true },
      orderBy: { fullName: 'asc' },
    });

    return users.map((u) => ({
      id: u.id,
      telegramId: u.telegramId,
      fullName: u.fullName || 'بدون اسم',
      role: u.role,
      assignedSiteId: u.assignedSiteId,
      assignedSiteName: u.assignedSite?.name ?? null,
    }));
  }

  async getUserAssignment(telegramId: bigint): Promise<AdminAssignmentDto | null> {
    const u = await this.prisma.user.findUnique({
      where: { telegramId },
      include: { assignedSite: true },
    });
    if (!u) return null;

    return {
      id: u.id,
      telegramId: u.telegramId,
      fullName: u.fullName || 'بدون اسم',
      role: u.role,
      assignedSiteId: u.assignedSiteId,
      assignedSiteName: u.assignedSite?.name ?? null,
    };
  }

  async listActiveSites(): Promise<SiteOptionDto[]> {
    const sites = await this.prisma.site.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });
    return sites;
  }

  async setAssignment(telegramId: bigint, siteId: string | null): Promise<AdminAssignmentDto> {
    const updated = await this.prisma.user.update({
      where: { telegramId },
      data: { assignedSiteId: siteId },
      include: { assignedSite: true },
    });

    return {
      id: updated.id,
      telegramId: updated.telegramId,
      fullName: updated.fullName || 'بدون اسم',
      role: updated.role,
      assignedSiteId: updated.assignedSiteId,
      assignedSiteName: updated.assignedSite?.name ?? null,
    };
  }
}
