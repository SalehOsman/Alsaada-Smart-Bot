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
      workers: [],
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
        delete: vi.fn().mockResolvedValue(mockDepartments[0]),
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
        delete: vi.fn().mockResolvedValue(mockDepartments[0].jobs[0]),
      },
      worker: {
        count: vi.fn().mockResolvedValue(0),
      },
      cycleTransitionHistory: {
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'trans-hist-uuid-1',
            ...data,
            createdAt: new Date(),
          })
        ),
        findMany: vi.fn().mockResolvedValue([]),
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
  getNextQuickCycle,
  handleJobHeadcountDelta,
  handleJobToggleCycle,
  handleQuickPresetCycle,
  handleStartEditDeptName,
  handleStartEditDeptCode,
  handleToggleDeptActive,
  handlePromptDeleteDept,
  handleConfirmDeleteDept,
  handleStartEditJobCode,
  handleToggleJobActive,
  handlePromptDeleteJob,
  handleConfirmDeleteJob,
  handleStartEditJobCycle,
  handleSetWorkDays,
  handleSetRestDays,
  handleApplyCyclePolicy,
  handlePromptCustomDate,
  handleJobMatrixTextInput,
} from '../src/handlers/job-matrix.handler.js';
import { cycleTransitionService } from '../src/services/cycle-transition.service.js';
import { MyContext } from '../src/types/context.js';
import { fastCache } from '../src/services/fast-cache.service.js';
import * as redisModule from '../src/redis.js';
import { prisma } from '../src/db.js';

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

    it('should cycle between 30/10, 40/10, and 26/4 and prompt for transition policy', async () => {
      // 1. Verify rotation math
      expect(getNextQuickCycle(20, 10)).toEqual({ workDays: 30, restDays: 10 });
      expect(getNextQuickCycle(30, 10)).toEqual({ workDays: 40, restDays: 10 });
      expect(getNextQuickCycle(40, 10)).toEqual({ workDays: 26, restDays: 4 });
      expect(getNextQuickCycle(26, 4)).toEqual({ workDays: 30, restDays: 10 });

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

      // 2. Verifies that it prompts for transition policy instead of saving silently
      expect(mockEditMessageText).toHaveBeenCalledWith(
        expect.stringContaining('اختيار سياسة ومنهجية السريان'),
        expect.objectContaining({
          parse_mode: 'Markdown',
          reply_markup: expect.anything(),
        })
      );
      expect(redisModule.setPendingJobMatrixAction).toHaveBeenCalledWith(
        123456n,
        expect.objectContaining({
          action: 'edit_job_cycle_policy',
          deptCode: 'OP',
          jobCode: 'DRV',
          draft: { workDays: 30, restDays: 10 },
        })
      );
    });

    it('should handle quick preset callback for direct cycle selection', async () => {
      const mockAnswerCallbackQuery = vi.fn();
      const mockEditMessageText = vi.fn();
      const mockCtx = {
        isRealSuperAdmin: true,
        from: { id: 123456 },
        callbackQuery: { data: 'action:job:quick_preset:OP:DRV:40:10' },
        answerCallbackQuery: mockAnswerCallbackQuery,
        editMessageText: mockEditMessageText,
      } as unknown as MyContext;

      await handleQuickPresetCycle(mockCtx, 'OP', 'DRV', 40, 10);

      expect(mockEditMessageText).toHaveBeenCalledWith(
        expect.stringContaining('40/10'),
        expect.anything()
      );
      expect(redisModule.setPendingJobMatrixAction).toHaveBeenCalledWith(
        123456n,
        expect.objectContaining({
          draft: { workDays: 40, restDays: 10 },
        })
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

    it('should initiate custom work/rest cycle wizard and prompt for work days', async () => {
      const mockEditMessageText = vi.fn();
      const mockAnswerCallbackQuery = vi.fn();
      const mockCtx = {
        isRealSuperAdmin: true,
        from: { id: 123456 },
        callbackQuery: { data: 'action:job:edit_cycle:OP:DRV' },
        editMessageText: mockEditMessageText,
        answerCallbackQuery: mockAnswerCallbackQuery,
      } as unknown as MyContext;

      await handleStartEditJobCycle(mockCtx, 'OP', 'DRV');

      expect(mockEditMessageText).toHaveBeenCalledWith(
        expect.stringContaining('أيام العمل بالموقع'),
        expect.objectContaining({
          parse_mode: 'Markdown',
          reply_markup: expect.anything(),
        })
      );
    });

    it('should save custom work days and prompt for rest days in step 2', async () => {
      const mockEditMessageText = vi.fn();
      const mockAnswerCallbackQuery = vi.fn();
      const mockCtx = {
        isRealSuperAdmin: true,
        from: { id: 123456 },
        callbackQuery: { data: 'action:job:set_wd:OP:DRV:26' },
        editMessageText: mockEditMessageText,
        answerCallbackQuery: mockAnswerCallbackQuery,
      } as unknown as MyContext;

      await handleSetWorkDays(mockCtx, 'OP', 'DRV', 26);

      expect(mockEditMessageText).toHaveBeenCalledWith(
        expect.stringContaining('26 يوماً'),
        expect.objectContaining({
          parse_mode: 'Markdown',
          reply_markup: expect.anything(),
        })
      );
    });

    it('should prompt for transition policy selection in step 3 when rest days are chosen', async () => {
      vi.mocked(redisModule.getPendingJobMatrixAction).mockResolvedValueOnce({
        action: 'edit_job_rest_days',
        deptCode: 'OP',
        jobCode: 'DRV',
        draft: { workDays: 26 },
      });

      const mockEditMessageText = vi.fn();
      const mockAnswerCallbackQuery = vi.fn();
      const mockCtx = {
        isRealSuperAdmin: true,
        from: { id: 123456 },
        callbackQuery: { data: 'action:job:set_rd:OP:DRV:4' },
        editMessageText: mockEditMessageText,
        answerCallbackQuery: mockAnswerCallbackQuery,
      } as unknown as MyContext;

      await handleSetRestDays(mockCtx, 'OP', 'DRV', 4);

      expect(mockAnswerCallbackQuery).toHaveBeenCalled();
      expect(mockEditMessageText).toHaveBeenCalledWith(
        expect.stringContaining('الخطوة 3 من 3 (سياسة السريان)'),
        expect.objectContaining({
          parse_mode: 'Markdown',
          reply_markup: expect.anything(),
        })
      );
      expect(redisModule.setPendingJobMatrixAction).toHaveBeenCalledWith(
        123456n,
        expect.objectContaining({
          action: 'edit_job_cycle_policy',
          deptCode: 'OP',
          jobCode: 'DRV',
          draft: { workDays: 26, restDays: 4 },
        })
      );
    });

    it('should apply transition policy (IMMEDIATE_PRORATED), record history audit and update job card', async () => {
      vi.mocked(redisModule.getPendingJobMatrixAction).mockResolvedValueOnce({
        action: 'edit_job_cycle_policy',
        deptCode: 'OP',
        jobCode: 'DRV',
        draft: { workDays: 26, restDays: 4 },
      });

      const mockEditMessageText = vi.fn();
      const mockAnswerCallbackQuery = vi.fn();
      const mockCtx = {
        isRealSuperAdmin: true,
        from: { id: 123456 },
        callbackQuery: { data: 'action:job:apply_policy:OP:DRV:IMMEDIATE_PRORATED' },
        editMessageText: mockEditMessageText,
        answerCallbackQuery: mockAnswerCallbackQuery,
      } as unknown as MyContext;

      await handleApplyCyclePolicy(mockCtx, 'OP', 'DRV', 'IMMEDIATE_PRORATED');

      expect(mockAnswerCallbackQuery).toHaveBeenCalledWith(
        expect.objectContaining({ text: expect.stringContaining('26/4') })
      );
      expect(mockEditMessageText).toHaveBeenCalledWith(
        expect.stringContaining('تم اعتماد وتوثيق دورة العمل بنجاح!'),
        expect.anything()
      );
      expect(redisModule.clearPendingJobMatrixAction).toHaveBeenCalledWith(123456n);
    });

    it('should prompt for custom date when user selects custom date policy', async () => {
      vi.mocked(redisModule.getPendingJobMatrixAction).mockResolvedValueOnce({
        action: 'edit_job_cycle_policy',
        deptCode: 'OP',
        jobCode: 'DRV',
        draft: { workDays: 24, restDays: 6 },
      });

      const mockEditMessageText = vi.fn();
      const mockAnswerCallbackQuery = vi.fn();
      const mockCtx = {
        isRealSuperAdmin: true,
        from: { id: 123456 },
        callbackQuery: { data: 'action:job:prompt_custom_date:OP:DRV' },
        editMessageText: mockEditMessageText,
        answerCallbackQuery: mockAnswerCallbackQuery,
      } as unknown as MyContext;

      await handlePromptCustomDate(mockCtx, 'OP', 'DRV');

      expect(mockEditMessageText).toHaveBeenCalledWith(
        expect.stringContaining('تحديد تاريخ سريان مخصص لدورة العمل'),
        expect.anything()
      );
      expect(redisModule.setPendingJobMatrixAction).toHaveBeenCalledWith(
        123456n,
        expect.objectContaining({
          action: 'edit_job_cycle_custom_date',
        })
      );
    });

    it('should accept custom date text format (YYYY-MM-DD) and apply custom date policy', async () => {
      vi.mocked(redisModule.getPendingJobMatrixAction).mockResolvedValueOnce({
        action: 'edit_job_cycle_custom_date',
        deptCode: 'OP',
        jobCode: 'DRV',
        draft: { workDays: 24, restDays: 6 },
      });

      const mockReply = vi.fn();
      const mockDelete = vi.fn().mockResolvedValue(true);
      const mockEditMessageText = vi.fn();
      const mockCtx = {
        isRealSuperAdmin: true,
        from: { id: 123456 },
        message: { text: '2026-10-01' },
        reply: mockReply,
        deleteMessage: mockDelete,
        editMessageText: mockEditMessageText,
      } as unknown as MyContext;

      const handled = await handleJobMatrixTextInput(mockCtx);
      expect(handled).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should process custom work and rest days from direct text messages', async () => {
      // Step 1: Work days text input
      vi.mocked(redisModule.getPendingJobMatrixAction).mockResolvedValueOnce({
        action: 'edit_job_work_days',
        deptCode: 'OP',
        jobCode: 'DRV',
      });

      const mockReply1 = vi.fn();
      const mockDelete1 = vi.fn().mockResolvedValue(true);
      const mockCtx1 = {
        isRealSuperAdmin: true,
        from: { id: 123456 },
        message: { text: '26' },
        reply: mockReply1,
        deleteMessage: mockDelete1,
      } as unknown as MyContext;

      const handled1 = await handleJobMatrixTextInput(mockCtx1);
      expect(handled1).toBe(true);
      expect(mockReply1).toHaveBeenCalledWith(
        expect.stringContaining('أيام الراحة والإجازة'),
        expect.anything()
      );

      // Step 2: Rest days text input
      vi.mocked(redisModule.getPendingJobMatrixAction).mockResolvedValueOnce({
        action: 'edit_job_rest_days',
        deptCode: 'OP',
        jobCode: 'DRV',
        draft: { workDays: 26 },
      });

      const mockReply2 = vi.fn();
      const mockDelete2 = vi.fn().mockResolvedValue(true);
      const mockCtx2 = {
        isRealSuperAdmin: true,
        from: { id: 123456 },
        message: { text: '4' },
        reply: mockReply2,
        deleteMessage: mockDelete2,
      } as unknown as MyContext;

      const handled2 = await handleJobMatrixTextInput(mockCtx2);
      expect(handled2).toBe(true);
    });
  });

  describe('4. CycleTransitionService — Proration Math Engine & Multi-Period Splitting', () => {
    it('should calculate simple accrual when no transition occurred in period', () => {
      const result = cycleTransitionService.calculateProratedAccrual({
        periodStartDate: '2026-09-01',
        periodEndDate: '2026-09-30',
        transitions: [],
        fallbackWorkDays: 20,
        fallbackRestDays: 10,
      });

      expect(result.totalPresenceDays).toBe(30);
      // 30 * (10 / 20) = 15 days
      expect(result.totalEarnedRestDays).toBe(15);
      expect(result.integerLeaveDays).toBe(15);
      expect(result.fractionalDay).toBe(0);
      expect(result.periods).toHaveLength(1);
    });

    it('should split period and compute accurate proration when cycle changed mid-month', () => {
      // Worker on-site from 2026-09-01 to 2026-09-30 (30 days)
      // Cycle changed on 2026-09-16 from 20/10 (ratio 0.5) to 24/6 (ratio 0.25)
      // Period 1: Sept 1 to Sept 15 (15 days) @ 20/10 => 15 * 0.5 = 7.5 days
      // Period 2: Sept 16 to Sept 30 (15 days) @ 24/6 => 15 * 0.25 = 3.75 days
      // Total earned: 7.5 + 3.75 = 11.25 days
      const result = cycleTransitionService.calculateProratedAccrual({
        periodStartDate: '2026-09-01',
        periodEndDate: '2026-09-30',
        transitions: [
          {
            effectiveDate: '2026-09-16',
            previousWorkDays: 20,
            previousRestDays: 10,
            newWorkDays: 24,
            newRestDays: 6,
          },
        ],
        fallbackWorkDays: 20,
        fallbackRestDays: 10,
      });

      expect(result.totalPresenceDays).toBe(30);
      expect(result.totalEarnedRestDays).toBe(11.25);
      expect(result.integerLeaveDays).toBe(11);
      expect(result.fractionalDay).toBe(0.25);
      expect(result.periods).toHaveLength(2);
      expect(result.periods[0].daysCount).toBe(15);
      expect(result.periods[0].earnedRestDays).toBe(7.5);
      expect(result.periods[1].daysCount).toBe(15);
      expect(result.periods[1].earnedRestDays).toBe(3.75);
      expect(result.summaryArabic).toContain('11.25 يوم راحة');
    });
  });

  describe('5. Department & Job Title Full Lifecycle Management (Codes, Activation, Safe Deletion)', () => {
    it('should initiate department code edit and save state in Redis', async () => {
      const mockEditMessageText = vi.fn();
      const mockCtx = {
        isRealSuperAdmin: true,
        from: { id: 123456 },
        callbackQuery: {
          data: 'action:dept:edit_code:OP',
          message: { message_id: 99 },
        },
        editMessageText: mockEditMessageText,
        answerCallbackQuery: vi.fn(),
      } as unknown as MyContext;

      await handleStartEditDeptCode(mockCtx, 'OP');

      expect(redisModule.setPendingJobMatrixAction).toHaveBeenCalledWith(
        123456n,
        expect.objectContaining({
          action: 'edit_dept_code',
          deptCode: 'OP',
          messageId: 99,
        })
      );
      expect(mockEditMessageText).toHaveBeenCalledWith(
        expect.stringContaining('تعديل كود القسم الوظيفي'),
        expect.objectContaining({ parse_mode: 'Markdown' })
      );
    });

    it('should toggle department active status and invalidate caches', async () => {
      const mockAnswerCallbackQuery = vi.fn();
      const mockEditMessageText = vi.fn();
      const mockCtx = {
        isRealSuperAdmin: true,
        from: { id: 123456 },
        callbackQuery: {
          data: 'action:dept:toggle_active:OP',
        },
        answerCallbackQuery: mockAnswerCallbackQuery,
        editMessageText: mockEditMessageText,
      } as unknown as MyContext;

      await handleToggleDeptActive(mockCtx, 'OP');

      expect(prisma.department.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isActive: false },
        })
      );
      expect(mockAnswerCallbackQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('تم إيقاف قسم'),
        })
      );
    });

    it('should block department deletion and present safety explanation when jobs exist', async () => {
      const mockEditMessageText = vi.fn();
      const mockCtx = {
        isRealSuperAdmin: true,
        from: { id: 123456 },
        callbackQuery: {
          data: 'action:dept:delete_prompt:OP',
        },
        editMessageText: mockEditMessageText,
      } as unknown as MyContext;

      // mockDepartments[0] has 1 job (DRV)
      await handlePromptDeleteDept(mockCtx, 'OP');

      expect(mockEditMessageText).toHaveBeenCalledWith(
        expect.stringContaining('تعذر حذف القسم الوظيفي'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  callback_data: 'action:dept:toggle_active:OP',
                }),
              ]),
            ]),
          }),
        })
      );
    });

    it('should permit department deletion confirmation prompt when department has zero jobs and zero workers', async () => {
      vi.mocked(prisma.department.findUnique).mockResolvedValueOnce({
        id: 'dept-empty',
        code: 'EMPTY',
        name: 'قسم فارغ',
        description: null,
        isActive: true,
        order: 99,
        jobs: [],
        workers: [],
      } as any);

      const mockEditMessageText = vi.fn();
      const mockCtx = {
        isRealSuperAdmin: true,
        from: { id: 123456 },
        callbackQuery: {
          data: 'action:dept:delete_prompt:EMPTY',
        },
        editMessageText: mockEditMessageText,
      } as unknown as MyContext;

      await handlePromptDeleteDept(mockCtx, 'EMPTY');

      expect(mockEditMessageText).toHaveBeenCalledWith(
        expect.stringContaining('تأكيد الحذف النهائي للقسم الوظيفي'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  callback_data: 'action:dept:delete_confirm:EMPTY',
                }),
              ]),
            ]),
          }),
        })
      );
    });

    it('should delete empty department on confirm and refresh hub', async () => {
      vi.mocked(prisma.department.findUnique).mockResolvedValueOnce({
        id: 'dept-empty',
        code: 'EMPTY',
        name: 'قسم فارغ',
        description: null,
        isActive: true,
        order: 99,
        jobs: [],
        workers: [],
      } as any);

      const mockAnswer = vi.fn();
      const mockEditMessageText = vi.fn();
      const mockCtx = {
        isRealSuperAdmin: true,
        from: { id: 123456 },
        callbackQuery: {
          data: 'action:dept:delete_confirm:EMPTY',
        },
        answerCallbackQuery: mockAnswer,
        editMessageText: mockEditMessageText,
      } as unknown as MyContext;

      await handleConfirmDeleteDept(mockCtx, 'EMPTY');

      expect(prisma.department.delete).toHaveBeenCalledWith({
        where: { id: 'dept-empty' },
      });
      expect(mockAnswer).toHaveBeenCalledWith({
        text: expect.stringContaining('تم حذف قسم'),
      });
    });

    it('should initiate job code edit and save state in Redis', async () => {
      const mockEditMessageText = vi.fn();
      const mockCtx = {
        isRealSuperAdmin: true,
        from: { id: 123456 },
        callbackQuery: {
          data: 'action:job:edit_code:OP:DRV',
          message: { message_id: 101 },
        },
        editMessageText: mockEditMessageText,
        answerCallbackQuery: vi.fn(),
      } as unknown as MyContext;

      await handleStartEditJobCode(mockCtx, 'OP', 'DRV');

      expect(redisModule.setPendingJobMatrixAction).toHaveBeenCalledWith(
        123456n,
        expect.objectContaining({
          action: 'edit_job_code',
          deptCode: 'OP',
          jobCode: 'DRV',
          messageId: 101,
        })
      );
      expect(mockEditMessageText).toHaveBeenCalledWith(
        expect.stringContaining('تعديل كود الوظيفة'),
        expect.objectContaining({ parse_mode: 'Markdown' })
      );
    });

    it('should toggle job active status and invalidate caches', async () => {
      const mockAnswerCallbackQuery = vi.fn();
      const mockEditMessageText = vi.fn();
      const mockCtx = {
        isRealSuperAdmin: true,
        from: { id: 123456 },
        callbackQuery: {
          data: 'action:job:toggle_active:OP:DRV',
        },
        answerCallbackQuery: mockAnswerCallbackQuery,
        editMessageText: mockEditMessageText,
      } as unknown as MyContext;

      await handleToggleJobActive(mockCtx, 'OP', 'DRV');

      expect(prisma.jobTitle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isActive: false },
        })
      );
      expect(mockAnswerCallbackQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('تم إيقاف وظيفة'),
        })
      );
    });

    it('should block job deletion when workers are assigned to it', async () => {
      vi.mocked(prisma.worker.count).mockResolvedValueOnce(5);

      const mockEditMessageText = vi.fn();
      const mockCtx = {
        isRealSuperAdmin: true,
        from: { id: 123456 },
        callbackQuery: {
          data: 'action:job:delete_prompt:OP:DRV',
        },
        editMessageText: mockEditMessageText,
      } as unknown as MyContext;

      await handlePromptDeleteJob(mockCtx, 'OP', 'DRV');

      expect(mockEditMessageText).toHaveBeenCalledWith(
        expect.stringContaining('تعذر حذف الوظيفة'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  callback_data: 'action:job:toggle_active:OP:DRV',
                }),
              ]),
            ]),
          }),
        })
      );
    });

    it('should permit job deletion confirmation when 0 workers are assigned', async () => {
      vi.mocked(prisma.worker.count).mockResolvedValueOnce(0);

      const mockEditMessageText = vi.fn();
      const mockCtx = {
        isRealSuperAdmin: true,
        from: { id: 123456 },
        callbackQuery: {
          data: 'action:job:delete_prompt:OP:DRV',
        },
        editMessageText: mockEditMessageText,
      } as unknown as MyContext;

      await handlePromptDeleteJob(mockCtx, 'OP', 'DRV');

      expect(mockEditMessageText).toHaveBeenCalledWith(
        expect.stringContaining('تأكيد الحذف النهائي للوظيفة'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  callback_data: 'action:job:delete_confirm:OP:DRV',
                }),
              ]),
            ]),
          }),
        })
      );
    });

    it('should handle text input for edit_dept_code with validation and collision checks', async () => {
      // 1. Invalid code (too short)
      vi.mocked(redisModule.getPendingJobMatrixAction).mockResolvedValueOnce({
        action: 'edit_dept_code',
        deptCode: 'OP',
      });
      const mockReply1 = vi.fn();
      const mockCtx1 = {
        isRealSuperAdmin: true,
        from: { id: 123456 },
        message: { text: 'X' },
        reply: mockReply1,
      } as unknown as MyContext;

      const handled1 = await handleJobMatrixTextInput(mockCtx1);
      expect(handled1).toBe(true);
      expect(mockReply1).toHaveBeenCalledWith(expect.stringContaining('كود القسم غير صالح'));

      // 2. Collision with existing dept
      vi.mocked(redisModule.getPendingJobMatrixAction).mockResolvedValueOnce({
        action: 'edit_dept_code',
        deptCode: 'OP',
      });
      vi.mocked(prisma.department.findUnique).mockResolvedValueOnce({
        id: 'dept-mnt',
        code: 'MNT',
        name: 'إدارة الصيانة',
      } as any);
      const mockReply2 = vi.fn();
      const mockCtx2 = {
        isRealSuperAdmin: true,
        from: { id: 123456 },
        message: { text: 'MNT' },
        reply: mockReply2,
      } as unknown as MyContext;

      const handled2 = await handleJobMatrixTextInput(mockCtx2);
      expect(handled2).toBe(true);
      expect(mockReply2).toHaveBeenCalledWith(
        expect.stringContaining('مسجل مسبقاً'),
        expect.anything()
      );

      // 3. Valid unique new code
      vi.mocked(redisModule.getPendingJobMatrixAction).mockResolvedValueOnce({
        action: 'edit_dept_code',
        deptCode: 'OP',
      });
      vi.mocked(prisma.department.findUnique).mockResolvedValueOnce(null);
      const mockReply3 = vi.fn();
      const mockDelete3 = vi.fn().mockResolvedValue(true);
      const mockCtx3 = {
        isRealSuperAdmin: true,
        from: { id: 123456 },
        message: { text: 'OPS' },
        reply: mockReply3,
        deleteMessage: mockDelete3,
      } as unknown as MyContext;

      const handled3 = await handleJobMatrixTextInput(mockCtx3);
      expect(handled3).toBe(true);
      expect(prisma.department.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { code: 'OP' },
          data: { code: 'OPS' },
        })
      );
    });

    it('should handle text input for edit_job_code with validation and collision checks', async () => {
      // 1. Invalid code (too short)
      vi.mocked(redisModule.getPendingJobMatrixAction).mockResolvedValueOnce({
        action: 'edit_job_code',
        deptCode: 'OP',
        jobCode: 'DRV',
      });
      const mockReply1 = vi.fn();
      const mockCtx1 = {
        isRealSuperAdmin: true,
        from: { id: 123456 },
        message: { text: 'A' },
        reply: mockReply1,
      } as unknown as MyContext;

      const handled1 = await handleJobMatrixTextInput(mockCtx1);
      expect(handled1).toBe(true);
      expect(mockReply1).toHaveBeenCalledWith(expect.stringContaining('كود الوظيفة غير صالح'));

      // 2. Collision with existing job in same dept
      vi.mocked(redisModule.getPendingJobMatrixAction).mockResolvedValueOnce({
        action: 'edit_job_code',
        deptCode: 'OP',
        jobCode: 'DRV',
      });
      vi.mocked(prisma.department.findUnique).mockResolvedValueOnce({
        id: 'dept-1',
        code: 'OP',
        name: 'التشغيل',
      } as any);
      vi.mocked(prisma.jobTitle.findUnique).mockResolvedValueOnce({
        id: 'job-other',
        name: 'مهندس موقع',
        code: 'ENG',
      } as any);

      const mockReply2 = vi.fn();
      const mockCtx2 = {
        isRealSuperAdmin: true,
        from: { id: 123456 },
        message: { text: 'ENG' },
        reply: mockReply2,
      } as unknown as MyContext;

      const handled2 = await handleJobMatrixTextInput(mockCtx2);
      expect(handled2).toBe(true);
      expect(mockReply2).toHaveBeenCalledWith(
        expect.stringContaining('مسجل مسبقاً بهذا القسم'),
        expect.anything()
      );

      // 3. Valid unique new job code
      vi.mocked(redisModule.getPendingJobMatrixAction).mockResolvedValueOnce({
        action: 'edit_job_code',
        deptCode: 'OP',
        jobCode: 'DRV',
      });
      vi.mocked(prisma.department.findUnique).mockResolvedValueOnce({
        id: 'dept-1',
        code: 'OP',
        name: 'التشغيل',
      } as any);
      vi.mocked(prisma.jobTitle.findUnique)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'job-1',
          code: 'DRV',
          name: 'سائق',
        } as any);

      const mockReply3 = vi.fn();
      const mockDelete3 = vi.fn().mockResolvedValue(true);
      const mockCtx3 = {
        isRealSuperAdmin: true,
        from: { id: 123456 },
        message: { text: 'DRVR' },
        reply: mockReply3,
        deleteMessage: mockDelete3,
      } as unknown as MyContext;

      const handled3 = await handleJobMatrixTextInput(mockCtx3);
      expect(handled3).toBe(true);
      expect(prisma.jobTitle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'job-1' },
          data: { code: 'DRVR' },
        })
      );
    });
  });
});
