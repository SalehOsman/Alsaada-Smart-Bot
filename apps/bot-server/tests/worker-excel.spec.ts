import { describe, it, expect, vi, beforeEach } from 'vitest';
import { workerExcelService, setWorkforcePrisma } from '@alsaada/workforce';
import { prisma } from '../src/db.js';
import ExcelJS from 'exceljs';

const mockWorkersList = [
  {
    id: 'w-1',
    code: 'OP-DRV-0001',
    legacyCode: '101',
    name: 'أحمد محمود علي إبراهيم',
    nickname: 'أبو حميد',
    idType: 'NATIONAL_ID',
    nationalIdEncrypted: 'mock-nid-1',
    birthDate: new Date('1990-05-15'),
    gender: 'MALE',
    governorateCode: '27',
    jobTitle: 'سائق لودر ومعدات ثقيلة',
    departmentId: 'dept-1',
    jobTitleId: 'job-1',
    siteId: 'site-1',
    hireDate: new Date('2024-01-01'),
    contractType: 'DAILY_LABOR',
    shiftSystem: 'دورة 20+10',
    dailyWage: 250,
    basicSalary: 7500,
    fixedAllowances: 1500,
    paymentMethod: 'VODAFONE_CASH',
    walletType: 'محفظة فودافون كاش',
    accountNumberEncrypted: 'mock-acc-1',
    canteenCigarettePolicy: 'ONE_PACK_DAILY',
    phoneEncrypted: 'mock-phone-1',
    emergencyPhoneEncrypted: 'mock-em-1',
    emergencyContactName: 'محمود علي (الأب)',
    drivingLicense: 'مهنية ثانية',
    militaryStatus: 'أدى الخدمة',
    maritalStatus: 'متزوج',
    idCardExpiryDate: new Date('2028-10-20'),
    address: 'قنا - مركز قوص',
    status: 'ACTIVE',
    isDeleted: false,
    site: { id: 'site-1', name: 'موقع السباعية' },
    department: { id: 'dept-1', name: 'إدارة التشغيل والمعدات' },
    jobRef: { id: 'job-1', name: 'سائق لودر ومعدات ثقيلة' },
  },
  {
    id: 'w-2',
    code: 'OP-HLP-0002',
    legacyCode: '102',
    name: 'خالد عبد الله حسن',
    nickname: 'خالد',
    idType: 'NATIONAL_ID',
    nationalIdEncrypted: 'mock-nid-2',
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
    walletType: '',
    accountNumberEncrypted: '',
    canteenCigarettePolicy: 'NONE',
    phoneEncrypted: 'mock-phone-2',
    emergencyPhoneEncrypted: '',
    emergencyContactName: '',
    drivingLicense: 'لا يوجد',
    militaryStatus: 'إعفاء نهائي',
    maritalStatus: 'أعزب',
    idCardExpiryDate: new Date('2029-05-10'),
    address: 'أسوان - دراو',
    status: 'ACTIVE',
    isDeleted: false,
    site: { id: 'site-1', name: 'موقع السباعية' },
    department: { id: 'dept-1', name: 'إدارة التشغيل والمعدات' },
    jobRef: { id: 'job-2', name: 'عامل تشغيل وخدمات' },
  },
];

