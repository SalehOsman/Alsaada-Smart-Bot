import { describe, it, expect, vi } from 'vitest';
import { GhostModeService } from '../flow.service.js';
import type { GhostModeRepository } from '../flow.repository.js';

describe('Flow 00.6 Unit Tests — GhostMode', () => {
  it('should impersonate valid role successfully', async () => {
    const mockRepo = {
      setImpersonatedRole: vi.fn().mockResolvedValue(undefined),
      getImpersonatedRole: vi.fn(),
      clearImpersonatedRole: vi.fn(),
    } as unknown as GhostModeRepository;

    const service = new GhostModeService(mockRepo);
    const res = await service.impersonate(123456n, 'FIELD_ADMIN');

    expect(res.success).toBe(true);
    expect(res.role).toBe('FIELD_ADMIN');
    expect(mockRepo.setImpersonatedRole).toHaveBeenCalledWith(123456n, 'FIELD_ADMIN');
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
