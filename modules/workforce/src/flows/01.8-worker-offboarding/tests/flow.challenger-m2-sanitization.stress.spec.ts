import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  evaluateNegativeBalanceAction,
  sanitizeProfileForRole,
  WorkerOffboardingService,
} from '../flow.service.js';
import type { WorkerOffboardingRepository } from '../flow.repository.js';
import type { ClearanceProfile, FinalizeClearanceData } from '../flow.types.js';

describe('Challenger 2 Empirical Stress Test — Negative Balance & Zero Financial Leaks (Milestone 2)', () => {
  function makeRichFinancialProfile(overrides: Partial<ClearanceProfile> = {}): ClearanceProfile {
    return {
      worker: {
        id: 'w-rich-77',
        code: 'OP-ELC-0077',
        legacyCode: '77',
        name: 'إبراهيم حسن المنشاوي',
        nickname: 'المنشاوي',
        jobTitle: 'كبير فنيين صيانة',
        dailyWage: 350,
        basicSalary: 10500,
        fixedAllowances: 1500,
        status: 'ACTIVE',
        telegramId: 77889900n,
        siteId: 'site-delta',
        siteName: 'محطة طاقة السويس',
        departmentName: 'الصيانة الميكانيكية والكهربائية',
        hireDate: new Date('2021-03-01'),
        shiftSystem: '24_WORK_6_REST',
      },
      activeLeave: {
        id: 'lv-77',
        leaveNumber: '#LV-2026-0077',
        leaveType: 'SICK',
        departureDate: new Date('2026-09-01'),
        expectedReturnDate: new Date('2026-09-10'),
        actualReturnDate: null,
        status: 'ACTIVE_ON_LEAVE',
        daysBeforeLeave: 10,
        daysUntilExpectedReturn: 9,
        overdueDays: 1,
      },
      ppeAssets: [
        {
          id: 'ppe-101',
          voucherId: '#PPE-101',
          assetType: 'SAFETY_HARNESS',
          name: 'حزام أمان للارتفاعات معتمد',
          condition: 'DAMAGED_NATURAL',
          costPrice: 1200,
          isDamagedOrLost: true,
          deductionAmount: 400,
        },
        {
          id: 'ppe-102',
          voucherId: '#PPE-102',
          assetType: 'HEAVY_GLOVES',
          name: 'قفازات عازلة للضغط العالي',
          condition: 'GOOD',
          costPrice: 450,
          isDamagedOrLost: false,
          deductionAmount: 0,
        },
      ],
      advances: {
        totalOutstandingAdvances: 4500,
        unsettledInstallments: [
          {
            id: 'inst-77-1',
            originalVoucherNumber: '#ADV-2026-077',
            installmentSequence: 1,
            dueMonth: '2026-09',
            installmentAmount: 2250,
            status: 'PENDING',
          },
          {
            id: 'inst-77-2',
            originalVoucherNumber: '#ADV-2026-077',
            installmentSequence: 2,
            dueMonth: '2026-10',
            installmentAmount: 2250,
            status: 'PENDING',
          },
        ],
      },
      pendingDisciplinaryRecords: [
        {
          id: 'disc-pend-77',
          recordNumber: '#DISC-PEND-77',
          type: 'PENALTY_CASH',
          amount: 500,
          daysEquivalent: null,
          reason: 'عدم ارتداء حزام الأمان بالارتفاع',
          createdAt: new Date('2026-09-05'),
          workerName: 'إبراهيم حسن المنشاوي',
          workerCode: 'OP-ELC-0077',
        },
        {
          id: 'disc-pend-78',
          recordNumber: '#DISC-PEND-78',
          type: 'PENALTY_DAYS',
          amount: null,
          daysEquivalent: 2,
          reason: 'تأخير متكرر عن الوردية الصباحية',
          createdAt: new Date('2026-09-06'),
          workerName: 'إبراهيم حسن المنشاوي',
          workerCode: 'OP-ELC-0077',
        },
      ],
      approvedDisciplinaryRecords: [
        {
          id: 'disc-app-77',
          recordNumber: '#DISC-APP-77',
          type: 'BONUS_CASH',
          amount: 800,
          daysEquivalent: null,
          reason: 'مكافأة إنجاز صيانة طارئة',
          createdAt: new Date('2026-08-20'),
        },
        {
          id: 'disc-app-78',
          recordNumber: '#DISC-APP-78',
          type: 'PENALTY_CASH',
          amount: 300,
          daysEquivalent: null,
          reason: 'مخالفة ترتيب المعدات',
          createdAt: new Date('2026-08-25'),
        },
      ],
      stats: {
        totalApprovedBonuses: 800,
        totalApprovedPenalties: 300,
        totalApprovedPenaltyDays: 0,
        totalPendingBonuses: 0,
        totalPendingPenalties: 500,
        totalPendingPenaltyDays: 2,
      },
      ...overrides,
    };
  }

  // ==========================================================================
  // Section 1: Negative Balance Radar (WRITTEN_OFF vs BLACKLISTED)
  // ==========================================================================
  describe('1. Negative Balance Radar Empirical Verification', () => {
    describe('1.1 Negative Balance Evaluation: BLACKLISTED Action', () => {
      it('should accurately set BLACKLISTED worker status, record full positive debt, and keep isDebtWrittenOff=false', () => {
        const netSettlement = -3750;
        const evaluation = evaluateNegativeBalanceAction(netSettlement, 'BLACKLISTED');

        expect(evaluation.isNegative).toBe(true);
        expect(evaluation.action).toBe('BLACKLISTED');
        expect(evaluation.workerStatus).toBe('BLACKLISTED');
        expect(evaluation.debtAmount).toBe(3750);
        expect(evaluation.isDebtWrittenOff).toBe(false);
        expect(evaluation.auditMessage).toContain('3750 ج.م');
        expect(evaluation.auditMessage).toContain('القائمة السوداء');
        expect(evaluation.auditMessage).toContain('حظر إعادة التعيين');
      });

      it('should handle large negative debts under BLACKLISTED', () => {
        const netSettlement = -999999;
        const evaluation = evaluateNegativeBalanceAction(netSettlement, 'BLACKLISTED');

        expect(evaluation.isNegative).toBe(true);
        expect(evaluation.workerStatus).toBe('BLACKLISTED');
        expect(evaluation.debtAmount).toBe(999999);
        expect(evaluation.isDebtWrittenOff).toBe(false);
      });

      it('should handle fractional negative debt amounts correctly', () => {
        const netSettlement = -1234.56;
        const evaluation = evaluateNegativeBalanceAction(netSettlement, 'BLACKLISTED');

        expect(evaluation.debtAmount).toBe(1234.56);
        expect(evaluation.isNegative).toBe(true);
        expect(evaluation.workerStatus).toBe('BLACKLISTED');
      });
    });

    describe('1.2 Negative Balance Evaluation: WRITTEN_OFF Action', () => {
      it('should set TERMINATED worker status (not blacklisted), record debt amount, and mark isDebtWrittenOff=true', () => {
        const netSettlement = -2400;
        const evaluation = evaluateNegativeBalanceAction(netSettlement, 'WRITTEN_OFF');

        expect(evaluation.isNegative).toBe(true);
        expect(evaluation.action).toBe('WRITTEN_OFF');
        expect(evaluation.workerStatus).toBe('TERMINATED');
        expect(evaluation.debtAmount).toBe(2400);
        expect(evaluation.isDebtWrittenOff).toBe(true);
        expect(evaluation.auditMessage).toContain('2400 ج.م');
        expect(evaluation.auditMessage).toContain('إسقاط المديونية');
        expect(evaluation.auditMessage).toContain('التراضي الإداري');
        expect(evaluation.auditMessage).toContain('الشطب المالي');
      });
    });

    describe('1.3 Boundary & Positive Balance Evaluation', () => {
      it('should return isNegative=false, debtAmount=0, and workerStatus=TERMINATED for positive balance', () => {
        const positiveSettlement = 4500;
        const evalBlacklist = evaluateNegativeBalanceAction(positiveSettlement, 'BLACKLISTED');

        expect(evalBlacklist.isNegative).toBe(false);
        expect(evalBlacklist.workerStatus).toBe('TERMINATED');
        expect(evalBlacklist.debtAmount).toBe(0);
        expect(evalBlacklist.isDebtWrittenOff).toBe(false);

        const evalWrittenOff = evaluateNegativeBalanceAction(positiveSettlement, 'WRITTEN_OFF');
        expect(evalWrittenOff.isNegative).toBe(false);
        expect(evalWrittenOff.workerStatus).toBe('TERMINATED');
        expect(evalWrittenOff.debtAmount).toBe(0);
        expect(evalWrittenOff.isDebtWrittenOff).toBe(false);
      });

      it('should return isNegative=false and debtAmount=0 for exact zero balance (0)', () => {
        const zeroSettlement = 0;
        const evaluation = evaluateNegativeBalanceAction(zeroSettlement, 'WRITTEN_OFF');

        expect(evaluation.isNegative).toBe(false);
        expect(evaluation.workerStatus).toBe('TERMINATED');
        expect(evaluation.debtAmount).toBe(0);
        expect(evaluation.isDebtWrittenOff).toBe(false);
        expect(evaluation.auditMessage).toContain('المخالصة ذات رصيد إيجابي أو صفري');
      });

      it('should treat -0.01 as negative and 0.01 as non-negative', () => {
        const justBelowZero = evaluateNegativeBalanceAction(-0.01, 'BLACKLISTED');
        expect(justBelowZero.isNegative).toBe(true);
        expect(justBelowZero.debtAmount).toBe(0.01);
        expect(justBelowZero.workerStatus).toBe('BLACKLISTED');

        const justAboveZero = evaluateNegativeBalanceAction(0.01, 'BLACKLISTED');
        expect(justAboveZero.isNegative).toBe(false);
        expect(justAboveZero.debtAmount).toBe(0);
        expect(justAboveZero.workerStatus).toBe('TERMINATED');
      });
    });

    describe('1.4 Finalization Sovereignty Gate for Negative Balances', () => {
      let mockRepo: Partial<WorkerOffboardingRepository>;
      let service: WorkerOffboardingService;

      beforeEach(() => {
        mockRepo = {
          getWorkerClearanceProfile: vi.fn().mockResolvedValue(
            makeRichFinancialProfile({
              pendingDisciplinaryRecords: [],
              stats: undefined,
            })
          ),
          finalizeWorkerClearance: vi.fn().mockImplementation(async (data: FinalizeClearanceData) => ({
            success: true,
            clearanceNumber: '#CLR-2026-9999',
            clearanceReferenceId: 'CLR-2026-9999',
            workerId: data.workerId,
            workerName: 'المنشاوي',
            workerCode: 'OP-ELC-0077',
            demotedTelegramId: 77889900n,
            netSettlementAmount: data.netSettlementAmount,
            payoutOption: data.payoutOption || 'WITH_PAYROLL',
            status: data.negativeBalanceAction === 'BLACKLISTED' ? 'BLACKLISTED' : 'TERMINATED',
            message: data.negativeBalanceAction === 'BLACKLISTED' ? 'تم إدراج العامل بالقائمة السوداء' : 'تم اعتماد المخالصة',
          })),
        };
        service = new WorkerOffboardingService(mockRepo as unknown as WorkerOffboardingRepository);
      });

      it('should reject finalizeWorkerClearance if net settlement is negative and negativeBalanceAction is missing', async () => {
        const negativeData: FinalizeClearanceData = {
          workerId: 'w-rich-77',
          earnedSalary: 1000,
          totalAdvances: 5000,
          netSettlementAmount: -4000,
          reason: 'DISCIPLINARY',
          actorTelegramId: 1111n,
          payoutOption: 'WITH_PAYROLL',
        };

        await expect(
          service.finalizeWorkerClearance(negativeData, 'SUPER_ADMIN')
        ).rejects.toThrow('يجب تحديد الإجراء الإداري للمديونية السالبة (إسقاط وتراضي أو إدراج بالقائمة السوداء).');
      });

      it('should finalize with BLACKLISTED status when negativeBalanceAction is BLACKLISTED', async () => {
        const negativeData: FinalizeClearanceData = {
          workerId: 'w-rich-77',
          earnedSalary: 1000,
          totalAdvances: 5000,
          netSettlementAmount: -4000,
          reason: 'DISCIPLINARY',
          actorTelegramId: 1111n,
          payoutOption: 'WITH_PAYROLL',
          negativeBalanceAction: 'BLACKLISTED',
        };

        const result = await service.finalizeWorkerClearance(negativeData, 'SUPER_ADMIN');
        expect(result.success).toBe(true);
        expect(result.status).toBe('BLACKLISTED');
        expect(result.message).toContain('القائمة السوداء');
      });

      it('should finalize with TERMINATED status when negativeBalanceAction is WRITTEN_OFF', async () => {
        const negativeData: FinalizeClearanceData = {
          workerId: 'w-rich-77',
          earnedSalary: 1000,
          totalAdvances: 5000,
          netSettlementAmount: -4000,
          reason: 'MUTUAL_AGREEMENT',
          actorTelegramId: 1111n,
          payoutOption: 'WITH_PAYROLL',
          negativeBalanceAction: 'WRITTEN_OFF',
        };

        const result = await service.finalizeWorkerClearance(negativeData, 'SUPER_ADMIN');
        expect(result.success).toBe(true);
        expect(result.status).toBe('TERMINATED');
      });
    });
  });

  // ==========================================================================
  // Section 2: Zero Financial Leaks (Field Role Sanitization)
  // ==========================================================================
  describe('2. Zero Financial Leaks Empirical Verification', () => {
    const KNOWN_FINANCIAL_VALUES = [
      350,   // dailyWage
      10500, // basicSalary
      1500,  // fixedAllowances
      4500,  // totalOutstandingAdvances
      2250,  // installmentAmount
      1200,  // ppe costPrice 1
      400,   // ppe deduction 1
      450,   // ppe costPrice 2
      500,   // pending penalty cash
      800,   // approved bonus cash
      300,   // approved penalty cash
    ];

    describe('2.1 FIELD_ADMIN Sanitization & Zero Leaks', () => {
      it('should completely strip all salary and allowance numbers to 0', () => {
        const original = makeRichFinancialProfile();
        const sanitized = sanitizeProfileForRole(original, 'FIELD_ADMIN');

        expect(sanitized.worker.dailyWage).toBe(0);
        expect(sanitized.worker.basicSalary).toBe(0);
        expect(sanitized.worker.fixedAllowances).toBe(0);
      });

      it('should completely strip all advance balances and installment lists to empty', () => {
        const original = makeRichFinancialProfile();
        const sanitized = sanitizeProfileForRole(original, 'FIELD_ADMIN');

        expect(sanitized.advances.totalOutstandingAdvances).toBe(0);
        expect(sanitized.advances.unsettledInstallments).toEqual([]);
      });

      it('should strip all PPE asset cost prices and deduction amounts to 0', () => {
        const original = makeRichFinancialProfile();
        const sanitized = sanitizeProfileForRole(original, 'FIELD_ADMIN');

        expect(sanitized.ppeAssets.length).toBe(2);
        for (const ppe of sanitized.ppeAssets) {
          expect(ppe.costPrice).toBe(0);
          expect(ppe.deductionAmount).toBe(0);
        }
      });

      it('should strip all disciplinary amounts and daysEquivalent to null', () => {
        const original = makeRichFinancialProfile();
        const sanitized = sanitizeProfileForRole(original, 'FIELD_ADMIN');

        for (const rec of sanitized.pendingDisciplinaryRecords) {
          expect(rec.amount).toBeNull();
          expect(rec.daysEquivalent).toBeNull();
        }

        expect(sanitized.approvedDisciplinaryRecords).toBeDefined();
        for (const rec of sanitized.approvedDisciplinaryRecords!) {
          expect(rec.amount).toBeNull();
          expect(rec.daysEquivalent).toBeNull();
        }
      });

      it('should remove the stats summary object entirely (undefined)', () => {
        const original = makeRichFinancialProfile();
        const sanitized = sanitizeProfileForRole(original, 'FIELD_ADMIN');

        expect(sanitized.stats).toBeUndefined();
      });

      it('should preserve 100% of operational non-financial fields without loss', () => {
        const original = makeRichFinancialProfile();
        const sanitized = sanitizeProfileForRole(original, 'FIELD_ADMIN');

        // Worker identity & operational assignment
        expect(sanitized.worker.id).toBe(original.worker.id);
        expect(sanitized.worker.code).toBe(original.worker.code);
        expect(sanitized.worker.legacyCode).toBe(original.worker.legacyCode);
        expect(sanitized.worker.name).toBe(original.worker.name);
        expect(sanitized.worker.nickname).toBe(original.worker.nickname);
        expect(sanitized.worker.jobTitle).toBe(original.worker.jobTitle);
        expect(sanitized.worker.siteName).toBe(original.worker.siteName);
        expect(sanitized.worker.siteId).toBe(original.worker.siteId);
        expect(sanitized.worker.departmentName).toBe(original.worker.departmentName);
        expect(sanitized.worker.shiftSystem).toBe(original.worker.shiftSystem);
        expect(sanitized.worker.status).toBe(original.worker.status);
        expect(sanitized.worker.telegramId).toBe(original.worker.telegramId);
        expect(sanitized.worker.hireDate).toEqual(original.worker.hireDate);

        // Active Leave operational metrics
        expect(sanitized.activeLeave).not.toBeNull();
        expect(sanitized.activeLeave?.leaveNumber).toBe(original.activeLeave?.leaveNumber);
        expect(sanitized.activeLeave?.leaveType).toBe(original.activeLeave?.leaveType);
        expect(sanitized.activeLeave?.daysBeforeLeave).toBe(original.activeLeave?.daysBeforeLeave);
        expect(sanitized.activeLeave?.overdueDays).toBe(original.activeLeave?.overdueDays);
        expect(sanitized.activeLeave?.departureDate).toEqual(original.activeLeave?.departureDate);

        // PPE operational conditions
        expect(sanitized.ppeAssets[0]?.name).toBe(original.ppeAssets[0]?.name);
        expect(sanitized.ppeAssets[0]?.assetType).toBe(original.ppeAssets[0]?.assetType);
        expect(sanitized.ppeAssets[0]?.condition).toBe('DAMAGED_NATURAL');
        expect(sanitized.ppeAssets[0]?.isDamagedOrLost).toBe(true);

        // Disciplinary administrative reasons
        expect(sanitized.pendingDisciplinaryRecords[0]?.reason).toBe(original.pendingDisciplinaryRecords[0]?.reason);
        expect(sanitized.pendingDisciplinaryRecords[0]?.recordNumber).toBe(original.pendingDisciplinaryRecords[0]?.recordNumber);
      });

      it('should guarantee zero trace of secret financial numbers in recursive payload', () => {
        const original = makeRichFinancialProfile();
        const sanitized = sanitizeProfileForRole(original, 'FIELD_ADMIN');

        // Extract all numeric values from sanitized object recursively
        const extractedNumbers: number[] = [];
        function extractNumbers(obj: unknown) {
          if (typeof obj === 'number') {
            extractedNumbers.push(obj);
          } else if (Array.isArray(obj)) {
            for (const item of obj) extractNumbers(item);
          } else if (obj && typeof obj === 'object') {
            for (const val of Object.values(obj)) {
              extractNumbers(val);
            }
          }
        }
        extractNumbers(sanitized);

        // Check that none of the secret financial numbers exist in extracted numbers
        for (const secretVal of KNOWN_FINANCIAL_VALUES) {
          expect(extractedNumbers).not.toContain(secretVal);
        }
      });
    });

    describe('2.2 WORKER and GUEST Sanitization', () => {
      it('should sanitize identically for WORKER role', () => {
        const original = makeRichFinancialProfile();
        const sanitized = sanitizeProfileForRole(original, 'WORKER');

        expect(sanitized.worker.dailyWage).toBe(0);
        expect(sanitized.worker.basicSalary).toBe(0);
        expect(sanitized.advances.totalOutstandingAdvances).toBe(0);
        expect(sanitized.advances.unsettledInstallments).toEqual([]);
        expect(sanitized.stats).toBeUndefined();
      });

      it('should sanitize identically for GUEST role', () => {
        const original = makeRichFinancialProfile();
        const sanitized = sanitizeProfileForRole(original, 'GUEST');

        expect(sanitized.worker.dailyWage).toBe(0);
        expect(sanitized.worker.basicSalary).toBe(0);
        expect(sanitized.advances.totalOutstandingAdvances).toBe(0);
        expect(sanitized.advances.unsettledInstallments).toEqual([]);
        expect(sanitized.stats).toBeUndefined();
      });

      it('should sanitize for arbitrary unauthorized role strings (e.g. SUPPLIER, SITE_ENGINEER, UNKNOWN)', () => {
        const original = makeRichFinancialProfile();
        const forSupplier = sanitizeProfileForRole(original, 'SUPPLIER');
        const forEngineer = sanitizeProfileForRole(original, 'SITE_ENGINEER');
        const forUnknown = sanitizeProfileForRole(original, 'RANDOM_ROLE');

        expect(forSupplier.worker.dailyWage).toBe(0);
        expect(forEngineer.worker.dailyWage).toBe(0);
        expect(forUnknown.worker.dailyWage).toBe(0);
      });
    });

    describe('2.3 Full Visibility Retention for Authorized Roles', () => {
      it('should preserve 100% of financial figures intact for SUPER_ADMIN', () => {
        const original = makeRichFinancialProfile();
        const saProfile = sanitizeProfileForRole(original, 'SUPER_ADMIN');

        expect(saProfile.worker.dailyWage).toBe(350);
        expect(saProfile.worker.basicSalary).toBe(10500);
        expect(saProfile.worker.fixedAllowances).toBe(1500);
        expect(saProfile.advances.totalOutstandingAdvances).toBe(4500);
        expect(saProfile.advances.unsettledInstallments.length).toBe(2);
        expect(saProfile.advances.unsettledInstallments[0]?.installmentAmount).toBe(2250);
        expect(saProfile.ppeAssets[0]?.costPrice).toBe(1200);
        expect(saProfile.ppeAssets[0]?.deductionAmount).toBe(400);
        expect(saProfile.pendingDisciplinaryRecords[0]?.amount).toBe(500);
        expect(saProfile.pendingDisciplinaryRecords[1]?.daysEquivalent).toBe(2);
        expect(saProfile.approvedDisciplinaryRecords?.[0]?.amount).toBe(800);
        expect(saProfile.stats?.totalApprovedBonuses).toBe(800);
      });

      it('should preserve 100% of financial figures intact for ACCOUNTANT', () => {
        const original = makeRichFinancialProfile();
        const accProfile = sanitizeProfileForRole(original, 'ACCOUNTANT');

        expect(accProfile.worker.dailyWage).toBe(350);
        expect(accProfile.worker.basicSalary).toBe(10500);
        expect(accProfile.advances.totalOutstandingAdvances).toBe(4500);
        expect(accProfile.ppeAssets[0]?.costPrice).toBe(1200);
        expect(accProfile.stats?.totalPendingPenalties).toBe(500);
      });
    });

    describe('2.4 Immutability & Original Object Integrity', () => {
      it('should NOT mutate the original profile object when sanitizing for FIELD_ADMIN', () => {
        const original = makeRichFinancialProfile();
        const originalDailyWage = original.worker.dailyWage;
        const originalBasicSalary = original.worker.basicSalary;
        const originalAdvances = original.advances.totalOutstandingAdvances;

        const sanitized = sanitizeProfileForRole(original, 'FIELD_ADMIN');

        // Sanitized has 0
        expect(sanitized.worker.dailyWage).toBe(0);

        // Original is strictly preserved
        expect(original.worker.dailyWage).toBe(originalDailyWage);
        expect(original.worker.basicSalary).toBe(originalBasicSalary);
        expect(original.advances.totalOutstandingAdvances).toBe(originalAdvances);
        expect(original.ppeAssets[0]?.costPrice).toBe(1200);
        expect(original.pendingDisciplinaryRecords[0]?.amount).toBe(500);
        expect(original.stats).toBeDefined();
      });

      it('should handle profile with null activeLeave and undefined approvedDisciplinaryRecords gracefully', () => {
        const minimalProfile = makeRichFinancialProfile({
          activeLeave: null,
          approvedDisciplinaryRecords: undefined,
          stats: undefined,
        });

        const sanitized = sanitizeProfileForRole(minimalProfile, 'FIELD_ADMIN');
        expect(sanitized.activeLeave).toBeNull();
        expect(sanitized.approvedDisciplinaryRecords).toBeUndefined();
        expect(sanitized.stats).toBeUndefined();
        expect(sanitized.worker.dailyWage).toBe(0);
      });
    });

    describe('2.5 Service Integration with Role-based Profile Retrieval', () => {
      let mockRepo: Partial<WorkerOffboardingRepository>;
      let service: WorkerOffboardingService;

      beforeEach(() => {
        mockRepo = {
          getWorkerClearanceProfile: vi.fn().mockResolvedValue(makeRichFinancialProfile()),
        };
        service = new WorkerOffboardingService(mockRepo as unknown as WorkerOffboardingRepository);
      });

      it('should automatically sanitize profile when role=FIELD_ADMIN is passed to getWorkerClearanceProfile', async () => {
        const profile = await service.getWorkerClearanceProfile('w-rich-77', 'FIELD_ADMIN');

        expect(profile.worker.dailyWage).toBe(0);
        expect(profile.advances.totalOutstandingAdvances).toBe(0);
        expect(profile.stats).toBeUndefined();
        expect(profile.worker.nickname).toBe('المنشاوي');
      });

      it('should return raw un-sanitized profile when role=SUPER_ADMIN is passed', async () => {
        const profile = await service.getWorkerClearanceProfile('w-rich-77', 'SUPER_ADMIN');

        expect(profile.worker.dailyWage).toBe(350);
        expect(profile.advances.totalOutstandingAdvances).toBe(4500);
        expect(profile.stats?.totalApprovedBonuses).toBe(800);
      });

      it('should return raw un-sanitized profile when no role is passed (backward compatible)', async () => {
        const profile = await service.getWorkerClearanceProfile('w-rich-77');

        expect(profile.worker.dailyWage).toBe(350);
        expect(profile.advances.totalOutstandingAdvances).toBe(4500);
      });
    });
  });
});