vi.mock('../src/db.js', () => ({
  prisma: {
    department: {
      findUnique: vi.fn().mockImplementation(({ where }) =>
        Promise.resolve({ id: where.id, name: 'إدارة التشغيل والمعدات', code: 'OP' })
      ),
      findMany: vi.fn().mockResolvedValue([
        { id: 'dept-1', name: 'إدارة التشغيل والمعدات', code: 'OP', order: 1 },
      ]),
    },
    jobTitle: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'job-1',
          code: 'DRV',
          name: 'سائق لودر ومعدات ثقيلة',
          baseSalary: 8000,
          additionalSalary: 2000,
          departmentId: 'dept-1',
          department: { code: 'OP', name: 'إدارة التشغيل والمعدات', order: 1 },
        },
        {
          id: 'job-2',
          code: 'HLP',
          name: 'عامل تشغيل وخدمات',
          baseSalary: 6000,
          additionalSalary: 1000,
          departmentId: 'dept-1',
          department: { code: 'OP', name: 'إدارة التشغيل والمعدات', order: 1 },
        },
      ]),
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.id === 'job-1') {
          return Promise.resolve({
            id: 'job-1',
            code: 'DRV',
            name: 'سائق لودر ومعدات ثقيلة',
            baseSalary: 8000,
            additionalSalary: 2000,
            departmentId: 'dept-1',
            department: { code: 'OP', name: 'إدارة التشغيل والمعدات', order: 1 },
          });
        }
        return Promise.resolve({
          id: 'job-2',
          code: 'HLP',
          name: 'عامل تشغيل وخدمات',
          baseSalary: 6000,
          additionalSalary: 1000,
          departmentId: 'dept-1',
          department: { code: 'OP', name: 'إدارة التشغيل والمعدات', order: 1 },
        });
      }),
    },
    site: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'site-1',
          code: 'STE-01',
          name: 'موقع محجر الفوسفات - السباعية',
          project: { name: 'مشروع الفوسفات' },
        },
      ]),
    },
    worker: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockImplementation((args) => {
        if (args?.where?.jobTitleId) {
          return Promise.resolve(mockWorkersList.filter((w) => w.jobTitleId === args.where.jobTitleId));
        }
        if (args?.where?.governorateCode) {
          return Promise.resolve(mockWorkersList.filter((w) => w.governorateCode === args.where.governorateCode));
        }
        if (args?.where?.departmentId) {
          return Promise.resolve(mockWorkersList.filter((w) => w.departmentId === args.where.departmentId));
        }
        return Promise.resolve(mockWorkersList);
      }),
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'wrk-1',
          code: data.code,
          name: data.name,
          site: { name: 'موقع السباعية' },
        })
      ),
    },
  },
}));

vi.mock('../src/services/fast-cache.service.js', () => ({
  fastCache: {
    invalidate: vi.fn().mockResolvedValue(undefined),
    rememberSWR: vi.fn().mockImplementation((_k, _t, fetcher) => fetcher()),
  },
}));

