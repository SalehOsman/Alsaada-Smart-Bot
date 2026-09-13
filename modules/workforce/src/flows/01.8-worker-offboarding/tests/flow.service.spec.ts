import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  WorkerOffboardingService,
  calculateFinancialClearance,
  validatePayoutOption,
  evaluateNegativeBalanceAction,
  sanitizeProfileForRole,
} from '../flow.service.js';
import type { WorkerOffboardingRepository } from '../flow.repository.js';
import type { ClearanceProfile, FinalizeClearanceData } from '../flow.types.js';

describe('01.8 Worker Offboarding — Service & Accounting Engine Unit Tests', () => {
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
        hireDate: new Date('2023-01-15'),
        shiftSystem: '24_WORK_6_REST',
      },
      activeLeave: {
        id: 'lv-99',
        leaveNumber: '#LV-2026-0099',
        leaveType: 'ANNUAL',
        departureDate: new Date('2026-09-01'),
        expectedReturnDate: new Date('2026-09-15'),
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
          createdAt: new Date(),
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
          createdAt: new Date(),
        },
        {
          id: 'disc-app-2',
          recordNumber: '#DISC-003',
          type: 'PENALTY_DAYS',
          amount: null,
          daysEquivalent: 1,
          reason: 'تأخير غير مبرر',
          createdAt: new Date(),
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
    it('should resolve daily rate from dailyWage when positive', () => {
      const profile = createSampleProfile();
      const breakdown = calculateFinancialClearance(profile, { workedDays: 10 });
      expect(breakdown.dailyRate).toBe(200);
      expect(breakdown.earnedSalary).toBe(2000);
    });

    it('should resolve daily rate from grossSalary / 30 when dailyWage is 0', () => {
      const profile = createSampleProfile({
        worker: {
          ...createSampleProfile().worker,
          dailyWage: 0,
          basicSalary: 6000,
          fixedAllowances: 0,
        },
      });
      const breakdown = calculateFinancialClearance(profile, { workedDays: 15 });
      expect(breakdown.dailyRate).toBe(200); // 6000 / 30
      expect(breakdown.earnedSalary).toBe(3000);
    });

    it('should fallback to 300 when both dailyWage and grossSalary are 0', () => {
      const profile = createSampleProfile({
        worker: {
          ...createSampleProfile().worker,
          dailyWage: 0,
          basicSalary: 0,
          fixedAllowances: 0,
        },
      });
      const breakdown = calculateFinancialClearance(profile, { workedDays: 10 });
      expect(breakdown.dailyRate).toBe(300);
      expect(breakdown.earnedSalary).toBe(3000);
    });

    it('should allow explicit dailyRate override from input', () => {
      const profile = createSampleProfile();
      const breakdown = calculateFinancialClearance(profile, {
        workedDays: 10,
        dailyRate: 250,
      });
      expect(breakdown.dailyRate).toBe(250);
      expect(breakdown.earnedSalary).toBe(2500);
    });

    it('should accurately calculate Positive Net Balance scenario', () => {
      // workedDays = 20, dailyRate = 200 -> earnedSalary = 4000
      // approvedBonuses: cash bonus = 300
      // totalCredits = 4000 + 300 = 4300
      // totalAdvances: 1000
      // totalPenalties: 1 penalty day * 200 = 200
      // assetDamageDeduction: 100
      // totalDebits = 1000 + 200 + 100 = 1300
      // netSettlementAmount = 4300 - 1300 = +3000
      const profile = createSampleProfile();
      const breakdown = calculateFinancialClearance(profile, {
        workedDays: 20,
        assetDamageDeduction: 100,
      });

      expect(breakdown.earnedSalary).toBe(4000);
      expect(breakdown.approvedBonuses).toBe(300);
      expect(breakdown.totalCredits).toBe(4300);
      expect(breakdown.totalAdvances).toBe(1000);
      expect(breakdown.totalPenalties).toBe(200);
      expect(breakdown.assetDamageDeduction).toBe(100);
      expect(breakdown.totalDebits).toBe(1300);
      expect(breakdown.netSettlementAmount).toBe(3000);
      expect(breakdown.isNegativeBalance).toBe(false);
      expect(breakdown.hasPendingDecisions).toBe(true); // 1 pending decision exists
    });

    it('should accurately calculate Zero Net Balance scenario', () => {
      // workedDays = 5, dailyRate = 200 -> earnedSalary = 1000
      // no bonuses -> totalCredits = 1000
      // advances = 1000, penalties = 0, assetDamage = 0 -> totalDebits = 1000
      // netSettlementAmount = 1000 - 1000 = 0
      const profile = createSampleProfile({
        approvedDisciplinaryRecords: [],
        pendingDisciplinaryRecords: [],
        stats: undefined,
      });

      const breakdown = calculateFinancialClearance(profile, {
        workedDays: 5,
        assetDamageDeduction: 0,
      });

      expect(breakdown.earnedSalary).toBe(1000);
      expect(breakdown.totalCredits).toBe(1000);
      expect(breakdown.totalDebits).toBe(1000);
      expect(breakdown.netSettlementAmount).toBe(0);
      expect(breakdown.isNegativeBalance).toBe(false);
      expect(breakdown.hasPendingDecisions).toBe(false);
    });

    it('should accurately calculate Negative Net Balance scenario', () => {
      // workedDays = 4, dailyRate = 200 -> earnedSalary = 800
      // advances = 2000, penalties = 200, assetDamage = 300 -> totalDebits = 2500
      // netSettlementAmount = 800 - 2500 = -1700
      const profile = createSampleProfile({
        advances: {
          totalOutstandingAdvances: 2000,
          unsettledInstallments: [
            { id: 'inst-1', originalVoucherNumber: '#V-1', installmentAmount: 2000, status: 'PENDING' },
          ],
        },
      });

      const breakdown = calculateFinancialClearance(profile, {
        workedDays: 4,
        assetDamageDeduction: 300,
      });

      // credits = 800 + 300 (bonus) = 1100
      // debits = 2000 + 200 (penalty day) + 300 (damage) = 2500
      // net = 1100 - 2500 = -1400
      expect(breakdown.earnedSalary).toBe(800);
      expect(breakdown.totalCredits).toBe(1100);
      expect(breakdown.totalDebits).toBe(2500);
      expect(breakdown.netSettlementAmount).toBe(-1400);
      expect(breakdown.isNegativeBalance).toBe(true);
    });

    it('should merge selected pending decisions into approved calculation when requested', () => {
      const profile = createSampleProfile();
      // pending has 1 penalty with amount = 250
      const breakdown = calculateFinancialClearance(profile, {
        workedDays: 10,
        selectedDisciplinaryDecisions: ['disc-pending-1'],
      });

      // penalties now include 200 (1 penalty day) + 250 (selected penalty) = 450
      expect(breakdown.totalPenalties).toBe(450);
      expect(breakdown.hasPendingDecisions).toBe(false); // all pending decisions were selected/settled
    });
  });

  describe('2. Negative Balance Radar & Blacklist Handling', () => {
    it('should evaluate BLACKLISTED action for negative balance and record debt', () => {
      const evaluation = evaluateNegativeBalanceAction(-1850, 'BLACKLISTED');
      expect(evaluation.isNegative).toBe(true);
      expect(evaluation.action).toBe('BLACKLISTED');
      expect(evaluation.workerStatus).toBe('BLACKLISTED');
      expect(evaluation.debtAmount).toBe(1850);
      expect(evaluation.isDebtWrittenOff).toBe(false);
      expect(evaluation.auditMessage).toContain('1850 ج.م');
      expect(evaluation.auditMessage).toContain('القائمة السوداء');
    });

    it('should evaluate WRITTEN_OFF action for negative balance and mark debt written-off', () => {
      const evaluation = evaluateNegativeBalanceAction(-1200, 'WRITTEN_OFF');
      expect(evaluation.isNegative).toBe(true);
      expect(evaluation.action).toBe('WRITTEN_OFF');
      expect(evaluation.workerStatus).toBe('TERMINATED');
      expect(evaluation.debtAmount).toBe(1200);
      expect(evaluation.isDebtWrittenOff).toBe(true);
      expect(evaluation.auditMessage).toContain('1200 ج.م');
      expect(evaluation.auditMessage).toContain('إسقاط المديونية');
    });

    it('should handle positive or zero balance gracefully', () => {
      const evaluation = evaluateNegativeBalanceAction(500, 'WRITTEN_OFF');
      expect(evaluation.isNegative).toBe(false);
      expect(evaluation.workerStatus).toBe('TERMINATED');
      expect(evaluation.debtAmount).toBe(0);
      expect(evaluation.isDebtWrittenOff).toBe(false);
    });
  });

  describe('3. Mandatory Pending Decisions Policy', () => {
    it('should block IMMEDIATE payout option when worker has pending decisions and force WITH_PAYROLL', () => {
      const profile = createSampleProfile(); // has 1 pending decision
      const result = validatePayoutOption(profile, 'IMMEDIATE');
      expect(result.allowed).toBe(false);
      expect(result.forcedOption).toBe('WITH_PAYROLL');
      expect(result.reason).toContain('قرارات إدارية معلقة');
    });

    it('should accept WITH_PAYROLL payout option when worker has pending decisions', () => {
      const profile = createSampleProfile();
      const result = validatePayoutOption(profile, 'WITH_PAYROLL');
      expect(result.allowed).toBe(true);
      expect(result.forcedOption).toBe('WITH_PAYROLL');
    });

    it('should allow IMMEDIATE payout option when worker has NO pending decisions', () => {
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
      const result = validatePayoutOption(profile, 'IMMEDIATE');
      expect(result.allowed).toBe(true);
      expect(result.forcedOption).toBe('IMMEDIATE');
    });
  });

  describe('4. Zero Financial Leaks for Field Admin (Role Sanitization)', () => {
    it('should strip all salary, advances, and financial numbers for FIELD_ADMIN', () => {
      const profile = createSampleProfile();
      const sanitized = sanitizeProfileForRole(profile, 'FIELD_ADMIN');

      // Financial figures stripped
      expect(sanitized.worker.dailyWage).toBe(0);
      expect(sanitized.worker.basicSalary).toBe(0);
      expect(sanitized.worker.fixedAllowances).toBe(0);
      expect(sanitized.advances.totalOutstandingAdvances).toBe(0);
      expect(sanitized.advances.unsettledInstallments).toEqual([]);
      expect(sanitized.stats).toBeUndefined();

      // Disciplinary amounts stripped to null
      expect(sanitized.pendingDisciplinaryRecords[0]?.amount).toBeNull();
      expect(sanitized.pendingDisciplinaryRecords[0]?.daysEquivalent).toBeNull();
      expect(sanitized.approvedDisciplinaryRecords?.[0]?.amount).toBeNull();
      expect(sanitized.approvedDisciplinaryRecords?.[1]?.daysEquivalent).toBeNull();

      // PPE cost and deductions stripped
      expect(sanitized.ppeAssets[0]?.costPrice).toBe(0);
      expect(sanitized.ppeAssets[0]?.deductionAmount).toBe(0);
      expect(sanitized.ppeAssets[1]?.costPrice).toBe(0);
      expect(sanitized.ppeAssets[1]?.deductionAmount).toBe(0);

      // Operational fields strictly preserved
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

    it('should preserve full financial figures for SUPER_ADMIN', () => {
      const profile = createSampleProfile();
      const sanitized = sanitizeProfileForRole(profile, 'SUPER_ADMIN');

      expect(sanitized.worker.dailyWage).toBe(200);
      expect(sanitized.worker.basicSalary).toBe(6000);
      expect(sanitized.advances.totalOutstandingAdvances).toBe(1000);
      expect(sanitized.ppeAssets[0]?.costPrice).toBe(350);
      expect(sanitized.pendingDisciplinaryRecords[0]?.amount).toBe(250);
    });

    it('should preserve full financial figures for ACCOUNTANT', () => {
      const profile = createSampleProfile();
      const sanitized = sanitizeProfileForRole(profile, 'ACCOUNTANT');

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
            createdAt: new Date(),
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
            createdAt: new Date(),
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

    it('should return sanitized profile for FIELD_ADMIN via getWorkerClearanceProfile', async () => {
      const profile = await service.getWorkerClearanceProfile('w-101', 'FIELD_ADMIN');
      expect(profile.worker.dailyWage).toBe(0);
      expect(profile.advances.totalOutstandingAdvances).toBe(0);
      expect(profile.worker.name).toBe('محمود عبد الرحمن');
    });

    it('should delegate getPendingClearanceReports and getPendingDisciplinaryDecisions', async () => {
      const reports = await service.getPendingClearanceReports();
      expect(reports.length).toBe(1);
      expect(reports[0]?.ticketNumber).toBe('#TCK-CLR-001');

      const decisions = await service.getPendingDisciplinaryDecisions('w-101');
      expect(decisions.length).toBe(1);
      expect(decisions[0]?.recordNumber).toBe('#DISC-001');
    });

    it('should delegate settleDisciplinaryDecision to repository', async () => {
      await service.settleDisciplinaryDecision('disc-1', 'APPROVE', '8888', 300);
      expect(mockRepo.settleDisciplinaryDecision).toHaveBeenCalledWith(
        'disc-1',
        'APPROVE',
        '8888',
        300,
        undefined
      );
    });

    it('should enforce role checks on submitFieldClearanceReport', async () => {
      await expect(
        service.submitFieldClearanceReport(
          {
            workerId: 'w-101',
            workerCode: 'OP-0101',
            workedDays: 15,
            reason: 'RESIGNATION',
            submitterTelegramId: 5555n,
          },
          'WORKER'
        )
      ).rejects.toThrow('غير مصرح للمستخدم برفع تقرير إخلاء طرف ميداني.');

      const ticketNum = await service.submitFieldClearanceReport(
        {
          workerId: 'w-101',
          workerCode: 'OP-0101',
          workedDays: 15,
          reason: 'RESIGNATION',
          submitterTelegramId: 5555n,
        },
        'FIELD_ADMIN'
      );
      expect(ticketNum).toBe('#TCK-CLR-NEW');
    });

    it('should enforce SUPER_ADMIN authority on finalizeWorkerClearance', async () => {
      const finalizeData: FinalizeClearanceData = {
        workerId: 'w-101',
        earnedSalary: 4000,
        totalAdvances: 1000,
        netSettlementAmount: 3000,
        reason: 'RESIGNATION',
        actorTelegramId: 9999n,
      };

      await expect(
        service.finalizeWorkerClearance(finalizeData, 'FIELD_ADMIN')
      ).rejects.toThrow('الاختصاص السيادي الحصري للمدير العام (SUPER_ADMIN)');
    });

    it('should enforce pending decisions policy when finalizing clearance', async () => {
      const finalizeData: FinalizeClearanceData = {
        workerId: 'w-101',
        earnedSalary: 4000,
        totalAdvances: 1000,
        netSettlementAmount: 3000,
        reason: 'RESIGNATION',
        actorTelegramId: 9999n,
        payoutOption: 'IMMEDIATE', // worker has pending decision!
      };

      await expect(
        service.finalizeWorkerClearance(finalizeData, 'SUPER_ADMIN')
      ).rejects.toThrow('لا يمكن صرف المخالصة فورياً لوجود قرارات إدارية معلقة');
    });

    it('should enforce negativeBalanceAction when net settlement is negative', async () => {
      // Mock profile without pending decisions
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
        // negativeBalanceAction missing!
      };

      await expect(
        service.finalizeWorkerClearance(finalizeData, 'SUPER_ADMIN')
      ).rejects.toThrow('يجب تحديد الإجراء الإداري للمديونية السالبة');
    });

    it('should successfully finalize clearance and trigger onWorkerDemoted callback', async () => {
      const finalizeData: FinalizeClearanceData = {
        workerId: 'w-101',
        earnedSalary: 4000,
        totalAdvances: 1000,
        netSettlementAmount: 3000,
        reason: 'RESIGNATION',
        actorTelegramId: 9999n,
        payoutOption: 'WITH_PAYROLL',
      };

      const result = await service.finalizeWorkerClearance(finalizeData, 'SUPER_ADMIN');
      expect(result.success).toBe(true);
      expect(result.clearanceNumber).toBe('#CLR-2026-0001');
      expect(onWorkerDemoted).toHaveBeenCalledWith(11223344n);
    });
  });
});
