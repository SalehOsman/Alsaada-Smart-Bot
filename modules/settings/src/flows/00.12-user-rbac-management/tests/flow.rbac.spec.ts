import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UserRbacService } from '../flow.service.js';
import type { UserRbacRepository } from '../flow.repository.js';
import type { UserDetailDto } from '../flow.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.12 RBAC Tests — Sovereign Access Control & Strict Defense', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const superAdminUser: UserDetailDto = {
    id: 'u-1',
    telegramId: 100n,
    fullName: 'المدير العام الأول',
    role: 'SUPER_ADMIN',
    isActive: true,
    isBanned: false,
    createdAt: PINNED_BASE_TIME,
  };

  it('strictly forbids self demotion or role modification', async () => {
    // Arrange
    const mockRepo = {} as unknown as UserRbacRepository;
    const service = new UserRbacService(mockRepo);

    // Act
    const res = await service.changeUserRole(100n, 100n, 'FIELD_ADMIN');

    // Assert
    expect(res.success).toBe(false);
    expect(res.error).toBe('أمان النظام: لا يمكنك تعديل رتبة أو صلاحيات حسابك الشخصي بنفسك.');
  });

  it('strictly protects the last standing Super Admin from demotion', async () => {
    // Arrange
    const mockRepo = {
      getUserByTelegramId: vi.fn().mockResolvedValue(superAdminUser),
      countActiveSuperAdmins: vi.fn().mockResolvedValue(1),
    } as unknown as UserRbacRepository;
    const service = new UserRbacService(mockRepo);

    // Act
    const res = await service.changeUserRole(200n, 100n, 'FIELD_ADMIN');

    // Assert
    expect(res.success).toBe(false);
    expect(res.error).toContain('لا يمكن خفض صلاحية المشرف العام الوحيد بالمنظومة');
  });

  it('strictly protects the last standing Super Admin from being revoked or banned', async () => {
    // Arrange
    const mockRepo = {
      getUserByTelegramId: vi.fn().mockResolvedValue(superAdminUser),
      countActiveSuperAdmins: vi.fn().mockResolvedValue(1),
    } as unknown as UserRbacRepository;
    const service = new UserRbacService(mockRepo);

    // Act
    const banRes = await service.toggleUserBan(200n, 100n, true);
    const revokeRes = await service.revokeUser(200n, 100n);

    // Assert
    expect(banRes.success).toBe(false);
    expect(banRes.error).toContain('لا يمكن حظر المشرف العام الوحيد');
    expect(revokeRes.success).toBe(false);
    expect(revokeRes.error).toContain('لا يمكن سحب صلاحيات المشرف العام الوحيد');
  });
});
