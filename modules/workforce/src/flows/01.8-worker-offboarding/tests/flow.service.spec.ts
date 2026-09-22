import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WorkerOffboardingService,
  calculateFinancialClearance,
  validatePayoutOption,
  evaluateNegativeBalanceAction,
  sanitizeProfileForRole,
} from '../flow.service.js';
import type { WorkerOffboardingRepository } from '../flow.repository.js';
import type { ClearanceProfile, FinalizeClearanceData } from '../flow.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('01.8 Worker Offboarding — Service & Accounting Engine Unit Tests', () => {
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

  function createSampleProfile(overrides: Partial<ClearanceProfile> = {}): ClearanceProfile {
    return {
      worker: {
        id: 'w-101',
        code: 'OP-0101',
        legacyCode: 'LEG-101',
        name: 'محمود عبد الرحمن',
        nickname: 'حودة',
        jobTitle: 'فني كهرباء ميداني',
        dailyWage: 200,
        basicSalary: 6000,
        fixedAllowances: 500,
        status: 'ACTIVE',
        telegramId: 11223344n,
        siteId: 'site-cairo',
        siteName: 'مشروع العاصمة الإدارية',
        departmentName: 'الإدارة الهندسية',
        hireDate: new Date('2023-01-15T00:00:00.000Z'),
        shiftSystem: '24_WORK_6_REST',
      },
      activeLeave: {
        id: 'lv-99',
        leaveNumber: '#LV-2026-0099',
        leaveType: 'ANNUAL',
        departureDate: new Date('2026-09-01T00:00:00.000Z'),
        expectedReturnDate: new Date('2026-09-15T00:00:00.000Z'),
        actualReturnDate: null,
        status: 'ACTIVE_ON_LEAVE',
        daysBeforeLeave: 12,
        daysUntilExpectedReturn: 15,
        overdueDays: 0,
      },
      ppeAssets: [
        {
          id: 'ppe-1',
          voucherId: '#PPE-001',
          assetType: 'SAFETY_HELMET',
          name: 'خوذة أمان معتمدة',
          condition: 'GOOD',
          costPrice: 350,
          isDamagedOrLost: false,
          deductionAmount: 0,
        },
        {
          id: 'ppe-2',
          voucherId: '#PPE-002',
          assetType: 'SAFETY_SHOES',
          name: 'حذاء أمان (سيفتي)',
          condition: 'DAMAGED_NATURAL',
          costPrice: 600,
          isDamagedOrLost: true,
          deductionAmount: 200,
        },
      ],
      advances: {
        totalOutstandingAdvances: 1000,
        unsettledInstallments: [
          {
            id: 'inst-1',
            originalVoucherNumber: '#ADV-001',
            installmentAmount: 1000,
            status: 'PENDING',
          },
        ],
      },
      pendingDisciplinaryRecords: [
        {
          id: 'disc-pending-1',
          recordNumber: '#DISC-001',
          type: 'PENALTY_CASH',
          amount: 250,
          daysEquivalent: null,
          reason: 'مخالفة تعليمات السلامة',
          createdAt: new Date('2026-09-10T00:00:00.000Z'),
          workerName: 'محمود عبد الرحمن',
          workerCode: 'OP-0101',
        },
      ],
      approvedDisciplinaryRecords: [
        {
          id: 'disc-app-1',
          recordNumber: '#DISC-002',
          type: 'BONUS_CASH',
          amount: 300,
          daysEquivalent: null,
          reason: 'مكافأة تميز بالوردية',
          createdAt: new Date('2026-09-08T00:00:00.000Z'),
        },
        {
          id: 'disc-app-2',
          recordNumber: '#DISC-003',
          type: 'PENALTY_DAYS',
          amount: null,
          daysEquivalent: 1,
          reason: 'تأخير غير مبرر',
          createdAt: new Date('2026-09-09T00:00:00.000Z'),
        },
      ],
      stats: {
        totalApprovedBonuses: 300,
        totalApprovedPenalties: 0,
        totalApprovedPenaltyDays: 1,
        totalPendingBonuses: 0,
        totalPendingPenalties: 250,
        totalPendingPenaltyDays: 0,
      },
      ...overrides,
    };
  }

  describe('1. Exact Accounting Formulas & Arithmetic Precision', () => {
    it('resolves daily rate from dailyWage when positive', () => {
      // Arrange
      const profile = createSampleProfile();

      // Act
      const breakdown = calculateFinancialClearance(profile, { workedDays: 10 });

      // Assert
      expect(breakdown.dailyRate).toBe(200);
      expect(breakdown.earnedSalary).toBe(2000);
    });

    it('resolves daily rate from grossSalary divided by 30 when dailyWage is 0', () => {
      // Arrange
      const profile = createSampleProfile({
        worker: {
          ...createSampleProfile().worker,
          dailyWage: 0,
          basicSalary: 6000,
          fixedAllowances: 0,
        },
      });

      // Act
      const breakdown = calculateFinancialClearance(profile, { workedDays: 15 });

      // Assert
      expect(breakdown.dailyRate).toBe(200);
      expect(breakdown.earnedSalary).toBe(3000);
    });

    it('falls back to 300 when both dailyWage and grossSalary are 0', () => {
      // Arrange
      const profile = createSampleProfile({
        worker: {
          ...createSampleProfile().worker,
          dailyWage: 0,
          basicSalary: 0,
          fixedAllowances: 0,
        },
      });

      // Act
      const breakdown = calculateFinancialClearance(profile, { workedDays: 10 });

      // Assert
      expect(breakdown.dailyRate).toBe(300);
      expect(breakdown.earnedSalary).toBe(3000);
    });

    it('allows explicit dailyRate override from input', () => {
      // Arrange
      const profile = createSampleProfile();

      // Act
      const breakdown = calculateFinancialClearance(profile, {
        workedDays: 10,
        dailyRate: 250,
      });

      // Assert
      expect(breakdown.dailyRate).toBe(250);
      expect(breakdown.earnedSalary).toBe(2500);
    });

    it('accurately calculates Positive Net Balance scenario', () => {
      // Arrange
      const profile = createSampleProfile();

      // Act
      const breakdown = calculateFinancialClearance(profile, {
        workedDays: 20,
        assetDamageDeduction: 100,
      });

      // Assert
      expect(breakdown.earnedSalary).toBe(4000);
      expect(breakdown.approvedBonuses).toBe(300);
      expect(breakdown.totalCredits).toBe(4300);
      expect(breakdown.totalAdvances).toBe(1000);
      expect(breakdown.totalPenalties).toBe(200);
      expect(breakdown.assetDamageDeduction).toBe(100);
      expect(breakdown.totalDebits).toBe(1300);
      expect(breakdown.netSettlementAmount).toBe(3000);
      expect(breakdown.isNegativeBalance).toBe(false);
      expect(breakdown.hasPendingDecisions).toBe(true);
    });

    it('accurately calculates Zero Net Balance scenario', () => {
      // Arrange
      const profile = createSampleProfile({
        approvedDisciplinaryRecords: [],
        pendingDisciplinaryRecords: [],
        stats: undefined,
      });

      // Act
      const breakdown = calculateFinancialClearance(profile, {
        workedDays: 5,
        assetDamageDeduction: 0,
      });

      // Assert
      expect(breakdown.earnedSalary).toBe(1000);
      expect(breakdown.totalCredits).toBe(1000);
      expect(breakdown.totalDebits).toBe(1000);
      expect(breakdown.netSettlementAmount).toBe(0);
      expect(breakdown.isNegativeBalance).toBe(false);
      expect(breakdown.hasPendingDecisions).toBe(false);
    });

    it('accurately calculates Negative Net Balance scenario', () => {
      // Arrange
      const profile = createSampleProfile({
        advances: {
          totalOutstandingAdvances: 2000,
          unsettledInstallments: [
            { id: 'inst-1', originalVoucherNumber: '#V-1', installmentAmount: 2000, status: 'PENDING' },
          ],
        },
      });

      // Act
      const breakdown = calculateFinancialClearance(profile, {
        workedDays: 4,
        assetDamageDeduction: 300,
      });

      // Assert
      expect(breakdown.earnedSalary).toBe(800);
      expect(breakdown.totalCredits).toBe(1100);
      expect(breakdown.totalDebits).toBe(2500);
      expect(breakdown.netSettlementAmount).toBe(-1400);
      expect(breakdown.isNegativeBalance).toBe(true);
    });

    it('merges selected pending decisions into approved calculation when requested', () => {
      // Arrange
      const profile = createSampleProfile();

      // Act
      const breakdown = calculateFinancialClearance(profile, {
        workedDays: 10,
        selectedDisciplinaryDecisions: ['disc-pending-1'],
      });

      // Assert
      expect(breakdown.totalPenalties).toBe(450);
      expect(breakdown.hasPendingDecisions).toBe(false);
    });
  });

  describe('2. Negative Balance Radar & Blacklist Handling', () => {
    it('evaluates BLACKLISTED action for negative balance and records debt', () => {
      // Arrange
      const netSettlement = -1850;
      const action = 'BLACKLISTED';

      // Act
      const evaluation = evaluateNegativeBalanceAction(netSettlement, action);

      // Assert
      expect(evaluation.isNegative).toBe(true);
      expect(evaluation.action).toBe('BLACKLISTED');
      expect(evaluation.workerStatus).toBe('BLACKLISTED');
      expect(evaluation.debtAmount).toBe(1850);
      expect(evaluation.isDebtWrittenOff).toBe(false);
      expect(evaluation.auditMessage).toContain('1850 ج.م');
      expect(evaluation.auditMessage).toContain('القائمة السوداء');
    });

    it('evaluates WRITTEN_OFF action for negative balance and marks debt written-off', () => {
      // Arrange
      const netSettlement = -1200;
      const action = 'WRITTEN_OFF';

      // Act
      const evaluation = evaluateNegativeBalanceAction(netSettlement, action);

      // Assert
      expect(evaluation.isNegative).toBe(true);
      expect(evaluation.action).toBe('WRITTEN_OFF');
      expect(evaluation.workerStatus).toBe('TERMINATED');
      expect(evaluation.debtAmount).toBe(1200);
      expect(evaluation.isDebtWrittenOff).toBe(true);
      expect(evaluation.auditMessage).toContain('1200 ج.م');
      expect(evaluation.auditMessage).toContain('إسقاط المديونية');
    });

    it('handles positive or zero balance gracefully in negative balance evaluator', () => {
      // Arrange
      const netSettlement = 500;
      const action = 'WRITTEN_OFF';

      // Act
      const evaluation = evaluateNegativeBalanceAction(netSettlement, action);

      // Assert
      expect(evaluation.isNegative).toBe(false);
      expect(evaluation.workerStatus).toBe('TERMINATED');
      expect(evaluation.debtAmount).toBe(0);
      expect(evaluation.isDebtWrittenOff).toBe(false);
    });
  });

  describe('3. Mandatory Pending Decisions Policy', () => {
    it('blocks IMMEDIATE payout option when worker has pending decisions and forces WITH_PAYROLL', () => {
      // Arrange
      const profile = createSampleProfile();

      // Act
      const result = validatePayoutOption(profile, 'IMMEDIATE');

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.forcedOption).toBe('WITH_PAYROLL');
      expect(result.reason).toContain('قرارات إدارية معلقة');
    });

    it('accepts WITH_PAYROLL payout option when worker has pending decisions', () => {
      // Arrange
      const profile = createSampleProfile();

      // Act
      const result = validatePayoutOption(profile, 'WITH_PAYROLL');

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.forcedOption).toBe('WITH_PAYROLL');
    });

    it('allows IMMEDIATE payout option when worker has no pending decisions', () => {
      // Arrange
      const profile = createSampleProfile({
        pendingDisciplinaryRecords: [],
        stats: {
          totalApprovedBonuses: 0,
          totalApprovedPenalties: 0,
          totalApprovedPenaltyDays: 0,
          totalPendingBonuses: 0,
          totalPendingPenalties: 0,
          totalPendingPenaltyDays: 0,
        },
      });

      // Act
      const result = validatePayoutOption(profile, 'IMMEDIATE');

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.forcedOption).toBe('IMMEDIATE');
    });
  });

  describe('4. Zero Financial Leaks for Field Admin (Role Sanitization)', () => {
    it('strips all salary, advances, and financial numbers for FIELD_ADMIN', () => {
      // Arrange
      const profile = createSampleProfile();

      // Act
      const sanitized = sanitizeProfileForRole(profile, 'FIELD_ADMIN');

      // Assert
      expect(sanitized.worker.dailyWage).toBe(0);
      expect(sanitized.worker.basicSalary).toBe(0);
      expect(sanitized.worker.fixedAllowances).toBe(0);
      expect(sanitized.advances.totalOutstandingAdvances).toBe(0);
      expect(sanitized.advances.unsettledInstallments).toEqual([]);
      expect(sanitized.stats).toBeUndefined();

      expect(sanitized.pendingDisciplinaryRecords[0]?.amount).toBeNull();
      expect(sanitized.pendingDisciplinaryRecords[0]?.daysEquivalent).toBeNull();
      expect(sanitized.approvedDisciplinaryRecords?.[0]?.amount).toBeNull();
      expect(sanitized.approvedDisciplinaryRecords?.[1]?.daysEquivalent).toBeNull();

      expect(sanitized.ppeAssets[0]?.costPrice).toBe(0);
      expect(sanitized.ppeAssets[0]?.deductionAmount).toBe(0);
      expect(sanitized.ppeAssets[1]?.costPrice).toBe(0);
      expect(sanitized.ppeAssets[1]?.deductionAmount).toBe(0);

      expect(sanitized.worker.name).toBe('محمود عبد الرحمن');
      expect(sanitized.worker.nickname).toBe('حودة');
      expect(sanitized.worker.code).toBe('OP-0101');
      expect(sanitized.worker.jobTitle).toBe('فني كهرباء ميداني');
      expect(sanitized.worker.siteName).toBe('مشروع العاصمة الإدارية');
      expect(sanitized.activeLeave?.leaveNumber).toBe('#LV-2026-0099');
      expect(sanitized.activeLeave?.daysBeforeLeave).toBe(12);
      expect(sanitized.ppeAssets[0]?.name).toBe('خوذة أمان معتمدة');
      expect(sanitized.ppeAssets[0]?.condition).toBe('GOOD');
      expect(sanitized.pendingDisciplinaryRecords[0]?.reason).toBe('مخالفة تعليمات السلامة');
    });

    it('preserves full financial figures for SUPER_ADMIN', () => {
      // Arrange
      const profile = createSampleProfile();

      // Act
      const sanitized = sanitizeProfileForRole(profile, 'SUPER_ADMIN');

      // Assert
      expect(sanitized.worker.dailyWage).toBe(200);
      expect(sanitized.worker.basicSalary).toBe(6000);
      expect(sanitized.advances.totalOutstandingAdvances).toBe(1000);
      expect(sanitized.ppeAssets[0]?.costPrice).toBe(350);
      expect(sanitized.pendingDisciplinaryRecords[0]?.amount).toBe(250);
    });

    it('preserves full financial figures for ACCOUNTANT', () => {
      // Arrange
      const profile = createSampleProfile();

      // Act
      const sanitized = sanitizeProfileForRole(profile, 'ACCOUNTANT');

      // Assert
      expect(sanitized.worker.dailyWage).toBe(200);
      expect(sanitized.advances.totalOutstandingAdvances).toBe(1000);
    });
  });

  describe('5. Service Delegator & Orchestration Methods', () => {
    let mockRepo: Partial<WorkerOffboardingRepository>;
    let onWorkerDemoted: ReturnType<typeof vi.fn>;
    let service: WorkerOffboardingService;

    beforeEach(() => {
      mockRepo = {
        getWorkerClearanceProfile: vi.fn().mockResolvedValue(createSampleProfile()),
        getPendingClearanceReports: vi.fn().mockResolvedValue([
          {
            id: 'tck-1',
            ticketNumber: '#TCK-CLR-001',
            workerId: 'w-101',
            workerCode: 'OP-0101',
            workedDays: 15,
            reason: 'RESIGNATION',
            requestedByTelegramId: 9999n,
            createdAt: new Date('2026-09-01T00:00:00.000Z'),
            status: 'PENDING',
          },
        ]),
        getPendingDisciplinaryDecisions: vi.fn().mockResolvedValue([
          {
            id: 'disc-1',
            recordNumber: '#DISC-001',
            type: 'PENALTY_CASH',
            amount: 250,
            daysEquivalent: null,
            reason: 'تأخير',
            createdAt: new Date('2026-09-01T00:00:00.000Z'),
          },
        ]),
        settleDisciplinaryDecision: vi.fn().mockResolvedValue(undefined),
        submitFieldClearanceReport: vi.fn().mockResolvedValue('#TCK-CLR-NEW'),
        finalizeWorkerClearance: vi.fn().mockResolvedValue({
          success: true,
          clearanceNumber: '#CLR-2026-0001',
          clearanceReferenceId: 'CLR-2026-0001',
          workerId: 'w-101',
          workerName: 'محمود عبد الرحمن',
          workerCode: 'OP-0101',
          demotedTelegramId: 11223344n,
          netSettlementAmount: 3000,
          payoutOption: 'WITH_PAYROLL',
          status: 'TERMINATED',
          message: 'تم اعتماد المخالصة بنجاح.',
        }),
      };
      onWorkerDemoted = vi.fn().mockResolvedValue(undefined);
      service = new WorkerOffboardingService(
        mockRepo as unknown as WorkerOffboardingRepository,
        onWorkerDemoted
      );
    });

    it('returns sanitized profile for FIELD_ADMIN via getWorkerClearanceProfile', async () => {
      // Arrange
      const workerId = 'w-101';
      const role = 'FIELD_ADMIN';

      // Act
      const profile = await service.getWorkerClearanceProfile(workerId, role);

      // Assert
      expect(profile.worker.dailyWage).toBe(0);
      expect(profile.advances.totalOutstandingAdvances).toBe(0);
      expect(profile.worker.name).toBe('محمود عبد الرحمن');
    });

    it('delegates getPendingClearanceReports and getPendingDisciplinaryDecisions', async () => {
      // Arrange & Act
      // Arrange
      const workerId = 'w-101';

      // Act
      const reports = await service.getPendingClearanceReports();
      const decisions = await service.getPendingDisciplinaryDecisions(workerId);

      // Assert
      expect(reports.length).toBe(1);
      expect(reports[0]?.ticketNumber).toBe('#TCK-CLR-001');
      expect(decisions.length).toBe(1);
      expect(decisions[0]?.recordNumber).toBe('#DISC-001');
    });

    it('delegates settleDisciplinaryDecision to repository', async () => {
      // Arrange
      const decisionId = 'disc-1';
      const action = 'APPROVE';
      const actorId = '8888';
      const adjustedAmount = 300;

      // Act
      await service.settleDisciplinaryDecision(decisionId, action, actorId, adjustedAmount);

      // Assert
      expect(mockRepo.settleDisciplinaryDecision).toHaveBeenCalledWith(
        decisionId,
        action,
        actorId,
        adjustedAmount,
        undefined
      );
    });

    it('enforces role checks on submitFieldClearanceReport', async () => {
      // Arrange
      const reportData = {
        workerId: 'w-101',
        workerCode: 'OP-0101',
        workedDays: 15,
        reason: 'RESIGNATION' as const,
        submitterTelegramId: 5555n,
      };

      // Act & Assert
      // Act
      const unauthorizedPromise = service.submitFieldClearanceReport(reportData, 'WORKER');

      // Assert
      await expect(unauthorizedPromise).rejects.toThrow('غير مصرح للمستخدم برفع تقرير إخلاء طرف ميداني.');

      // Act
      const ticketNum = await service.submitFieldClearanceReport(reportData, 'FIELD_ADMIN');

      // Assert
      expect(ticketNum).toBe('#TCK-CLR-NEW');
    });

    it('enforces SUPER_ADMIN authority on finalizeWorkerClearance', async () => {
      // Arrange
      const finalizeData: FinalizeClearanceData = {
        workerId: 'w-101',
        earnedSalary: 4000,
        totalAdvances: 1000,
        netSettlementAmount: 3000,
        reason: 'RESIGNATION',
        actorTelegramId: 9999n,
      };

      // Act
      const unauthorizedPromise = service.finalizeWorkerClearance(finalizeData, 'FIELD_ADMIN');

      // Assert
      await expect(unauthorizedPromise).rejects.toThrow('الاختصاص السيادي الحصري للمدير العام (SUPER_ADMIN)');
    });

    it('enforces pending decisions policy when finalizing clearance', async () => {
      // Arrange
      const finalizeData: FinalizeClearanceData = {
        workerId: 'w-101',
        earnedSalary: 4000,
        totalAdvances: 1000,
        netSettlementAmount: 3000,
        reason: 'RESIGNATION',
        actorTelegramId: 9999n,
        payoutOption: 'IMMEDIATE',
      };

      // Act
      const immediatePromise = service.finalizeWorkerClearance(finalizeData, 'SUPER_ADMIN');

      // Assert
      await expect(immediatePromise).rejects.toThrow('لا يمكن صرف المخالصة فورياً لوجود قرارات إدارية معلقة');
    });

    it('enforces negativeBalanceAction when net settlement is negative', async () => {
      // Arrange
      (mockRepo.getWorkerClearanceProfile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        createSampleProfile({
          pendingDisciplinaryRecords: [],
          stats: undefined,
        })
      );

      const finalizeData: FinalizeClearanceData = {
        workerId: 'w-101',
        earnedSalary: 1000,
        totalAdvances: 3000,
        netSettlementAmount: -2000,
        reason: 'DISCIPLINARY',
        actorTelegramId: 9999n,
        payoutOption: 'WITH_PAYROLL',
      };

      // Act
      const missingActionPromise = service.finalizeWorkerClearance(finalizeData, 'SUPER_ADMIN');

      // Assert
      await expect(missingActionPromise).rejects.toThrow('يجب تحديد الإجراء الإداري للمديونية السالبة');
    });

    it('successfully finalizes clearance and triggers onWorkerDemoted callback', async () => {
      // Arrange
      const finalizeData: FinalizeClearanceData = {
        workerId: 'w-101',
        earnedSalary: 4000,
        totalAdvances: 1000,
        netSettlementAmount: 3000,
        reason: 'RESIGNATION',
        actorTelegramId: 9999n,
        payoutOption: 'WITH_PAYROLL',
      };

      // Act
      const result = await service.finalizeWorkerClearance(finalizeData, 'SUPER_ADMIN');

      // Assert
      expect(result.success).toBe(true);
      expect(result.clearanceNumber).toBe('#CLR-2026-0001');
      expect(onWorkerDemoted).toHaveBeenCalledWith(11223344n);
    });
  });
});
