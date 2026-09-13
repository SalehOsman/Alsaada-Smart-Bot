import { describe, it, expect, vi } from 'vitest';
import {
  calculateFinancialClearance,
  validatePayoutOption,
  evaluateNegativeBalanceAction,
  WorkerOffboardingService,
} from '../flow.service.js';
import type { WorkerOffboardingRepository } from '../flow.repository.js';
import type { ClearanceProfile, FinalizeClearanceData } from '../flow.types.js';

describe('Challenger 1 Empirical Stress Test — Accounting Engine & Gating (Milestone 2)', () => {
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
        hireDate: new Date('2022-05-10'),
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
    it('should correctly evaluate zero worked days with positive wage', () => {
      const profile = makeBaseProfile();
      const result = calculateFinancialClearance(profile, { workedDays: 0 });

      expect(result.workedDays).toBe(0);
      expect(result.dailyRate).toBe(250);
      expect(result.earnedSalary).toBe(0);
      expect(result.totalCredits).toBe(0);
      expect(result.totalDebits).toBe(0);
      expect(result.netSettlementAmount).toBe(0);
      expect(result.isNegativeBalance).toBe(false);
    });

    it('should clamp negative worked days to 0 and calculate zero earned salary', () => {
      const profile = makeBaseProfile();
      const result = calculateFinancialClearance(profile, { workedDays: -10 });

      expect(result.workedDays).toBe(0);
      expect(result.earnedSalary).toBe(0);
      expect(result.netSettlementAmount).toBe(0);
    });

    it('should fallback to 300 daily rate when worker dailyWage and grossSalary are 0', () => {
      const profile = makeBaseProfile({
        worker: {
          ...makeBaseProfile().worker,
          dailyWage: 0,
          basicSalary: 0,
          fixedAllowances: 0,
        },
      });
      const result = calculateFinancialClearance(profile, { workedDays: 0 });

      expect(result.dailyRate).toBe(300);
      expect(result.workedDays).toBe(0);
      expect(result.earnedSalary).toBe(0);
      expect(result.netSettlementAmount).toBe(0);
    });

    it('should calculate zero earned salary when both workedDays=0 and wage=0 with advances=0', () => {
      const profile = makeBaseProfile({
        worker: {
          ...makeBaseProfile().worker,
          dailyWage: 0,
          basicSalary: 0,
          fixedAllowances: 0,
        },
      });
      const result = calculateFinancialClearance(profile, { workedDays: 0, dailyRate: 0 });

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
    it('should handle large gross salary and compute exact daily rate', () => {
      // gross = 300,000 + 60,000 = 360,000 -> dailyRate = 360,000 / 30 = 12,000
      const profile = makeBaseProfile({
        worker: {
          ...makeBaseProfile().worker,
          dailyWage: 0,
          basicSalary: 300_000,
          fixedAllowances: 60_000,
        },
      });
      const result = calculateFinancialClearance(profile, { workedDays: 15 });

      expect(result.dailyRate).toBe(12000);
      expect(result.earnedSalary).toBe(180000); // 15 * 12000
    });

    it('should compute deep negative balance when advances far exceed salary', () => {
      // dailyRate = 250, workedDays = 10 -> earnedSalary = 2500
      // total advances = 750,000
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
      const result = calculateFinancialClearance(profile, {
        workedDays: 10,
        assetDamageDeduction: 50_000,
      });

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
    it('should accurately aggregate cash and day-equivalent bonuses and penalties', () => {
      // dailyRate = 350
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
            createdAt: new Date(),
          },
          {
            id: 'b-days',
            recordNumber: '#B-2',
            type: 'BONUS_DAYS',
            amount: null,
            daysEquivalent: 3,
            reason: 'حافز 3 أيام',
            createdAt: new Date(),
          },
          {
            id: 'p-cash',
            recordNumber: '#P-1',
            type: 'PENALTY_CASH',
            amount: 400,
            daysEquivalent: null,
            reason: 'غرامة مخالفة',
            createdAt: new Date(),
          },
          {
            id: 'p-days',
            recordNumber: '#P-2',
            type: 'PENALTY_DAYS',
            amount: null,
            daysEquivalent: 2,
            reason: 'خصم يومين غياب',
            createdAt: new Date(),
          },
        ],
        advances: {
          totalOutstandingAdvances: 2500,
          unsettledInstallments: [],
        },
      });

      const result = calculateFinancialClearance(profile, {
        workedDays: 20,
        customBonusAmount: 300,
        customPenaltyAmount: 150,
        assetDamageDeduction: 500,
      });

      // EarnedSalary = 20 * 350 = 7000
      expect(result.earnedSalary).toBe(7000);

      // Bonuses = 1200 (cash) + Math.round(3 * 350 = 1050) + 300 (custom) = 2550
      expect(result.approvedBonuses).toBe(2550);
      expect(result.totalCredits).toBe(7000 + 2550); // 9550

      // Penalties = 400 (cash) + Math.round(2 * 350 = 700) + 150 (custom) = 1250
      expect(result.totalPenalties).toBe(1250);

      // Debits = 2500 (advances) + 1250 (penalties) + 500 (assetDamage) = 4250
      expect(result.totalAdvances).toBe(2500);
      expect(result.assetDamageDeduction).toBe(500);
      expect(result.totalDebits).toBe(4250);

      // Net = 9550 - 4250 = +5300
      expect(result.netSettlementAmount).toBe(5300);
      expect(result.isNegativeBalance).toBe(false);
    });

    it('should aggregate legacy stats when approved records array is empty', () => {
      const profile = makeBaseProfile({
        worker: {
          ...makeBaseProfile().worker,
          dailyWage: 200,
        },
        approvedDisciplinaryRecords: [],
        stats: {
          totalApprovedBonuses: 800,
          totalApprovedPenalties: 300,
          totalApprovedPenaltyDays: 2, // 2 * 200 = 400
          totalPendingBonuses: 0,
          totalPendingPenalties: 0,
          totalPendingPenaltyDays: 0,
        },
      });

      const result = calculateFinancialClearance(profile, { workedDays: 10 });
      expect(result.earnedSalary).toBe(2000);
      expect(result.approvedBonuses).toBe(800);
      expect(result.totalCredits).toBe(2800);
      expect(result.totalPenalties).toBe(300 + 400); // 700
      expect(result.totalDebits).toBe(700);
      expect(result.netSettlementAmount).toBe(2100);
    });
  });

  // ==========================================================================
  // 4. Exact Penny Rounding (Math.round parity with legacy)
  // ==========================================================================
  describe('4. Exact Penny Rounding Parity with Legacy', () => {
    it('should round dailyRate identically to legacy Math.round(gross / 30)', () => {
      const testCases = [
        { basic: 7000, allowances: 0, expectedDailyRate: Math.round(7000 / 30) }, // 233.333 -> 233
        { basic: 7005, allowances: 0, expectedDailyRate: Math.round(7005 / 30) }, // 233.5 -> 234
        { basic: 7004, allowances: 0, expectedDailyRate: Math.round(7004 / 30) }, // 233.466 -> 233
        { basic: 7019, allowances: 0, expectedDailyRate: Math.round(7019 / 30) }, // 233.966 -> 234
        { basic: 11111, allowances: 222, expectedDailyRate: Math.round((11111 + 222) / 30) }, // 11333 / 30 = 377.766 -> 378
      ];

      for (const tc of testCases) {
        const profile = makeBaseProfile({
          worker: {
            ...makeBaseProfile().worker,
            dailyWage: 0,
            basicSalary: tc.basic,
            fixedAllowances: tc.allowances,
          },
        });
        const result = calculateFinancialClearance(profile, { workedDays: 1 });
        expect(result.dailyRate).toBe(tc.expectedDailyRate);
      }
    });

    it('should round earnedSalary identically to legacy Math.round(workedDays * dailyRate)', () => {
      // If dailyRate = 233, workedDays = 12.5 -> 12.5 * 233 = 2912.5 -> 2913
      const profile = makeBaseProfile({
        worker: {
          ...makeBaseProfile().worker,
          dailyWage: 233,
        },
      });

      const fractionalWorkedDays = [
        { days: 0.5, expected: Math.round(0.5 * 233) }, // 116.5 -> 117
        { days: 12.5, expected: Math.round(12.5 * 233) }, // 2912.5 -> 2913
        { days: 17.25, expected: Math.round(17.25 * 233) }, // 4019.25 -> 4019
        { days: 17.75, expected: Math.round(17.75 * 233) }, // 4135.75 -> 4136
      ];

      for (const f of fractionalWorkedDays) {
        const result = calculateFinancialClearance(profile, { workedDays: f.days });
        expect(result.earnedSalary).toBe(f.expected);
      }
    });

    it('should round penalty and bonus days equivalents identically to legacy', () => {
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
            daysEquivalent: 1.5, // 1.5 * 175 = 262.5 -> 263
            reason: 'يوم ونصف مكافأة',
            createdAt: new Date(),
          },
          {
            id: 'p-frac',
            recordNumber: '#PF-1',
            type: 'PENALTY_DAYS',
            amount: null,
            daysEquivalent: 0.5, // 0.5 * 175 = 87.5 -> 88
            reason: 'نصف يوم جزاء',
            createdAt: new Date(),
          },
        ],
      });

      const result = calculateFinancialClearance(profile, { workedDays: 10 });
      expect(result.approvedBonuses).toBe(Math.round(1.5 * dailyRate)); // 263
      expect(result.totalPenalties).toBe(Math.round(0.5 * dailyRate)); // 88
    });
  });

  // ==========================================================================
  // 5. Payout Option Gating: Mandatory Pending Decisions Policy
  // ==========================================================================
  describe('5. Payout Option Gating: Pending Decisions Policy', () => {
    it('should allow IMMEDIATE option when worker has 0 pending decisions', () => {
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

      const immediateCheck = validatePayoutOption(profile, 'IMMEDIATE');
      expect(immediateCheck.allowed).toBe(true);
      expect(immediateCheck.forcedOption).toBe('IMMEDIATE');
      expect(immediateCheck.reason).toBeUndefined();

      const payrollCheck = validatePayoutOption(profile, 'WITH_PAYROLL');
      expect(payrollCheck.allowed).toBe(true);
      expect(payrollCheck.forcedOption).toBe('WITH_PAYROLL');
    });

    it('should block IMMEDIATE option and force WITH_PAYROLL when worker has 1 pending cash penalty', () => {
      const profile = makeBaseProfile({
        pendingDisciplinaryRecords: [
          {
            id: 'p-1',
            recordNumber: '#P-001',
            type: 'PENALTY_CASH',
            amount: 300,
            daysEquivalent: null,
            reason: 'تأخير غير مبرر',
            createdAt: new Date(),
          },
        ],
      });

      const immediateCheck = validatePayoutOption(profile, 'IMMEDIATE');
      expect(immediateCheck.allowed).toBe(false);
      expect(immediateCheck.forcedOption).toBe('WITH_PAYROLL');
      expect(immediateCheck.reason).toContain('قرارات إدارية معلقة');

      // WITH_PAYROLL must still be allowed
      const payrollCheck = validatePayoutOption(profile, 'WITH_PAYROLL');
      expect(payrollCheck.allowed).toBe(true);
      expect(payrollCheck.forcedOption).toBe('WITH_PAYROLL');
    });

    it('should block IMMEDIATE option and force WITH_PAYROLL when worker has 1 pending bonus', () => {
      const profile = makeBaseProfile({
        pendingDisciplinaryRecords: [
          {
            id: 'b-1',
            recordNumber: '#B-001',
            type: 'BONUS_CASH',
            amount: 500,
            daysEquivalent: null,
            reason: 'مكافأة عمل إضافي معلقة',
            createdAt: new Date(),
          },
        ],
      });

      const immediateCheck = validatePayoutOption(profile, 'IMMEDIATE');
      expect(immediateCheck.allowed).toBe(false);
      expect(immediateCheck.forcedOption).toBe('WITH_PAYROLL');
    });

    it('should block IMMEDIATE option when pending decisions are indicated via legacy flags or stats', () => {
      // Test via stats
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
      expect(validatePayoutOption(profileWithStats, 'IMMEDIATE').allowed).toBe(false);

      // Test via legacy pendingDisciplinaryCount
      const profileWithLegacyCount = {
        ...makeBaseProfile({ pendingDisciplinaryRecords: [] }),
        pendingDisciplinaryCount: 2,
      } as unknown as ClearanceProfile;
      expect(validatePayoutOption(profileWithLegacyCount, 'IMMEDIATE').allowed).toBe(false);

      // Test via legacy hasPendingDecisions flag
      const profileWithLegacyFlag = {
        ...makeBaseProfile({ pendingDisciplinaryRecords: [] }),
        hasPendingDecisions: true,
      } as unknown as ClearanceProfile;
      expect(validatePayoutOption(profileWithLegacyFlag, 'IMMEDIATE').allowed).toBe(false);
    });

    it('should block finalizeWorkerClearance when IMMEDIATE is requested for worker with pending decisions', async () => {
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
                createdAt: new Date(),
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

      await expect(
        service.finalizeWorkerClearance(finalizeData, 'SUPER_ADMIN')
      ).rejects.toThrow('لا يمكن صرف المخالصة فورياً لوجود قرارات إدارية معلقة بحق العامل');

      expect(mockRepo.finalizeWorkerClearance).not.toHaveBeenCalled();
    });

    it('should permit finalizeWorkerClearance when WITH_PAYROLL is used for worker with pending decisions', async () => {
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
                createdAt: new Date(),
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

      const result = await service.finalizeWorkerClearance(finalizeData, 'SUPER_ADMIN');
      expect(result.success).toBe(true);
      expect(mockRepo.finalizeWorkerClearance).toHaveBeenCalledWith(
        expect.objectContaining({
          payoutOption: 'WITH_PAYROLL',
        })
      );
    });
  });
});
