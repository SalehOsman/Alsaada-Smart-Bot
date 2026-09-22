import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ExcelJS from 'exceljs';
import { WorkerExportService } from '../flow.service.js';
import { WorkerExportRepository } from '../flow.repository.js';
import type { WorkerExportEntity } from '../flow.types.js';

describe('Flow 01.4 Unit Tests — Worker Export & Template Service', () => {
  const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

  const mockWorkers: WorkerExportEntity[] = [
    {
      id: 'wrk-1',
      code: 'OP-DRV-0001',
      legacyCode: 'OLD-101',
      fullName: 'أحمد محمود علي إبراهيم',
      nickname: 'أبو حميد',
      nationalIdEncrypted: '29001012701234',
      idType: 'NATIONAL_ID',
      nationality: 'مصري',
      birthDate: new Date('1990-01-01'),
      gender: 'MALE',
      governorateCode: '27',
      jobTitle: 'سائق لودر ومعدات ثقيلة',
      departmentId: 'dept-1',
      jobTitleId: 'job-1',
      siteId: 'site-1',
      hireDate: new Date('2023-01-15'),
      contractType: 'PERMANENT',
      shiftSystem: 'دورة 30+10',
      dailyWage: 250,
      basicSalary: 7500,
      fixedAllowances: 1500,
      paymentMethod: 'VODAFONE_CASH',
      walletType: 'فودافون كاش',
      accountNumberEncrypted: '01011112222',
      canteenCigarettePolicy: 'ONE_PACK_DAILY',
      phoneEncrypted: '01012345678',
      emergencyPhoneEncrypted: '01098765432',
      emergencyContactName: 'محمود علي (شقيق)',
      drivingLicense: 'درجة أولى',
      militaryStatus: 'أدى الخدمة قدوة حسنة',
      maritalStatus: 'متزوج',
      idCardExpiryDate: new Date('2028-05-26'),
      address: 'قنا - قوص',
      status: 'ACTIVE',
      site: { id: 'site-1', name: 'موقع السباعية' },
      department: { id: 'dept-1', name: 'إدارة التشغيل والمعدات' },
      jobRef: { id: 'job-1', name: 'سائق لودر ومعدات ثقيلة' },
    },
    {
      id: 'wrk-2',
      code: 'OP-SRV-0002',
      legacyCode: null,
      fullName: 'مصطفى كمال الدين حسن',
      nickname: null,
      nationalIdEncrypted: '29508202801234',
      idType: 'NATIONAL_ID',
      nationality: 'مصري',
      birthDate: new Date('1995-08-20'),
      gender: 'MALE',
      governorateCode: '28',
      jobTitle: 'عامل تشغيل وخدمات',
      departmentId: 'dept-1',
      jobTitleId: 'job-2',
      siteId: 'site-1',
      hireDate: new Date('2024-02-01'),
      contractType: 'PERMANENT',
      shiftSystem: 'دورة 24+6',
      dailyWage: 200,
      basicSalary: 6000,
      fixedAllowances: 1000,
      paymentMethod: 'CASH_SITE',
      walletType: null,
      accountNumberEncrypted: null,
      canteenCigarettePolicy: 'NONE',
      phoneEncrypted: '01122334455',
      emergencyPhoneEncrypted: null,
      emergencyContactName: null,
      drivingLicense: 'لا يوجد',
      militaryStatus: 'إعفاء نهائي',
      maritalStatus: 'أعزب',
      idCardExpiryDate: new Date('2029-05-10'),
      address: 'أسوان - دراو',
      status: 'ACTIVE',
      site: { id: 'site-1', name: 'موقع السباعية' },
      department: { id: 'dept-1', name: 'إدارة التشغيل والمعدات' },
      jobRef: { id: 'job-2', name: 'عامل تشغيل وخدمات' },
    },
  ];

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('generates template Excel buffer with code guide sheet', async () => {
    // Arrange
    const mockRepo = {
      getActiveJobs: vi.fn().mockResolvedValue([
        { id: 'job-1', name: 'سائق لودر ومعدات ثقيلة', code: 'OP-DRV' },
      ]),
      getActiveSites: vi.fn().mockResolvedValue([
        { id: 'site-1', name: 'موقع السباعية', code: 'SBY-01' },
      ]),
      getDepartments: vi.fn().mockResolvedValue([]),
    } as unknown as WorkerExportRepository;

    const service = new WorkerExportService(mockRepo);

    // Act
    const buffer = await service.generateTemplateBuffer();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

    const dataSheet = workbook.getWorksheet('بيانات العمال الجدد');
    const refSheet = workbook.getWorksheet('دليل الأكواد المعتمدة');

    // Assert
    expect(buffer).toBeDefined();
    expect(dataSheet).toBeDefined();
    expect(refSheet).toBeDefined();
    expect(refSheet?.getCell('A2').value).toBe('OP-DRV');
    expect(refSheet?.getCell('D2').value).toBe('SBY-01');
  });

  it('generates FULL workers export with 43 columns for Super Admin including compensation fields', async () => {
    // Arrange
    const mockRepo = {
      getActiveJobs: vi.fn().mockResolvedValue([]),
      getActiveSites: vi.fn().mockResolvedValue([]),
      getDepartments: vi.fn().mockResolvedValue([]),
      getDepartmentById: vi.fn().mockResolvedValue(null),
      getJobTitleById: vi.fn().mockResolvedValue(null),
      getWorkersForExport: vi.fn().mockResolvedValue(mockWorkers),
    } as unknown as WorkerExportRepository;

    const service = new WorkerExportService(mockRepo);

    // Act
    const result = await service.generateWorkersExportBuffer({ type: 'ALL' }, true);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const sheet = workbook.getWorksheet('كشف العاملين');
    const headerRow = sheet?.getRow(4);
    const headers: string[] = [];
    headerRow?.eachCell((cell) => headers.push(cell.text));

    // Assert
    expect(result.workerCount).toBe(2);
    expect(result.fileName).toBe('كشف_العاملين_الشامل.xlsx');
    expect(sheet).toBeDefined();
    expect(headers.length).toBe(43);
    expect(headers).toContain('الأجر اليومي (ج.م)');
    expect(headers).toContain('الراتب الأساسي (ج.م)');
    expect(headers).toContain('الراتب الإضافي (ج.م)');
    expect(headers).toContain('إجمالي الاستحقاق الشهري (ج.م)');
    expect(headers).toContain('رقم الحساب / المحفظة');
    expect(headers).toContain('اسم صاحب المحفظة');
    expect(headers).toContain('معرف إنستاباي');
    expect(headers).toContain('صنف السجائر المعتمد');
  });

  it('strictly masks and omits all financial columns for regular Admin yielding 32 columns', async () => {
    // Arrange
    const mockRepo = {
      getActiveJobs: vi.fn().mockResolvedValue([]),
      getActiveSites: vi.fn().mockResolvedValue([]),
      getDepartments: vi.fn().mockResolvedValue([]),
      getDepartmentById: vi.fn().mockResolvedValue(null),
      getJobTitleById: vi.fn().mockResolvedValue(null),
      getWorkersForExport: vi.fn().mockResolvedValue(mockWorkers),
    } as unknown as WorkerExportRepository;

    const service = new WorkerExportService(mockRepo);

    // Act
    const result = await service.generateWorkersExportBuffer({ type: 'ALL' }, false);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const sheet = workbook.getWorksheet('كشف العاملين');
    const headerRow = sheet?.getRow(4);
    const headers: string[] = [];
    headerRow?.eachCell((cell) => headers.push(cell.text));

    // Assert
    expect(result.workerCount).toBe(2);
    expect(sheet).toBeDefined();
    expect(headers.length).toBe(32);
    expect(headers).toContain('وحدة السكن / العنبر');
    expect(headers).toContain('الرقم التأميني');
    expect(headers).toContain('الموقف التأميني');
    expect(headers).toContain('مقاس السيفتي');
    expect(headers).toContain('مقاس الزي');
    expect(headers).toContain('ملاحظات طبية');
    expect(headers.some((h) => h.includes('الراتب'))).toBe(false);
    expect(headers.some((h) => h.includes('الأجر'))).toBe(false);
    expect(headers.some((h) => h.includes('البدلات'))).toBe(false);
    expect(headers.some((h) => h.includes('المحفظة'))).toBe(false);
  });

  it('filters export by department accurately', async () => {
    // Arrange
    const mockRepo = {
      getActiveJobs: vi.fn().mockResolvedValue([]),
      getActiveSites: vi.fn().mockResolvedValue([]),
      getDepartments: vi.fn().mockResolvedValue([]),
      getDepartmentById: vi.fn().mockResolvedValue({ id: 'dept-1', name: 'إدارة التشغيل والمعدات', code: 'OP' }),
      getJobTitleById: vi.fn().mockResolvedValue(null),
      getWorkersForExport: vi.fn().mockResolvedValue(mockWorkers.filter((w) => w.departmentId === 'dept-1')),
    } as unknown as WorkerExportRepository;

    const service = new WorkerExportService(mockRepo);

    // Act
    const result = await service.generateWorkersExportBuffer(
      { type: 'DEPARTMENT', departmentId: 'dept-1' },
      true
    );

    // Assert
    expect(result.filterLabel).toContain('قسم: إدارة التشغيل والمعدات');
    expect(result.fileName).toContain('قسم_إدارة_التشغيل_والمعدات');
    expect(result.workerCount).toBe(2);
  });

  it('filters export by job title accurately', async () => {
    // Arrange
    const mockRepo = {
      getActiveJobs: vi.fn().mockResolvedValue([]),
      getActiveSites: vi.fn().mockResolvedValue([]),
      getDepartments: vi.fn().mockResolvedValue([]),
      getDepartmentById: vi.fn().mockResolvedValue(null),
      getJobTitleById: vi.fn().mockResolvedValue({ id: 'job-1', name: 'سائق لودر ومعدات ثقيلة', code: 'OP-DRV' }),
      getWorkersForExport: vi.fn().mockResolvedValue(mockWorkers.filter((w) => w.jobTitleId === 'job-1')),
    } as unknown as WorkerExportRepository;

    const service = new WorkerExportService(mockRepo);

    // Act
    const result = await service.generateWorkersExportBuffer(
      { type: 'JOB_TITLE', jobTitleId: 'job-1' },
      true
    );

    // Assert
    expect(result.filterLabel).toContain('مهنة: سائق لودر ومعدات ثقيلة');
    expect(result.workerCount).toBe(1);
  });

  it('filters export by governorate accurately', async () => {
    // Arrange
    const mockRepo = {
      getActiveJobs: vi.fn().mockResolvedValue([]),
      getActiveSites: vi.fn().mockResolvedValue([]),
      getDepartments: vi.fn().mockResolvedValue([]),
      getDepartmentById: vi.fn().mockResolvedValue(null),
      getJobTitleById: vi.fn().mockResolvedValue(null),
      getWorkersForExport: vi.fn().mockResolvedValue(mockWorkers.filter((w) => w.governorateCode === '27')),
    } as unknown as WorkerExportRepository;

    const service = new WorkerExportService(mockRepo);

    // Act
    const result = await service.generateWorkersExportBuffer(
      { type: 'GOVERNORATE', governorateCode: '27' },
      false
    );

    // Assert
    expect(result.filterLabel).toContain('محافظة: قنا');
    expect(result.workerCount).toBe(1);
  });
});
