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
});
