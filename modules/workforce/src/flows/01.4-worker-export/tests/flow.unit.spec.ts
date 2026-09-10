import { describe, it, expect, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { WorkerExportService } from '../flow.service.js';
import { WorkerExportRepository } from '../flow.repository.js';
import type { WorkerExportEntity } from '../flow.types.js';

describe('Flow 01.4 Unit Tests — Worker Export & Template Service', () => {
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

  const mockRepo = {
    getActiveJobs: vi.fn().mockResolvedValue([
      { id: 'job-1', name: 'سائق لودر ومعدات ثقيلة', code: 'OP-DRV' },
      { id: 'job-2', name: 'عامل تشغيل وخدمات', code: 'OP-SRV' },
    ]),
    getActiveSites: vi.fn().mockResolvedValue([
      { id: 'site-1', name: 'موقع السباعية', code: 'SBY-01' },
    ]),
    getDepartments: vi.fn().mockResolvedValue([
      { id: 'dept-1', name: 'إدارة التشغيل والمعدات', code: 'OP' },
    ]),
    getDepartmentById: vi.fn().mockImplementation((id: string) =>
      Promise.resolve({ id, name: 'إدارة التشغيل والمعدات', code: 'OP' })
    ),
    getJobTitleById: vi.fn().mockImplementation((id: string) =>
      Promise.resolve({ id, name: 'سائق لودر ومعدات ثقيلة', code: 'OP-DRV' })
    ),
    getWorkersForExport: vi.fn().mockImplementation((where: { departmentId?: string; jobTitleId?: string; governorateCode?: string }) => {
      if (where.jobTitleId) {
        return Promise.resolve(mockWorkers.filter((w) => w.jobTitleId === where.jobTitleId));
      }
      if (where.governorateCode) {
        return Promise.resolve(mockWorkers.filter((w) => w.governorateCode === where.governorateCode));
      }
      if (where.departmentId) {
        return Promise.resolve(mockWorkers.filter((w) => w.departmentId === where.departmentId));
      }
      return Promise.resolve(mockWorkers);
    }),
    saveImportedWorkersAtomic: vi.fn(),
  } as unknown as WorkerExportRepository;

  const service = new WorkerExportService(mockRepo);

  it('should generate template Excel buffer with code guide sheet', async () => {
    const buffer = await service.generateTemplateBuffer();
    expect(buffer).toBeDefined();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

    const dataSheet = workbook.getWorksheet('بيانات العمال الجدد');
    expect(dataSheet).toBeDefined();

    const refSheet = workbook.getWorksheet('دليل الأكواد المعتمدة');
    expect(refSheet).toBeDefined();
    expect(refSheet?.getCell('A2').value).toBe('OP-DRV');
    expect(refSheet?.getCell('D2').value).toBe('SBY-01');
  });

  it('should generate FULL workers export with 43 columns for Super Admin', async () => {
    const result = await service.generateWorkersExportBuffer({ type: 'ALL' }, true);
    expect(result.workerCount).toBe(2);
    expect(result.fileName).toBe('كشف_العاملين_الشامل.xlsx');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const sheet = workbook.getWorksheet('كشف العاملين');
    expect(sheet).toBeDefined();

    const headerRow = sheet?.getRow(4);
    const headers: string[] = [];
    headerRow?.eachCell((cell) => headers.push(cell.text));

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

  it('should STRICTLY MASK and OMIT all financial columns (32 columns) for regular Admin', async () => {
    const result = await service.generateWorkersExportBuffer({ type: 'ALL' }, false);
    expect(result.workerCount).toBe(2);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const sheet = workbook.getWorksheet('كشف العاملين');
    expect(sheet).toBeDefined();

    const headerRow = sheet?.getRow(4);
    const headers: string[] = [];
    headerRow?.eachCell((cell) => headers.push(cell.text));

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

  it('should filter export by department', async () => {
    const result = await service.generateWorkersExportBuffer(
      { type: 'DEPARTMENT', departmentId: 'dept-1' },
      true
    );
    expect(result.filterLabel).toContain('قسم: إدارة التشغيل والمعدات');
    expect(result.fileName).toContain('قسم_إدارة_التشغيل_والمعدات');
  });

  it('should filter export by job title', async () => {
    const result = await service.generateWorkersExportBuffer(
      { type: 'JOB_TITLE', jobTitleId: 'job-1' },
      true
    );
    expect(result.filterLabel).toContain('مهنة: سائق لودر ومعدات ثقيلة');
    expect(result.workerCount).toBe(1);
  });

  it('should filter export by governorate', async () => {
    const result = await service.generateWorkersExportBuffer(
      { type: 'GOVERNORATE', governorateCode: '27' },
      false
    );
    expect(result.filterLabel).toContain('محافظة: قنا');
    expect(result.workerCount).toBe(1);
  });
});
