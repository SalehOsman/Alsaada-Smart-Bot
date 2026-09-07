import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';

vi.mock('../src/redis.js', () => ({
  redis: {
    on: vi.fn(),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
  },
  getPendingJobMatrixAction: vi.fn().mockResolvedValue(null),
  setPendingJobMatrixAction: vi.fn().mockResolvedValue(undefined),
  clearPendingJobMatrixAction: vi.fn().mockResolvedValue(undefined),
}));

const { mockDepartments } = vi.hoisted(() => {
  const mockDepartments = [
    {
      id: 'dept-1',
      code: 'OP',
      name: 'إدارة التشغيل والمعدات',
      description: 'تشغيل أسطول المعدات الثقيلة والكسارات بالمواقع والمناجم',
      isActive: true,
      order: 1,
      jobs: [
        {
          id: 'job-1',
          departmentId: 'dept-1',
          code: 'DRV',
          name: 'سائق لودر ومعدات ثقيلة',
          baseSalary: 7500,
          additionalSalary: 2500,
          workDays: 20,
          restDays: 10,
          totalCycleDays: 30,
          shiftNature: 'دورة قياسية (20+10)',
          minHeadcount: 3,
          isActive: true,
          order: 1,
        },
      ],
    },
  ];
  return { mockDepartments };
});

vi.mock('../src/db.js', () => {
  const txMock = {
    department: {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.code === 'OP') return Promise.resolve(mockDepartments[0]);
        return Promise.resolve(null);
      }),
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: 'new-dept-id', ...data, jobs: [] })
      ),
      update: vi.fn().mockImplementation(({ where, data }) =>
        Promise.resolve({ ...mockDepartments[0], ...data })
      ),
    },
    jobTitle: {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.departmentId_code?.code === 'DRV') {
          return Promise.resolve(mockDepartments[0].jobs[0]);
        }
        return Promise.resolve(null);
      }),
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: 'new-job-id', ...data })
      ),
      update: vi.fn().mockImplementation(({ where, data }) =>
        Promise.resolve({ ...mockDepartments[0].jobs[0], ...data })
      ),
    },
  };

  return {
    prisma: {
      department: {
        findMany: vi.fn().mockResolvedValue(mockDepartments),
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.code === 'OP') return Promise.resolve(mockDepartments[0]);
          return Promise.resolve(null);
        }),
        create: vi.fn().mockResolvedValue(mockDepartments[0]),
        update: vi.fn().mockResolvedValue(mockDepartments[0]),
      },
      jobTitle: {
        findMany: vi.fn().mockResolvedValue(mockDepartments[0].jobs),
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.id === 'job-1' || where.departmentId_code?.code === 'DRV') {
            return Promise.resolve({
              ...mockDepartments[0].jobs[0],
              department: mockDepartments[0],
            });
          }
          return Promise.resolve(null);
        }),
        update: vi.fn().mockImplementation(({ where, data }) =>
          Promise.resolve({
            ...mockDepartments[0].jobs[0],
            ...data,
            department: mockDepartments[0],
          })
        ),
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'new-job-id',
            ...data,
            department: mockDepartments[0],
          })
        ),
      },
      $transaction: vi.fn().mockImplementation((cb) => cb(txMock)),
    },
  };
});

import {
  jobMatrixExcelService,
  JobMatrixExcelService,
} from '../src/services/job-matrix-excel.service.js';
import { systemDataService } from '../src/services/system-data.service.js';
import {
  renderDepartmentsHub,
  renderDepartmentDetail,
  renderJobDetail,
  handleJobHeadcountDelta,
  handleJobToggleCycle,
  handleJobMatrixTextInput,
} from '../src/handlers/job-matrix.handler.js';
import { MyContext } from '../src/types/context.js';
import { fastCache } from '../src/services/fast-cache.service.js';
import * as redisModule from '../src/redis.js';

