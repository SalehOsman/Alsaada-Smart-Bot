import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { workerExcelService, setWorkforcePrisma } from '@alsaada/workforce';
import { prisma } from '../src/db.js';
import ExcelJS from 'exceljs';
import { PINNED_BASE_TIME } from '@alsaada/shared/testing';

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
  // Deterministic pinned base time reference for roster generation and export timestamps
  const _EXECUTION_BASE_TIME = PINNED_BASE_TIME;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setWorkforcePrisma(prisma);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('generates template buffer containing entry sheet and reference codes sheet', async () => {
    // Arrange
    const minExpectedLength = 1000;

    // Act
    const buffer = await workerExcelService.generateTemplateBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet1 = workbook.worksheets[0]!;
    const headerRow = sheet1.getRow(1);
    const sheet2 = workbook.worksheets[1]!;

    // Assert
    expect(buffer.length).toBeGreaterThan(minExpectedLength);
    expect(workbook.worksheets).toHaveLength(2);
    expect(sheet1.name).toBe('بيانات العمال الجدد');
    expect(sheet2.name).toBe('دليل الأكواد المعتمدة');
    expect(headerRow.getCell(1).text).toContain('الاسم الرباعي');
    expect(headerRow.getCell(3).text).toContain('كود العامل القديم');
    expect(headerRow.getCell(4).text).toContain('نوع الإثبات');
    expect(sheet2.rowCount).toBeGreaterThan(1);
  });

  it('rejects file with invalid format or zero worker entries', async () => {
    // Arrange
    const emptyWorkbook = new ExcelJS.Workbook();
    emptyWorkbook.addWorksheet('ورقة فارغة');
    const emptyBuffer = (await emptyWorkbook.xlsx.writeBuffer()) as unknown as Buffer;

    // Act
    const result = await workerExcelService.parseAndImportExcel(emptyBuffer);

    // Assert
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.workersCreated).toBe(0);
    expect(result.createdWorkers).toBeUndefined();
  });

  it('parses and imports valid workers with Egyptian national id and foreign passport', async () => {
    // Arrange
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

    // Act
    const result = await workerExcelService.parseAndImportExcel(buffer);

    // Assert
    expect(result.success).toBe(true);
    expect(result.workersCreated).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(result.createdWorkers).toHaveLength(2);
  });

  it('reports row-level errors when job code is invalid or national id length is malformed', async () => {
    // Arrange
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

    // Act
    const result = await workerExcelService.parseAndImportExcel(buffer);

    // Assert
    expect(result.success).toBe(false);
    expect(result.workersCreated).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('الرقم القومي'))).toBe(true);
    expect(result.errors.some(e => e.includes('كود الوظيفة'))).toBe(true);
    expect(result.createdWorkers).toBeUndefined();
  });

  describe('Worker Excel Export — Full Roster, Smart Filtering & RBAC Data Masking', () => {
    it('generates full workers export including financial columns when requested by Super Admin', async () => {
      // Arrange
      const filter = { type: 'ALL' as const };
      const isSuperAdmin = true;

      // Act
      const exportResult = await workerExcelService.generateWorkersExportBuffer(filter, isSuperAdmin);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(exportResult.buffer as any);
      const sheet = workbook.getWorksheet('كشف العاملين');
      const headerRow = sheet!.getRow(4);
      const headerValues: string[] = [];
      headerRow.eachCell((cell) => headerValues.push(cell.text));
      const worker1Row = sheet!.getRow(5);

      // Assert
      expect(exportResult.workerCount).toBe(2);
      expect(exportResult.fileName).toBe('كشف_العاملين_الشامل.xlsx');
      expect(sheet!.getRow(1).getCell(1).text).toContain('كشف قيد وبيانات العاملين');
      expect(sheet!.getRow(2).getCell(1).text).toContain('الإدارة العليا');
      expect(sheet!.getRow(2).getCell(1).text).toContain('2 عامل');
      expect(headerValues).toContain('الأجر اليومي (ج.م)');
      expect(headerValues).toContain('الراتب الأساسي (ج.م)');
      expect(headerValues).toContain('الراتب الإضافي (ج.م)');
      expect(headerValues).toContain('إجمالي الاستحقاق الشهري (ج.م)');
      expect(headerValues).toContain('رقم الحساب / المحفظة');
      expect(headerValues).toHaveLength(43);
      expect(worker1Row.getCell(2).text).toBe('OP-DRV-0001');
      expect(worker1Row.getCell(4).text).toBe('أحمد محمود علي إبراهيم');
      expect(worker1Row.getCell(33).value).toBe(250);
      expect(worker1Row.getCell(34).value).toBe(7500);
      expect(worker1Row.getCell(35).value).toBe(1500);
      expect(worker1Row.getCell(36).value).toBe(9000);
    });

    it('strictly masks and omits all financial columns when exported for regular Admin', async () => {
      // Arrange
      const filter = { type: 'ALL' as const };
      const isSuperAdmin = false;

      // Act
      const exportResult = await workerExcelService.generateWorkersExportBuffer(filter, isSuperAdmin);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(exportResult.buffer as any);
      const sheet = workbook.getWorksheet('كشف العاملين');
      const headerRow = sheet!.getRow(4);
      const headerValues: string[] = [];
      headerRow.eachCell((cell) => headerValues.push(cell.text));
      const worker1Row = sheet!.getRow(5);

      // Assert
      expect(exportResult.workerCount).toBe(2);
      expect(sheet!.getRow(2).getCell(1).text).toContain('بيانات تشغيلية');
      expect(headerValues).toHaveLength(32);
      expect(headerValues).not.toContain('الراتب الأساسي (ج.م)');
      expect(headerValues).not.toContain('الأجر اليومي (ج.م)');
      expect(headerValues).not.toContain('الراتب الإضافي (ج.م)');
      expect(headerValues).not.toContain('رقم الحساب / المحفظة');
      expect(worker1Row.getCell(2).text).toBe('OP-DRV-0001');
      expect(worker1Row.getCell(33).value).toBeNull();
    });

    it('filters workers export by specific department identifier', async () => {
      // Arrange
      const filter = { type: 'DEPARTMENT' as const, departmentId: 'dept-1' };

      // Act
      const exportResult = await workerExcelService.generateWorkersExportBuffer(filter, true);

      // Assert
      expect(exportResult.filterLabel).toBe('قسم: إدارة التشغيل والمعدات');
      expect(exportResult.fileName).toBe('كشف_عمال_قسم_إدارة_التشغيل_والمعدات.xlsx');
      expect(exportResult.workerCount).toBe(2);
    });

    it('filters workers export by specific job title identifier', async () => {
      // Arrange
      const filter = { type: 'JOB_TITLE' as const, jobTitleId: 'job-1' };

      // Act
      const exportResult = await workerExcelService.generateWorkersExportBuffer(filter, true);

      // Assert
      expect(exportResult.filterLabel).toBe('مهنة: سائق لودر ومعدات ثقيلة');
      expect(exportResult.fileName).toBe('كشف_عمال_مهنة_سائق_لودر_ومعدات_ثقيلة.xlsx');
      expect(exportResult.workerCount).toBe(1);
    });

    it('filters workers export by specific governorate code', async () => {
      // Arrange
      const filter = { type: 'GOVERNORATE' as const, governorateCode: '27' };

      // Act
      const exportResult = await workerExcelService.generateWorkersExportBuffer(filter, false);

      // Assert
      expect(exportResult.filterLabel).toBe('محافظة: قنا');
      expect(exportResult.fileName).toBe('كشف_عمال_محافظة_قنا.xlsx');
      expect(exportResult.workerCount).toBe(1);
    });
  });
});
