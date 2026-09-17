import type { PrismaClient } from '@alsaada/database';
import type { SiteDto } from './flow.types.js';

export class SitesHubRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listSites(): Promise<SiteDto[]> {
    const sites = await this.prisma.site.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        project: true,
        workers: {
          where: { status: 'ACTIVE' },
          select: { id: true },
        },
      },
    });

    return sites.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      status: s.status as 'ACTIVE' | 'PAUSED' | 'CLOSED',
      governorate: s.governorateCode,
      projectId: s.projectId,
      projectName: s.project?.name ?? null,
      geofenceRadiusMeters: s.geofenceRadiusMeters ?? 1000,
      latitude: s.latitude ? Number(s.latitude) : null,
      longitude: s.longitude ? Number(s.longitude) : null,
      workerCount: s.workers.length,
    }));
  }

  async getSiteByCode(code: string): Promise<SiteDto | null> {
    const s = await this.prisma.site.findUnique({
      where: { code },
      include: {
        project: true,
        workers: {
          where: { status: 'ACTIVE' },
          select: { id: true },
        },
      },
    });
    if (!s) return null;

    return {
      id: s.id,
      code: s.code,
      name: s.name,
      status: s.status as 'ACTIVE' | 'PAUSED' | 'CLOSED',
      governorate: s.governorateCode,
      projectId: s.projectId,
      projectName: s.project?.name ?? null,
      geofenceRadiusMeters: s.geofenceRadiusMeters ?? 1000,
      latitude: s.latitude ? Number(s.latitude) : null,
      longitude: s.longitude ? Number(s.longitude) : null,
      workerCount: s.workers.length,
    };
  }

  async toggleSiteStatus(code: string): Promise<SiteDto> {
    const site = await this.prisma.site.findUniqueOrThrow({ where: { code } });
    const newStatus = site.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    const updated = await this.prisma.site.update({
      where: { code },
      data: { status: newStatus },
      include: {
        project: true,
        workers: { where: { status: 'ACTIVE' }, select: { id: true } },
      },
    });

    return {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      status: updated.status as 'ACTIVE' | 'PAUSED' | 'CLOSED',
      governorate: updated.governorateCode,
      projectId: updated.projectId,
      projectName: updated.project?.name ?? null,
      geofenceRadiusMeters: updated.geofenceRadiusMeters ?? 1000,
      latitude: updated.latitude ? Number(updated.latitude) : null,
      longitude: updated.longitude ? Number(updated.longitude) : null,
      workerCount: updated.workers.length,
    };
  }

  async createSite(data: {
    name: string;
    code: string;
    governorate?: string | undefined;
    geofenceRadiusMeters: number;
    projectId?: string | undefined;
    latitude?: number | undefined;
    longitude?: number | undefined;
  }): Promise<SiteDto> {
    let projectId = data.projectId;
    if (!projectId) {
      const defaultProject = await this.prisma.project.findFirst();
      if (defaultProject) {
        projectId = defaultProject.id;
      } else {
        const tenant = await this.prisma.tenant.findFirst() || await this.prisma.tenant.create({
          data: { code: 'ALSAADA_MAIN', name: 'شركة السعادة للمقاولات العامة' }
        });
        const createdProj = await this.prisma.project.create({
          data: { tenantId: tenant.id, code: 'PRJ-MAIN', name: 'المشروع العام' }
        });
        projectId = createdProj.id;
      }
    }

    const created = await this.prisma.site.create({
      data: {
        projectId,
        name: data.name,
        code: data.code,
        governorateCode: data.governorate ?? null,
        geofenceRadiusMeters: data.geofenceRadiusMeters,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        status: 'ACTIVE',
      },
      include: {
        project: true,
        workers: { select: { id: true } },
      },
    });


    return {
      id: created.id,
      code: created.code,
      name: created.name,
      status: created.status as 'ACTIVE' | 'PAUSED' | 'CLOSED',
      governorate: created.governorateCode,
      projectId: created.projectId,
      projectName: created.project?.name ?? null,
      geofenceRadiusMeters: created.geofenceRadiusMeters ?? 1000,
      latitude: created.latitude ? Number(created.latitude) : null,
      longitude: created.longitude ? Number(created.longitude) : null,
      workerCount: 0,
    };
  }

  async updateSiteField(code: string, data: Record<string, unknown>): Promise<SiteDto> {
    const updatePayload: Record<string, unknown> = { ...data };
    if ('governorate' in updatePayload) {
      updatePayload.governorateCode = updatePayload.governorate;
      delete updatePayload.governorate;
    }

    const updated = await this.prisma.site.update({
      where: { code },
      data: updatePayload,
      include: {
        project: true,
        workers: { where: { status: 'ACTIVE' }, select: { id: true } },
      },
    });

    return {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      status: updated.status as 'ACTIVE' | 'PAUSED' | 'CLOSED',
      governorate: updated.governorateCode,
      projectId: updated.projectId,
      projectName: updated.project?.name ?? null,
      geofenceRadiusMeters: updated.geofenceRadiusMeters ?? 1000,
      latitude: updated.latitude ? Number(updated.latitude) : null,
      longitude: updated.longitude ? Number(updated.longitude) : null,
      workerCount: updated.workers.length,
    };
  }

  async listProjects(): Promise<Array<{ id: string; name: string }>> {
    const projects = await this.prisma.project.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return projects;
  }
}
