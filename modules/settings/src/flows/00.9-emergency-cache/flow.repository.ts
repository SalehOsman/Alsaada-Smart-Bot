import type { PrismaClient } from '@alsaada/database';
import type { Redis } from 'ioredis';
import type { MaintenanceStatusDto, PrewarmResultDto } from './flow.types.js';

export class EmergencyCacheRepository {
  private localMaintenance = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis?: Redis | null
  ) {}

  async getMaintenanceStatus(): Promise<MaintenanceStatusDto> {
    if (this.redis) {
      const raw = await this.redis.get('system:maintenance_mode');
      return {
        isMaintenanceActive: raw === 'true',
        toggledAt: null,
        toggledById: null,
      };
    }
    return {
      isMaintenanceActive: this.localMaintenance,
      toggledAt: null,
      toggledById: null,
    };
  }

  async setMaintenanceStatus(active: boolean): Promise<boolean> {
    if (this.redis) {
      await this.redis.set('system:maintenance_mode', active ? 'true' : 'false');
    } else {
      this.localMaintenance = active;
    }
    return active;
  }

  async flushEphemeralCache(): Promise<void> {
    if (this.redis) {
      // Find and delete ephemeral keys (user sessions, screen flows, breadcrumbs) without deleting persistent config
      const keys = await this.redis.keys('user_breadcrumbs:*');
      const sessionKeys = await this.redis.keys('screen_flow:*');
      const all = [...keys, ...sessionKeys];
      if (all.length > 0) {
        await this.redis.del(...all);
      }
    }
  }

  async countEntitiesForPrewarm(): Promise<{ workers: number; sites: number; departments: number; jobs: number }> {
    const [workers, sites, departments, jobs] = await Promise.all([
      this.prisma.worker.count({ where: { status: 'ACTIVE' } }),
      this.prisma.site.count({ where: { status: 'ACTIVE' } }),
      this.prisma.department.count({ where: { isActive: true } }),
      this.prisma.jobTitle.count({ where: { isActive: true } }),
    ]);

    return { workers, sites, departments, jobs };
  }
}
