import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GhostModeService } from '../flow.service.js';
import type { GhostModeRepository } from '../flow.repository.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.6 Unit Tests — GhostMode', () => {
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

  it('impersonates valid role and links active site correctly', async () => {
    // Arrange
    const mockRepo = {
      setImpersonatedRole: vi.fn().mockResolvedValue(undefined),
      setImpersonatedEntity: vi.fn().mockResolvedValue(undefined),
      getImpersonatedRole: vi.fn(),
      clearImpersonatedRole: vi.fn(),
      getFirstActiveSite: vi.fn().mockResolvedValue({ id: 'site-1', name: 'موقع السباعية' }),
    } as unknown as GhostModeRepository;
    const service = new GhostModeService(mockRepo);

    // Act
    const res = await service.impersonate(123456n, 'FIELD_ADMIN');

    // Assert
    expect(res.success).toBe(true);
    expect(res.role).toBe('FIELD_ADMIN');
    expect(mockRepo.setImpersonatedRole).toHaveBeenCalledWith(
      123456n,
      'FIELD_ADMIN',
      expect.objectContaining({ siteId: 'site-1' })
    );
  });

  it('impersonates worker profile and attaches entity credentials', async () => {
    // Arrange
    const mockRepo = {
      setImpersonatedRole: vi.fn().mockResolvedValue(undefined),
      setImpersonatedEntity: vi.fn().mockResolvedValue(undefined),
      findWorkerById: vi.fn().mockResolvedValue({
        id: 'w-1',
        code: 'W-001',
        name: 'أحمد علي',
        siteId: 'site-1',
        site: { name: 'السباعية' },
      }),
    } as unknown as GhostModeRepository;
    const service = new GhostModeService(mockRepo);

    // Act
    const res = await service.impersonateWorker(123456n, 'w-1');

    // Assert
    expect(res.success).toBe(true);
    expect(res.role).toBe('WORKER');
    expect(mockRepo.setImpersonatedRole).toHaveBeenCalledWith(
      123456n,
      'WORKER',
      expect.objectContaining({
        id: 'w-1',
        code: 'W-001',
        name: 'أحمد علي',
      })
    );
  });

  it('impersonates supplier entity with designated code and name', async () => {
    // Arrange
    const mockRepo = {
      setImpersonatedRole: vi.fn().mockResolvedValue(undefined),
      setImpersonatedEntity: vi.fn().mockResolvedValue(undefined),
      findSupplierById: vi.fn().mockResolvedValue({
        id: 's-1',
        code: 'SUP-001',
        name: 'شركة الأمل للتوريدات',
      }),
    } as unknown as GhostModeRepository;
    const service = new GhostModeService(mockRepo);

    // Act
    const res = await service.impersonateSupplier(123456n, 's-1');

    // Assert
    expect(res.success).toBe(true);
    expect(res.role).toBe('SUPPLIER');
    expect(mockRepo.setImpersonatedRole).toHaveBeenCalledWith(
      123456n,
      'SUPPLIER',
      expect.objectContaining({
        id: 's-1',
        code: 'SUP-001',
        name: 'شركة الأمل للتوريدات',
      })
    );
  });

  it('rejects unsupported role candidate for impersonation', async () => {
    // Arrange
    const mockRepo = {
      setImpersonatedRole: vi.fn(),
    } as unknown as GhostModeRepository;
    const service = new GhostModeService(mockRepo);

    // Act
    const res = await service.impersonate(123456n, 'UNKNOWN_ROLE');

    // Assert
    expect(res.success).toBe(false);
    expect(res.error).toContain('غير متاح للمحاكاة');
    expect(mockRepo.setImpersonatedRole).not.toHaveBeenCalled();
  });

  it('clears active impersonation state upon exit', async () => {
    // Arrange
    const mockRepo = {
      clearImpersonatedRole: vi.fn().mockResolvedValue(undefined),
    } as unknown as GhostModeRepository;
    const service = new GhostModeService(mockRepo);

    // Act
    await service.exitImpersonate(123456n);

    // Assert
    expect(mockRepo.clearImpersonatedRole).toHaveBeenCalledWith(123456n);
  });
});
