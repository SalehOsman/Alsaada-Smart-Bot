import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ExcelJS from 'exceljs';
import { WorkerExportService } from '../flow.service.js';
import { WorkerExportRepository } from '../flow.repository.js';

describe('Flow 01.4 Integration Tests — Excel Import & Outbox Events', () => {
  const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

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

  it('validates and imports worker rows atomically with outbox events', async () => {
    // Arrange
    const mockSave = vi.fn().mockResolvedValue({
      createdCount: 1,
      createdCodes: ['W-1234-1'],
    });

    const mockRepo = {
      getActiveJobs: vi.fn().mockResolvedValue([
        { id: 'job-1', name: 'سائق لودر ومعدات ثقيلة', code: 'OP-DRV' },
      ]),
      getActiveSites: vi.fn().mockResolvedValue([
        { id: 'site-1', name: 'موقع السباعية', code: 'SBY-01' },
      ]),
      getDepartments: vi.fn().mockResolvedValue([]),
      getDepartmentById: vi.fn().mockResolvedValue(null),
      getJobTitleById: vi.fn().mockResolvedValue(null),
      getWorkersForExport: vi.fn().mockResolvedValue([]),
      saveImportedWorkersAtomic: mockSave,
    } as unknown as WorkerExportRepository;

    const service = new WorkerExportService(mockRepo);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('بيانات العمال الجدد');
    sheet.addRow([
      'الاسم الرباعي *',
      'اسم الشهرة',
      'كود قديم',
      'نوع الإثبات *',
      'رقم الإثبات *',
      'الجنسية',
      'تاريخ الميلاد',
      'النوع',
      'رقم الهاتف *',
      'كود الوظيفة *',
      'كود الموقع *',
      'تاريخ المباشرة',
      'طريقة استلام الراتب',
    ]);
    sheet.addRow([
      'إبراهيم عادل كمال حسني',
      'هيما',
      '',
      'رقم قومي',
      '29205152701234',
      'مصري',
      '',
      'ذكر',
      '01012345678',
      'OP-DRV',
      'SBY-01',
      '2026-02-01',
      'CASH_SITE',
    ]);

    const rawBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(rawBuffer);

    // Act
    const result = await service.parseAndImportExcel(buffer);

    // Assert
    expect(result.success).toBe(true);
    expect(result.workersCreated).toBe(1);
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('fails closed when a row contains invalid data and blocks database persistence', async () => {
    // Arrange
    const mockSave = vi.fn();
    const mockRepo = {
      getActiveJobs: vi.fn().mockResolvedValue([
        { id: 'job-1', name: 'سائق لودر ومعدات ثقيلة', code: 'OP-DRV' },
      ]),
      getActiveSites: vi.fn().mockResolvedValue([
        { id: 'site-1', name: 'موقع السباعية', code: 'SBY-01' },
      ]),
      saveImportedWorkersAtomic: mockSave,
    } as unknown as WorkerExportRepository;

    const service = new WorkerExportService(mockRepo);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('بيانات العمال الجدد');
    sheet.addRow(['الاسم الرباعي *', '', '', 'نوع الإثبات *', 'رقم الإثبات *', '', '', '', 'رقم الهاتف *', 'كود الوظيفة *', 'كود الموقع *']);
    sheet.addRow(['علي أحمد', '', '', 'رقم قومي', '123', '', '', '', '010', 'INVALID_JOB', 'INVALID_SITE']);

    const rawBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(rawBuffer);

    // Act
    const result = await service.parseAndImportExcel(buffer);

    // Assert
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(mockSave).not.toHaveBeenCalled();
  });
});
