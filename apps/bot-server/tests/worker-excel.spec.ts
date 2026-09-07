import { describe, it, expect, vi } from 'vitest';
import { workerExcelService } from '../src/services/worker-excel.service.js';
import ExcelJS from 'exceljs';

vi.mock('../src/db.js', () => ({
  prisma: {
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
      findMany: vi.fn().mockResolvedValue([]),
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
  it('should generate template buffer with 2 sheets (Workers Entry and Reference Codes)', async () => {
    const buffer = await workerExcelService.generateTemplateBuffer();
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(1000);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    expect(workbook.worksheets.length).toBe(2);
    expect(workbook.worksheets[0].name).toBe('بيانات العمال الجدد');
    expect(workbook.worksheets[1].name).toBe('دليل الأكواد المعتمدة');

    const sheet1 = workbook.worksheets[0];
    const headerRow = sheet1.getRow(1);
    expect(headerRow.getCell(1).text).toContain('الاسم الرباعي');
    expect(headerRow.getCell(3).text).toContain('كود العامل القديم');
    expect(headerRow.getCell(4).text).toContain('نوع الإثبات');

    const sheet2 = workbook.worksheets[1];
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
});
