import { describe, it, expect, vi } from 'vitest';
import { UserRbacService } from '../flow.service.js';
import type { UserRbacRepository } from '../flow.repository.js';
import type { UserDetailDto, WorkerCandidateDto } from '../flow.types.js';

describe('Flow 00.12 Unit Tests — UserRbacService', () => {
  const sampleUser: UserDetailDto = {
    id: 'u-1',
    telegramId: 123456789n,
    fullName: 'أحمد محمود',
    role: 'WORKER',
    isActive: true,
    isBanned: false,
    createdAt: new Date(),
  };

  const sampleSuperAdmin: UserDetailDto = {
    id: 'u-admin',
    telegramId: 999888777n,
    fullName: 'المدير العام',
    role: 'SUPER_ADMIN',
    isActive: true,
    isBanned: false,
    createdAt: new Date(),
  };

  it('lists users with pagination correctly', async () => {
    const mockRepo = {
      listUsers: vi.fn().mockResolvedValue({
        users: [sampleUser],
        total: 1,
        totalPages: 1,
      }),
    } as unknown as UserRbacRepository;

    const service = new UserRbacService(mockRepo);
    const res = await service.listUsers(1, 8);

    expect(res.users).toHaveLength(1);
    expect(res.total).toBe(1);
    expect(mockRepo.listUsers).toHaveBeenCalledWith(1, 8);
  });

  it('searches users with valid query', async () => {
    const mockRepo = {
      searchUsers: vi.fn().mockResolvedValue([sampleUser]),
    } as unknown as UserRbacRepository;

    const service = new UserRbacService(mockRepo);
    const res = await service.searchUsers('أحمد');

    expect(res).toHaveLength(1);
    expect(mockRepo.searchUsers).toHaveBeenCalledWith('أحمد');
  });

  it('blocks self-modification of roles', async () => {
    const mockRepo = {} as unknown as UserRbacRepository;
    const service = new UserRbacService(mockRepo);

    const res = await service.changeUserRole(123456789n, 123456789n, 'FIELD_ADMIN');
    expect(res.success).toBe(false);
    expect(res.error).toContain('لا يمكنك تعديل رتبة أو صلاحيات حسابك الشخصي بنفسك');
  });

  it('blocks demoting the sole super admin', async () => {
    const mockRepo = {
      getUserByTelegramId: vi.fn().mockResolvedValue(sampleSuperAdmin),
      countActiveSuperAdmins: vi.fn().mockResolvedValue(1),
    } as unknown as UserRbacRepository;

    const service = new UserRbacService(mockRepo);
    const res = await service.changeUserRole(111n, 999888777n, 'FIELD_ADMIN');

    expect(res.success).toBe(false);
    expect(res.error).toContain('لا يمكن خفض صلاحية المشرف العام الوحيد بالمنظومة');
  });

  it('allows promoting/changing roles when valid', async () => {
    const mockRepo = {
      getUserByTelegramId: vi.fn().mockResolvedValue(sampleUser),
      changeUserRole: vi.fn().mockResolvedValue({
        ...sampleUser,
        role: 'FIELD_ADMIN',
      }),
    } as unknown as UserRbacRepository;

    const service = new UserRbacService(mockRepo);
    const res = await service.changeUserRole(999888777n, 123456789n, 'FIELD_ADMIN');

    expect(res.success).toBe(true);
    expect(res.user?.role).toBe('FIELD_ADMIN');
  });

  it('blocks banning self and sole super admin', async () => {
    const mockRepo = {
      getUserByTelegramId: vi.fn().mockResolvedValue(sampleSuperAdmin),
      countActiveSuperAdmins: vi.fn().mockResolvedValue(1),
    } as unknown as UserRbacRepository;

    const service = new UserRbacService(mockRepo);
    const selfRes = await service.toggleUserBan(111n, 111n, true);
    expect(selfRes.success).toBe(false);

    const adminRes = await service.toggleUserBan(111n, 999888777n, true);
    expect(adminRes.success).toBe(false);
    expect(adminRes.error).toContain('لا يمكن حظر المشرف العام الوحيد');
  });

  it('validates Telegram ID and executes atomic direct link', async () => {
    const mockRepo = {
      atomicDirectLinkWorker: vi.fn().mockResolvedValue({
        success: true,
        workerCode: 'OP-01',
        workerName: 'علي حسن',
        telegramId: 777666555n,
      }),
    } as unknown as UserRbacRepository;

    const service = new UserRbacService(mockRepo);
    const res = await service.directLinkWorker('worker-uuid', '777666555', {
      officialPhone: '01012345678',
    });

    expect(res.success).toBe(true);
    expect(res.whatsAppUrl).toContain('wa.me/201012345678');
    expect(mockRepo.atomicDirectLinkWorker).toHaveBeenCalled();
  });

  it('handles live preview from telegram getChat safely', async () => {
    const mockRepo = {} as unknown as UserRbacRepository;
    const service = new UserRbacService(mockRepo);

    const mockApi = {
      getChat: vi.fn().mockResolvedValue({
        first_name: 'Saleh',
        last_name: 'Osman',
        username: 'saleh_o',
      }),
    };

    const preview = await service.previewTelegramProfile(12345n, mockApi);
    expect(preview.exists).toBe(true);
    expect(preview.firstName).toBe('Saleh');
    expect(preview.username).toBe('saleh_o');
  });
});
