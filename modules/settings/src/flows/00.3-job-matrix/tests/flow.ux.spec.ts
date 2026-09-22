import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildDepartmentsListKeyboard,
  buildDepartmentDetailKeyboard,
  buildJobDetailKeyboard,
  buildCancelEditKeyboard,
} from '../flow.keyboard.js';
import type { DepartmentDto, JobTitleDto } from '../flow.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.3 UX Tests — الهيكل الوظيفي ومصفوفة المهن والورديات', () => {
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

  it('generates standard navigation keyboard when departments list is empty', () => {
    // Arrange
    const depts: DepartmentDto[] = [];
    const isImpersonating = false;

    // Act
    const kb = buildDepartmentsListKeyboard(depts, isImpersonating);

    // Assert
    expect(kb).toBeDefined();
    expect(kb.inline_keyboard.length).toBeGreaterThan(0);
    const hasExitImpersonate = kb.inline_keyboard.some((row) =>
      row.some((btn) => 'callback_data' in btn && btn.callback_data === 'action:exit_impersonate')
    );
    expect(hasExitImpersonate).toBe(false);
  });

  it('injects exit impersonation button when supervisor simulation is active', () => {
    // Arrange
    const depts: DepartmentDto[] = [];
    const isImpersonating = true;

    // Act
    const kb = buildDepartmentsListKeyboard(depts, isImpersonating);

    // Assert
    expect(kb).toBeDefined();
    const hasExitImpersonate = kb.inline_keyboard.some((row) =>
      row.some((btn) => 'callback_data' in btn && btn.callback_data === 'action:exit_impersonate')
    );
    expect(hasExitImpersonate).toBe(true);
  });

  it('renders department detail keyboard with active job listings', () => {
    // Arrange
    const dept: DepartmentDto = {
      id: 'd-1',
      code: 'ENG',
      name: 'الإدارة الهندسية',
      isActive: true,
      jobsCount: 1,
      activeJobsCount: 1,
    };
    const jobs: JobTitleDto[] = [
      {
        id: 'j-1',
        code: 'ENG-CIVIL',
        title: 'مهندس موقع',
        departmentId: 'd-1',
        departmentName: 'الإدارة الهندسية',
        departmentCode: 'ENG',
        isActive: true,
        minHeadcount: 2,
        baseSalary: 12000,
        allowance: 2000,
        workDays: 20,
        restDays: 10,
        workerCount: 5,
      },
    ];

    // Act
    const kb = buildDepartmentDetailKeyboard(dept, jobs);

    // Assert
    expect(kb).toBeDefined();
    const jobButton = kb.inline_keyboard[0]?.[0];
    expect(jobButton && 'callback_data' in jobButton ? jobButton.callback_data : '').toBe('action:job:view:ENG:ENG-CIVIL');
    expect(jobButton?.text).toContain('مهندس موقع');
  });

  it('renders job detail keyboard with headcount adjustment controls', () => {
    // Arrange
    const job: JobTitleDto = {
      id: 'j-1',
      code: 'OP-LDR',
      title: 'سائق لودر',
      departmentId: 'd-2',
      departmentName: 'التشغيل',
      departmentCode: 'OP',
      isActive: true,
      minHeadcount: 4,
      baseSalary: 9000,
      allowance: 1000,
      workDays: 24,
      restDays: 6,
      workerCount: 3,
    };

    // Act
    const kb = buildJobDetailKeyboard(job);

    // Assert
    expect(kb).toBeDefined();
    const incBtn = kb.inline_keyboard[0]?.find((b) => 'callback_data' in b && b.callback_data.includes(':inc'));
    const decBtn = kb.inline_keyboard[0]?.find((b) => 'callback_data' in b && b.callback_data.includes(':dec'));
    expect(incBtn && 'callback_data' in incBtn ? incBtn.callback_data : '').toBe('action:job:headcount:OP:OP-LDR:inc');
    expect(decBtn && 'callback_data' in decBtn ? decBtn.callback_data : '').toBe('action:job:headcount:OP:OP-LDR:dec');
  });

  it('renders cancel keyboard returning to job view callback', () => {
    // Arrange
    const deptCode = 'ENG';
    const jobCode = 'ENG-CIVIL';

    // Act
    const kb = buildCancelEditKeyboard(deptCode, jobCode);

    // Assert
    expect(kb).toBeDefined();
    const cancelBtn = kb.inline_keyboard[0]?.[0];
    expect(cancelBtn && 'callback_data' in cancelBtn ? cancelBtn.callback_data : '').toBe('action:job:view:ENG:ENG-CIVIL');
  });
});
