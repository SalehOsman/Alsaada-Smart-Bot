import { describe, it, expect } from 'vitest';
import {
  WorkerCommitmentEngine,
  formatCommitmentCard,
  formatCommitmentBadge,
  buildProgressBar,
} from '../src/worker-commitment/index.js';
import type { WorkerCommitmentInput } from '../src/worker-commitment/types.js';

describe('WorkerCommitmentEngine (NEW-80) — Unit Tests', () => {
  const baseDate = new Date('2026-09-15T00:00:00Z');
  const hireDateOld = new Date('2025-01-01T00:00:00Z'); // experienced worker (> 30 days)
  const periodStart = new Date('2026-06-15T00:00:00Z');
  const periodEnd = new Date('2026-09-15T00:00:00Z');

  it('1. should calculate full 100/100 score for worker with clean record', () => {
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

    const result = WorkerCommitmentEngine.calculateScore(input);

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
  });

  it('2. should deduct 8 points per unexcused leave delay, but waive excused delays', () => {
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
          departureDate: new Date('2026-07-01'),
          expectedReturnDate: new Date('2026-07-10'),
          overdueDays: 2,
          isOverstayPardoned: false,
          status: 'RESUMED',
        },
      ],
    };

    const res1 = WorkerCommitmentEngine.calculateScore(inputWithUnexcused);
    // 2 days unexcused delay * 8 = 16 pts deducted -> 40 - 16 = 24
    expect(res1.leaveShiftScore).toBe(24);
    expect(res1.totalScore).toBe(84); // 24 + 30 + 15 + 15
    expect(res1.breakdown.unexcusedAbsenceDays).toBe(2);
    expect(res1.breakdown.excusedDelaysCount).toBe(0);

    // Now test with excused / pardoned delay
    const inputWithExcused: WorkerCommitmentInput = {
      ...inputWithUnexcused,
      leaves: [
        {
          departureDate: new Date('2026-07-01'),
          expectedReturnDate: new Date('2026-07-10'),
          overdueDays: 2,
          isOverstayPardoned: true,
          overstayPardonReason: 'عطل مفاجئ في وسيلة المواصلات واعتمده المشرف',
          status: 'RESUMED',
        },
      ],
    };

    const res2 = WorkerCommitmentEngine.calculateScore(inputWithExcused);
    // Overstay pardoned -> 0 deduction!
    expect(res2.leaveShiftScore).toBe(40);
    expect(res2.totalScore).toBe(100);
    expect(res2.breakdown.unexcusedAbsenceDays).toBe(0);
    expect(res2.breakdown.excusedDelaysCount).toBe(2);
  });

  it('3. should support adaptive scoring for daily labor based on attendance', () => {
    const inputDailyLabor: WorkerCommitmentInput = {
      workerId: 'w-103',
      workerName: 'عمر خالد',
      workerCode: 'DL-0044',
      contractType: 'DAILY_LABOR',
      hireDate: hireDateOld,
      periodStart,
      periodEnd,
      scheduledDays: 25,
      attendedDays: 22, // 3 missing days unannounced
    };

    const res = WorkerCommitmentEngine.calculateScore(inputDailyLabor);
    // 3 missing days * 8 = 24 points deducted -> 40 - 24 = 16
    expect(res.leaveShiftScore).toBe(16);
    expect(res.totalScore).toBe(76);
    expect(res.tier).toBe('MODERATE');
    expect(res.tierBadge).toBe('🟡');
  });

  it('4. should deduct for penalties and award points for bonuses capped at 30 and 0', () => {
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

    const res1 = WorkerCommitmentEngine.calculateScore(inputWithPenalties);
    // 2 penalties * 10 = 20 pts deducted -> 30 - 20 = 10
    expect(res1.disciplinaryScore).toBe(10);
    expect(res1.breakdown.penaltiesCount).toBe(2);

    // With 1 bonus added (+5 pts)
    const inputWithBonus: WorkerCommitmentInput = {
      ...inputWithPenalties,
      disciplinaryRecords: [
        ...inputWithPenalties.disciplinaryRecords!,
        { type: 'BONUS_DAYS', decisionDate: baseDate, reason: 'تميز في تشغيل المعدة' },
      ],
    };

    const res2 = WorkerCommitmentEngine.calculateScore(inputWithBonus);
    // 30 - 20 + 5 = 15
    expect(res2.disciplinaryScore).toBe(15);
    expect(res2.breakdown.bonusesCount).toBe(1);

    // Capped at 30 even with multiple bonuses and 0 penalties
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
    const res3 = WorkerCommitmentEngine.calculateScore(inputManyBonuses);
    expect(res3.disciplinaryScore).toBe(30);
  });

  it('5. should deduct 7.5 points for negligent PPE damage/loss, but not for natural damage', () => {
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
          condition: 'LOST_NEGLIGENT', // negligent -> -7.5
          status: 'LOST',
        },
        {
          assetType: 'SAFETY_SHOES',
          condition: 'DAMAGED_NATURAL', // natural wear -> 0 deduction!
          status: 'DAMAGED',
        },
      ],
    };

    const res = WorkerCommitmentEngine.calculateScore(inputPPE);
    expect(res.ppeScore).toBe(7.5); // 15 - 7.5
    expect(res.breakdown.damagedPpeCount).toBe(1);
  });

  it('6. should deduct for overdue advance installments', () => {
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
          overdueInstallmentsCount: 1, // -7.5 pts
        },
      ],
    };

    const res = WorkerCommitmentEngine.calculateScore(inputAdvance);
    expect(res.financialScore).toBe(7.5); // 15 - 7.5
    expect(res.breakdown.financialDefaultsCount).toBe(1);
  });

  it('7. should mark new hires (< 30 days) as PROBATION (⚪) regardless of score', () => {
    const recentHireDate = new Date('2026-09-01T00:00:00Z'); // 14 days before periodEnd (2026-09-15)
    const inputProbation: WorkerCommitmentInput = {
      workerId: 'w-107',
      workerName: 'عادل إمام الجديد',
      workerCode: 'OP-HLP-0099',
      contractType: 'PERMANENT',
      hireDate: recentHireDate,
      periodStart,
      periodEnd,
    };

    const res = WorkerCommitmentEngine.calculateScore(inputProbation);
    expect(res.totalScore).toBe(100);
    expect(res.tier).toBe('PROBATION');
    expect(res.tierArabic).toBe('حديث تعيين / قيد التجربة');
    expect(res.tierBadge).toBe('⚪');
    expect(res.breakdown.isProbation).toBe(true);
  });

  it('8. should classify under review (<60) when multiple violations occur', () => {
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
          departureDate: new Date('2026-07-01'),
          expectedReturnDate: new Date('2026-07-05'),
          overdueDays: 4, // 4 * 8 = 32 deduction -> leaveScore = 8
          isOverstayPardoned: false,
          status: 'OVERDUE',
        },
      ],
      disciplinaryRecords: [
        { type: 'PENALTY_CASH', decisionDate: baseDate },
        { type: 'PENALTY_DAYS', decisionDate: baseDate }, // 2 * 10 = 20 deduction -> discScore = 10
      ],
      ppeAssets: [
        { assetType: 'SAFETY_BOOTS', condition: 'LOST_NEGLIGENT', status: 'LOST' }, // -7.5 -> ppeScore = 7.5
      ],
      advanceRecords: [
        { amountRequested: 5000, status: 'APPROVED', hasOverdueInstallments: true, overdueInstallmentsCount: 1 }, // -7.5 -> finScore = 7.5
      ],
    };

    const res = WorkerCommitmentEngine.calculateScore(inputUnderReview);
    // leave: 8, disc: 10, ppe: 7.5, fin: 7.5 -> total = 33
    expect(res.totalScore).toBe(33);
    expect(res.tier).toBe('UNDER_REVIEW');
    expect(res.tierBadge).toBe('🔴');
    expect(res.tierArabic).toBe('غير ملتزم / قيد المتابعة');
    expect(res.recoveryGuidance).toContain('الالتزام التام بمواعيد العودة');
    expect(res.recoveryGuidance).toContain('تجنب المخالفات');
  });

  it('9. should correctly format card, badge, and progress bar', () => {
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

    const result = WorkerCommitmentEngine.calculateScore(input);
    const card = formatCommitmentCard(result);
    const badge = formatCommitmentBadge(result);
    const bar = buildProgressBar(result.totalScore, result.tier);

    expect(card).toContain('⭐ *بطاقة مؤشر التزام وموثوقية العامل*');
    expect(card).toContain('الريس صلاح');
    expect(card).toContain('#OP-ENG-0001');
    expect(card).toContain('🟢 *ملتزم*');
    expect(badge).toBe('⭐ مؤشر الالتزام: 🟢 *ملتزم* (100/100)');
    expect(bar).toContain('🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩 100%');
  });

  it('10. should handle cache invalidation logic correctly', () => {
    expect(WorkerCommitmentEngine.getLiveCacheKey('w-999')).toBe('wcs:live:w999'.replace('w999', 'w-999'));
    expect(WorkerCommitmentEngine.shouldInvalidateLiveCache('LEAVE_RETURNED')).toBe(true);
    expect(WorkerCommitmentEngine.shouldInvalidateLiveCache('DISCIPLINARY_PENALTY_ISSUED')).toBe(true);
    expect(WorkerCommitmentEngine.shouldInvalidateLiveCache('PPE_ASSET_DAMAGED')).toBe(true);
    expect(WorkerCommitmentEngine.shouldInvalidateLiveCache('RANDOM_UNRELATED_EVENT')).toBe(false);
  });
});
