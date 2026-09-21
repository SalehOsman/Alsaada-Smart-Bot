import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerRegistrationService } from '../flow.service.js';
import { WorkerRegistrationRepository } from '../flow.repository.js';
import { WorkerRegistrationMessages } from '../flow.messages.js';
import { WorkerWizardStep } from '../flow.types.js';
import type { PrismaClient } from '@alsaada/database';

describe('Flow 01.1 Integration Tests — Atomic Worker Registration & Outbox', () => {
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

  it('atomically persists worker, audit log, and outbox event upon registration', async () => {
    // Arrange
    const createdWorkerMock = {
      id: 'worker-uuid-1',
      code: 'OP-DRV-001',
      name: 'محمود علي إبراهيم',
      nickname: 'محمود علي',
      jobTitle: 'سائق لودر',
      hireDate: new Date('2026-09-01'),
      shiftSystem: '20_WORK_10_REST',
      site: { id: 'site-1', name: 'موقع السباعية' },
    };

    let auditLogCreated = false;
    let outboxCreated = false;

    const mockPrisma = {
      worker: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(createdWorkerMock),
      },
      auditLog: {
        create: vi.fn().mockImplementation(() => {
          auditLogCreated = true;
          return Promise.resolve({ id: 'audit-1' });
        }),
      },
      outboxEvent: {
        create: vi.fn().mockImplementation(() => {
          outboxCreated = true;
          return Promise.resolve({ id: 'outbox-1' });
        }),
      },
      jobTitle: {
        findUnique: vi.fn().mockResolvedValue({
          code: 'DRV',
          department: { code: 'OP' },
        }),
      },
      $transaction: vi.fn().mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        return callback(mockPrisma);
      }),
    } as unknown as PrismaClient;

    const repo = new WorkerRegistrationRepository(mockPrisma);
    const service = new WorkerRegistrationService(repo);

    // Act
    const result = await service.registerWorker(
      {
        name: 'محمود علي إبراهيم',
        idType: 'NATIONAL_ID',
        idNumber: '29001012701234',
        phone: '01012345678',
        jobTitleName: 'سائق لودر',
        jobTitleId: 'job-uuid-1',
        siteName: 'موقع السباعية',
      },
      BigInt(99887766),
      'FIELD_ADMIN'
    );

    // Assert
    expect(result.code).toBe('OP-DRV-001');
    expect(result.name).toBe('محمود علي إبراهيم');
    expect(auditLogCreated).toBe(true);
    expect(outboxCreated).toBe(true);
  });

  it('blocks duplicate registrations when an existing worker shares the same national ID', async () => {
    // Arrange
    const mockPrisma = {
      worker: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'existing-id',
          code: 'OP-DRV-001',
          name: 'سعيد عبد الله',
          jobTitle: 'سائق',
          site: { name: 'الموقع القديم' },
        }),
      },
    } as unknown as PrismaClient;

    const repo = new WorkerRegistrationRepository(mockPrisma);
    const service = new WorkerRegistrationService(repo);

    // Act & Assert
    // Act
    const registrationPromise = service.registerWorker({
      name: 'سعيد عبد الله الجديد',
      idType: 'NATIONAL_ID',
      idNumber: '29001012701234',
      phone: '01012345678',
      jobTitleName: 'سائق',
    });

    // Assert
    await expect(registrationPromise).rejects.toThrow(/تعارض/);
  });

  it('persists additionalSalary, default contractType to PERMANENT, and calculates dailyWage internally', async () => {
    // Arrange
    let workerCreateData: Record<string, unknown> | null = null;
    let salaryHistoryData: Record<string, unknown> | null = null;

    const mockPrisma = {
      worker: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
          workerCreateData = args.data;
          return Promise.resolve({
            id: 'worker-uuid-2',
            code: 'OP-DRV-002',
            name: 'حسن إبراهيم علي',
            site: { id: 'site-1', name: 'موقع الوادي' },
            ...args.data,
          });
        }),
      },
      salaryHistory: {
        create: vi.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
          salaryHistoryData = args.data;
          return Promise.resolve({ id: 'sal-1', ...args.data });
        }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      outboxEvent: {
        create: vi.fn().mockResolvedValue({ id: 'outbox-1' }),
      },
      jobTitle: {
        findUnique: vi.fn().mockResolvedValue({
          code: 'DRV',
          department: { code: 'OP' },
        }),
      },
      $transaction: vi.fn().mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback(mockPrisma)),
    } as unknown as PrismaClient;

    const repo = new WorkerRegistrationRepository(mockPrisma);
    const service = new WorkerRegistrationService(repo);

    // Act
    await service.registerWorker(
      {
        name: 'حسن إبراهيم علي',
        idType: 'NATIONAL_ID',
        idNumber: '29001012701234',
        phone: '01099887766',
        jobTitleName: 'سائق لودر',
        jobTitleId: 'job-uuid-1',
        siteName: 'موقع الوادي',
        basicSalary: 6000,
        additionalSalary: 3000,
      },
      BigInt(12345678),
      'SUPER_ADMIN'
    );

    // Assert
    expect(workerCreateData).not.toBeNull();
    if (!workerCreateData || !salaryHistoryData) throw new Error('Expected mock data to be defined');
    const wData = workerCreateData;
    expect(wData['contractType']).toBe('PERMANENT');
    expect(Number(wData['basicSalary'])).toBe(6000);
    expect(Number(wData['additionalSalary'])).toBe(3000);
    expect(Number(wData['dailyWage'])).toBe(300);

    expect(salaryHistoryData).not.toBeNull();
    const sData = salaryHistoryData;
    expect(Number(sData['newBasicSalary'])).toBe(6000);
    expect(Number(sData['newAdditionalSalary'])).toBe(3000);
    expect(Number(sData['newGrossSalary'])).toBe(9000);
  });

  it('detects duplicate phone or wallet number via blind index', async () => {
    // Arrange
    const mockPrisma = {
      worker: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'existing-w',
          code: 'OP-HLP-010',
          name: 'سمير خليل',
          jobTitle: 'مساعد فني',
          phoneMasked: '010****5678',
        }),
      },
    } as unknown as PrismaClient;

    const repo = new WorkerRegistrationRepository(mockPrisma);
    const service = new WorkerRegistrationService(repo);

    // Act
    const check = await service.checkPhoneOrWalletDuplicate('01012345678');

    // Assert
    expect(check.isDuplicate).toBe(true);
    expect(check.existingWorker?.code).toBe('OP-HLP-010');
    expect(check.existingWorker?.name).toBe('سمير خليل');
  });

  it('detects duplicate phone or wallet number with +20 and 20 prefix normalization', async () => {
    // Arrange
    const mockPrisma = {
      worker: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'existing-w',
          code: 'OP-HLP-010',
          name: 'سمير خليل',
          jobTitle: 'مساعد فني',
          phoneMasked: '010****5678',
        }),
      },
    } as unknown as PrismaClient;

    const repo = new WorkerRegistrationRepository(mockPrisma);
    const service = new WorkerRegistrationService(repo);

    // Act
    const checkWithPlus = await service.checkPhoneOrWalletDuplicate('+201012345678');
    const checkWith20 = await service.checkPhoneOrWalletDuplicate('201012345678');

    // Assert
    expect(checkWithPlus.isDuplicate).toBe(true);
    expect(checkWith20.isDuplicate).toBe(true);
  });

  it('renders confirmation card with basic and additional salary while strictly hiding dailyWage and translating payoutMethod', () => {
    // Arrange
    const state = {
      currentStep: WorkerWizardStep.CONFIRMATION,
      name: 'أحمد سعيد منصور',
      nickname: 'أحمد سعيد',
      idType: 'NATIONAL_ID' as const,
      idNumber: '29001012701234',
      phone: '01012345678',
      jobTitleName: 'مشغل كسارة',
      siteName: 'موقع السباعية',
      hireDate: '2026-09-15',
      shiftSystem: '20 يوم عمل / 10 راحة',
      basicSalary: 7500,
      additionalSalary: 2500,
      paymentMethod: 'VODAFONE_CASH',
      accountNumber: '01012345678',
    };

    // Act
    const card = WorkerRegistrationMessages.confirmationCard(state, 'SUPER_ADMIN');
    const maskedCard = WorkerRegistrationMessages.confirmationCard(state, 'FIELD_ADMIN');

    // Assert
    expect(card).toContain('الراتب الأساسي الشهري');
    expect(card).toContain('الراتب الإضافي الشهري');
    expect(card).toContain('إجمالي الراتب الشهري');
    expect(card).toContain('محفظة فودافون كاش');
    expect(card).not.toContain('VODAFONE_CASH');
    expect(card).not.toContain('أجر يومي');
    expect(card).not.toContain('اليومية');
    expect(card).not.toContain('dailyWage');

    // Verify FIELD_ADMIN completely hides all 3 salary lines
    expect(maskedCard).not.toContain('الراتب الأساسي الشهري');
    expect(maskedCard).not.toContain('الراتب الإضافي الشهري');
    expect(maskedCard).not.toContain('إجمالي الراتب الشهري');
  });

  it('successfully registers foreign worker with passport, storing birthDate and gender atomically', async () => {
    // Arrange
    let workerCreateData: Record<string, unknown> | null = null;

    const mockPrisma = {
      worker: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
          workerCreateData = args.data;
          return Promise.resolve({
            id: 'worker-uuid-pass',
            code: 'OP-ENG-001',
            name: 'جون دو سميث',
            site: { id: 'site-1', name: 'موقع السباعية' },
            ...args.data,
          });
        }),
      },
      salaryHistory: {
        create: vi.fn().mockResolvedValue({ id: 'sal-pass' }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-pass' }),
      },
      outboxEvent: {
        create: vi.fn().mockResolvedValue({ id: 'outbox-pass' }),
      },
      jobTitle: {
        findUnique: vi.fn().mockResolvedValue({
          code: 'ENG',
          department: { code: 'OP' },
        }),
      },
      $transaction: vi.fn().mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback(mockPrisma)),
    } as unknown as PrismaClient;

    const repo = new WorkerRegistrationRepository(mockPrisma);
    const service = new WorkerRegistrationService(repo);

    // Act
    const result = await service.registerWorker({
      name: 'جون دو سميث',
      idType: 'PASSPORT',
      idNumber: 'A12345678',
      birthDate: new Date('1988-03-15'),
      gender: 'MALE',
      phone: '01011223344',
      jobTitleName: 'مهندس عمليات',
      jobTitleId: 'job-eng-1',
      siteName: 'موقع السباعية',
      basicSalary: 12000,
      additionalSalary: 4000,
    });

    // Assert
    expect(result.code).toBe('OP-ENG-001');
    expect(workerCreateData).not.toBeNull();
    if (!workerCreateData) throw new Error('Expected workerCreateData to be defined');
    const wData = workerCreateData;
    expect(wData['idType']).toBe('PASSPORT');
    expect(wData['governorateCode']).toBe('88');
    expect(wData['contractType']).toBe('PERMANENT');
    expect(Number(wData['dailyWage'])).toBe(533.33);
  });

  it('saves front and back ID photos to worker directory and creates WorkerDocument records', async () => {
    // Arrange
    const createdDocuments: Record<string, unknown>[] = [];
    let workerCreateData: Record<string, unknown> | null = null;

    const mockPrisma = {
      worker: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          workerCreateData = data;
          return Promise.resolve({
            id: 'worker-id-photo-1',
            code: 'OP-DRV-001',
            name: 'سعيد عبد الله',
            jobTitle: 'سائق',
            idType: 'NATIONAL_ID',
            hireDate: new Date('2026-09-01'),
            site: { id: 'site-1', name: 'موقع السباعية' },
          });
        }),
      },
      workerDocument: {
        create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          createdDocuments.push(data);
          return Promise.resolve({ id: `doc-${createdDocuments.length}`, ...data });
        }),
      },
      jobTitle: {
        findUnique: vi.fn().mockResolvedValue({
          code: 'DRV',
          department: { code: 'OP' },
        }),
      },
      $transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)),
    } as unknown as PrismaClient;

    const repo = new WorkerRegistrationRepository(mockPrisma);
    const service = new WorkerRegistrationService(repo);

    const frontBuffer = Buffer.from('fake-front-id-photo-data');
    const backBuffer = Buffer.from('fake-back-id-photo-data');

    // Act
    const result = await service.registerWorker({
      name: 'سعيد عبد الله',
      idType: 'NATIONAL_ID',
      idNumber: '29001012701234',
      phone: '01012345678',
      jobTitleName: 'سائق',
      jobTitleId: 'job-drv-1',
      siteName: 'موقع السباعية',
      frontPhotoBuffer: frontBuffer,
      backPhotoBuffer: backBuffer,
    });

    // Assert
    expect(result.code).toBe('OP-DRV-001');
    expect(String(workerCreateData?.['idCardFrontPath'])).toContain('attachments/workers/OP-DRV-001/OP-DRV-001_front.jpg');
    expect(String(workerCreateData?.['idCardBackPath'])).toContain('attachments/workers/OP-DRV-001/OP-DRV-001_back.jpg');
    expect(createdDocuments.length).toBe(2);
    expect(createdDocuments[0]!['category']).toBe('NATIONAL_ID');
    expect(createdDocuments[0]!['fileUri']).toBe(workerCreateData?.['idCardFrontPath']);
    expect(createdDocuments[1]!['category']).toBe('NATIONAL_ID');
    expect(createdDocuments[1]!['fileUri']).toBe(workerCreateData?.['idCardBackPath']);
  });
});
