import { describe, it, expect, vi } from 'vitest';
import { AdminProfileService } from '../flow.service.js';
import type { AdminProfileRepository } from '../flow.repository.js';

describe('Flow 00.4 Unit Tests — AdminProfile', () => {
  it('should validate and update valid full name', async () => {
    const mockRepo = {
      getUser: vi.fn(),
      updateFullName: vi.fn().mockResolvedValue({}),
      updateEncryptedPhone: vi.fn(),
    } as unknown as AdminProfileRepository;

    const service = new AdminProfileService(mockRepo);
    const res = await service.updateFullName(123456n, 'المهندس صالح عثمان');

    expect(res.success).toBe(true);
    expect(mockRepo.updateFullName).toHaveBeenCalledWith(123456n, 'المهندس صالح عثمان');
  });

  it('should reject short full name', async () => {
    const mockRepo = {
      updateFullName: vi.fn(),
    } as unknown as AdminProfileRepository;

    const service = new AdminProfileService(mockRepo);
    const res = await service.updateFullName(123456n, 'ص');

    expect(res.success).toBe(false);
    expect(res.error).toContain('ألا يقل عن 3 أحرف');
    expect(mockRepo.updateFullName).not.toHaveBeenCalled();
  });

  it('should validate Egyptian phone format before encrypting', async () => {
    const mockRepo = {
      updateEncryptedPhone: vi.fn().mockResolvedValue({}),
    } as unknown as AdminProfileRepository;

    const service = new AdminProfileService(mockRepo, '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
    const res = await service.updatePhone(123456n, '01012345678');

    expect(res.success).toBe(true);
    expect(mockRepo.updateEncryptedPhone).toHaveBeenCalled();
  });

  it('should reject invalid phone format', async () => {
    const mockRepo = {
      updateEncryptedPhone: vi.fn(),
    } as unknown as AdminProfileRepository;

    const service = new AdminProfileService(mockRepo);
    const res = await service.updatePhone(123456n, '12345');

    expect(res.success).toBe(false);
    expect(res.error).toContain('رقماً مصرياً صحيحاً');
    expect(mockRepo.updateEncryptedPhone).not.toHaveBeenCalled();
  });

  it('should throw error when encryption key is missing during phone update', async () => {
    const mockRepo = {
      updateEncryptedPhone: vi.fn(),
    } as unknown as AdminProfileRepository;

    const service = new AdminProfileService(mockRepo);
    await expect(service.updatePhone(123456n, '01012345678')).rejects.toThrow(
      'DATABASE_ENCRYPTION_KEY is required to update phone number.'
    );
  });
});
