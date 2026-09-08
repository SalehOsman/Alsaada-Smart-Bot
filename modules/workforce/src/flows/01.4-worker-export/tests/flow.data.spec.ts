import { describe, it, expect, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { WorkerExportService } from '../flow.service.js';
import { WorkerExportRepository } from '../flow.repository.js';
import type { WorkerExportEntity } from '../flow.types.js';

describe('Flow 01.4 Data Tests — Formatting, RTL Alignment & Standard Dates', () => {
  it('should format dates as DD-MM-YYYY and enforce RTL workbook views', async () => {
    const mockWorker: WorkerExportEntity = {
      id: 'wrk-1',
      code: 'OP-DRV-0001',
      legacyCode: null,
      fullName: 'أحمد محمود علي إبراهيم',
      nickname: null,
      nationalIdEncrypted: '29001012701234',
      idType: 'NATIONAL_ID',
      nationality: 'مصري',
      birthDate: new Date('1990-01-15T00:00:00.000Z'),
      gender: 'MALE',
      governorateCode: '27',
      jobTitle: 'سائق',
      departmentId: null,
      jobTitleId: null,
      siteId: 'site-1',
      hireDate: new Date('2023-05-20T00:00:00.000Z'),
      contractType: 'PERMANENT',
      shiftSystem: 'دورة 30+10',
      dailyWage: 250,
      basicSalary: 7500,
      fixedAllowances: 1500,
      paymentMethod: 'CASH_SITE',
      walletType: null,
      accountNumberEncrypted: null,
      canteenCigarettePolicy: 'NONE',
      phoneEncrypted: '01012345678',
      emergencyPhoneEncrypted: null,
      emergencyContactName: null,
      drivingLicense: 'درجة أولى',
      militaryStatus: 'إعفاء نهائي',
      maritalStatus: 'أعزب',
      idCardExpiryDate: new Date('2028-05-26T00:00:00.000Z'),
      address: 'قنا',
      status: 'ACTIVE',
      site: { id: 'site-1', name: 'السباعية' },
      department: null,
      jobRef: null,
    };

    const mockRepo = {
      getActiveJobs: vi.fn().mockResolvedValue([]),
      getActiveSites: vi.fn().mockResolvedValue([]),
      getDepartments: vi.fn().mockResolvedValue([]),
      getDepartmentById: vi.fn().mockResolvedValue(null),
      getJobTitleById: vi.fn().mockResolvedValue(null),
      getWorkersForExport: vi.fn().mockResolvedValue([mockWorker]),
    } as unknown as WorkerExportRepository;

    const service = new WorkerExportService(mockRepo);
    const result = await service.generateWorkersExportBuffer({ type: 'ALL' }, true);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.buffer);
    const sheet = workbook.getWorksheet('كشف العاملين');
    expect(sheet).toBeDefined();

    // Verify RTL view
    const views = sheet?.views;
    expect(views?.[0]?.rightToLeft).toBe(true);

    // Row 5 contains worker 1
    const workerRow = sheet?.getRow(5);
    expect(workerRow).toBeDefined();

    // Column 11: Birth Date (DD-MM-YYYY)
    const birthDateCell = workerRow?.getCell(11).text;
    expect(birthDateCell).toMatch(/^\d{2}-\d{2}-\d{4}$/);

    // Column 18: Hire Date (DD-MM-YYYY)
    const hireDateCell = workerRow?.getCell(18).text;
    expect(hireDateCell).toMatch(/^\d{2}-\d{2}-\d{4}$/);

    // Column 24: Expiry Date (DD-MM-YYYY)
    const expiryDateCell = workerRow?.getCell(24).text;
    expect(expiryDateCell).toMatch(/^\d{2}-\d{2}-\d{4}$/);
  });
});