describe('💼 Job Matrix & Functional Departments Suite', () => {
  beforeEach(() => {
    fastCache.clearL1();
    vi.clearAllMocks();
  });

  describe('1. JobMatrixExcelService — Template Generation & Import', () => {
    it('should generate an executive-grade styled XLSX template buffer', async () => {
      const buffer = await jobMatrixExcelService.generateTemplateBuffer();

      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(1000);

      // Verify Excel contents using ExcelJS
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const dataSheet = workbook.getWorksheet('دليل الأقسام والوظائف');
      expect(dataSheet).toBeDefined();
      expect(dataSheet?.views?.[0]?.rightToLeft).toBe(true);

      const instructionsSheet = workbook.getWorksheet('تعليمات التعبئة');
      expect(instructionsSheet).toBeDefined();

      // Check header columns in dataSheet
      const headerRow = dataSheet?.getRow(1);
      expect(headerRow?.getCell(1).value).toBe('كود القسم *');
      expect(headerRow?.getCell(2).value).toBe('اسم القسم الوظيفي *');
      expect(headerRow?.getCell(3).value).toBe('كود الوظيفة *');
      expect(headerRow?.getCell(4).value).toBe('المسمى الوظيفي *');

      // Check sample rows presence (at least 5 samples)
      expect(dataSheet?.rowCount).toBeGreaterThanOrEqual(6);
    });

    it('should parse and import valid XLSX buffer using atomic transaction', async () => {
      const buffer = await jobMatrixExcelService.generateTemplateBuffer();
      const result = await jobMatrixExcelService.parseAndImportExcel(buffer);

      expect(result.success).toBe(true);
      expect(result.totalRowsProcessed).toBeGreaterThanOrEqual(5);
      expect(result.errors).toHaveLength(0);
      expect(result.departmentsCreated + result.departmentsUpdated).toBeGreaterThan(0);
      expect(result.jobsCreated + result.jobsUpdated).toBeGreaterThan(0);
    });

    it('should safely reject empty or corrupted Excel files with descriptive errors', async () => {
      const emptyWorkbook = new ExcelJS.Workbook();
      emptyWorkbook.addWorksheet('دليل الأقسام والوظائف');
      const emptyBuffer = Buffer.from(await emptyWorkbook.xlsx.writeBuffer());

      const result = await jobMatrixExcelService.parseAndImportExcel(emptyBuffer);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('لم يتم العثور على أي صفوف بيانات');
    });

    it('should validate row data and flag invalid or missing dept and job codes', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('دليل الأقسام والوظائف');
      sheet.addRow(['كود القسم *', 'اسم القسم *', 'كود الوظيفة *', 'المسمى الوظيفي *']);
      // Row 2: invalid single-char code and missing title
      sheet.addRow(['X', 'قسم تجريبي', '', '']);

      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
      const result = await jobMatrixExcelService.parseAndImportExcel(buffer);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes('كود الوظيفة مفقود'))).toBe(true);
    });
  });

  describe('2. SystemDataService — In-Memory L1 RAM Cache', () => {
    it('should retrieve departments from L1 RAM with sub-millisecond latency', async () => {
      const depts = await systemDataService.getDepartments();
      expect(depts).toBeDefined();
      expect(depts.length).toBeGreaterThan(0);
      expect(depts[0].code).toBe('OP');
      expect(depts[0].jobs[0].code).toBe('DRV');

      // Second call served instantly from L1 cache
      const t0 = performance.now();
      const cached = await systemDataService.getDepartments();
      const elapsed = performance.now() - t0;
      expect(elapsed).toBeLessThan(5); // < 5ms even in unoptimized CI
      expect(cached).toEqual(depts);
    });

    it('should purge cache when invalidateDepartmentsAndJobs is called', async () => {
      await systemDataService.getDepartments();
      await systemDataService.invalidateDepartmentsAndJobs();

      // After invalidate, subsequent query calls DB / repopulates
      const fresh = await systemDataService.getDepartments();
      expect(fresh).toBeDefined();
    });
  });

  describe('3. Job Matrix Handlers — RBAC, Renders & Fast Controls', () => {
    it('should block non-super-admin users from opening the departments hub', async () => {
      const mockAnswerCallbackQuery = vi.fn();
      const mockCtx = {
        isRealSuperAdmin: false,
        callbackQuery: { data: 'action:settings:job_matrix' },
        answerCallbackQuery: mockAnswerCallbackQuery,
      } as unknown as MyContext;

      await renderDepartmentsHub(mockCtx, true);

      expect(mockAnswerCallbackQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          show_alert: true,
          text: expect.stringContaining('حصرياً للمدير العام'),
        })
      );
    });

    it('should render departments hub with executive Arabic copy and operational buttons', async () => {
      const mockEditMessageText = vi.fn();
      const mockCtx = {
        isRealSuperAdmin: true,
        from: { id: 123456 },
        callbackQuery: { data: 'action:settings:job_matrix' },
        editMessageText: mockEditMessageText,
      } as unknown as MyContext;

      await renderDepartmentsHub(mockCtx, true);

      expect(mockEditMessageText).toHaveBeenCalledWith(
        expect.stringContaining('الهيكل الوظيفي ومصفوفة المهن'),
        expect.objectContaining({
          parse_mode: 'Markdown',
          reply_markup: expect.anything(),
        })
      );
    });

    it('should adjust minimum headcount with +1 and -1 delta correctly', async () => {
      const mockAnswerCallbackQuery = vi.fn();
      const mockEditMessageText = vi.fn();
      const mockCtx = {
        isRealSuperAdmin: true,
        from: { id: 123456 },
        callbackQuery: { data: 'action:job:headcount:OP:DRV:inc' },
        answerCallbackQuery: mockAnswerCallbackQuery,
        editMessageText: mockEditMessageText,
      } as unknown as MyContext;

      // Increment
      await handleJobHeadcountDelta(mockCtx, 'OP', 'DRV', 'inc');
      expect(mockAnswerCallbackQuery).toHaveBeenCalledWith(
        expect.objectContaining({ text: expect.stringContaining('تم تعديل حد كفاية') })
      );

      // Decrement
      await handleJobHeadcountDelta(mockCtx, 'OP', 'DRV', 'dec');
      expect(mockAnswerCallbackQuery).toHaveBeenCalledWith(
        expect.objectContaining({ text: expect.stringContaining('تم تعديل حد كفاية') })
      );
    });

    it('should toggle job work and leave cycle between standard (20+10) and extended (24+6)', async () => {
      const mockAnswerCallbackQuery = vi.fn();
      const mockEditMessageText = vi.fn();
      const mockCtx = {
        isRealSuperAdmin: true,
        from: { id: 123456 },
        callbackQuery: { data: 'action:job:toggle_cycle:OP:DRV' },
        answerCallbackQuery: mockAnswerCallbackQuery,
        editMessageText: mockEditMessageText,
      } as unknown as MyContext;

      await handleJobToggleCycle(mockCtx, 'OP', 'DRV');

      expect(mockAnswerCallbackQuery).toHaveBeenCalledWith(
        expect.objectContaining({ text: expect.stringContaining('تم تعديل الدورة إلى') })
      );
    });

    it('should process pending salary edit text input accurately', async () => {
      vi.mocked(redisModule.getPendingJobMatrixAction).mockResolvedValueOnce({
        action: 'edit_job_base_salary',
        deptCode: 'OP',
        jobCode: 'DRV',
      });

      const mockReply = vi.fn();
      const mockDeleteMessage = vi.fn().mockResolvedValue(true);
      const mockCtx = {
        isRealSuperAdmin: true,
        from: { id: 123456 },
        message: { text: '8500' },
        reply: mockReply,
        deleteMessage: mockDeleteMessage,
      } as unknown as MyContext;

      const handled = await handleJobMatrixTextInput(mockCtx);

      expect(handled).toBe(true);
      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('تعديل الراتب الإضافي والبدلات'),
        expect.anything()
      );
    });
  });
});
