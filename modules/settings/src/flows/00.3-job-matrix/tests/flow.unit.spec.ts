import { describe, it, expect, vi } from 'vitest';
import { JobMatrixService } from '../flow.service.js';
import type { JobMatrixRepository } from '../flow.repository.js';
import type { DepartmentDto, JobTitleDto } from '../flow.types.js';

describe('Flow 00.3 Unit Tests — JobMatrix', () => {
  const sampleDepts: DepartmentDto[] = [
    {
      id: 'd-1',
      code: 'ENG',
      name: 'الإدارة الهندسية والمشروعات',
      isActive: true,
      jobsCount: 3,
      activeJobsCount: 3,
    },
  ];

  const sampleJob: JobTitleDto = {
    id: 'j-1',
    code: 'ENG-CIVIL',
    title: 'مهندس مدني موقع',
    departmentId: 'd-1',
    departmentName: 'الإدارة الهندسية',
    departmentCode: 'ENG',
    isActive: true,
    minHeadcount: 2,
    baseSalary: 12000,
    allowance: 0,
    workDays: 30,
    restDays: 10,
    workerCount: 4,
  };

  it('should list departments correctly', async () => {
    const mockRepo = {
      listDepartments: vi.fn().mockResolvedValue(sampleDepts),
    } as unknown as JobMatrixRepository;

    const service = new JobMatrixService(mockRepo);
    const depts = await service.listDepartments();

    expect(depts).toHaveLength(1);
    expect(depts[0]!.code).toBe('ENG');
    expect(mockRepo.listDepartments).toHaveBeenCalledTimes(1);
  });

  it('should update job headcount delta', async () => {
    const mockRepo = {
      updateJobHeadcountDelta: vi.fn().mockResolvedValue({
        ...sampleJob,
        minHeadcount: 3,
      }),
    } as unknown as JobMatrixRepository;

    const service = new JobMatrixService(mockRepo);
    const updated = await service.updateHeadcountDelta('j-1', 1);

    expect(updated.minHeadcount).toBe(3);
    expect(mockRepo.updateJobHeadcountDelta).toHaveBeenCalledWith('j-1', 1);
  });

  it('should toggle job active status', async () => {
    const mockRepo = {
      toggleJobActive: vi.fn().mockResolvedValue({
        ...sampleJob,
        isActive: false,
      }),
    } as unknown as JobMatrixRepository;

    const service = new JobMatrixService(mockRepo);
    const updated = await service.toggleJobActive('j-1');

    expect(updated.isActive).toBe(false);
    expect(mockRepo.toggleJobActive).toHaveBeenCalledWith('j-1');
  });

  it('should update job cycle work and rest days', async () => {
    const mockRepo = {
      updateJobCycle: vi.fn().mockResolvedValue({
        ...sampleJob,
        workDays: 40,
        restDays: 10,
      }),
    } as unknown as JobMatrixRepository;

    const service = new JobMatrixService(mockRepo);
    const updated = await service.updateJobCycle('j-1', 40, 10);

    expect(updated.workDays).toBe(40);
    expect(updated.restDays).toBe(10);
    expect(mockRepo.updateJobCycle).toHaveBeenCalledWith('j-1', 40, 10);
  });
});
