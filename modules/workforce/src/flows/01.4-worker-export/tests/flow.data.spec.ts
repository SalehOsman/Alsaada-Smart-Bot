import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ExcelJS from 'exceljs';
import { encryptField, normalizeKeyToHex } from '@alsaada/database';
import { WorkerExportService } from '../flow.service.js';
import { WorkerExportRepository } from '../flow.repository.js';
import type { WorkerExportEntity } from '../flow.types.js';

describe('Flow 01.4 Data Tests — Formatting, RTL Alignment & Standard Dates', () => {
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

  it('formats dates as DD-MM-YYYY and enforces RTL workbook views', async () => {
    // Arrange
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

    // Act
    const result = await service.generateWorkersExportBuffer({ type: 'ALL' }, true);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const sheet = workbook.getWorksheet('كشف العاملين');

    // Assert
    expect(sheet).toBeDefined();
    const views = sheet?.views;
    expect(views?.[0]?.rightToLeft).toBe(true);

    const workerRow = sheet?.getRow(5);
    expect(workerRow).toBeDefined();

    const birthDateCell = workerRow?.getCell(11).text;
    expect(birthDateCell).toMatch(/^\d{2}-\d{2}-\d{4}$/);

    const hireDateCell = workerRow?.getCell(18).text;
    expect(hireDateCell).toMatch(/^\d{2}-\d{2}-\d{4}$/);

    const expiryDateCell = workerRow?.getCell(24).text;
    expect(expiryDateCell).toMatch(/^\d{2}-\d{2}-\d{4}$/);
  });

  it('decrypts encrypted fields accurately using normalized key and hides encrypted artifacts', async () => {
    // Arrange
    const rawPassphrase = 'my-custom-passphrase-key!';
    const normalizedKey = normalizeKeyToHex(rawPassphrase);

    const plainNationalId = '29505151201531';
    const plainPhone = '01099887766';
    const plainEmergency = '01233445566';
    const plainAccount = 'EG120002000100000012345678';

    const mockEncryptedWorker: WorkerExportEntity = {
      id: 'wrk-enc-1',
      code: 'OP-SEC-0002',
      legacyCode: null,
      fullName: 'محمود عبد السلام عثمان',
      nickname: null,
      nationalIdEncrypted: encryptField(plainNationalId, normalizedKey),
      idType: 'NATIONAL_ID',
      nationality: 'مصري',
      birthDate: new Date('1995-05-15T00:00:00.000Z'),
      gender: 'MALE',
      governorateCode: '01',
      jobTitle: 'مشغل معدات',
      departmentId: null,
      jobTitleId: null,
      siteId: 'site-1',
      hireDate: new Date('2024-01-01T00:00:00.000Z'),
      contractType: 'PERMANENT',
      shiftSystem: 'دورة 20+10',
      dailyWage: 300,
      basicSalary: 9000,
      fixedAllowances: 2000,
      paymentMethod: 'BANK_TRANSFER',
      walletType: 'بنك مصر',
      accountNumberEncrypted: encryptField(plainAccount, normalizedKey),
      canteenCigarettePolicy: 'NONE',
      phoneEncrypted: encryptField(plainPhone, normalizedKey),
      emergencyPhoneEncrypted: encryptField(plainEmergency, normalizedKey),
      emergencyContactName: 'عثمان',
      drivingLicense: 'درجة ثانية',
      militaryStatus: 'أدى الخدمة',
      maritalStatus: 'متزوج',
      idCardExpiryDate: new Date('2029-01-01T00:00:00.000Z'),
      address: 'القاهرة',
      status: 'ACTIVE',
      site: { id: 'site-1', name: 'المقر الرئيسي' },
      department: null,
      jobRef: null,
    };

    const mockRepo = {
      getActiveJobs: vi.fn().mockResolvedValue([]),
      getActiveSites: vi.fn().mockResolvedValue([]),
      getDepartments: vi.fn().mockResolvedValue([]),
      getDepartmentById: vi.fn().mockResolvedValue(null),
      getJobTitleById: vi.fn().mockResolvedValue(null),
      getWorkersForExport: vi.fn().mockResolvedValue([mockEncryptedWorker]),
    } as unknown as WorkerExportRepository;

    const service = new WorkerExportService(mockRepo, rawPassphrase);

    // Act
    const result = await service.generateWorkersExportBuffer({ type: 'ALL' }, true);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const sheet = workbook.getWorksheet('كشف العاملين');
    const workerRow = sheet?.getRow(5);

    // Assert
    expect(sheet).toBeDefined();
    expect(workerRow).toBeDefined();

    expect(workerRow?.getCell(10).text).toBe(plainNationalId);
    expect(workerRow?.getCell(10).text).not.toBe(mockEncryptedWorker.nationalIdEncrypted);

    expect(workerRow?.getCell(15).text).toBe(plainPhone);
    expect(workerRow?.getCell(15).text).not.toBe(mockEncryptedWorker.phoneEncrypted);

    expect(workerRow?.getCell(16).text).toBe(plainEmergency);
    expect(workerRow?.getCell(39).text).toBe(plainAccount);
  });
});
