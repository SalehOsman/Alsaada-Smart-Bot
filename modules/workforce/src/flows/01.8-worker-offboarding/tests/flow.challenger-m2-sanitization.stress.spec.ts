import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  evaluateNegativeBalanceAction,
  sanitizeProfileForRole,
  WorkerOffboardingService,
} from '../flow.service.js';
import type { WorkerOffboardingRepository } from '../flow.repository.js';
import type { ClearanceProfile, FinalizeClearanceData } from '../flow.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Challenger 2 Empirical Stress Test — Negative Balance & Zero Financial Leaks (Milestone 2)', () => {
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
        hireDate: new Date('2021-03-01T00:00:00.000Z'),
        shiftSystem: '24_WORK_6_REST',
      },
      activeLeave: {
        id: 'lv-77',
        leaveNumber: '#LV-2026-0077',
        leaveType: 'SICK',
        departureDate: new Date('2026-09-01T00:00:00.000Z'),
        expectedReturnDate: new Date('2026-09-10T00:00:00.000Z'),
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
          createdAt: new Date('2026-09-05T00:00:00.000Z'),
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
          createdAt: new Date('2026-09-06T00:00:00.000Z'),
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
          createdAt: new Date('2026-08-20T00:00:00.000Z'),
        },
        {
          id: 'disc-app-78',
          recordNumber: '#DISC-APP-78',
          type: 'PENALTY_CASH',
          amount: 300,
          daysEquivalent: null,
          reason: 'مخالفة ترتيب المعدات',
          createdAt: new Date('2026-08-25T00:00:00.000Z'),
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
      it('accurately sets BLACKLISTED worker status, records full positive debt, and keeps isDebtWrittenOff=false', () => {
        // Arrange
        const netSettlement = -3750;

        // Act
        const evaluation = evaluateNegativeBalanceAction(netSettlement, 'BLACKLISTED');

        // Assert
        expect(evaluation.isNegative).toBe(true);
        expect(evaluation.action).toBe('BLACKLISTED');
        expect(evaluation.workerStatus).toBe('BLACKLISTED');
        expect(evaluation.debtAmount).toBe(3750);
        expect(evaluation.isDebtWrittenOff).toBe(false);
        expect(evaluation.auditMessage).toContain('3750 ج.م');
        expect(evaluation.auditMessage).toContain('القائمة السوداء');
        expect(evaluation.auditMessage).toContain('حظر إعادة التعيين');
      });

      it('handles large negative debts under BLACKLISTED', () => {
        // Arrange
        const netSettlement = -999999;

        // Act
        const evaluation = evaluateNegativeBalanceAction(netSettlement, 'BLACKLISTED');

        // Assert
        expect(evaluation.isNegative).toBe(true);
        expect(evaluation.workerStatus).toBe('BLACKLISTED');
        expect(evaluation.debtAmount).toBe(999999);
        expect(evaluation.isDebtWrittenOff).toBe(false);
      });

      it('handles fractional negative debt amounts correctly', () => {
        // Arrange
        const netSettlement = -1234.56;

        // Act
        const evaluation = evaluateNegativeBalanceAction(netSettlement, 'BLACKLISTED');

        // Assert
        expect(evaluation.debtAmount).toBe(1234.56);
        expect(evaluation.isNegative).toBe(true);
        expect(evaluation.workerStatus).toBe('BLACKLISTED');
      });
    });

    describe('1.2 Negative Balance Evaluation: WRITTEN_OFF Action', () => {
      it('sets TERMINATED worker status (not blacklisted), records debt amount, and marks isDebtWrittenOff=true', () => {
        // Arrange
        const netSettlement = -2400;

        // Act
        const evaluation = evaluateNegativeBalanceAction(netSettlement, 'WRITTEN_OFF');

        // Assert
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
      it('returns isNegative=false, debtAmount=0, and workerStatus=TERMINATED for positive balance', () => {
        // Arrange
        const positiveSettlement = 4500;

        // Act
        const evalBlacklist = evaluateNegativeBalanceAction(positiveSettlement, 'BLACKLISTED');
        const evalWrittenOff = evaluateNegativeBalanceAction(positiveSettlement, 'WRITTEN_OFF');

        // Assert
        expect(evalBlacklist.isNegative).toBe(false);
        expect(evalBlacklist.workerStatus).toBe('TERMINATED');
        expect(evalBlacklist.debtAmount).toBe(0);
        expect(evalBlacklist.isDebtWrittenOff).toBe(false);

        expect(evalWrittenOff.isNegative).toBe(false);
        expect(evalWrittenOff.workerStatus).toBe('TERMINATED');
        expect(evalWrittenOff.debtAmount).toBe(0);
        expect(evalWrittenOff.isDebtWrittenOff).toBe(false);
      });

      it('returns isNegative=false and debtAmount=0 for exact zero balance (0)', () => {
        // Arrange
        const zeroSettlement = 0;

        // Act
        const evaluation = evaluateNegativeBalanceAction(zeroSettlement, 'WRITTEN_OFF');

        // Assert
        expect(evaluation.isNegative).toBe(false);
        expect(evaluation.workerStatus).toBe('TERMINATED');
        expect(evaluation.debtAmount).toBe(0);
        expect(evaluation.isDebtWrittenOff).toBe(false);
        expect(evaluation.auditMessage).toContain('المخالصة ذات رصيد إيجابي أو صفري');
      });

      it('treats -0.01 as negative and 0.01 as non-negative', () => {
        // Arrange
        const negativeAmount = -0.01;
        const positiveAmount = 0.01;

        // Act
        const justBelowZero = evaluateNegativeBalanceAction(negativeAmount, 'BLACKLISTED');
        const justAboveZero = evaluateNegativeBalanceAction(positiveAmount, 'BLACKLISTED');

        // Assert
        expect(justBelowZero.isNegative).toBe(true);
        expect(justBelowZero.debtAmount).toBe(0.01);
        expect(justBelowZero.workerStatus).toBe('BLACKLISTED');

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

      it('rejects finalizeWorkerClearance if net settlement is negative and negativeBalanceAction is missing', async () => {
        // Arrange
        const negativeData: FinalizeClearanceData = {
          workerId: 'w-rich-77',
          earnedSalary: 1000,
          totalAdvances: 5000,
          netSettlementAmount: -4000,
          reason: 'DISCIPLINARY',
          actorTelegramId: 1111n,
          payoutOption: 'WITH_PAYROLL',
        };

        // Act & Assert
        // Act
        const actionMissingPromise = service.finalizeWorkerClearance(negativeData, 'SUPER_ADMIN');

        // Assert
        await expect(actionMissingPromise).rejects.toThrow('يجب تحديد الإجراء الإداري للمديونية السالبة (إسقاط وتراضي أو إدراج بالقائمة السوداء).');
      });

      it('finalizes with BLACKLISTED status when negativeBalanceAction is BLACKLISTED', async () => {
        // Arrange
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

        // Act
        const result = await service.finalizeWorkerClearance(negativeData, 'SUPER_ADMIN');

        // Assert
        expect(result.success).toBe(true);
        expect(result.status).toBe('BLACKLISTED');
        expect(result.message).toContain('القائمة السوداء');
      });

      it('finalizes with TERMINATED status when negativeBalanceAction is WRITTEN_OFF', async () => {
        // Arrange
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

        // Act
        const result = await service.finalizeWorkerClearance(negativeData, 'SUPER_ADMIN');

        // Assert
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
      350,
      10500,
      1500,
      4500,
      2250,
      1200,
      400,
      450,
      500,
      800,
      300,
    ];

    describe('2.1 FIELD_ADMIN Sanitization & Zero Leaks', () => {
      it('completely strips all salary and allowance numbers to 0', () => {
        // Arrange
        const original = makeRichFinancialProfile();

        // Act
        const sanitized = sanitizeProfileForRole(original, 'FIELD_ADMIN');

        // Assert
        expect(sanitized.worker.dailyWage).toBe(0);
        expect(sanitized.worker.basicSalary).toBe(0);
        expect(sanitized.worker.fixedAllowances).toBe(0);
      });

      it('completely strips all advance balances and installment lists to empty', () => {
        // Arrange
        const original = makeRichFinancialProfile();

        // Act
        const sanitized = sanitizeProfileForRole(original, 'FIELD_ADMIN');

        // Assert
        expect(sanitized.advances.totalOutstandingAdvances).toBe(0);
        expect(sanitized.advances.unsettledInstallments).toEqual([]);
      });

      it('strips all PPE asset cost prices and deduction amounts to 0', () => {
        // Arrange
        const original = makeRichFinancialProfile();

        // Act
        const sanitized = sanitizeProfileForRole(original, 'FIELD_ADMIN');

        // Assert
        expect(sanitized.ppeAssets.length).toBe(2);
        for (const ppe of sanitized.ppeAssets) {
          expect(ppe.costPrice).toBe(0);
          expect(ppe.deductionAmount).toBe(0);
        }
      });

      it('strips all disciplinary amounts and daysEquivalent to null', () => {
        // Arrange
        const original = makeRichFinancialProfile();

        // Act
        const sanitized = sanitizeProfileForRole(original, 'FIELD_ADMIN');

        // Assert
        for (const rec of sanitized.pendingDisciplinaryRecords) {
          expect(rec.amount).toBeNull();
          expect(rec.daysEquivalent).toBeNull();
        }

        for (const rec of sanitized.approvedDisciplinaryRecords!) {
          expect(rec.amount).toBeNull();
          expect(rec.daysEquivalent).toBeNull();
        }
      });

      it('removes the stats summary object entirely (undefined)', () => {
        // Arrange
        const original = makeRichFinancialProfile();

        // Act
        const sanitized = sanitizeProfileForRole(original, 'FIELD_ADMIN');

        // Assert
        expect(sanitized.stats).toBeUndefined();
      });

      it('preserves 100% of operational non-financial fields without loss', () => {
        // Arrange
        const original = makeRichFinancialProfile();

        // Act
        const sanitized = sanitizeProfileForRole(original, 'FIELD_ADMIN');

        // Assert
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

        expect(sanitized.activeLeave?.leaveNumber).toBe(original.activeLeave?.leaveNumber);
        expect(sanitized.activeLeave?.leaveType).toBe(original.activeLeave?.leaveType);
        expect(sanitized.activeLeave?.daysBeforeLeave).toBe(original.activeLeave?.daysBeforeLeave);
        expect(sanitized.activeLeave?.overdueDays).toBe(original.activeLeave?.overdueDays);
        expect(sanitized.activeLeave?.departureDate).toEqual(original.activeLeave?.departureDate);

        expect(sanitized.ppeAssets[0]?.name).toBe(original.ppeAssets[0]?.name);
        expect(sanitized.ppeAssets[0]?.assetType).toBe(original.ppeAssets[0]?.assetType);
        expect(sanitized.ppeAssets[0]?.condition).toBe('DAMAGED_NATURAL');
        expect(sanitized.ppeAssets[0]?.isDamagedOrLost).toBe(true);

        expect(sanitized.pendingDisciplinaryRecords[0]?.reason).toBe(original.pendingDisciplinaryRecords[0]?.reason);
        expect(sanitized.pendingDisciplinaryRecords[0]?.recordNumber).toBe(original.pendingDisciplinaryRecords[0]?.recordNumber);
      });

      it('guarantees zero trace of secret financial numbers in recursive payload', () => {
        // Arrange
        const original = makeRichFinancialProfile();

        // Act
        const sanitized = sanitizeProfileForRole(original, 'FIELD_ADMIN');

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

        // Assert
        for (const secretVal of KNOWN_FINANCIAL_VALUES) {
          expect(extractedNumbers).not.toContain(secretVal);
        }
      });
    });

    describe('2.2 WORKER and GUEST Sanitization', () => {
      it('sanitizes identically for WORKER role', () => {
        // Arrange
        const original = makeRichFinancialProfile();

        // Act
        const sanitized = sanitizeProfileForRole(original, 'WORKER');

        // Assert
        expect(sanitized.worker.dailyWage).toBe(0);
        expect(sanitized.worker.basicSalary).toBe(0);
        expect(sanitized.advances.totalOutstandingAdvances).toBe(0);
        expect(sanitized.advances.unsettledInstallments).toEqual([]);
        expect(sanitized.stats).toBeUndefined();
      });

      it('sanitizes identically for GUEST role', () => {
        // Arrange
        const original = makeRichFinancialProfile();

        // Act
        const sanitized = sanitizeProfileForRole(original, 'GUEST');

        // Assert
        expect(sanitized.worker.dailyWage).toBe(0);
        expect(sanitized.worker.basicSalary).toBe(0);
        expect(sanitized.advances.totalOutstandingAdvances).toBe(0);
        expect(sanitized.advances.unsettledInstallments).toEqual([]);
        expect(sanitized.stats).toBeUndefined();
      });

      it('sanitizes for arbitrary unauthorized role strings', () => {
        // Arrange
        const original = makeRichFinancialProfile();

        // Act
        const forSupplier = sanitizeProfileForRole(original, 'SUPPLIER');
        const forEngineer = sanitizeProfileForRole(original, 'SITE_ENGINEER');
        const forUnknown = sanitizeProfileForRole(original, 'RANDOM_ROLE');

        // Assert
        expect(forSupplier.worker.dailyWage).toBe(0);
        expect(forEngineer.worker.dailyWage).toBe(0);
        expect(forUnknown.worker.dailyWage).toBe(0);
      });
    });

    describe('2.3 Full Visibility Retention for Authorized Roles', () => {
      it('preserves 100% of financial figures intact for SUPER_ADMIN', () => {
        // Arrange
        const original = makeRichFinancialProfile();

        // Act
        const saProfile = sanitizeProfileForRole(original, 'SUPER_ADMIN');

        // Assert
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

      it('preserves 100% of financial figures intact for ACCOUNTANT', () => {
        // Arrange
        const original = makeRichFinancialProfile();

        // Act
        const accProfile = sanitizeProfileForRole(original, 'ACCOUNTANT');

        // Assert
        expect(accProfile.worker.dailyWage).toBe(350);
        expect(accProfile.worker.basicSalary).toBe(10500);
        expect(accProfile.advances.totalOutstandingAdvances).toBe(4500);
        expect(accProfile.ppeAssets[0]?.costPrice).toBe(1200);
        expect(accProfile.stats?.totalPendingPenalties).toBe(500);
      });
    });

    describe('2.4 Immutability & Original Object Integrity', () => {
      it('does NOT mutate the original profile object when sanitizing for FIELD_ADMIN', () => {
        // Arrange
        const original = makeRichFinancialProfile();
        const originalDailyWage = original.worker.dailyWage;
        const originalBasicSalary = original.worker.basicSalary;
        const originalAdvances = original.advances.totalOutstandingAdvances;

        // Act
        const sanitized = sanitizeProfileForRole(original, 'FIELD_ADMIN');

        // Assert
        expect(sanitized.worker.dailyWage).toBe(0);

        expect(original.worker.dailyWage).toBe(originalDailyWage);
        expect(original.worker.basicSalary).toBe(originalBasicSalary);
        expect(original.advances.totalOutstandingAdvances).toBe(originalAdvances);
        expect(original.ppeAssets[0]?.costPrice).toBe(1200);
        expect(original.pendingDisciplinaryRecords[0]?.amount).toBe(500);
      });

      it('handles profile with null activeLeave and undefined approvedDisciplinaryRecords gracefully', () => {
        // Arrange
        const minimalProfile = makeRichFinancialProfile({
          activeLeave: null,
          approvedDisciplinaryRecords: undefined,
          stats: undefined,
        });

        // Act
        const sanitized = sanitizeProfileForRole(minimalProfile, 'FIELD_ADMIN');

        // Assert
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

      it('automatically sanitizes profile when role=FIELD_ADMIN is passed to getWorkerClearanceProfile', async () => {
        // Arrange
        const workerId = 'w-rich-77';
        const role = 'FIELD_ADMIN';

        // Act
        const profile = await service.getWorkerClearanceProfile(workerId, role);

        // Assert
        expect(profile.worker.dailyWage).toBe(0);
        expect(profile.advances.totalOutstandingAdvances).toBe(0);
        expect(profile.stats).toBeUndefined();
        expect(profile.worker.nickname).toBe('المنشاوي');
      });

      it('returns raw un-sanitized profile when role=SUPER_ADMIN is passed', async () => {
        // Arrange
        const workerId = 'w-rich-77';
        const role = 'SUPER_ADMIN';

        // Act
        const profile = await service.getWorkerClearanceProfile(workerId, role);

        // Assert
        expect(profile.worker.dailyWage).toBe(350);
        expect(profile.advances.totalOutstandingAdvances).toBe(4500);
        expect(profile.stats?.totalApprovedBonuses).toBe(800);
      });

      it('returns raw un-sanitized profile when no role is passed (backward compatible)', async () => {
        // Arrange
        const workerId = 'w-rich-77';

        // Act
        const profile = await service.getWorkerClearanceProfile(workerId);

        // Assert
        expect(profile.worker.dailyWage).toBe(350);
        expect(profile.advances.totalOutstandingAdvances).toBe(4500);
      });
    });
  });
});
