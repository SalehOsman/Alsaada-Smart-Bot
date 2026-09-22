import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerOffboardingRepository } from '../flow.repository.js';
import type { PrismaClient } from '@alsaada/database';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('01.8 Worker Offboarding Repository — Empirical Adversarial & Stress Testing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ==========================================================================
  // STRESS SUITE 1: Extreme Conditions & Null Values in Profile Aggregation
  // ==========================================================================
  describe('STRESS 1: Extreme Conditions & Null Values in getWorkerClearanceProfile', () => {
    it('handles worker with pure empty collections and null optional attributes in clearance profile', async () => {
      // Arrange
      const mockPrisma = {
        worker: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'worker-empty-001',
            code: 'OP-EMP-001',
            legacyCode: null,
            name: 'محمود عبد الفتاح',
            nickname: null,
            jobTitle: 'عامل عادي',
            dailyWage: 0,
            basicSalary: 0,
            fixedAllowances: 0,
            status: 'ACTIVE',
            telegramId: null,
            siteId: null,
            site: null,
            department: null,
            hireDate: null,
            shiftSystem: undefined,
          }),
        },
        leave: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        pPEAsset: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        advanceInstallment: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        disciplinaryAndBonus: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      };

      const repo = new WorkerOffboardingRepository(mockPrisma as unknown as PrismaClient);

      // Act
      const profile = await repo.getWorkerClearanceProfile('worker-empty-001');

      // Assert
      expect(profile.worker.id).toBe('worker-empty-001');
      expect(profile.worker.nickname).toBeNull();
      expect(profile.worker.siteName).toBeNull();
      expect(profile.worker.departmentName).toBeNull();
      expect(profile.worker.dailyWage).toBe(0);
      expect(profile.worker.basicSalary).toBe(0);
      expect(profile.worker.telegramId).toBeNull();

      expect(profile.activeLeave).toBeNull();
      expect(profile.ppeAssets).toEqual([]);
      expect(profile.advances.totalOutstandingAdvances).toBe(0);
      expect(profile.advances.unsettledInstallments).toEqual([]);
      expect(profile.pendingDisciplinaryRecords).toEqual([]);
      expect(profile.approvedDisciplinaryRecords).toEqual([]);

      expect(profile.stats?.totalApprovedBonuses).toBe(0);
      expect(profile.stats?.totalApprovedPenalties).toBe(0);
      expect(profile.stats?.totalPendingPenalties).toBe(0);
      expect(profile.stats?.totalPendingBonuses).toBe(0);
    });

    it('throws descriptive error when worker record is not found', async () => {
      // Arrange
      const mockPrisma = {
        worker: { findUnique: vi.fn().mockResolvedValue(null) },
        leave: { findFirst: vi.fn().mockResolvedValue(null) },
        pPEAsset: { findMany: vi.fn().mockResolvedValue([]) },
        advanceInstallment: { findMany: vi.fn().mockResolvedValue([]) },
        disciplinaryAndBonus: { findMany: vi.fn().mockResolvedValue([]) },
      };

      const repo = new WorkerOffboardingRepository(mockPrisma as unknown as PrismaClient);

      // Act & Assert
      // Act
      const notFoundPromise = repo.getWorkerClearanceProfile('non-existent-worker');

      // Assert
      await expect(notFoundPromise).rejects.toThrow(
        'لم يتم العثور على سجل العامل بالمعرف: non-existent-worker'
      );
    });

    it('calculates boundary conditions and overdue reporting for active overdue leave', async () => {
      // Arrange
      const pastDeparture = new Date('2026-08-01T08:00:00Z');
      const pastExpectedReturn = new Date('2026-08-15T18:00:00Z');

      const mockPrisma = {
        worker: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'worker-overdue-leave',
            code: 'OP-OD-002',
            name: 'رمضان السعيد',
            nickname: 'أبو صيام',
            status: 'ON_LEAVE',
            dailyWage: 250,
            basicSalary: 7500,
            fixedAllowances: 0,
            telegramId: 55667788n,
          }),
        },
        leave: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'lv-overdue-1',
            leaveNumber: '#LV-2026-0899',
            leaveType: 'CASUAL',
            departureDate: pastDeparture,
            expectedReturnDate: pastExpectedReturn,
            actualReturnDate: null,
            status: 'OVERDUE',
            overdueDays: 27,
          }),
        },
        pPEAsset: { findMany: vi.fn().mockResolvedValue([]) },
        advanceInstallment: { findMany: vi.fn().mockResolvedValue([]) },
        disciplinaryAndBonus: { findMany: vi.fn().mockResolvedValue([]) },
      };

      const repo = new WorkerOffboardingRepository(mockPrisma as unknown as PrismaClient);

      // Act
      const profile = await repo.getWorkerClearanceProfile('worker-overdue-leave');

      // Assert
      expect(profile.activeLeave?.leaveNumber).toBe('#LV-2026-0899');
      expect(profile.activeLeave?.status).toBe('OVERDUE');
      expect(profile.activeLeave?.overdueDays).toBe(27);
      expect(profile.activeLeave?.daysBeforeLeave).toBe(0);
      expect(profile.activeLeave?.daysUntilExpectedReturn).toBe(15);
    });

    it('aggregates damaged PPE and pending disciplinary records of all types', async () => {
      // Arrange
      const mockPrisma = {
        worker: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'w-damaged-ppe',
            code: 'OP-044',
            name: 'سامح إبراهيم',
            nickname: 'سامح',
            status: 'ACTIVE',
            dailyWage: 300,
            basicSalary: 9000,
            fixedAllowances: 1000,
            telegramId: 99112233n,
          }),
        },
        leave: { findFirst: vi.fn().mockResolvedValue(null) },
        pPEAsset: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'ppe-1',
              voucherId: '#PPE-001',
              assetType: 'SAFETY_HELMET',
              condition: 'DAMAGED_NATURAL',
              costPrice: 400,
              returnDate: null,
              issueDate: new Date('2025-10-01T00:00:00Z'),
            },
            {
              id: 'ppe-2',
              voucherId: '#PPE-002',
              assetType: 'SAFETY_SHOES',
              condition: 'LOST_NEGLIGENT',
              costPrice: 850,
              returnDate: null,
              issueDate: new Date('2026-01-15T00:00:00Z'),
            },
            {
              id: 'ppe-3',
              voucherId: '#PPE-003',
              assetType: 'UNKNOWN_EQUIPMENT_TYPE',
              condition: 'GOOD',
              costPrice: 200,
              returnDate: null,
              issueDate: new Date('2026-03-01T00:00:00Z'),
            },
          ]),
        },
        advanceInstallment: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'inst-10',
              originalVoucherNumber: '#VCH-010',
              installmentSequence: 2,
              dueMonth: '2026-09',
              installmentAmount: 750,
              status: 'PENDING',
            },
            {
              id: 'inst-11',
              originalVoucherNumber: '#VCH-011',
              installmentSequence: 3,
              dueMonth: '2026-10',
              installmentAmount: 750,
              status: 'PENDING',
            },
          ]),
        },
        disciplinaryAndBonus: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'disc-pending-cash',
              recordNumber: '#PEN-001',
              type: 'PENALTY_CASH',
              amount: 500,
              daysEquivalent: null,
              reason: 'إتلاف معدة تشغيل',
              approvedByUserId: null,
              createdAt: new Date('2026-09-10T00:00:00Z'),
              worker: { nickname: 'سامح' },
            },
            {
              id: 'disc-pending-days',
              recordNumber: '#PEN-002',
              type: 'PENALTY_DAYS',
              amount: null,
              daysEquivalent: 3,
              reason: 'غياب بدون إذن',
              approvedByUserId: null,
              createdAt: new Date('2026-09-10T00:00:00Z'),
              worker: { nickname: 'سامح' },
            },
            {
              id: 'disc-pending-bonus',
              recordNumber: '#BON-001',
              type: 'BONUS_CASH',
              amount: 600,
              daysEquivalent: null,
              reason: 'إتقان صيانة استثنائية',
              approvedByUserId: null,
              createdAt: new Date('2026-09-10T00:00:00Z'),
              worker: { nickname: 'سامح' },
            },
            {
              id: 'disc-approved-penalty',
              recordNumber: '#PEN-APP-001',
              type: 'PENALTY_CASH',
              amount: 200,
              daysEquivalent: null,
              reason: 'تأخير متكرر',
              approvedByUserId: 1001n,
              createdAt: new Date('2026-09-10T00:00:00Z'),
              worker: { nickname: 'سامح' },
            },
          ]),
        },
      };

      const repo = new WorkerOffboardingRepository(mockPrisma as unknown as PrismaClient);

      // Act
      const profile = await repo.getWorkerClearanceProfile('w-damaged-ppe');

      // Assert
      expect(profile.ppeAssets).toHaveLength(3);
      expect(profile.ppeAssets[0]?.isDamagedOrLost).toBe(true);
      expect(profile.ppeAssets[0]?.name).toBe('خوذة أمان معتمدة');
      expect(profile.ppeAssets[1]?.isDamagedOrLost).toBe(true);
      expect(profile.ppeAssets[1]?.name).toBe('حذاء أمان (سيفتي)');
      expect(profile.ppeAssets[2]?.isDamagedOrLost).toBe(false);
      expect(profile.ppeAssets[2]?.name).toBe('UNKNOWN_EQUIPMENT_TYPE');

      expect(profile.advances.totalOutstandingAdvances).toBe(1500);
      expect(profile.advances.unsettledInstallments).toHaveLength(2);

      expect(profile.pendingDisciplinaryRecords).toHaveLength(3);
      expect(profile.approvedDisciplinaryRecords).toHaveLength(1);
      expect(profile.stats?.totalPendingPenalties).toBe(500);
      expect(profile.stats?.totalPendingPenaltyDays).toBe(3);
      expect(profile.stats?.totalPendingBonuses).toBe(600);
      expect(profile.stats?.totalApprovedPenalties).toBe(200);
    });
  });

  // ==========================================================================
  // STRESS SUITE 2: Sovereign Demotion & Transaction Atomicity in finalizeWorkerClearance
  // ==========================================================================
  describe('STRESS 2: finalizeWorkerClearance Atomicity, Demotion & Negative Balances', () => {
    it('processes positive net settlement normal termination with all side effects', async () => {
      // Arrange
      const opsExecuted: Record<string, unknown>[] = [];
      const mockPrisma = {
        worker: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'w-pos-01',
            code: 'OP-050',
            name: 'حسين جابر',
            nickname: 'أبو علي',
            status: 'ACTIVE',
            telegramId: 77889900n,
            site: { name: 'الموقع الرئيسي' },
          }),
          update: vi.fn().mockImplementation((args: Record<string, unknown>) => {
            opsExecuted.push({ op: 'worker.update', ...args });
            return args;
          }),
        },
        user: {
          findFirst: vi.fn().mockResolvedValue(null),
          updateMany: vi.fn().mockImplementation((args: Record<string, unknown>) => {
            opsExecuted.push({ op: 'user.updateMany', ...args });
            return { count: 1 };
          }),
        },
        workerClearance: {
          count: vi.fn().mockResolvedValue(15),
          create: vi.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
            opsExecuted.push({ op: 'workerClearance.create', ...args });
            return args.data;
          }),
        },
        leave: {
          updateMany: vi.fn().mockImplementation((args: Record<string, unknown>) => {
            opsExecuted.push({ op: 'leave.updateMany', ...args });
            return { count: 1 };
          }),
        },
        pPEAsset: {
          update: vi.fn().mockImplementation((args: Record<string, unknown>) => {
            opsExecuted.push({ op: 'pPEAsset.update', ...args });
            return args;
          }),
          updateMany: vi.fn().mockImplementation((args: Record<string, unknown>) => {
            opsExecuted.push({ op: 'pPEAsset.updateMany', ...args });
            return { count: 2 };
          }),
        },
        approvalTicket: {
          updateMany: vi.fn().mockImplementation((args: Record<string, unknown>) => {
            opsExecuted.push({ op: 'approvalTicket.updateMany', ...args });
            return { count: 1 };
          }),
        },
        auditLog: {
          create: vi.fn().mockImplementation((args: Record<string, unknown>) => {
            opsExecuted.push({ op: 'auditLog.create', ...args });
            return args;
          }),
        },
        outboxEvent: {
          create: vi.fn().mockImplementation((args: Record<string, unknown>) => {
            opsExecuted.push({ op: 'outboxEvent.create', ...args });
            return args;
          }),
        },
        $transaction: vi.fn().mockImplementation(async (ops: unknown[]) => Promise.all(ops)),
      };

      const repo = new WorkerOffboardingRepository(mockPrisma as unknown as PrismaClient);

      // Act
      const result = await repo.finalizeWorkerClearance({
        workerId: 'w-pos-01',
        earnedSalary: 5000,
        totalAdvances: 1200,
        netSettlementAmount: 3800,
        reason: 'RESIGNATION',
        payoutOption: 'IMMEDIATE',
        actorTelegramId: 99999n,
        ppeSettlements: [
          { id: 'ppe-dam-1', condition: 'DAMAGED_NATURAL', deductionAmount: 300 },
        ],
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.clearanceNumber).toBe('#CLR-2026-0016');
      expect(result.netSettlementAmount).toBe(3800);
      expect(result.payoutOption).toBe('IMMEDIATE');
      expect(result.status).toBe('TERMINATED');
      expect(result.demotedTelegramId).toBe(77889900n);
      expect(result.sha256Checksum).toMatch(/^[a-f0-9]{64}$/);

      expect(mockPrisma.worker.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'w-pos-01' },
          data: expect.objectContaining({
            status: 'TERMINATED',
            telegramId: null,
            terminationReason: 'RESIGNATION',
          }),
        })
      );

      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { telegramId: 77889900n },
              { workerId: 'w-pos-01' },
            ],
          }),
          data: {
            role: 'GUEST',
            workerId: null,
            assignedSiteId: null,
          },
        })
      );

      expect(mockPrisma.leave.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workerId: 'w-pos-01', actualReturnDate: null },
          data: expect.objectContaining({ status: 'RESUMED' }),
        })
      );

      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'WORKER_CLEARANCE_FINALIZED',
            aggregateId: 'w-pos-01',
          }),
        })
      );
    });

    it('processes negative net settlement with BLACKLISTED action and debt recording', async () => {
      // Arrange
      const mockPrisma = {
        worker: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'w-debt-01',
            code: 'OP-099',
            name: 'ماهر عبد الجليل',
            nickname: 'ماهر',
            status: 'ACTIVE',
            telegramId: 11223344n,
          }),
          update: vi.fn().mockResolvedValue({ id: 'w-debt-01' }),
        },
        user: {
          findFirst: vi.fn().mockResolvedValue(null),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        workerClearance: {
          count: vi.fn().mockResolvedValue(40),
          create: vi.fn().mockResolvedValue({ id: 'clr-41' }),
        },
        leave: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        pPEAsset: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        approvalTicket: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        auditLog: { create: vi.fn().mockResolvedValue({ id: 'aud-41' }) },
        outboxEvent: { create: vi.fn().mockResolvedValue({ id: 'out-41' }) },
        $transaction: vi.fn().mockImplementation(async (ops: unknown[]) => Promise.all(ops)),
      };

      const repo = new WorkerOffboardingRepository(mockPrisma as unknown as PrismaClient);

      // Act
      const result = await repo.finalizeWorkerClearance({
        workerId: 'w-debt-01',
        earnedSalary: 1000,
        totalAdvances: 3500,
        netSettlementAmount: -2500,
        reason: 'TERMINATION_DISCIPLINARY',
        negativeBalanceAction: 'BLACKLISTED',
        payoutOption: 'WITH_PAYROLL',
        actorTelegramId: 999n,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.status).toBe('BLACKLISTED');
      expect(result.message).toContain('تم اعتماد المخالصة وإدراج العامل بالقائمة السوداء مع تثبيت مديونية قدرها 2500 ج.م.');

      expect(mockPrisma.worker.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'w-debt-01' },
          data: expect.objectContaining({
            status: 'BLACKLISTED',
            telegramId: null,
            terminationReason: 'TERMINATION_DISCIPLINARY [BLACKLISTED - Debt: 2500 EGP]',
          }),
        })
      );

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            afterPayload: expect.objectContaining({
              status: 'BLACKLISTED',
              netSettlementAmount: -2500,
            }),
          }),
        })
      );
    });

    it('processes negative net settlement with WRITTEN_OFF action and forgiven debt', async () => {
      // Arrange
      const mockPrisma = {
        worker: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'w-debt-02',
            code: 'OP-100',
            name: 'فايز صابر',
            status: 'ACTIVE',
            telegramId: null,
          }),
          update: vi.fn().mockResolvedValue({ id: 'w-debt-02' }),
        },
        user: {
          findFirst: vi.fn().mockResolvedValue(null),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        workerClearance: {
          count: vi.fn().mockResolvedValue(50),
          create: vi.fn().mockResolvedValue({ id: 'clr-51' }),
        },
        leave: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        pPEAsset: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        approvalTicket: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        auditLog: { create: vi.fn().mockResolvedValue({ id: 'aud-51' }) },
        outboxEvent: { create: vi.fn().mockResolvedValue({ id: 'out-51' }) },
        $transaction: vi.fn().mockImplementation(async (ops: unknown[]) => Promise.all(ops)),
      };

      const repo = new WorkerOffboardingRepository(mockPrisma as unknown as PrismaClient);

      // Act
      const result = await repo.finalizeWorkerClearance({
        workerId: 'w-debt-02',
        earnedSalary: 500,
        totalAdvances: 1000,
        netSettlementAmount: -500,
        reason: 'MUTUAL_AGREEMENT',
        negativeBalanceAction: 'WRITTEN_OFF',
        actorTelegramId: 999n,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.status).toBe('TERMINATED');
      expect(result.message).toContain('تم اعتماد المخالصة المالية وإنهاء الخدمة وهبوط الحساب لدور زائر بنجاح.');

      expect(mockPrisma.worker.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'w-debt-02' },
          data: expect.objectContaining({
            status: 'TERMINATED',
            terminationReason: 'MUTUAL_AGREEMENT',
          }),
        })
      );
    });

    it('executes sovereign demotion when worker telegramId is null but user account is linked by workerId', async () => {
      // Arrange
      const mockPrisma = {
        worker: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'w-no-tg',
            code: 'OP-101',
            name: 'عماد رشاد',
            status: 'ACTIVE',
            telegramId: null,
          }),
          update: vi.fn().mockResolvedValue({ id: 'w-no-tg' }),
        },
        user: {
          findFirst: vi.fn().mockResolvedValue({ id: 'usr-1', telegramId: 88776655n }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        workerClearance: {
          count: vi.fn().mockResolvedValue(1),
          create: vi.fn().mockResolvedValue({ id: 'clr-2' }),
        },
        leave: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        pPEAsset: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        approvalTicket: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        auditLog: { create: vi.fn().mockResolvedValue({ id: 'aud-2' }) },
        outboxEvent: { create: vi.fn().mockResolvedValue({ id: 'out-2' }) },
        $transaction: vi.fn().mockImplementation(async (ops: unknown[]) => Promise.all(ops)),
      };

      const repo = new WorkerOffboardingRepository(mockPrisma as unknown as PrismaClient);

      // Act
      const result = await repo.finalizeWorkerClearance({
        workerId: 'w-no-tg',
        earnedSalary: 2000,
        totalAdvances: 0,
        netSettlementAmount: 2000,
        reason: 'CONTRACT_END',
        actorTelegramId: 999n,
      });

      // Assert
      expect(result.demotedTelegramId).toBe(88776655n);
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { workerId: 'w-no-tg' },
        select: { telegramId: true },
      });
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { telegramId: 88776655n },
              { workerId: 'w-no-tg' },
            ],
          }),
        })
      );
    });

    it('propagates transaction failure cleanly and ensures rollback', async () => {
      // Arrange
      const mockPrisma = {
        worker: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'w-fail',
            code: 'OP-FAIL',
            name: 'فشل مؤقت',
            status: 'ACTIVE',
          }),
          update: vi.fn().mockReturnValue({ op: 'worker.update' }),
        },
        user: {
          findFirst: vi.fn().mockResolvedValue(null),
          updateMany: vi.fn().mockReturnValue({ op: 'user.updateMany' }),
        },
        workerClearance: {
          count: vi.fn().mockResolvedValue(10),
          create: vi.fn().mockReturnValue({ op: 'workerClearance.create' }),
        },
        leave: { updateMany: vi.fn().mockReturnValue({ op: 'leave.updateMany' }) },
        pPEAsset: { updateMany: vi.fn().mockReturnValue({ op: 'pPEAsset.updateMany' }) },
        approvalTicket: { updateMany: vi.fn().mockReturnValue({ op: 'approvalTicket.updateMany' }) },
        auditLog: { create: vi.fn().mockReturnValue({ op: 'auditLog.create' }) },
        outboxEvent: { create: vi.fn().mockReturnValue({ op: 'outboxEvent.create' }) },
        $transaction: vi.fn().mockRejectedValue(new Error('DB_DEADLOCK_CONSTRAINT_ERROR')),
      };

      const repo = new WorkerOffboardingRepository(mockPrisma as unknown as PrismaClient);

      // Act & Assert
      // Act
      const rollbackPromise = repo.finalizeWorkerClearance({
        workerId: 'w-fail',
        earnedSalary: 1000,
        totalAdvances: 0,
        netSettlementAmount: 1000,
        reason: 'OTHER',
        actorTelegramId: 999n,
      });

      // Assert
      await expect(rollbackPromise).rejects.toThrow('DB_DEADLOCK_CONSTRAINT_ERROR');
    });
  });

  // ==========================================================================
  // STRESS SUITE 3: Inboxes, Decision Settlement & Field Reports
  // ==========================================================================
  describe('STRESS 3: Inboxes, Decision Settlement & Field Reports', () => {
    it('handles corrupted and non-JSON reviewDecisionNotes in getPendingClearanceReports', async () => {
      // Arrange
      const mockPrisma = {
        approvalTicket: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 't-corrupted-1',
              ticketNumber: '#TCK-CLR-CORR-1',
              entityId: 'w-corr-1',
              reviewDecisionNotes: 'MALFORMED_NON_JSON_STRING',
              requestedByTelegramId: 1234n,
              createdAt: new Date('2026-09-10T00:00:00Z'),
              status: 'PENDING',
            },
            {
              id: 't-corrupted-2',
              ticketNumber: '#TCK-CLR-CORR-2',
              entityId: 'w-corr-2',
              reviewDecisionNotes: null,
              requestedByTelegramId: 5678n,
              createdAt: new Date('2026-09-10T00:00:00Z'),
              status: 'PENDING',
            },
            {
              id: 't-valid',
              ticketNumber: '#TCK-CLR-VAL',
              entityId: 'w-corr-3',
              reviewDecisionNotes: JSON.stringify({
                workedDays: 18,
                reason: 'RESIGNATION',
                ppeObservations: 'خوذة مفقودة',
              }),
              requestedByTelegramId: 9999n,
              createdAt: new Date('2026-09-10T00:00:00Z'),
              status: 'PENDING',
            },
          ]),
        },
        worker: {
          findMany: vi.fn().mockResolvedValue([
            { id: 'w-corr-1', code: 'W-01', name: 'عامل 1', nickname: 'ع1' },
            { id: 'w-corr-3', code: 'W-03', name: 'عامل 3', nickname: 'ع3' },
          ]),
        },
      };

      const repo = new WorkerOffboardingRepository(mockPrisma as unknown as PrismaClient);

      // Act
      const reports = await repo.getPendingClearanceReports();

      // Assert
      expect(reports).toHaveLength(3);
      expect(reports[0]?.ticketNumber).toBe('#TCK-CLR-CORR-1');
      expect(reports[0]?.notes).toBe('MALFORMED_NON_JSON_STRING');
      expect(reports[0]?.workerNickname).toBe('ع1');

      expect(reports[1]?.ticketNumber).toBe('#TCK-CLR-CORR-2');
      expect(reports[1]?.notes).toBeNull();
      expect(reports[1]?.workerNickname).toBeUndefined();

      expect(reports[2]?.ticketNumber).toBe('#TCK-CLR-VAL');
      expect(reports[2]?.workedDays).toBe(18);
      expect(reports[2]?.ppeObservations).toBe('خوذة مفقودة');
    });

    it('supports APPROVE, REJECT, and ADJUST with audit tags in settleDisciplinaryDecision', async () => {
      // Arrange
      const mockPrisma = {
        disciplinaryAndBonus: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'disc-test-1',
            reason: 'مخالفة تشغيلية',
          }),
          update: vi.fn().mockResolvedValue({ id: 'disc-test-1' }),
        },
      };

      const repo = new WorkerOffboardingRepository(mockPrisma as unknown as PrismaClient);

      // Act & Assert
      // Act
      await repo.settleDisciplinaryDecision('disc-test-1', 'APPROVE', '12345', 450, 2);

      // Assert
      expect(mockPrisma.disciplinaryAndBonus.update).toHaveBeenCalledWith({
        where: { id: 'disc-test-1' },
        data: {
          approvedByUserId: 12345n,
          amount: 450,
          daysEquivalent: 2,
        },
      });

      // Act
      await repo.settleDisciplinaryDecision('disc-test-1', 'REJECT', '12345');

      // Assert
      expect(mockPrisma.disciplinaryAndBonus.update).toHaveBeenCalledWith({
        where: { id: 'disc-test-1' },
        data: {
          approvedByUserId: 12345n,
          amount: 0,
          daysEquivalent: 0,
          reason: '[مستبعد ومرفوض إدارياً] مخالفة تشغيلية',
        },
      });

      // Act
      await repo.settleDisciplinaryDecision('disc-test-1', 'ADJUST', '12345', 200);

      // Assert
      expect(mockPrisma.disciplinaryAndBonus.update).toHaveBeenCalledWith({
        where: { id: 'disc-test-1' },
        data: {
          approvedByUserId: 12345n,
          amount: 200,
          reason: '[معدل بقرار الإدارة] مخالفة تشغيلية',
        },
      });
    });

    it('throws error when settleDisciplinaryDecision is called on non-existent record', async () => {
      // Arrange
      const mockPrisma = {
        disciplinaryAndBonus: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };

      const repo = new WorkerOffboardingRepository(mockPrisma as unknown as PrismaClient);

      // Act & Assert
      // Act
      const missingPromise = repo.settleDisciplinaryDecision('disc-missing', 'APPROVE', '12345');

      // Assert
      await expect(missingPromise).rejects.toThrow('لم يتم العثور على القرار الإداري رقم: disc-missing');
    });

    it('creates approval ticket with serializable metadata and zero financial leak in submitFieldClearanceReport', async () => {
      // Arrange
      let createdTicketData: Record<string, unknown> | null = null;
      const mockPrisma = {
        approvalTicket: {
          create: vi.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
            createdTicketData = args.data;
            return { id: 'tck-uuid-1', ticketNumber: args.data.ticketNumber };
          }),
        },
      };

      const repo = new WorkerOffboardingRepository(mockPrisma as unknown as PrismaClient);

      // Act
      const ticketNum = await repo.submitFieldClearanceReport({
        workerId: 'w-field-1',
        workerCode: 'OP-FIELD-01',
        workedDays: 24,
        reason: 'RESIGNATION',
        ppeObservations: 'تم تسليم كافة العهد بحالة ممتازة',
        notes: 'ملاحظة المشرف الميداني',
        submitterTelegramId: 998877n,
        siteId: 'site-al-saada-1',
      });

      // Assert
      expect(ticketNum).toMatch(/^#TCK-CLR-/);
      const ticket = createdTicketData as unknown as {
        ticketType: string;
        entityId: string;
        status: string;
        reviewDecisionNotes: string;
      };
      expect(ticket.ticketType).toBe('END_OF_SERVICE_CLEARANCE');
      expect(ticket.entityId).toBe('w-field-1');
      expect(ticket.status).toBe('PENDING');

      const meta = JSON.parse(ticket.reviewDecisionNotes);
      expect(meta.workerId).toBe('w-field-1');
      expect(meta.workedDays).toBe(24);
      expect(meta.reason).toBe('RESIGNATION');
      expect(meta.ppeObservations).toBe('تم تسليم كافة العهد بحالة ممتازة');
      expect(meta.siteId).toBe('site-al-saada-1');
      expect(meta.earnedSalary).toBeUndefined();
      expect(meta.totalAdvances).toBeUndefined();
    });
  });
});
