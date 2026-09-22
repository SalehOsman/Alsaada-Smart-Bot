import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateFinancialClearance,
  validatePayoutOption,
  evaluateNegativeBalanceAction,
  WorkerOffboardingService,
} from '../flow.service.js';
import type { WorkerOffboardingRepository } from '../flow.repository.js';
import type { ClearanceProfile, FinalizeClearanceData } from '../flow.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Challenger 1 Empirical Stress Test — Accounting Engine & Gating (Milestone 2)', () => {
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

  function makeBaseProfile(overrides: Partial<ClearanceProfile> = {}): ClearanceProfile {
    return {
      worker: {
        id: 'w-stress-1',
        code: 'W-999',
        legacyCode: 'LEG-999',
        name: 'سيد أبو العزم',
        nickname: 'سيد',
        jobTitle: 'مشغل معدات ثقيلة',
        dailyWage: 250,
        basicSalary: 7500,
        fixedAllowances: 500,
        status: 'ACTIVE',
        telegramId: 987654321n,
        siteId: 'site-alpha',
        siteName: 'محطة الصرف المركزية',
        hireDate: new Date('2022-05-10T00:00:00.000Z'),
        shiftSystem: '24_WORK_6_REST',
      },
      activeLeave: null,
      ppeAssets: [],
      advances: {
        totalOutstandingAdvances: 0,
        unsettledInstallments: [],
      },
      pendingDisciplinaryRecords: [],
      approvedDisciplinaryRecords: [],
      stats: {
        totalApprovedBonuses: 0,
        totalApprovedPenalties: 0,
        totalApprovedPenaltyDays: 0,
        totalPendingBonuses: 0,
        totalPendingPenalties: 0,
        totalPendingPenaltyDays: 0,
      },
      ...overrides,
    };
  }

  // ==========================================================================
  // 1. Extreme Calculations: Zero Days Worked & Zero Wage
  // ==========================================================================
  describe('1. Extreme Calculations: Zero Days & Zero Wage', () => {
    it('correctly evaluates zero worked days with positive wage', () => {
      // Arrange
      const profile = makeBaseProfile();

      // Act
      const result = calculateFinancialClearance(profile, { workedDays: 0 });

      // Assert
      expect(result.workedDays).toBe(0);
      expect(result.dailyRate).toBe(250);
      expect(result.earnedSalary).toBe(0);
      expect(result.totalCredits).toBe(0);
      expect(result.totalDebits).toBe(0);
      expect(result.netSettlementAmount).toBe(0);
      expect(result.isNegativeBalance).toBe(false);
    });

    it('clamps negative worked days to 0 and calculates zero earned salary', () => {
      // Arrange
      const profile = makeBaseProfile();

      // Act
      const result = calculateFinancialClearance(profile, { workedDays: -10 });

      // Assert
      expect(result.workedDays).toBe(0);
      expect(result.earnedSalary).toBe(0);
      expect(result.netSettlementAmount).toBe(0);
    });

    it('falls back to 300 daily rate when worker dailyWage and grossSalary are 0', () => {
      // Arrange
      const profile = makeBaseProfile({
        worker: {
          ...makeBaseProfile().worker,
          dailyWage: 0,
          basicSalary: 0,
          fixedAllowances: 0,
        },
      });

      // Act
      const result = calculateFinancialClearance(profile, { workedDays: 0 });

      // Assert
      expect(result.dailyRate).toBe(300);
      expect(result.workedDays).toBe(0);
      expect(result.earnedSalary).toBe(0);
      expect(result.netSettlementAmount).toBe(0);
    });

    it('calculates zero earned salary when both workedDays=0 and wage=0 with advances=0', () => {
      // Arrange
      const profile = makeBaseProfile({
        worker: {
          ...makeBaseProfile().worker,
          dailyWage: 0,
          basicSalary: 0,
          fixedAllowances: 0,
        },
      });

      // Act
      const result = calculateFinancialClearance(profile, { workedDays: 0, dailyRate: 0 });

      // Assert
      expect(result.dailyRate).toBe(300);
      expect(result.earnedSalary).toBe(0);
      expect(result.netSettlementAmount).toBe(0);
      expect(result.isNegativeBalance).toBe(false);
    });
  });

  // ==========================================================================
  // 2. Large Salaries & High Advances Exceeding Salary (Negative Balance)
  // ==========================================================================
  describe('2. Large Salaries & High Advances (Negative Balance)', () => {
    it('handles large gross salary and computes exact daily rate', () => {
      // Arrange
      const profile = makeBaseProfile({
        worker: {
          ...makeBaseProfile().worker,
          dailyWage: 0,
          basicSalary: 300_000,
          fixedAllowances: 60_000,
        },
      });

      // Act
      const result = calculateFinancialClearance(profile, { workedDays: 15 });

      // Assert
      expect(result.dailyRate).toBe(12000);
      expect(result.earnedSalary).toBe(180000);
    });

    it('computes deep negative balance when advances far exceed salary', () => {
      // Arrange
      const profile = makeBaseProfile({
        advances: {
          totalOutstandingAdvances: 750_000,
          unsettledInstallments: [
            {
              id: 'inst-huge',
              originalVoucherNumber: '#V-HUGE',
              installmentAmount: 750_000,
              status: 'PENDING',
            },
          ],
        },
      });

      // Act
      const result = calculateFinancialClearance(profile, {
        workedDays: 10,
        assetDamageDeduction: 50_000,
      });

      // Assert
      expect(result.earnedSalary).toBe(2500);
      expect(result.totalCredits).toBe(2500);
      expect(result.totalAdvances).toBe(750000);
      expect(result.assetDamageDeduction).toBe(50000);
      expect(result.totalDebits).toBe(800000);
      expect(result.netSettlementAmount).toBe(-797500);
      expect(result.isNegativeBalance).toBe(true);

      // Evaluate Negative Balance Actions
      const blacklistEval = evaluateNegativeBalanceAction(result.netSettlementAmount, 'BLACKLISTED');
      expect(blacklistEval.isNegative).toBe(true);
      expect(blacklistEval.action).toBe('BLACKLISTED');
      expect(blacklistEval.workerStatus).toBe('BLACKLISTED');
      expect(blacklistEval.debtAmount).toBe(797500);
      expect(blacklistEval.isDebtWrittenOff).toBe(false);
      expect(blacklistEval.auditMessage).toContain('797500');
      expect(blacklistEval.auditMessage).toContain('القائمة السوداء');

      const writeOffEval = evaluateNegativeBalanceAction(result.netSettlementAmount, 'WRITTEN_OFF');
      expect(writeOffEval.isNegative).toBe(true);
      expect(writeOffEval.action).toBe('WRITTEN_OFF');
      expect(writeOffEval.workerStatus).toBe('TERMINATED');
      expect(writeOffEval.debtAmount).toBe(797500);
      expect(writeOffEval.isDebtWrittenOff).toBe(true);
      expect(writeOffEval.auditMessage).toContain('797500');
      expect(writeOffEval.auditMessage).toContain('إسقاط المديونية');
    });
  });

  // ==========================================================================
  // 3. Mixed Bonuses & Penalties (Cash + Days Equivalent)
  // ==========================================================================
  describe('3. Mixed Bonuses & Penalties (Cash + Days Equivalent)', () => {
    it('accurately aggregates cash and day-equivalent bonuses and penalties', () => {
      // Arrange
      const profile = makeBaseProfile({
        worker: {
          ...makeBaseProfile().worker,
          dailyWage: 350,
        },
        approvedDisciplinaryRecords: [
          {
            id: 'b-cash',
            recordNumber: '#B-1',
            type: 'BONUS_CASH',
            amount: 1200,
            daysEquivalent: null,
            reason: 'مكافأة تميز',
            createdAt: new Date('2026-09-01T00:00:00.000Z'),
          },
          {
            id: 'b-days',
            recordNumber: '#B-2',
            type: 'BONUS_DAYS',
            amount: null,
            daysEquivalent: 3,
            reason: 'حافز 3 أيام',
            createdAt: new Date('2026-09-02T00:00:00.000Z'),
          },
          {
            id: 'p-cash',
            recordNumber: '#P-1',
            type: 'PENALTY_CASH',
            amount: 400,
            daysEquivalent: null,
            reason: 'غرامة مخالفة',
            createdAt: new Date('2026-09-03T00:00:00.000Z'),
          },
          {
            id: 'p-days',
            recordNumber: '#P-2',
            type: 'PENALTY_DAYS',
            amount: null,
            daysEquivalent: 2,
            reason: 'خصم يومين غياب',
            createdAt: new Date('2026-09-04T00:00:00.000Z'),
          },
        ],
        advances: {
          totalOutstandingAdvances: 2500,
          unsettledInstallments: [],
        },
      });

      // Act
      const result = calculateFinancialClearance(profile, {
        workedDays: 20,
        customBonusAmount: 300,
        customPenaltyAmount: 150,
        assetDamageDeduction: 500,
      });

      // Assert
      expect(result.earnedSalary).toBe(7000);
      expect(result.approvedBonuses).toBe(2550);
      expect(result.totalCredits).toBe(9550);
      expect(result.totalPenalties).toBe(1250);
      expect(result.totalAdvances).toBe(2500);
      expect(result.assetDamageDeduction).toBe(500);
      expect(result.totalDebits).toBe(4250);
      expect(result.netSettlementAmount).toBe(5300);
      expect(result.isNegativeBalance).toBe(false);
    });

    it('aggregates legacy stats when approved records array is empty', () => {
      // Arrange
      const profile = makeBaseProfile({
        worker: {
          ...makeBaseProfile().worker,
          dailyWage: 200,
        },
        approvedDisciplinaryRecords: [],
        stats: {
          totalApprovedBonuses: 800,
          totalApprovedPenalties: 300,
          totalApprovedPenaltyDays: 2,
          totalPendingBonuses: 0,
          totalPendingPenalties: 0,
          totalPendingPenaltyDays: 0,
        },
      });

      // Act
      const result = calculateFinancialClearance(profile, { workedDays: 10 });

      // Assert
      expect(result.earnedSalary).toBe(2000);
      expect(result.approvedBonuses).toBe(800);
      expect(result.totalCredits).toBe(2800);
      expect(result.totalPenalties).toBe(700);
      expect(result.totalDebits).toBe(700);
      expect(result.netSettlementAmount).toBe(2100);
    });
  });

  // ==========================================================================
  // 4. Exact Penny Rounding (Math.round parity with legacy)
  // ==========================================================================
  describe('4. Exact Penny Rounding Parity with Legacy', () => {
    it('rounds dailyRate identically to legacy Math.round(gross / 30)', () => {
      // Arrange
      const testCases = [
        { basic: 7000, allowances: 0, expectedDailyRate: Math.round(7000 / 30) },
        { basic: 7005, allowances: 0, expectedDailyRate: Math.round(7005 / 30) },
        { basic: 7004, allowances: 0, expectedDailyRate: Math.round(7004 / 30) },
        { basic: 7019, allowances: 0, expectedDailyRate: Math.round(7019 / 30) },
        { basic: 11111, allowances: 222, expectedDailyRate: Math.round((11111 + 222) / 30) },
      ];

      // Act & Assert
      for (const tc of testCases) {
        // Arrange
        const profile = makeBaseProfile({
          worker: {
            ...makeBaseProfile().worker,
            dailyWage: 0,
            basicSalary: tc.basic,
            fixedAllowances: tc.allowances,
          },
        });

        // Act
        const result = calculateFinancialClearance(profile, { workedDays: 1 });

        // Assert
        expect(result.dailyRate).toBe(tc.expectedDailyRate);
      }
    });

    it('rounds earnedSalary identically to legacy Math.round(workedDays * dailyRate)', () => {
      // Arrange
      const profile = makeBaseProfile({
        worker: {
          ...makeBaseProfile().worker,
          dailyWage: 233,
        },
      });

      const fractionalWorkedDays = [
        { days: 0.5, expected: Math.round(0.5 * 233) },
        { days: 12.5, expected: Math.round(12.5 * 233) },
        { days: 17.25, expected: Math.round(17.25 * 233) },
        { days: 17.75, expected: Math.round(17.75 * 233) },
      ];

      // Act & Assert
      for (const f of fractionalWorkedDays) {
        // Act
        const result = calculateFinancialClearance(profile, { workedDays: f.days });

        // Assert
        expect(result.earnedSalary).toBe(f.expected);
      }
    });

    it('rounds penalty and bonus days equivalents identically to legacy', () => {
      // Arrange
      const dailyRate = 175;
      const profile = makeBaseProfile({
        worker: {
          ...makeBaseProfile().worker,
          dailyWage: dailyRate,
        },
        approvedDisciplinaryRecords: [
          {
            id: 'b-frac',
            recordNumber: '#BF-1',
            type: 'BONUS_DAYS',
            amount: null,
            daysEquivalent: 1.5,
            reason: 'يوم ونصف مكافأة',
            createdAt: new Date('2026-09-05T00:00:00.000Z'),
          },
          {
            id: 'p-frac',
            recordNumber: '#PF-1',
            type: 'PENALTY_DAYS',
            amount: null,
            daysEquivalent: 0.5,
            reason: 'نصف يوم جزاء',
            createdAt: new Date('2026-09-06T00:00:00.000Z'),
          },
        ],
      });

      // Act
      const result = calculateFinancialClearance(profile, { workedDays: 10 });

      // Assert
      expect(result.approvedBonuses).toBe(Math.round(1.5 * dailyRate));
      expect(result.totalPenalties).toBe(Math.round(0.5 * dailyRate));
    });
  });

  // ==========================================================================
  // 5. Payout Option Gating: Mandatory Pending Decisions Policy
  // ==========================================================================
  describe('5. Payout Option Gating: Pending Decisions Policy', () => {
    it('allows IMMEDIATE option when worker has 0 pending decisions', () => {
      // Arrange
      const profile = makeBaseProfile({
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
      const immediateCheck = validatePayoutOption(profile, 'IMMEDIATE');
      const payrollCheck = validatePayoutOption(profile, 'WITH_PAYROLL');

      // Assert
      expect(immediateCheck.allowed).toBe(true);
      expect(immediateCheck.forcedOption).toBe('IMMEDIATE');
      expect(immediateCheck.reason).toBeUndefined();

      expect(payrollCheck.allowed).toBe(true);
      expect(payrollCheck.forcedOption).toBe('WITH_PAYROLL');
    });

    it('blocks IMMEDIATE option and forces WITH_PAYROLL when worker has 1 pending cash penalty', () => {
      // Arrange
      const profile = makeBaseProfile({
        pendingDisciplinaryRecords: [
          {
            id: 'p-1',
            recordNumber: '#P-001',
            type: 'PENALTY_CASH',
            amount: 300,
            daysEquivalent: null,
            reason: 'تأخير غير مبرر',
            createdAt: new Date('2026-09-07T00:00:00.000Z'),
          },
        ],
      });

      // Act
      const immediateCheck = validatePayoutOption(profile, 'IMMEDIATE');
      const payrollCheck = validatePayoutOption(profile, 'WITH_PAYROLL');

      // Assert
      expect(immediateCheck.allowed).toBe(false);
      expect(immediateCheck.forcedOption).toBe('WITH_PAYROLL');
      expect(immediateCheck.reason).toContain('قرارات إدارية معلقة');

      expect(payrollCheck.allowed).toBe(true);
      expect(payrollCheck.forcedOption).toBe('WITH_PAYROLL');
    });

    it('blocks IMMEDIATE option and forces WITH_PAYROLL when worker has 1 pending bonus', () => {
      // Arrange
      const profile = makeBaseProfile({
        pendingDisciplinaryRecords: [
          {
            id: 'b-1',
            recordNumber: '#B-001',
            type: 'BONUS_CASH',
            amount: 500,
            daysEquivalent: null,
            reason: 'مكافأة عمل إضافي معلقة',
            createdAt: new Date('2026-09-08T00:00:00.000Z'),
          },
        ],
      });

      // Act
      const immediateCheck = validatePayoutOption(profile, 'IMMEDIATE');

      // Assert
      expect(immediateCheck.allowed).toBe(false);
      expect(immediateCheck.forcedOption).toBe('WITH_PAYROLL');
    });

    it('blocks IMMEDIATE option when pending decisions are indicated via legacy flags or stats', () => {
      // Arrange
      const profileWithStats = makeBaseProfile({
        pendingDisciplinaryRecords: [],
        stats: {
          totalApprovedBonuses: 0,
          totalApprovedPenalties: 0,
          totalApprovedPenaltyDays: 0,
          totalPendingBonuses: 0,
          totalPendingPenalties: 150,
          totalPendingPenaltyDays: 0,
        },
      });

      const profileWithLegacyCount = {
        ...makeBaseProfile({ pendingDisciplinaryRecords: [] }),
        pendingDisciplinaryCount: 2,
      } as unknown as ClearanceProfile;

      const profileWithLegacyFlag = {
        ...makeBaseProfile({ pendingDisciplinaryRecords: [] }),
        hasPendingDecisions: true,
      } as unknown as ClearanceProfile;

      // Act
      const resStats = validatePayoutOption(profileWithStats, 'IMMEDIATE');
      const resCount = validatePayoutOption(profileWithLegacyCount, 'IMMEDIATE');
      const resFlag = validatePayoutOption(profileWithLegacyFlag, 'IMMEDIATE');

      // Assert
      expect(resStats.allowed).toBe(false);
      expect(resCount.allowed).toBe(false);
      expect(resFlag.allowed).toBe(false);
    });

    it('blocks finalizeWorkerClearance when IMMEDIATE is requested for worker with pending decisions', async () => {
      // Arrange
      const mockRepo: Partial<WorkerOffboardingRepository> = {
        getWorkerClearanceProfile: vi.fn().mockResolvedValue(
          makeBaseProfile({
            pendingDisciplinaryRecords: [
              {
                id: 'disc-pending-99',
                recordNumber: '#DISC-99',
                type: 'PENALTY_CASH',
                amount: 100,
                daysEquivalent: null,
                reason: 'غرامة معلقة',
                createdAt: new Date('2026-09-09T00:00:00.000Z'),
              },
            ],
          })
        ),
        finalizeWorkerClearance: vi.fn(),
      };

      const service = new WorkerOffboardingService(mockRepo as unknown as WorkerOffboardingRepository);

      const finalizeData: FinalizeClearanceData = {
        workerId: 'w-stress-1',
        earnedSalary: 5000,
        totalAdvances: 1000,
        netSettlementAmount: 4000,
        reason: 'RESIGNATION',
        actorTelegramId: 9999n,
        payoutOption: 'IMMEDIATE',
      };

      // Act & Assert
      // Act
      const blockedPromise = service.finalizeWorkerClearance(finalizeData, 'SUPER_ADMIN');

      // Assert
      await expect(blockedPromise).rejects.toThrow('لا يمكن صرف المخالصة فورياً لوجود قرارات إدارية معلقة بحق العامل');
      expect(mockRepo.finalizeWorkerClearance).not.toHaveBeenCalled();
    });

    it('permits finalizeWorkerClearance when WITH_PAYROLL is used for worker with pending decisions', async () => {
      // Arrange
      const mockRepo: Partial<WorkerOffboardingRepository> = {
        getWorkerClearanceProfile: vi.fn().mockResolvedValue(
          makeBaseProfile({
            pendingDisciplinaryRecords: [
              {
                id: 'disc-pending-99',
                recordNumber: '#DISC-99',
                type: 'PENALTY_CASH',
                amount: 100,
                daysEquivalent: null,
                reason: 'غرامة معلقة',
                createdAt: new Date('2026-09-09T00:00:00.000Z'),
              },
            ],
          })
        ),
        finalizeWorkerClearance: vi.fn().mockResolvedValue({
          success: true,
          clearanceNumber: '#CLR-2026-9999',
          clearanceReferenceId: 'CLR-2026-9999',
          workerId: 'w-stress-1',
          workerName: 'سيد أبو العزم',
          workerCode: 'W-999',
          demotedTelegramId: 987654321n,
          netSettlementAmount: 4000,
          payoutOption: 'WITH_PAYROLL',
          status: 'TERMINATED',
          message: 'تم اعتماد المخالصة بنجاح.',
        }),
      };

      const service = new WorkerOffboardingService(mockRepo as unknown as WorkerOffboardingRepository);

      const finalizeData: FinalizeClearanceData = {
        workerId: 'w-stress-1',
        earnedSalary: 5000,
        totalAdvances: 1000,
        netSettlementAmount: 4000,
        reason: 'RESIGNATION',
        actorTelegramId: 9999n,
        payoutOption: 'WITH_PAYROLL',
      };

      // Act
      const result = await service.finalizeWorkerClearance(finalizeData, 'SUPER_ADMIN');

      // Assert
      expect(result.success).toBe(true);
      expect(mockRepo.finalizeWorkerClearance).toHaveBeenCalledWith(
        expect.objectContaining({
          payoutOption: 'WITH_PAYROLL',
        })
      );
    });
  });
});
