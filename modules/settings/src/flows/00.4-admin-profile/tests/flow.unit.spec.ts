import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdminProfileService } from '../flow.service.js';
import type { AdminProfileRepository } from '../flow.repository.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.4 Unit Tests — AdminProfile', () => {
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

  it('validates and updates valid full name in repository', async () => {
    // Arrange
    const mockRepo = {
      getUser: vi.fn(),
      updateFullName: vi.fn().mockResolvedValue({}),
      updateEncryptedPhone: vi.fn(),
    } as unknown as AdminProfileRepository;
    const service = new AdminProfileService(mockRepo);

    // Act
    const res = await service.updateFullName(123456n, 'المهندس صالح عثمان');

    // Assert
    expect(res.success).toBe(true);
    expect(mockRepo.updateFullName).toHaveBeenCalledWith(123456n, 'المهندس صالح عثمان');
  });

  it('rejects short full name without calling repository update', async () => {
    // Arrange
    const mockRepo = {
      updateFullName: vi.fn(),
    } as unknown as AdminProfileRepository;
    const service = new AdminProfileService(mockRepo);

    // Act
    const res = await service.updateFullName(123456n, 'ص');

    // Assert
    expect(res.success).toBe(false);
    expect(res.error).toContain('ألا يقل عن 3 أحرف');
    expect(mockRepo.updateFullName).not.toHaveBeenCalled();
  });

  it('validates Egyptian phone format before encrypting and storing', async () => {
    // Arrange
    const mockRepo = {
      updateEncryptedPhone: vi.fn().mockResolvedValue({}),
    } as unknown as AdminProfileRepository;
    const service = new AdminProfileService(mockRepo, '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');

    // Act
    const res = await service.updatePhone(123456n, '01012345678');

    // Assert
    expect(res.success).toBe(true);
    expect(mockRepo.updateEncryptedPhone).toHaveBeenCalled();
  });

  it('rejects invalid phone format and aborts persistence', async () => {
    // Arrange
    const mockRepo = {
      updateEncryptedPhone: vi.fn(),
    } as unknown as AdminProfileRepository;
    const service = new AdminProfileService(mockRepo);

    // Act
    const res = await service.updatePhone(123456n, '12345');

    // Assert
    expect(res.success).toBe(false);
    expect(res.error).toContain('رقماً مصرياً صحيحاً');
    expect(mockRepo.updateEncryptedPhone).not.toHaveBeenCalled();
  });

  it('throws error when database encryption key is omitted during phone update', async () => {
    // Arrange
    const mockRepo = {
      updateEncryptedPhone: vi.fn(),
    } as unknown as AdminProfileRepository;
    const service = new AdminProfileService(mockRepo);

    // Act
    const execution = () => service.updatePhone(123456n, '01012345678');

    // Assert
    await expect(execution()).rejects.toThrow(
      'DATABASE_ENCRYPTION_KEY is required to update phone number.'
    );
  });
});
