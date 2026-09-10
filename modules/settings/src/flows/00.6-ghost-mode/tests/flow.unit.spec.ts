import { describe, it, expect, vi } from 'vitest';
import { GhostModeService } from '../flow.service.js';
import type { GhostModeRepository } from '../flow.repository.js';

describe('Flow 00.6 Unit Tests — GhostMode', () => {
  it('should impersonate valid role successfully', async () => {
    const mockRepo = {
      setImpersonatedRole: vi.fn().mockResolvedValue(undefined),
      setImpersonatedEntity: vi.fn().mockResolvedValue(undefined),
      getImpersonatedRole: vi.fn(),
      clearImpersonatedRole: vi.fn(),
      getFirstActiveSite: vi.fn().mockResolvedValue({ id: 'site-1', name: 'موقع السباعية' }),
    } as unknown as GhostModeRepository;

    const service = new GhostModeService(mockRepo);
    const res = await service.impersonate(123456n, 'FIELD_ADMIN');

    expect(res.success).toBe(true);
    expect(res.role).toBe('FIELD_ADMIN');
    expect(mockRepo.setImpersonatedRole).toHaveBeenCalledWith(
      123456n,
      'FIELD_ADMIN',
      expect.objectContaining({ siteId: 'site-1' })
    );
  });

  it('should impersonate worker successfully', async () => {
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
    const res = await service.impersonateWorker(123456n, 'w-1');

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

  it('should impersonate supplier successfully', async () => {
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
    const res = await service.impersonateSupplier(123456n, 's-1');

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

  it('should reject invalid role for impersonation', async () => {
    const mockRepo = {
      setImpersonatedRole: vi.fn(),
    } as unknown as GhostModeRepository;

    const service = new GhostModeService(mockRepo);
    const res = await service.impersonate(123456n, 'UNKNOWN_ROLE');

    expect(res.success).toBe(false);
    expect(res.error).toContain('غير متاح للمحاكاة');
    expect(mockRepo.setImpersonatedRole).not.toHaveBeenCalled();
  });

  it('should clear impersonation upon exit', async () => {
    const mockRepo = {
      clearImpersonatedRole: vi.fn().mockResolvedValue(undefined),
    } as unknown as GhostModeRepository;

    const service = new GhostModeService(mockRepo);
    await service.exitImpersonate(123456n);

    expect(mockRepo.clearImpersonatedRole).toHaveBeenCalledWith(123456n);
  });
});
