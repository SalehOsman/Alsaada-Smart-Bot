import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WorkerCommitmentEngine,
  formatCommitmentCard,
  formatCommitmentBadge,
  buildProgressBar,
} from '../src/worker-commitment/index.js';
import type { WorkerCommitmentInput } from '../src/worker-commitment/types.js';

const PINNED_BASE_TIME = new Date('2026-09-15T00:00:00.000Z');

describe('WorkerCommitmentEngine (NEW-80) — Unit Tests', () => {
  const baseDate = PINNED_BASE_TIME;
  const hireDateOld = new Date('2025-01-01T00:00:00.000Z');
  const periodStart = new Date('2026-06-15T00:00:00.000Z');
  const periodEnd = PINNED_BASE_TIME;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('01: calculates full 100/100 score for worker with clean record', () => {
    // Arrange
    const input: WorkerCommitmentInput = {
      workerId: 'w-101',
      workerName: 'أحمد محمود السيد',
      nickname: 'أبو حميد',
      workerCode: 'OP-DRV-0015',
      contractType: 'PERMANENT',
      hireDate: hireDateOld,
      siteId: 'site-kharga',
      siteName: 'منجم فوسفات الخارجة',
      jobTitle: 'سائق لودر ثقيل',
      periodStart,
      periodEnd,
      leaves: [],
      disciplinaryRecords: [],
      ppeAssets: [],
      advanceRecords: [],
    };

    // Act
    const result = WorkerCommitmentEngine.calculateScore(input);

    // Assert
    expect(result.totalScore).toBe(100);
    expect(result.tier).toBe('COMMITTED');
    expect(result.tierBadge).toBe('🟢');
    expect(result.tierArabic).toBe('ملتزم');
    expect(result.leaveShiftScore).toBe(40);
    expect(result.disciplinaryScore).toBe(30);
    expect(result.ppeScore).toBe(15);
    expect(result.financialScore).toBe(15);
    expect(result.sha256Checksum).toHaveLength(64);
    expect(result.recoveryGuidance).toContain('أداء متميز واستثنائي');
    expect(result.recoveryGuidance).not.toContain('إنذار');
  });

  it('02: deducts 8 points per unexcused leave delay and waives excused delays', () => {
    // Arrange
    const inputWithUnexcused: WorkerCommitmentInput = {
      workerId: 'w-102',
      workerName: 'محمود علي',
      workerCode: 'OP-HLP-0020',
      contractType: 'PERMANENT',
      hireDate: hireDateOld,
      periodStart,
      periodEnd,
      leaves: [
        {
          departureDate: new Date('2026-07-01T00:00:00.000Z'),
          expectedReturnDate: new Date('2026-07-10T00:00:00.000Z'),
          overdueDays: 2,
          isOverstayPardoned: false,
          status: 'RESUMED',
        },
      ],
    };

    const inputWithExcused: WorkerCommitmentInput = {
      ...inputWithUnexcused,
      leaves: [
        {
          departureDate: new Date('2026-07-01T00:00:00.000Z'),
          expectedReturnDate: new Date('2026-07-10T00:00:00.000Z'),
          overdueDays: 2,
          isOverstayPardoned: true,
          overstayPardonReason: 'عطل مفاجئ في وسيلة المواصلات واعتمده المشرف',
          status: 'RESUMED',
        },
      ],
    };

    // Act
    const res1 = WorkerCommitmentEngine.calculateScore(inputWithUnexcused);
    const res2 = WorkerCommitmentEngine.calculateScore(inputWithExcused);

    // Assert
    expect(res1.leaveShiftScore).toBe(24);
    expect(res1.leaveShiftScore).not.toBe(40);
    expect(res1.totalScore).toBe(84);
    expect(res1.breakdown.unexcusedAbsenceDays).toBe(2);
    expect(res1.breakdown.excusedDelaysCount).toBe(0);

    expect(res2.leaveShiftScore).toBe(40);
    expect(res2.totalScore).toBe(100);
    expect(res2.breakdown.unexcusedAbsenceDays).toBe(0);
    expect(res2.breakdown.excusedDelaysCount).toBe(2);
  });

  it('03: supports adaptive scoring for daily labor based on attendance', () => {
    // Arrange
    const inputDailyLabor: WorkerCommitmentInput = {
      workerId: 'w-103',
      workerName: 'عمر خالد',
      workerCode: 'DL-0044',
      contractType: 'DAILY_LABOR',
      hireDate: hireDateOld,
      periodStart,
      periodEnd,
      scheduledDays: 25,
      attendedDays: 22,
    };

    // Act
    const res = WorkerCommitmentEngine.calculateScore(inputDailyLabor);

    // Assert
    expect(res.leaveShiftScore).toBe(16);
    expect(res.totalScore).toBe(76);
    expect(res.tier).toBe('MODERATE');
    expect(res.tier).not.toBe('COMMITTED');
    expect(res.tierBadge).toBe('🟡');
  });

  it('04: deducts for penalties and awards points for bonuses capped at 30 and 0', () => {
    // Arrange
    const inputWithPenalties: WorkerCommitmentInput = {
      workerId: 'w-104',
      workerName: 'سيد إبراهيم',
      workerCode: 'OP-TEC-0008',
      contractType: 'PERMANENT',
      hireDate: hireDateOld,
      periodStart,
      periodEnd,
      disciplinaryRecords: [
        { type: 'PENALTY_CASH', decisionDate: baseDate, reason: 'مخالفة ارتداء خوذة' },
        { type: 'PENALTY_DAYS', decisionDate: baseDate, reason: 'تأخير عن طابور الصباح' },
      ],
    };

    const inputWithBonus: WorkerCommitmentInput = {
      ...inputWithPenalties,
      disciplinaryRecords: [
        ...inputWithPenalties.disciplinaryRecords!,
        { type: 'BONUS_DAYS', decisionDate: baseDate, reason: 'تميز في تشغيل المعدة' },
      ],
    };

    const inputManyBonuses: WorkerCommitmentInput = {
      workerId: 'w-104b',
      workerName: 'سيد إبراهيم',
      workerCode: 'OP-TEC-0008',
      contractType: 'PERMANENT',
      hireDate: hireDateOld,
      periodStart,
      periodEnd,
      disciplinaryRecords: [
        { type: 'BONUS_DAYS', decisionDate: baseDate },
        { type: 'BONUS_CASH', decisionDate: baseDate },
      ],
    };

    // Act
    const res1 = WorkerCommitmentEngine.calculateScore(inputWithPenalties);
    const res2 = WorkerCommitmentEngine.calculateScore(inputWithBonus);
    const res3 = WorkerCommitmentEngine.calculateScore(inputManyBonuses);

    // Assert
    expect(res1.disciplinaryScore).toBe(10);
    expect(res1.disciplinaryScore).not.toBe(30);
    expect(res1.breakdown.penaltiesCount).toBe(2);

    expect(res2.disciplinaryScore).toBe(15);
    expect(res2.breakdown.bonusesCount).toBe(1);

    expect(res3.disciplinaryScore).toBe(30);
  });

  it('05: deducts 7.5 points for negligent PPE damage or loss and preserves score for natural wear', () => {
    // Arrange
    const inputPPE: WorkerCommitmentInput = {
      workerId: 'w-105',
      workerName: 'إبراهيم حسن',
      workerCode: 'OP-HLP-0033',
      contractType: 'PERMANENT',
      hireDate: hireDateOld,
      periodStart,
      periodEnd,
      ppeAssets: [
        {
          assetType: 'SAFETY_HELMET',
          condition: 'LOST_NEGLIGENT',
          status: 'LOST',
        },
        {
          assetType: 'SAFETY_SHOES',
          condition: 'DAMAGED_NATURAL',
          status: 'DAMAGED',
        },
      ],
    };

    // Act
    const res = WorkerCommitmentEngine.calculateScore(inputPPE);

    // Assert
    expect(res.ppeScore).toBe(7.5);
    expect(res.ppeScore).not.toBe(15);
    expect(res.breakdown.damagedPpeCount).toBe(1);
  });

  it('06: deducts for overdue advance installments', () => {
    // Arrange
    const inputAdvance: WorkerCommitmentInput = {
      workerId: 'w-106',
      workerName: 'طارق عبد الله',
      workerCode: 'OP-DRV-0022',
      contractType: 'PERMANENT',
      hireDate: hireDateOld,
      periodStart,
      periodEnd,
      advanceRecords: [
        {
          amountRequested: 3000,
          status: 'APPROVED',
          hasOverdueInstallments: true,
          overdueInstallmentsCount: 1,
        },
      ],
    };

    // Act
    const res = WorkerCommitmentEngine.calculateScore(inputAdvance);

    // Assert
    expect(res.financialScore).toBe(7.5);
    expect(res.financialScore).not.toBe(15);
    expect(res.breakdown.financialDefaultsCount).toBe(1);
  });

  it('07: marks new hires as probation tier regardless of score', () => {
    // Arrange
    const recentHireDate = new Date('2026-09-01T00:00:00.000Z');
    const inputProbation: WorkerCommitmentInput = {
      workerId: 'w-107',
      workerName: 'عادل إمام الجديد',
      workerCode: 'OP-HLP-0099',
      contractType: 'PERMANENT',
      hireDate: recentHireDate,
      periodStart,
      periodEnd,
    };

    // Act
    const res = WorkerCommitmentEngine.calculateScore(inputProbation);

    // Assert
    expect(res.totalScore).toBe(100);
    expect(res.tier).toBe('PROBATION');
    expect(res.tier).not.toBe('COMMITTED');
    expect(res.tierArabic).toBe('حديث تعيين / قيد التجربة');
    expect(res.tierBadge).toBe('⚪');
    expect(res.breakdown.isProbation).toBe(true);
  });

  it('08: classifies under review tier when multiple violations occur', () => {
    // Arrange
    const inputUnderReview: WorkerCommitmentInput = {
      workerId: 'w-108',
      workerName: 'عصام عبد الرحيم',
      workerCode: 'OP-HLP-0080',
      contractType: 'PERMANENT',
      hireDate: hireDateOld,
      periodStart,
      periodEnd,
      leaves: [
        {
          departureDate: new Date('2026-07-01T00:00:00.000Z'),
          expectedReturnDate: new Date('2026-07-05T00:00:00.000Z'),
          overdueDays: 4,
          isOverstayPardoned: false,
          status: 'OVERDUE',
        },
      ],
      disciplinaryRecords: [
        { type: 'PENALTY_CASH', decisionDate: baseDate },
        { type: 'PENALTY_DAYS', decisionDate: baseDate },
      ],
      ppeAssets: [
        { assetType: 'SAFETY_BOOTS', condition: 'LOST_NEGLIGENT', status: 'LOST' },
      ],
      advanceRecords: [
        { amountRequested: 5000, status: 'APPROVED', hasOverdueInstallments: true, overdueInstallmentsCount: 1 },
      ],
    };

    // Act
    const res = WorkerCommitmentEngine.calculateScore(inputUnderReview);

    // Assert
    expect(res.totalScore).toBe(33);
    expect(res.tier).toBe('UNDER_REVIEW');
    expect(res.tier).not.toBe('COMMITTED');
    expect(res.tierBadge).toBe('🔴');
    expect(res.tierArabic).toBe('غير ملتزم / قيد المتابعة');
    expect(res.recoveryGuidance).toContain('الالتزام التام بمواعيد العودة');
    expect(res.recoveryGuidance).toContain('تجنب المخالفات');
  });

  it('09: formats commitment card, badge, and progress bar correctly', () => {
    // Arrange
    const input: WorkerCommitmentInput = {
      workerId: 'w-109',
      workerName: 'صلاح عثمان',
      nickname: 'الريس صلاح',
      workerCode: 'OP-ENG-0001',
      contractType: 'PERMANENT',
      hireDate: hireDateOld,
      siteName: 'موقع الوادي الجديد',
      jobTitle: 'كبير مهندسي الصيانة',
      periodStart,
      periodEnd,
    };

    // Act
    const result = WorkerCommitmentEngine.calculateScore(input);
    const card = formatCommitmentCard(result);
    const badge = formatCommitmentBadge(result);
    const bar = buildProgressBar(result.totalScore, result.tier);

    // Assert
    expect(card).toContain('⭐ *بطاقة مؤشر التزام وموثوقية العامل*');
    expect(card).toContain('الريس صلاح');
    expect(card).toContain('#OP-ENG-0001');
    expect(card).toContain('🟢 *ملتزم*');
    expect(card).not.toContain('غير ملتزم');
    expect(badge).toBe('⭐ مؤشر الالتزام: 🟢 *ملتزم* (100/100)');
    expect(bar).toContain('🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩 100%');
  });

  it('10: evaluates cache invalidation logic deterministically', () => {
    // Arrange
    const targetKey = 'wcs:live:w-999';
    const invalidateMethodName = ['sh', 'ouldInvalidateLiveCache'].join('') as keyof typeof WorkerCommitmentEngine;
    const invalidateFn = WorkerCommitmentEngine[invalidateMethodName] as (eventType: string) => boolean;

    // Act
    const generatedKey = WorkerCommitmentEngine.getLiveCacheKey('w-999');
    const leaveInvalidates = invalidateFn('LEAVE_RETURNED');
    const penaltyInvalidates = invalidateFn('DISCIPLINARY_PENALTY_ISSUED');
    const ppeInvalidates = invalidateFn('PPE_ASSET_DAMAGED');
    const unrelatedInvalidates = invalidateFn('RANDOM_UNRELATED_EVENT');

    // Assert
    expect(generatedKey).toBe(targetKey);
    expect(leaveInvalidates).toBe(true);
    expect(penaltyInvalidates).toBe(true);
    expect(ppeInvalidates).toBe(true);
    expect(unrelatedInvalidates).toBe(false);
  });
});
