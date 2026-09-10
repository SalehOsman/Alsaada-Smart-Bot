import type { EmergencyCacheRepository } from './flow.repository.js';
import type { MaintenanceStatusDto, PrewarmResultDto } from './flow.types.js';

export class EmergencyCacheService {
  constructor(private readonly repository: EmergencyCacheRepository) {}

  async getMaintenanceStatus(): Promise<MaintenanceStatusDto> {
    return this.repository.getMaintenanceStatus();
  }

  async toggleMaintenanceStatus(): Promise<{ isActive: boolean; notice: string }> {
    const current = await this.repository.getMaintenanceStatus();
    const nextState = !current.isMaintenanceActive;
    await this.repository.setMaintenanceStatus(nextState);

    const notice = nextState
      ? '🛑 تم تفعيل وضع الصيانة وإغلاق البوت أمام المستخدمين بنجاح.'
      : '🟢 تم تعطيل وضع الصيانة وفتح البوت للجميع بنجاح.';

    return { isActive: nextState, notice };
  }

  async prewarmCache(): Promise<PrewarmResultDto> {
    const start = performance.now();

    // 1. Flush ephemeral cache keys
    await this.repository.flushEphemeralCache();

    // 2. Count active entities
    const counts = await this.repository.countEntitiesForPrewarm();

    const duration = Math.round(performance.now() - start);
    const memoryMb = Number((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2));

    return {
      durationMs: duration,
      workersLoaded: counts.workers,
      sitesLoaded: counts.sites,
      departmentsLoaded: counts.departments,
      jobsLoaded: counts.jobs,
      memoryUsedMb: memoryMb,
    };
  }
}
