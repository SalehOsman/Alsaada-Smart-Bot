import { describe, it, expect, vi } from 'vitest';
import { EmergencyCacheService } from '../flow.service.js';
import type { EmergencyCacheRepository } from '../flow.repository.js';

describe('Flow 00.9 Unit Tests — EmergencyCache', () => {
  it('should toggle maintenance mode from false to true', async () => {
    const mockRepo = {
      getMaintenanceStatus: vi.fn().mockResolvedValue({ isMaintenanceActive: false }),
      setMaintenanceStatus: vi.fn().mockResolvedValue(true),
    } as unknown as EmergencyCacheRepository;

    const service = new EmergencyCacheService(mockRepo);
    const res = await service.toggleMaintenanceStatus();

    expect(res.isActive).toBe(true);
    expect(res.notice).toContain('تم تفعيل وضع الصيانة');
    expect(mockRepo.setMaintenanceStatus).toHaveBeenCalledWith(true);
  });

  it('should toggle maintenance mode from true to false', async () => {
    const mockRepo = {
      getMaintenanceStatus: vi.fn().mockResolvedValue({ isMaintenanceActive: true }),
      setMaintenanceStatus: vi.fn().mockResolvedValue(false),
    } as unknown as EmergencyCacheRepository;

    const service = new EmergencyCacheService(mockRepo);
    const res = await service.toggleMaintenanceStatus();

    expect(res.isActive).toBe(false);
    expect(res.notice).toContain('تم تعطيل وضع الصيانة');
    expect(mockRepo.setMaintenanceStatus).toHaveBeenCalledWith(false);
  });

  it('should flush cache and return prewarm entity metrics', async () => {
    const mockRepo = {
      flushEphemeralCache: vi.fn().mockResolvedValue(undefined),
      countEntitiesForPrewarm: vi.fn().mockResolvedValue({
        workers: 45,
        sites: 8,
        departments: 5,
        jobs: 14,
      }),
    } as unknown as EmergencyCacheRepository;

    const service = new EmergencyCacheService(mockRepo);
    const res = await service.prewarmCache();

    expect(res.workersLoaded).toBe(45);
    expect(res.sitesLoaded).toBe(8);
    expect(res.jobsLoaded).toBe(14);
    expect(mockRepo.flushEphemeralCache).toHaveBeenCalledTimes(1);
    expect(mockRepo.countEntitiesForPrewarm).toHaveBeenCalledTimes(1);
  });
});
