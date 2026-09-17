import { describe, it, expect, vi } from 'vitest';
import { WorkerCommitmentMessages } from '../flow.messages.js';
import { WorkerCommitmentKeyboards } from '../flow.keyboard.js';
import { WorkerCommitmentService } from '../flow.service.js';
import { WorkerCommitmentHandler } from '../flow.handler.js';
import type { WorkerCommitmentRepository } from '../flow.repository.js';
import type { CommitmentScoreListItem, CommitmentStatsSummary } from '../flow.types.js';

describe('Flow 01.9 Unit Tests — Worker Commitment Index & Telemetry', () => {
  it('1. should render main menu message with summary metrics', () => {
    const stats: CommitmentStatsSummary = {
      totalEvaluated: 50,
      committedCount: 35,
      moderateCount: 10,
      underReviewCount: 3,
      probationCount: 2,
      averageScore: 84,
    };

    const msg = WorkerCommitmentMessages.mainMenu(stats, 'موقع الخارجة');
    expect(msg).toContain('موقع الخارجة');
    expect(msg).toContain('إجمالي العمالة المقيمة: *50 عامل*');
    expect(msg).toContain('متوسط الالتزام العام: *84 / 100*');
    expect(msg).toContain('ملتزمون (80-100): *35 عامل*');
    expect(msg).toContain('قيد المتابعة (<60): *3 عامل*');
  });

  it('2. should build main menu keyboard with 4 required action buttons', () => {
    const kb = WorkerCommitmentKeyboards.mainMenuKeyboard();
    const flat = kb.inline_keyboard.flat();

    const callbacks = flat.map((b) => ('callback_data' in b ? b.callback_data : ''));
    expect(callbacks).toContain('action:wcs:query');
    expect(callbacks).toContain('action:wcs:under_review');
    expect(callbacks).toContain('action:wcs:honor_roll');
    expect(callbacks).toContain('action:wcs:export_excel');
    expect(callbacks).toContain('menu:hr_sub:onboarding');
    expect(callbacks).toContain('action:main_menu');
  });

  it('3. should build paginated list keyboard for under review and honor roll', () => {
    const items: CommitmentScoreListItem[] = [
      {
        workerId: 'w-1',
        workerCode: 'OP-01',
        workerName: 'علي حسن',
        nickname: 'أبو علي',
        contractType: 'PERMANENT',
        totalScore: 50,
        tier: 'UNDER_REVIEW',
        tierBadge: '🔴',
        tierArabic: 'غير ملتزم',
        leaveShiftScore: 16,
        disciplinaryScore: 20,
        ppeScore: 7,
        financialScore: 7,
      },
    ];

    const kb = WorkerCommitmentKeyboards.commitmentListKeyboard(items, 1, 2, 'under_review');
    const flat = kb.inline_keyboard.flat();

    const workerBtn = flat.find((b) => 'callback_data' in b && b.callback_data === 'action:wcs:card:w-1');
    expect(workerBtn).toBeDefined();
    expect(workerBtn?.text).toContain('أبو علي');
    expect(workerBtn?.text).toContain('50 نقطة');

    const nextBtn = flat.find((b) => 'callback_data' in b && b.callback_data === 'action:wcs:under_review:page:2');
    expect(nextBtn).toBeDefined();
  });

  it('4. should service evaluate worker and return score', async () => {
    const mockRepo = {
      findWorkerByIdOrCode: vi.fn().mockResolvedValue({ id: 'w-99', code: 'OP-0099', name: 'سالم' }),
      getWorkerEvaluationData: vi.fn().mockResolvedValue({
        workerId: 'w-99',
        workerName: 'سالم أحمد',
        nickname: 'سالم',
        workerCode: 'OP-0099',
        contractType: 'PERMANENT',
        hireDate: new Date('2024-01-01'),
        periodStart: new Date('2026-06-01'),
        periodEnd: new Date('2026-09-01'),
        leaves: [],
        disciplinaryRecords: [],
        ppeAssets: [],
        advanceRecords: [],
      }),
      saveCommitmentScore: vi.fn().mockResolvedValue({}),
      getAllWorkersForEvaluation: vi.fn().mockResolvedValue([]),
    } as unknown as WorkerCommitmentRepository;

    const service = new WorkerCommitmentService(mockRepo);
    const res = await service.evaluateWorker('OP-0099');

    expect(res).not.toBeNull();
    expect(res?.totalScore).toBe(100);
    expect(res?.tier).toBe('COMMITTED');
    expect(mockRepo.saveCommitmentScore).toHaveBeenCalled();
  });

  it('5. should export RTL Excel sheet buffer with valid headers', async () => {
    const mockRepo = {
      getAllWorkersForEvaluation: vi.fn().mockResolvedValue([
        {
          workerId: 'w-1',
          workerName: 'إبراهيم علي',
          nickname: 'هيما',
          workerCode: 'OP-DRV-0001',
          contractType: 'PERMANENT',
          hireDate: new Date('2024-01-01'),
          periodStart: new Date('2026-06-01'),
          periodEnd: new Date('2026-09-01'),
          leaves: [],
          disciplinaryRecords: [],
          ppeAssets: [],
          advanceRecords: [],
        },
      ]),
    } as unknown as WorkerCommitmentRepository;

    const service = new WorkerCommitmentService(mockRepo);
    const buffer = await service.exportCommitmentExcel('site-1', 'موقع الفوسفات');

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('6. should getWorkersPickerPage correctly map badges, scores and singleMatch on search', async () => {
    const mockWorkers = [
      {
        id: 'w-1',
        code: 'OP-DRV-001',
        legacyCode: '101',
        aliases: ['OP-HLP-0015'],
        name: 'صالح رجب محمد',
        nickname: 'صالح رجب',
        jobTitle: 'سائق لودر',
        siteId: 'site-1',
        site: { id: 'site-1', name: 'موقع السويس' },
        commitmentScores: [{ totalScore: 92, tier: 'COMMITTED' }],
      },
      {
        id: 'w-2',
        code: 'OP-DRV-002',
        name: 'أحمد محمود',
        nickname: 'أحمد رجب',
        jobTitle: 'سائق تريلا',
        siteId: 'site-1',
        site: { id: 'site-1', name: 'موقع السويس' },
        commitmentScores: [{ totalScore: 75, tier: 'MODERATE' }],
      },
      {
        id: 'w-3',
        code: 'OP-LAB-003',
        name: 'محمود كمال',
        nickname: null,
        jobTitle: 'عامل عادي',
        siteId: 'site-2',
        site: { id: 'site-2', name: 'موقع العين السخنة' },
        commitmentScores: [],
      },
    ];

    const mockRepo = {
      getWorkersForPicker: vi.fn().mockResolvedValue(mockWorkers),
    } as unknown as WorkerCommitmentRepository;

    const service = new WorkerCommitmentService(mockRepo);

    // 1. Unfiltered page
    const page1 = await service.getWorkersPickerPage({ page: 1, pageSize: 8, siteId: 'site-1' });
    expect(page1.items).toHaveLength(3);
    expect(page1.items[0]?.tierBadge).toBe('🟢');
    expect(page1.items[0]?.score).toBe(92);
    expect(page1.items[1]?.tierBadge).toBe('🟡');
    expect(page1.items[2]?.tierBadge).toBe('⚪ 🆕');
    expect(page1.items[2]?.score).toBeUndefined();
    expect(page1.siteName).toBe('موقع السويس');

    // 2. Search matching 1 worker by nickname -> singleMatch
    const searchSingle = await service.getWorkersPickerPage({ search: 'صالح' });
    expect(searchSingle.rawMatchingCount).toBe(1);
    expect(searchSingle.singleMatch).not.toBeNull();
    expect(searchSingle.singleMatch?.id).toBe('w-1');

    // 3. Search matching 1 worker by historical alias
    const searchAlias = await service.getWorkersPickerPage({ search: 'OP-HLP-0015' });
    expect(searchAlias.rawMatchingCount).toBe(1);
    expect(searchAlias.singleMatch?.id).toBe('w-1');

    // 4. Search matching multiple workers -> singleMatch is null
    const searchMulti = await service.getWorkersPickerPage({ search: 'رجب' });
    expect(searchMulti.rawMatchingCount).toBe(2);
    expect(searchMulti.singleMatch).toBeNull();
  });

  it('7. should handleTextInput route directly to worker card on single match', async () => {
    const mockRepo = {
      getWorkersForPicker: vi.fn().mockResolvedValue([
        {
          id: 'w-single',
          code: 'OP-DRV-0099',
          name: 'صالح رجب',
          nickname: 'صالح رجب',
          jobTitle: 'سائق لودر',
          siteId: 'site-1',
          site: { id: 'site-1', name: 'موقع السويس' },
          commitmentScores: [{ totalScore: 95, tier: 'COMMITTED' }],
        },
      ]),
      findWorkerByIdOrCode: vi.fn().mockResolvedValue({ id: 'w-single', code: 'OP-DRV-0099', name: 'صالح رجب' }),
      getWorkerEvaluationData: vi.fn().mockResolvedValue({
        workerId: 'w-single',
        workerName: 'صالح رجب',
        nickname: 'صالح رجب',
        workerCode: 'OP-DRV-0099',
        contractType: 'PERMANENT',
        hireDate: new Date('2024-01-01'),
        periodStart: new Date('2026-06-01'),
        periodEnd: new Date('2026-09-01'),
        leaves: [],
        disciplinaryRecords: [],
        ppeAssets: [],
        advanceRecords: [],
      }),
      saveCommitmentScore: vi.fn().mockResolvedValue({}),
    } as unknown as WorkerCommitmentRepository;

    const service = new WorkerCommitmentService(mockRepo);
    const handler = new WorkerCommitmentHandler(service);

    const replySpy = vi.fn();
    const fakeCtx = {
      from: { id: 12345 },
      assignedSiteId: 'site-1',
      effectiveRole: 'FIELD_ADMIN',
      reply: replySpy,
      callbackQuery: null,
    } as unknown as Parameters<typeof handler.handleTextInput>[0];

    // Trigger search prompt so user is in activeQueries
    await handler.handleSearchPrompt(fakeCtx);

    const handled = await handler.handleTextInput(fakeCtx, 'صالح');
    expect(handled).toBe(true);
    expect(replySpy).toHaveBeenCalled();
    const lastCall = replySpy.mock.calls[replySpy.mock.calls.length - 1];
    expect(lastCall).toBeDefined();
    expect(lastCall?.[0]).toContain('صالح رجب');
  });

  it('8. should handleTextInput show filtered picker on multiple matches and warning on 0 matches', async () => {
    const mockRepo = {
      getWorkersForPicker: vi.fn().mockResolvedValue([
        {
          id: 'w-1',
          code: 'OP-DRV-001',
          name: 'علي حسن أحمد',
          nickname: 'علي حسن',
          jobTitle: 'سائق لودر',
          siteId: 'site-1',
          commitmentScores: [{ totalScore: 85, tier: 'COMMITTED' }],
        },
        {
          id: 'w-2',
          code: 'OP-DRV-002',
          name: 'علي مصطفى',
          nickname: 'علي الصغير',
          jobTitle: 'عامل تشغيل',
          siteId: 'site-1',
          commitmentScores: [{ totalScore: 70, tier: 'MODERATE' }],
        },
      ]),
    } as unknown as WorkerCommitmentRepository;

    const service = new WorkerCommitmentService(mockRepo);
    const handler = new WorkerCommitmentHandler(service);

    // Multiple matches case
    const replyMultiSpy = vi.fn();
    const ctxMulti = {
      from: { id: 777 },
      assignedSiteId: 'site-1',
      reply: replyMultiSpy,
    } as unknown as Parameters<typeof handler.handleTextInput>[0];

    await handler.handleSearchPrompt(ctxMulti);
    const handledMulti = await handler.handleTextInput(ctxMulti, 'علي');
    expect(handledMulti).toBe(true);
    expect(replyMultiSpy).toHaveBeenCalledTimes(2);
    const multiMsg = replyMultiSpy.mock.calls[1]?.[0];
    expect(multiMsg).toContain('قائمة اختيار العاملين');
    expect(multiMsg).toContain('علي');

    // Zero matches case
    const replyZeroSpy = vi.fn();
    const ctxZero = {
      from: { id: 888 },
      assignedSiteId: 'site-1',
      reply: replyZeroSpy,
    } as unknown as Parameters<typeof handler.handleTextInput>[0];

    await handler.handleSearchPrompt(ctxZero);
    const handledZero = await handler.handleTextInput(ctxZero, 'غير موجود');
    expect(handledZero).toBe(true);
    expect(replyZeroSpy).toHaveBeenCalledTimes(2);
    const zeroMsg = replyZeroSpy.mock.calls[1]?.[0];
    expect(zeroMsg).toContain('تعذر العثور على أي عامل مطابق للبحث');
    const zeroOpts = replyZeroSpy.mock.calls[1]?.[1];
    const retryButtons = zeroOpts?.reply_markup?.inline_keyboard?.flat().map((b: { callback_data?: string }) => b.callback_data);
    expect(retryButtons).toContain('action:wcs:picker:search_prompt');
    expect(retryButtons).toContain('action:wcs:query');
  });

  it('9. should clear activeQueries when user navigates to main menu', async () => {
    const mockRepo = {
      getAllWorkersForEvaluation: vi.fn().mockResolvedValue([]),
    } as unknown as WorkerCommitmentRepository;
    const service = new WorkerCommitmentService(mockRepo);
    const handler = new WorkerCommitmentHandler(service);

    const ctx = {
      from: { id: 9999 },
      reply: vi.fn(),
    } as unknown as Parameters<typeof handler.handleTextInput>[0];

    // User prompts search
    await handler.handleSearchPrompt(ctx);

    // User cancels by going to main menu
    await handler.handleMainMenu(ctx);

    // Next random text should NOT be intercepted by the commitment search handler
    const handled = await handler.handleTextInput(ctx, 'رسالة نصية عادية');
    expect(handled).toBe(false);
  });
});

