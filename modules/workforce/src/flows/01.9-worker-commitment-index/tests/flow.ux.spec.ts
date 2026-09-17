import { describe, it, expect } from 'vitest';
import { WorkerCommitmentKeyboards } from '../flow.keyboard.js';
import { WorkerCommitmentMessages } from '../flow.messages.js';

describe('Flow 01.9 UX Tests — Worker Commitment Index', () => {
  it('1. should render main menu keyboard with all 4 required operational actions', () => {
    const kb = WorkerCommitmentKeyboards.mainMenuKeyboard();
    expect(kb.inline_keyboard.length).toBeGreaterThanOrEqual(4);

    const callbacks = kb.inline_keyboard.flat().map((btn) => ('callback_data' in btn ? btn.callback_data : ''));
    expect(callbacks).toContain('action:wcs:query');
    expect(callbacks).toContain('action:wcs:under_review');
    expect(callbacks).toContain('action:wcs:honor_roll');
    expect(callbacks).toContain('action:wcs:export_excel');
  });

  it('2. should render list keyboard with correct pagination buttons', () => {
    const items = [
      {
        workerId: 'w-1',
        workerCode: 'OP-01',
        workerName: 'علي حسن',
        nickname: 'علي',
        contractType: 'PERMANENT',
        totalScore: 45,
        tier: 'UNDER_REVIEW' as const,
        tierBadge: '🔴',
        tierArabic: 'غير ملتزم / قيد المتابعة',
        leaveShiftScore: 10,
        disciplinaryScore: 10,
        ppeScore: 15,
        financialScore: 10,
      },
    ];

    const kbPage1 = WorkerCommitmentKeyboards.commitmentListKeyboard(items, 1, 3, 'under_review');
    const callbacksP1 = kbPage1.inline_keyboard.flat().map((b) => ('callback_data' in b ? b.callback_data : ''));
    expect(callbacksP1).toContain('action:wcs:card:w-1');
    expect(callbacksP1).toContain('action:wcs:under_review:page:2');
    expect(callbacksP1).not.toContain('action:wcs:under_review:page:0');

    const kbPage2 = WorkerCommitmentKeyboards.commitmentListKeyboard(items, 2, 3, 'under_review');
    const callbacksP2 = kbPage2.inline_keyboard.flat().map((b) => ('callback_data' in b ? b.callback_data : ''));
    expect(callbacksP2).toContain('action:wcs:under_review:page:1');
    expect(callbacksP2).toContain('action:wcs:under_review:page:3');
  });

  it('3. should render messages with standard breadcrumbs and statistics', () => {
    const msg = WorkerCommitmentMessages.mainMenu({
      totalEvaluated: 150,
      committedCount: 110,
      moderateCount: 25,
      underReviewCount: 10,
      probationCount: 5,
      averageScore: 84,
    });

    expect(msg).toContain('شؤون العاملين');
    expect(msg).toContain('⭐ مؤشر الالتزام والموثوقية');
    expect(msg).toContain('150');
    expect(msg).toContain('84');
  });

  it('4. should render worker picker keyboard with badge, job icon, nickname prioritization and score', () => {
    const workers = [
      {
        id: 'w-101',
        code: 'OP-DRV-0015',
        name: 'صالح رجب محمد السيد',
        nickname: 'صالح رجب',
        jobTitle: 'سائق لودر ومعدات',
        tierBadge: '🟢',
        tier: 'COMMITTED' as const,
        score: 95,
        hasEvaluation: true,
      },
      {
        id: 'w-102',
        code: 'OP-TEC-0042',
        name: 'أحمد علي حسن',
        nickname: null,
        jobTitle: 'فني ميكانيكا',
        tierBadge: '🟡',
        tier: 'MODERATE' as const,
        score: 72,
        hasEvaluation: true,
      },
      {
        id: 'w-103',
        code: 'OP-LAB-0088',
        name: 'محمود السيد',
        nickname: 'حودة',
        jobTitle: 'عامل عادي',
        tierBadge: '🔴',
        tier: 'UNDER_REVIEW' as const,
        score: 55,
        hasEvaluation: true,
      },
    ];

    const kb = WorkerCommitmentKeyboards.workerPickerKeyboard({
      workers,
      pagination: { page: 1, pageSize: 8, totalItems: 3, totalPages: 1 },
    });

    const flat = kb.inline_keyboard.flat();
    const btn1 = flat.find((b) => 'callback_data' in b && b.callback_data === 'action:wcs:card:w-101');
    const btn2 = flat.find((b) => 'callback_data' in b && b.callback_data === 'action:wcs:card:w-102');
    const btn3 = flat.find((b) => 'callback_data' in b && b.callback_data === 'action:wcs:card:w-103');

    expect(btn1?.text).toBe('🟢 🚜 صالح رجب - 95 نقطة');
    expect(btn2?.text).toBe('🟡 🔧 أحمد علي حسن - 72 نقطة');
    expect(btn3?.text).toBe('🔴 👷 حودة - 55 نقطة');
  });

  it('5. should render probation / un-evaluated worker with white badge and probation label', () => {
    const workers = [
      {
        id: 'w-104',
        code: 'OP-NEW-0001',
        name: 'كمال حسن مصطفى',
        nickname: 'كمال حسن',
        jobTitle: 'مشرف أمن وسلامة',
        tierBadge: '⚪ 🆕',
        tier: 'PROBATION' as const,
        score: undefined,
        hasEvaluation: false,
      },
      {
        id: 'w-105',
        code: 'OP-NEW-0002',
        name: 'سعيد عبد الرحمن',
        nickname: 'سعيد',
        jobTitle: 'سائق لودر',
        tierBadge: '⚪ 🆕',
        tier: 'PROBATION' as const,
        score: 95,
        hasEvaluation: true,
      },
    ];

    const kb = WorkerCommitmentKeyboards.workerPickerKeyboard({
      workers,
      pagination: { page: 1, pageSize: 8, totalItems: 2, totalPages: 1 },
    });

    const flat = kb.inline_keyboard.flat();
    const btn1 = flat.find((b) => 'callback_data' in b && b.callback_data === 'action:wcs:card:w-104');
    const btn2 = flat.find((b) => 'callback_data' in b && b.callback_data === 'action:wcs:card:w-105');
    expect(btn1?.text).toBe('⚪ 🆕 🛡️ كمال حسن - تحت الاختبار');
    expect(btn2?.text).toBe('⚪ 🆕 🚜 سعيد - تحت الاختبار');
  });

  it('6. should render search prompt button when unfiltered, and clear search button when filtered', () => {
    const workers = [
      {
        id: 'w-1',
        code: 'OP-01',
        name: 'علي حسن',
        nickname: 'علي',
        tierBadge: '🟢',
        hasEvaluation: true,
      },
    ];

    const kbUnfiltered = WorkerCommitmentKeyboards.workerPickerKeyboard({
      workers,
      pagination: { page: 1, pageSize: 8, totalItems: 1, totalPages: 1 },
    });
    const flatUnfiltered = kbUnfiltered.inline_keyboard.flat();
    const searchBtn = flatUnfiltered.find((b) => 'callback_data' in b && b.callback_data === 'action:wcs:picker:search_prompt');
    expect(searchBtn).toBeDefined();
    expect(searchBtn?.text).toContain('بحث');

    const kbFiltered = WorkerCommitmentKeyboards.workerPickerKeyboard({
      workers,
      pagination: { page: 1, pageSize: 8, totalItems: 1, totalPages: 1 },
      searchQuery: 'علي',
    });
    const flatFiltered = kbFiltered.inline_keyboard.flat();
    const clearBtn = flatFiltered.find((b) => 'callback_data' in b && b.callback_data === 'action:wcs:picker:clear_search');
    expect(clearBtn).toBeDefined();
    expect(clearBtn?.text).toContain('إلغاء تصفية البحث');
  });

  it('7. should render pagination buttons with action:wcs:picker:page: prefix', () => {
    const workers = [
      {
        id: 'w-1',
        code: 'OP-01',
        name: 'علي حسن',
        nickname: 'علي',
        tierBadge: '🟢',
        hasEvaluation: true,
      },
    ];

    const kb = WorkerCommitmentKeyboards.workerPickerKeyboard({
      workers,
      pagination: { page: 2, pageSize: 8, totalItems: 20, totalPages: 3 },
    });

    const flat = kb.inline_keyboard.flat();
    const prevBtn = flat.find((b) => 'callback_data' in b && b.callback_data === 'action:wcs:picker:page:1');
    const nextBtn = flat.find((b) => 'callback_data' in b && b.callback_data === 'action:wcs:picker:page:3');
    const pageIndicator = flat.find((b) => b.text.includes('2/3'));

    expect(prevBtn).toBeDefined();
    expect(nextBtn).toBeDefined();
    expect(pageIndicator).toBeDefined();
  });
});

