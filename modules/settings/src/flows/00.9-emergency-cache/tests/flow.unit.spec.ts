import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EmergencyCacheService } from '../flow.service.js';
import type { EmergencyCacheRepository } from '../flow.repository.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.9 Unit Tests — EmergencyCache', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('activates maintenance mode when currently disabled', async () => {
    // Arrange
    const mockRepo = {
      getMaintenanceStatus: vi.fn().mockResolvedValue({ isMaintenanceActive: false }),
      setMaintenanceStatus: vi.fn().mockResolvedValue(true),
    } as unknown as EmergencyCacheRepository;
    const service = new EmergencyCacheService(mockRepo);

    // Act
    const res = await service.toggleMaintenanceStatus();

    // Assert
    expect(res.isActive).toBe(true);
    expect(res.notice).toContain('تم تفعيل وضع الصيانة');
    expect(mockRepo.setMaintenanceStatus).toHaveBeenCalledWith(true);
  });

  it('deactivates maintenance mode when currently enabled', async () => {
    // Arrange
    const mockRepo = {
      getMaintenanceStatus: vi.fn().mockResolvedValue({ isMaintenanceActive: true }),
      setMaintenanceStatus: vi.fn().mockResolvedValue(false),
    } as unknown as EmergencyCacheRepository;
    const service = new EmergencyCacheService(mockRepo);

    // Act
    const res = await service.toggleMaintenanceStatus();

    // Assert
    expect(res.isActive).toBe(false);
    expect(res.notice).toContain('تم تعطيل وضع الصيانة');
    expect(mockRepo.setMaintenanceStatus).toHaveBeenCalledWith(false);
  });

  it('flushes cache and returns pre-warmed entity metrics', async () => {
    // Arrange
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

    // Act
    const res = await service.prewarmCache();

    // Assert
    expect(res.workersLoaded).toBe(45);
    expect(res.sitesLoaded).toBe(8);
    expect(res.jobsLoaded).toBe(14);
    expect(mockRepo.flushEphemeralCache).toHaveBeenCalledTimes(1);
    expect(mockRepo.countEntitiesForPrewarm).toHaveBeenCalledTimes(1);
  });

  it('propagates repository error when maintenance status update fails', async () => {
    // Arrange
    const mockRepo = {
      getMaintenanceStatus: vi.fn().mockResolvedValue({ isMaintenanceActive: false }),
      setMaintenanceStatus: vi.fn().mockRejectedValue(new Error('Persistence layer failure')),
    } as unknown as EmergencyCacheRepository;
    const service = new EmergencyCacheService(mockRepo);

    // Act
    const execution = () => service.toggleMaintenanceStatus();

    // Assert
    await expect(execution()).rejects.toThrow('Persistence layer failure');
  });
});
