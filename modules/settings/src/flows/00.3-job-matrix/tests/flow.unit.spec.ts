import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JobMatrixService } from '../flow.service.js';
import type { JobMatrixRepository } from '../flow.repository.js';
import type { DepartmentDto, JobTitleDto } from '../flow.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.3 Unit Tests — JobMatrix', () => {
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
    allowance: 3000,
    workDays: 30,
    restDays: 10,
    workerCount: 4,
  };

  it('lists departments and validates entity structure', async () => {
    // Arrange
    const mockRepo = {
      listDepartments: vi.fn().mockResolvedValue(sampleDepts),
    } as unknown as JobMatrixRepository;
    const service = new JobMatrixService(mockRepo);

    // Act
    const depts = await service.listDepartments();

    // Assert
    expect(depts).toHaveLength(1);
    expect(depts[0]?.code).toBe('ENG');
    expect(mockRepo.listDepartments).toHaveBeenCalledTimes(1);
  });

  it('updates job headcount delta correctly', async () => {
    // Arrange
    const mockRepo = {
      updateJobHeadcountDelta: vi.fn().mockResolvedValue({
        ...sampleJob,
        minHeadcount: 3,
      }),
    } as unknown as JobMatrixRepository;
    const service = new JobMatrixService(mockRepo);

    // Act
    const updated = await service.updateHeadcountDelta('j-1', 1);

    // Assert
    expect(updated.minHeadcount).toBe(3);
    expect(mockRepo.updateJobHeadcountDelta).toHaveBeenCalledWith('j-1', 1);
  });

  it('toggles job active status between states', async () => {
    // Arrange
    const mockRepo = {
      toggleJobActive: vi.fn().mockResolvedValue({
        ...sampleJob,
        isActive: false,
      }),
    } as unknown as JobMatrixRepository;
    const service = new JobMatrixService(mockRepo);

    // Act
    const updated = await service.toggleJobActive('j-1');

    // Assert
    expect(updated.isActive).toBe(false);
    expect(mockRepo.toggleJobActive).toHaveBeenCalledWith('j-1');
  });

  it('updates job cycle work and rest days configuration', async () => {
    // Arrange
    const mockRepo = {
      updateJobCycle: vi.fn().mockResolvedValue({
        ...sampleJob,
        workDays: 40,
        restDays: 10,
      }),
    } as unknown as JobMatrixRepository;
    const service = new JobMatrixService(mockRepo);

    // Act
    const updated = await service.updateJobCycle('j-1', 40, 10);

    // Assert
    expect(updated.workDays).toBe(40);
    expect(updated.restDays).toBe(10);
    expect(mockRepo.updateJobCycle).toHaveBeenCalledWith('j-1', 40, 10);
  });

  it('parses and imports valid Excel matrix buffer successfully with additionalSalary', async () => {
    // Arrange
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('دليل الأقسام والوظائف');

    worksheet.columns = [
      { header: 'كود القسم *', key: 'deptCode', width: 16 },
      { header: 'اسم القسم الوظيفي *', key: 'deptName', width: 28 },
      { header: 'كود الوظيفة *', key: 'jobCode', width: 16 },
      { header: 'المسمى الوظيفي *', key: 'jobTitle', width: 32 },
      { header: 'الراتب الأساسي (ج.م)', key: 'baseSalary', width: 20 },
      { header: 'الراتب الإضافي (ج.م)', key: 'additionalSalary', width: 20 },
      { header: 'أيام العمل بالموقع (W)', key: 'workDays', width: 20 },
      { header: 'أيام الراحة والإجازة (R)', key: 'restDays', width: 20 },
      { header: 'حد كفاية الموقع', key: 'minHeadcount', width: 18 },
    ];

    worksheet.addRow({
      deptCode: 'OP',
      deptName: 'إدارة التشغيل والمعدات',
      jobCode: 'OP-LDR',
      jobTitle: 'سائق لودر',
      baseSalary: 9000,
      additionalSalary: 3000,
      workDays: 20,
      restDays: 10,
      minHeadcount: 6,
    });

    const uint8 = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(uint8);

    const mockRepo = {
      importMatrixRowsAtomic: vi.fn().mockResolvedValue({
        departmentsUpserted: 1,
        jobsUpserted: 1,
      }),
    } as unknown as JobMatrixRepository;
    const service = new JobMatrixService(mockRepo);

    // Act
    const result = await service.parseAndImportExcel(buffer);

    // Assert
    expect(result.success).toBe(true);
    expect(result.departmentsUpserted).toBe(1);
    expect(result.jobsUpserted).toBe(1);
    expect(mockRepo.importMatrixRowsAtomic).toHaveBeenCalledTimes(1);
    expect(mockRepo.importMatrixRowsAtomic).toHaveBeenCalledWith([
      expect.objectContaining({
        deptCode: 'OP',
        deptName: 'إدارة التشغيل والمعدات',
        jobCode: 'OP-LDR',
        jobTitle: 'سائق لودر',
        baseSalary: 9000,
        additionalSalary: 3000,
        workDays: 20,
        restDays: 10,
        minHeadcount: 6,
      }),
    ]);
  });

  it('rejects Excel file with missing additionalSalary header or shifted columns', async () => {
    // Arrange
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('دليل الأقسام والوظائف');

    worksheet.columns = [
      { header: 'كود القسم *', key: 'deptCode', width: 16 },
      { header: 'اسم القسم الوظيفي *', key: 'deptName', width: 28 },
      { header: 'كود الوظيفة *', key: 'jobCode', width: 16 },
      { header: 'المسمى الوظيفي *', key: 'jobTitle', width: 32 },
      { header: 'الراتب الأساسي (ج.م)', key: 'baseSalary', width: 20 },
      { header: 'أيام العمل بالموقع (W)', key: 'workDays', width: 20 },
      { header: 'أيام الراحة والإجازة (R)', key: 'restDays', width: 20 },
      { header: 'حد كفاية الموقع', key: 'minHeadcount', width: 18 },
    ];

    worksheet.addRow({
      deptCode: 'OP',
      deptName: 'إدارة التشغيل والمعدات',
      jobCode: 'OP-LDR',
      jobTitle: 'سائق لودر',
      baseSalary: 9000,
      workDays: 20,
      restDays: 10,
      minHeadcount: 6,
    });

    const uint8 = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(uint8);

    const mockRepo = {
      importMatrixRowsAtomic: vi.fn(),
    } as unknown as JobMatrixRepository;
    const service = new JobMatrixService(mockRepo);

    // Act
    const result = await service.parseAndImportExcel(buffer);

    // Assert
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('عناوين أعمدة ملف الإكسيل غير مطابقة للقالب الرسمي المعتمد');
    expect(mockRepo.importMatrixRowsAtomic).not.toHaveBeenCalled();
  });

  it('rejects rows with out of bounds workDays or restDays', async () => {
    // Arrange
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('دليل الأقسام والوظائف');

    worksheet.columns = [
      { header: 'كود القسم *', key: 'deptCode', width: 16 },
      { header: 'اسم القسم الوظيفي *', key: 'deptName', width: 28 },
      { header: 'كود الوظيفة *', key: 'jobCode', width: 16 },
      { header: 'المسمى الوظيفي *', key: 'jobTitle', width: 32 },
      { header: 'الراتب الأساسي (ج.م)', key: 'baseSalary', width: 20 },
      { header: 'الراتب الإضافي (ج.م)', key: 'additionalSalary', width: 20 },
      { header: 'أيام العمل بالموقع (W)', key: 'workDays', width: 20 },
      { header: 'أيام الراحة والإجازة (R)', key: 'restDays', width: 20 },
      { header: 'حد كفاية الموقع', key: 'minHeadcount', width: 18 },
    ];

    worksheet.addRow({
      deptCode: 'OP',
      deptName: 'إدارة التشغيل',
      jobCode: 'OP-DOZ',
      jobTitle: 'سائق بلدوزر',
      baseSalary: 9000,
      additionalSalary: 2000,
      workDays: 3000,
      restDays: 10,
      minHeadcount: 2,
    });

    const uint8 = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(uint8);

    const mockRepo = {
      importMatrixRowsAtomic: vi.fn(),
    } as unknown as JobMatrixRepository;
    const service = new JobMatrixService(mockRepo);

    // Act
    const result = await service.parseAndImportExcel(buffer);

    // Assert
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('أيام العمل غير منطقية'))).toBe(true);
    expect(mockRepo.importMatrixRowsAtomic).not.toHaveBeenCalled();
  });

  it('handles corrupt or non-excel buffer gracefully', async () => {
    // Arrange
    const corruptBuffer = Buffer.from('not an excel file');
    const mockRepo = {
      importMatrixRowsAtomic: vi.fn(),
    } as unknown as JobMatrixRepository;
    const service = new JobMatrixService(mockRepo);

    // Act
    const result = await service.parseAndImportExcel(corruptBuffer);

    // Assert
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(mockRepo.importMatrixRowsAtomic).not.toHaveBeenCalled();
  });

  it('delegates base and additional salary updates with policy correctly', async () => {
    // Arrange
    const mockRepo = {
      updateJobBaseSalaryWithPolicy: vi.fn().mockResolvedValue({
        affectedWorkers: [{ id: 'w-1', code: 'OP-01', name: 'عامل 1', telegramId: BigInt(123) }],
        job: sampleJob,
      }),
      updateJobAdditionalSalaryWithPolicy: vi.fn().mockResolvedValue({
        affectedWorkers: [],
        job: sampleJob,
      }),
    } as unknown as JobMatrixRepository;
    const service = new JobMatrixService(mockRepo);

    // Act
    const resBase = await service.updateJobBaseSalaryWithPolicy('j-1', 14000, 'ALL_ACTIVE_WORKERS', BigInt(999));
    const resAdd = await service.updateJobAdditionalSalaryWithPolicy('j-1', 4000, 'NEW_HIRES_ONLY', BigInt(999));

    // Assert
    expect(mockRepo.updateJobBaseSalaryWithPolicy).toHaveBeenCalledWith('j-1', 14000, 'ALL_ACTIVE_WORKERS', BigInt(999));
    expect(resBase.affectedWorkers).toHaveLength(1);
    expect(mockRepo.updateJobAdditionalSalaryWithPolicy).toHaveBeenCalledWith('j-1', 4000, 'NEW_HIRES_ONLY', BigInt(999));
    expect(resAdd.affectedWorkers).toHaveLength(0);
  });

  it('delegates shift cycle policy updates correctly', async () => {
    // Arrange
    const mockRepo = {
      updateJobCycleWithPolicy: vi.fn().mockResolvedValue({
        affectedWorkersCount: 4,
        job: sampleJob,
      }),
    } as unknown as JobMatrixRepository;
    const service = new JobMatrixService(mockRepo);

    // Act
    const res = await service.updateJobCycleWithPolicy('j-1', 24, 6, 'NEXT_CYCLE', BigInt(888));

    // Assert
    expect(mockRepo.updateJobCycleWithPolicy).toHaveBeenCalledWith('j-1', 24, 6, 'NEXT_CYCLE', BigInt(888));
    expect(res.affectedWorkersCount).toBe(4);
  });
});
