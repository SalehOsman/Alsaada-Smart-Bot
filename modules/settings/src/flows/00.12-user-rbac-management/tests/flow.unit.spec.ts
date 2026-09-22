import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UserRbacService } from '../flow.service.js';
import type { UserRbacRepository } from '../flow.repository.js';
import type { UserDetailDto } from '../flow.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.12 Unit Tests — UserRbacService', () => {
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

  const sampleUser: UserDetailDto = {
    id: 'u-1',
    telegramId: 123456789n,
    fullName: 'أحمد محمود',
    role: 'WORKER',
    isActive: true,
    isBanned: false,
    createdAt: PINNED_BASE_TIME,
  };

  const sampleSuperAdmin: UserDetailDto = {
    id: 'u-admin',
    telegramId: 999888777n,
    fullName: 'المدير العام',
    role: 'SUPER_ADMIN',
    isActive: true,
    isBanned: false,
    createdAt: PINNED_BASE_TIME,
  };

  it('lists users with pagination correctly', async () => {
    // Arrange
    const mockRepo = {
      listUsers: vi.fn().mockResolvedValue({
        users: [sampleUser],
        total: 1,
        totalPages: 1,
      }),
    } as unknown as UserRbacRepository;
    const service = new UserRbacService(mockRepo);

    // Act
    const res = await service.listUsers(1, 8);

    // Assert
    expect(res.users).toHaveLength(1);
    expect(res.total).toBe(1);
    expect(mockRepo.listUsers).toHaveBeenCalledWith(1, 8);
  });

  it('searches users with valid query', async () => {
    // Arrange
    const mockRepo = {
      searchUsers: vi.fn().mockResolvedValue([sampleUser]),
    } as unknown as UserRbacRepository;
    const service = new UserRbacService(mockRepo);

    // Act
    const res = await service.searchUsers('أحمد');

    // Assert
    expect(res).toHaveLength(1);
    expect(mockRepo.searchUsers).toHaveBeenCalledWith('أحمد');
  });

  it('blocks self-modification of roles', async () => {
    // Arrange
    const mockRepo = {} as unknown as UserRbacRepository;
    const service = new UserRbacService(mockRepo);

    // Act
    const res = await service.changeUserRole(123456789n, 123456789n, 'FIELD_ADMIN');

    // Assert
    expect(res.success).toBe(false);
    expect(res.error).toContain('لا يمكنك تعديل رتبة أو صلاحيات حسابك الشخصي بنفسك');
  });

  it('blocks demoting the sole super admin', async () => {
    // Arrange
    const mockRepo = {
      getUserByTelegramId: vi.fn().mockResolvedValue(sampleSuperAdmin),
      countActiveSuperAdmins: vi.fn().mockResolvedValue(1),
    } as unknown as UserRbacRepository;
    const service = new UserRbacService(mockRepo);

    // Act
    const res = await service.changeUserRole(111n, 999888777n, 'FIELD_ADMIN');

    // Assert
    expect(res.success).toBe(false);
    expect(res.error).toContain('لا يمكن خفض صلاحية المشرف العام الوحيد بالمنظومة');
  });

  it('allows promoting and changing roles when valid', async () => {
    // Arrange
    const mockRepo = {
      getUserByTelegramId: vi.fn().mockResolvedValue(sampleUser),
      changeUserRole: vi.fn().mockResolvedValue({
        ...sampleUser,
        role: 'FIELD_ADMIN',
      }),
    } as unknown as UserRbacRepository;
    const service = new UserRbacService(mockRepo);

    // Act
    const res = await service.changeUserRole(999888777n, 123456789n, 'FIELD_ADMIN');

    // Assert
    expect(res.success).toBe(true);
    expect(res.user?.role).toBe('FIELD_ADMIN');
  });

  it('blocks banning self and sole super admin', async () => {
    // Arrange
    const mockRepo = {
      getUserByTelegramId: vi.fn().mockResolvedValue(sampleSuperAdmin),
      countActiveSuperAdmins: vi.fn().mockResolvedValue(1),
    } as unknown as UserRbacRepository;
    const service = new UserRbacService(mockRepo);

    // Act
    const selfRes = await service.toggleUserBan(111n, 111n, true);
    const adminRes = await service.toggleUserBan(111n, 999888777n, true);

    // Assert
    expect(selfRes.success).toBe(false);
    expect(adminRes.success).toBe(false);
    expect(adminRes.error).toContain('لا يمكن حظر المشرف العام الوحيد');
  });

  it('validates Telegram ID and executes atomic direct link', async () => {
    // Arrange
    const mockRepo = {
      atomicDirectLinkWorker: vi.fn().mockResolvedValue({
        success: true,
        workerCode: 'OP-01',
        workerName: 'علي حسن',
        telegramId: 777666555n,
      }),
    } as unknown as UserRbacRepository;
    const service = new UserRbacService(mockRepo);

    // Act
    const res = await service.directLinkWorker('worker-uuid', '777666555', {
      officialPhone: '01012345678',
    });

    // Assert
    expect(res.success).toBe(true);
    expect(res.whatsAppUrl).toContain('wa.me/201012345678');
    expect(mockRepo.atomicDirectLinkWorker).toHaveBeenCalled();
  });

  it('handles live preview from telegram getChat safely', async () => {
    // Arrange
    const mockRepo = {} as unknown as UserRbacRepository;
    const service = new UserRbacService(mockRepo);
    const mockApi = {
      getChat: vi.fn().mockResolvedValue({
        first_name: 'Saleh',
        last_name: 'Osman',
        username: 'saleh_o',
      }),
    };

    const preview = await service.previewTelegramProfile(
      12345n,
      mockApi as unknown as Parameters<typeof service.previewTelegramProfile>[1]
    );

    // Assert
    expect(preview.exists).toBe(true);
    expect(preview.firstName).toBe('Saleh');
    expect(preview.username).toBe('saleh_o');
  });

  it('assigns worker supervisor profile successfully', async () => {
    // Arrange
    const mockRepo = {
      getUserByTelegramId: vi.fn().mockResolvedValue(sampleUser),
      assignWorkerSupervisorProfile: vi.fn().mockResolvedValue({
        ...sampleUser,
        role: 'WORKER_SUPERVISOR',
      }),
    } as unknown as UserRbacRepository;
    const service = new UserRbacService(mockRepo);

    // Act
    const res = await service.assignWorkerSupervisorProfile(
      999888777n,
      123456789n,
      'FUEL_SUPERVISOR',
      'site-1'
    );

    // Assert
    expect(res.success).toBe(true);
    expect(res.user?.role).toBe('WORKER_SUPERVISOR');
    expect(mockRepo.assignWorkerSupervisorProfile).toHaveBeenCalledWith(
      999888777n,
      123456789n,
      'FUEL_SUPERVISOR',
      'site-1'
    );
  });

  it('blocks self-assignment of worker supervisor profile', async () => {
    // Arrange
    const mockRepo = {} as unknown as UserRbacRepository;
    const service = new UserRbacService(mockRepo);

    // Act
    const res = await service.assignWorkerSupervisorProfile(
      123456789n,
      123456789n,
      'CANTEEN_SUPERVISOR'
    );

    // Assert
    expect(res.success).toBe(false);
    expect(res.error).toContain('لا يمكنك ترقية أو تعديل رتبة حسابك الشخصي بنفسك');
  });
});
