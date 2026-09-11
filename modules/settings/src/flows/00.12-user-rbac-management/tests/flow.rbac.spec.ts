import { describe, it, expect, vi } from 'vitest';
import { UserRbacService } from '../flow.service.js';
import type { UserRbacRepository } from '../flow.repository.js';
import type { UserDetailDto } from '../flow.types.js';

describe('Flow 00.12 RBAC Tests — Sovereign Access Control & Strict Defense', () => {
  const superAdminUser: UserDetailDto = {
    id: 'u-1',
    telegramId: 100n,
    fullName: 'المدير العام الأول',
    role: 'SUPER_ADMIN',
    isActive: true,
    isBanned: false,
    createdAt: new Date(),
  };

  it('strictly forbids self demotion or role modification', async () => {
    const mockRepo = {} as unknown as UserRbacRepository;
    const service = new UserRbacService(mockRepo);

    const res = await service.changeUserRole(100n, 100n, 'FIELD_ADMIN');
    expect(res.success).toBe(false);
    expect(res.error).toBe('أمان النظام: لا يمكنك تعديل رتبة أو صلاحيات حسابك الشخصي بنفسك.');
  });

  it('strictly protects the last standing Super Admin from demotion', async () => {
    const mockRepo = {
      getUserByTelegramId: vi.fn().mockResolvedValue(superAdminUser),
      countActiveSuperAdmins: vi.fn().mockResolvedValue(1),
    } as unknown as UserRbacRepository;

    const service = new UserRbacService(mockRepo);

    const res = await service.changeUserRole(200n, 100n, 'FIELD_ADMIN');
    expect(res.success).toBe(false);
    expect(res.error).toContain('لا يمكن خفض صلاحية المشرف العام الوحيد بالمنظومة');
  });

  it('strictly protects the last standing Super Admin from being revoked or banned', async () => {
    const mockRepo = {
      getUserByTelegramId: vi.fn().mockResolvedValue(superAdminUser),
      countActiveSuperAdmins: vi.fn().mockResolvedValue(1),
    } as unknown as UserRbacRepository;

    const service = new UserRbacService(mockRepo);

    const banRes = await service.toggleUserBan(200n, 100n, true);
    expect(banRes.success).toBe(false);
    expect(banRes.error).toContain('لا يمكن حظر المشرف العام الوحيد');

    const revokeRes = await service.revokeUser(200n, 100n);
    expect(revokeRes.success).toBe(false);
    expect(revokeRes.error).toContain('لا يمكن سحب صلاحيات المشرف العام الوحيد');
  });
});
