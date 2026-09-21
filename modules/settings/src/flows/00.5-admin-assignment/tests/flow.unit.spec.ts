import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdminAssignmentService } from '../flow.service.js';
import type { AdminAssignmentRepository } from '../flow.repository.js';
import type { AdminAssignmentDto } from '../flow.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.5 Unit Tests — AdminAssignment', () => {
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

  const sampleUser: AdminAssignmentDto = {
    id: 'u-1',
    telegramId: 111222333n,
    fullName: 'المهندس أحمد ممدوح',
    role: 'FIELD_ADMIN',
    assignedSiteId: 's-1',
    assignedSiteName: 'موقع السويس',
    isOnLeave: false,
    freezeBotAccessOnLeave: true,
    ejectTelegramOnLeave: true,
    status: 'ACTIVE',
  };

  it('lists administrative users and maps projection correctly', async () => {
    // Arrange
    const mockRepo = {
      listAdminUsers: vi.fn().mockResolvedValue([sampleUser]),
    } as unknown as AdminAssignmentRepository;
    const service = new AdminAssignmentService(mockRepo);

    // Act
    const users = await service.listAdminUsers();

    // Assert
    expect(users).toHaveLength(1);
    expect(users[0]?.fullName).toBe('المهندس أحمد ممدوح');
    expect(mockRepo.listAdminUsers).toHaveBeenCalledTimes(1);
  });

  it('sets global assignment scope when GLOBAL keyword passed', async () => {
    // Arrange
    const mockRepo = {
      getUserAssignment: vi.fn().mockResolvedValue(sampleUser),
      countActiveSuperAdmins: vi.fn().mockResolvedValue(2),
      setAssignment: vi.fn().mockResolvedValue({
        ...sampleUser,
        assignedSiteId: null,
        assignedSiteName: null,
      }),
    } as unknown as AdminAssignmentRepository;
    const service = new AdminAssignmentService(mockRepo);

    // Act
    const res = await service.setAssignment(111222333n, 'GLOBAL');

    // Assert
    expect(res.success).toBe(true);
    expect(res.user?.assignedSiteId).toBeNull();
    expect(mockRepo.setAssignment).toHaveBeenCalledWith(111222333n, null);
  });

  it('assigns specific site identifier to supervisor', async () => {
    // Arrange
    const mockRepo = {
      getUserAssignment: vi.fn().mockResolvedValue(sampleUser),
      countActiveSuperAdmins: vi.fn().mockResolvedValue(2),
      setAssignment: vi.fn().mockResolvedValue({
        ...sampleUser,
        assignedSiteId: 'site-xyz',
        assignedSiteName: 'موقع العين السخنة',
      }),
    } as unknown as AdminAssignmentRepository;
    const service = new AdminAssignmentService(mockRepo);

    // Act
    const res = await service.setAssignment(111222333n, 'site-xyz');

    // Assert
    expect(res.success).toBe(true);
    expect(res.user?.assignedSiteId).toBe('site-xyz');
    expect(mockRepo.setAssignment).toHaveBeenCalledWith(111222333n, 'site-xyz');
  });

  it('rejects self-modification attempts with system security violation', async () => {
    // Arrange
    const mockRepo = {
      getUserAssignment: vi.fn().mockResolvedValue(sampleUser),
      countActiveSuperAdmins: vi.fn().mockResolvedValue(2),
      setAssignment: vi.fn(),
    } as unknown as AdminAssignmentRepository;
    const service = new AdminAssignmentService(mockRepo);

    // Act
    const res = await service.setAssignment(111222333n, 'site-xyz', 111222333n);

    // Assert
    expect(res.success).toBe(false);
    expect(res.error).toContain('أمان النظام');
    expect(mockRepo.setAssignment).not.toHaveBeenCalled();
  });

  it('rejects restricting scope of the sole active Super Admin', async () => {
    // Arrange
    const superAdminUser = {
      ...sampleUser,
      id: 'u-super',
      telegramId: 999888777n,
      role: 'SUPER_ADMIN',
    };
    const mockRepo = {
      getUserAssignment: vi.fn().mockResolvedValue(superAdminUser),
      countActiveSuperAdmins: vi.fn().mockResolvedValue(1),
      setAssignment: vi.fn(),
    } as unknown as AdminAssignmentRepository;
    const service = new AdminAssignmentService(mockRepo);

    // Act
    const res = await service.setAssignment(999888777n, 'site-xyz', 111222333n);

    // Assert
    expect(res.success).toBe(false);
    expect(res.error).toContain('المشرف العام الوحيد');
    expect(mockRepo.setAssignment).not.toHaveBeenCalled();
  });

  it('toggles freezeBotAccessOnLeave policy flag cleanly', async () => {
    // Arrange
    const mockRepo = {
      toggleFreezeBotAccessOnLeave: vi.fn().mockResolvedValue({
        ...sampleUser,
        freezeBotAccessOnLeave: false,
      }),
    } as unknown as AdminAssignmentRepository;
    const service = new AdminAssignmentService(mockRepo);

    // Act
    const res = await service.toggleFreezeBotAccess(111222333n, 999888777n);

    // Assert
    expect(res.success).toBe(true);
    expect(res.user?.freezeBotAccessOnLeave).toBe(false);
    expect(mockRepo.toggleFreezeBotAccessOnLeave).toHaveBeenCalledWith(111222333n);
  });

  it('toggles ejectTelegramOnLeave policy flag cleanly', async () => {
    // Arrange
    const mockRepo = {
      toggleEjectTelegramOnLeave: vi.fn().mockResolvedValue({
        ...sampleUser,
        ejectTelegramOnLeave: false,
      }),
    } as unknown as AdminAssignmentRepository;
    const service = new AdminAssignmentService(mockRepo);

    // Act
    const res = await service.toggleEjectTelegram(111222333n, 999888777n);

    // Assert
    expect(res.success).toBe(true);
    expect(res.user?.ejectTelegramOnLeave).toBe(false);
    expect(mockRepo.toggleEjectTelegramOnLeave).toHaveBeenCalledWith(111222333n);
  });

  it('transitions supervisor leave status with operator attribution', async () => {
    // Arrange
    const mockRepo = {
      setLeaveStatus: vi.fn().mockResolvedValue({
        ...sampleUser,
        isOnLeave: true,
        status: 'INACTIVE',
      }),
    } as unknown as AdminAssignmentRepository;
    const service = new AdminAssignmentService(mockRepo);

    // Act
    const res = await service.setLeaveStatus(111222333n, true, 999888777n, 'المدير العام');

    // Assert
    expect(res.success).toBe(true);
    expect(res.user?.isOnLeave).toBe(true);
    expect(mockRepo.setLeaveStatus).toHaveBeenCalledWith(111222333n, true, 999888777n, 'المدير العام');
  });
});