describe('Worker Excel Service — Template Generation & Bulk Import', () => {
  beforeEach(() => {
    setWorkforcePrisma(prisma);
  });

  it('should generate template buffer with 2 sheets (Workers Entry and Reference Codes)', async () => {
    const buffer = await workerExcelService.generateTemplateBuffer();
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(1000);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    expect(workbook.worksheets.length).toBe(2);
    expect(workbook.worksheets[0]?.name).toBe('بيانات العمال الجدد');
    expect(workbook.worksheets[1]?.name).toBe('دليل الأكواد المعتمدة');

    const sheet1 = workbook.worksheets[0]!;
    const headerRow = sheet1.getRow(1);
    expect(headerRow.getCell(1).text).toContain('الاسم الرباعي');
    expect(headerRow.getCell(3).text).toContain('كود العامل القديم');
    expect(headerRow.getCell(4).text).toContain('نوع الإثبات');

    const sheet2 = workbook.worksheets[1]!;
    expect(sheet2.rowCount).toBeGreaterThan(1);
  });

  it('should reject file with invalid format or no workers', async () => {
    const emptyWorkbook = new ExcelJS.Workbook();
    emptyWorkbook.addWorksheet('ورقة فارغة');
    const emptyBuffer = (await emptyWorkbook.xlsx.writeBuffer()) as unknown as Buffer;

    const result = await workerExcelService.parseAndImportExcel(emptyBuffer);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should successfully parse and import valid workers (Egyptian NID and Foreign Passport)', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('بيانات العمال');

    // Headers
    sheet.addRow([
      'الاسم الرباعي', 'اسم الشهرة', 'الكود القديم', 'نوع الإثبات', 'رقم الإثبات',
      'الجنسية', 'تاريخ الميلاد', 'النوع', 'رقم الهاتف', 'كود الوظيفة',
      'كود الموقع', 'تاريخ المباشرة', 'طريقة الصرف', 'رقم الحساب', 'ملاحظات'
    ]);

    // Row 1: Egyptian
    sheet.addRow([
      'علي إبراهيم عبد الله خليل', 'علي', '106', 'رقم قومي', '29001010101234',
      'مصر', '', 'ذكر', '01012345678', 'DRV',
      'STE-01', '2026-09-01', 'CASH_SITE', '-', 'سائق لودر'
    ]);

    // Row 2: Foreigner with Passport
    sheet.addRow([
      'مبارك عثمان فضل الله آدم', 'مبارك', '101', 'جواز سفر', 'P19283746',
      'السودان', '1993-05-10', 'ذكر', '01123456789', 'HLP',
      'STE-01', '2026-09-01', 'CASH_SITE', '-', 'عامل موقع'
    ]);

    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    const result = await workerExcelService.parseAndImportExcel(buffer);

    expect(result.success).toBe(true);
    expect(result.workersCreated).toBe(2);
    expect(result.errors.length).toBe(0);
  });

  it('should report row-level errors for invalid job code or bad national ID', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('بيانات العمال');

    sheet.addRow([
      'الاسم الرباعي', 'اسم الشهرة', 'الكود القديم', 'نوع الإثبات', 'رقم الإثبات',
      'الجنسية', 'تاريخ الميلاد', 'النوع', 'رقم الهاتف', 'كود الوظيفة',
      'كود الموقع', 'تاريخ المباشرة', 'طريقة الصرف', 'رقم الحساب', 'ملاحظات'
    ]);

    // Bad row with fake job code and short NID
    sheet.addRow([
      'محمود سالم حسن جاد', '', '', 'رقم قومي', '12345',
      'مصر', '', 'ذكر', '01011111111', 'UNKNOWN_JOB',
      'STE-01', '2026-09-01', 'CASH_SITE', '-', ''
    ]);

    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    const result = await workerExcelService.parseAndImportExcel(buffer);

    expect(result.success).toBe(false);
    expect(result.workersCreated).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('الرقم القومي'))).toBe(true);
    expect(result.errors.some(e => e.includes('كود الوظيفة'))).toBe(true);
  });

  describe('Worker Excel Export — Full Roster, Smart Filtering & RBAC Data Masking', () => {
    it('should generate FULL workers export with FINANCIAL columns for Super Admin', async () => {
      const exportResult = await workerExcelService.generateWorkersExportBuffer(
        { type: 'ALL' },
        true // isSuperAdmin = true
      );

      expect(exportResult.buffer).toBeDefined();
      expect(exportResult.workerCount).toBe(2);
      expect(exportResult.fileName).toBe('كشف_العاملين_الشامل.xlsx');

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(exportResult.buffer as any);

      const sheet = workbook.getWorksheet('كشف العاملين');
      expect(sheet).toBeDefined();

      // Row 1: Title
      expect(sheet!.getRow(1).getCell(1).text).toContain('كشف قيد وبيانات العاملين');
      // Row 2: Metadata (contains Super Admin classification)
      expect(sheet!.getRow(2).getCell(1).text).toContain('الإدارة العليا');
      expect(sheet!.getRow(2).getCell(1).text).toContain('2 عامل');

      // Row 4: Headers
      const headerRow = sheet!.getRow(4);
      const headerValues: string[] = [];
      headerRow.eachCell((cell) => headerValues.push(cell.text));

      // Financial columns must be PRESENT for Super Admin
      expect(headerValues).toContain('الأجر اليومي (ج.م)');
      expect(headerValues).toContain('الراتب الأساسي (ج.م)');
      expect(headerValues).toContain('الراتب الإضافي (ج.م)');
      expect(headerValues).toContain('إجمالي الاستحقاق الشهري (ج.م)');
      expect(headerValues).toContain('رقم الحساب / المحفظة');
      expect(headerValues.length).toBe(43);

      // Check row 5 (Worker 1) financial values
      const worker1Row = sheet!.getRow(5);
      expect(worker1Row.getCell(2).text).toBe('OP-DRV-0001');
      expect(worker1Row.getCell(4).text).toBe('أحمد محمود علي إبراهيم');
      expect(worker1Row.getCell(33).value).toBe(250); // Daily wage
      expect(worker1Row.getCell(34).value).toBe(7500); // Basic salary
      expect(worker1Row.getCell(35).value).toBe(1500); // Additional salary
      expect(worker1Row.getCell(36).value).toBe(9000); // Total salary
    });

    it('should STRICTLY MASK and OMIT all FINANCIAL columns for regular Admin (isSuperAdmin = false)', async () => {
      const exportResult = await workerExcelService.generateWorkersExportBuffer(
        { type: 'ALL' },
        false // isSuperAdmin = false (Regular Admin / Field Admin)
      );

      expect(exportResult.buffer).toBeDefined();
      expect(exportResult.workerCount).toBe(2);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(exportResult.buffer as any);

      const sheet = workbook.getWorksheet('كشف العاملين');
      expect(sheet).toBeDefined();

      // Row 2: Metadata must show administrative classification (no salaries)
      expect(sheet!.getRow(2).getCell(1).text).toContain('بيانات تشغيلية');

      // Row 4: Headers
      const headerRow = sheet!.getRow(4);
      const headerValues: string[] = [];
      headerRow.eachCell((cell) => headerValues.push(cell.text));

      // Exactly 32 administrative columns — ZERO financial columns!
      expect(headerValues.length).toBe(32);
      expect(headerValues.some((h) => h.includes('الراتب'))).toBe(false);
      expect(headerValues.some((h) => h.includes('الأجر'))).toBe(false);
      expect(headerValues.some((h) => h.includes('البدلات'))).toBe(false);
      expect(headerValues.some((h) => h.includes('المحفظة'))).toBe(false);

      // Verify Worker 1 row does not exceed 32 columns
      const worker1Row = sheet!.getRow(5);
      expect(worker1Row.getCell(2).text).toBe('OP-DRV-0001');
      expect(worker1Row.getCell(33).value).toBeNull();
    });

    it('should filter workers export by DEPARTMENT', async () => {
      const exportResult = await workerExcelService.generateWorkersExportBuffer(
        { type: 'DEPARTMENT', departmentId: 'dept-1' },
        true
      );

      expect(exportResult.filterLabel).toContain('قسم: إدارة التشغيل والمعدات');
      expect(exportResult.fileName).toContain('قسم_إدارة_التشغيل_والمعدات');
      expect(exportResult.workerCount).toBe(2);
    });

    it('should filter workers export by JOB_TITLE', async () => {
      const exportResult = await workerExcelService.generateWorkersExportBuffer(
        { type: 'JOB_TITLE', jobTitleId: 'job-1' },
        true
      );

      expect(exportResult.filterLabel).toContain('مهنة: سائق لودر ومعدات ثقيلة');
      expect(exportResult.fileName).toContain('سائق_لودر');
      expect(exportResult.workerCount).toBe(1);
    });

    it('should filter workers export by GOVERNORATE', async () => {
      const exportResult = await workerExcelService.generateWorkersExportBuffer(
        { type: 'GOVERNORATE', governorateCode: '27' },
        false
      );

      expect(exportResult.filterLabel).toContain('محافظة: قنا');
      expect(exportResult.fileName).toContain('قنا');
      expect(exportResult.workerCount).toBe(1);
    });
  });
});
