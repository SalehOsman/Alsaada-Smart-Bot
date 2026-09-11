import { describe, it, expect, vi } from 'vitest';
import { AdminAssignmentService } from '../flow.service.js';
import type { AdminAssignmentRepository } from '../flow.repository.js';
import type { AdminAssignmentDto } from '../flow.types.js';

describe('Flow 00.5 Unit Tests — AdminAssignment', () => {
  const sampleUser: AdminAssignmentDto = {
    id: 'u-1',
    telegramId: 111222333n,
    fullName: 'المهندس أحمد ممدوح',
    role: 'FIELD_ADMIN',
    assignedSiteId: 's-1',
    assignedSiteName: 'موقع السويس',
  };

  it('should list admin users correctly', async () => {
    const mockRepo = {
      listAdminUsers: vi.fn().mockResolvedValue([sampleUser]),
    } as unknown as AdminAssignmentRepository;

    const service = new AdminAssignmentService(mockRepo);
    const users = await service.listAdminUsers();

    expect(users).toHaveLength(1);
    expect(users[0]!.fullName).toBe('المهندس أحمد ممدوح');
    expect(mockRepo.listAdminUsers).toHaveBeenCalledTimes(1);
  });

  it('should set global assignment when GLOBAL passed', async () => {
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
    const res = await service.setAssignment(111222333n, 'GLOBAL');

    expect(res.success).toBe(true);
    expect(res.user?.assignedSiteId).toBeNull();
    expect(mockRepo.setAssignment).toHaveBeenCalledWith(111222333n, null);
  });

  it('should set site assignment for specific site ID', async () => {
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
    const res = await service.setAssignment(111222333n, 'site-xyz');

    expect(res.success).toBe(true);
    expect(res.user?.assignedSiteId).toBe('site-xyz');
    expect(mockRepo.setAssignment).toHaveBeenCalledWith(111222333n, 'site-xyz');
  });

  it('should reject self-modification with security error', async () => {
    const mockRepo = {
      getUserAssignment: vi.fn().mockResolvedValue(sampleUser),
      countActiveSuperAdmins: vi.fn().mockResolvedValue(2),
      setAssignment: vi.fn(),
    } as unknown as AdminAssignmentRepository;

    const service = new AdminAssignmentService(mockRepo);
    // Actor is trying to modify their own assignment
    const res = await service.setAssignment(111222333n, 'site-xyz', 111222333n);

    expect(res.success).toBe(false);
    expect(res.error).toContain('أمان النظام');
    expect(mockRepo.setAssignment).not.toHaveBeenCalled();
  });

  it('should reject restricting the last standing Super Admin', async () => {
    const superAdminUser = {
      ...sampleUser,
      id: 'u-super',
      telegramId: 999888777n,
      role: 'SUPER_ADMIN',
    };

    const mockRepo = {
      getUserAssignment: vi.fn().mockResolvedValue(superAdminUser),
      // Only 1 active super admin exists!
      countActiveSuperAdmins: vi.fn().mockResolvedValue(1),
      setAssignment: vi.fn(),
    } as unknown as AdminAssignmentRepository;

    const service = new AdminAssignmentService(mockRepo);
    const res = await service.setAssignment(999888777n, 'site-xyz', 111222333n);

    expect(res.success).toBe(false);
    expect(res.error).toContain('المشرف العام الوحيد');
    expect(mockRepo.setAssignment).not.toHaveBeenCalled();
  });
});

