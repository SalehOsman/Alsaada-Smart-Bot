import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getWorkforceEvaluations } from '../src/lib/data-fetchers';
import type { DashboardUser } from '../src/lib/rbac';
import { prisma } from '@alsaada/database';
import { PINNED_BASE_TIME } from '@alsaada/shared/testing';

vi.mock('@alsaada/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@alsaada/database')>();
  return {
    ...actual,
    prisma: {
      worker: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      site: {
        findMany: vi.fn(),
      },
    },
  };
});

describe('Admin Dashboard — Workforce Evaluations & Commitment Score (NEW-80)', () => {
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(prisma.worker.findMany).mockResolvedValue(mockWorkers as unknown as Awaited<ReturnType<typeof prisma.worker.findMany>>);
    vi.mocked(prisma.site.findMany).mockResolvedValue(mockSites as unknown as Awaited<ReturnType<typeof prisma.site.findMany>>);
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
    vi.useRealTimers();
  });

  const superAdminUser: DashboardUser = {
    id: 'usr-admin-1',
    telegramId: '123456789',
    role: 'SUPER_ADMIN',
    name: 'المدير العام',
    assignedSiteId: null,
  };

  const fieldAdminUser: DashboardUser = {
    id: 'usr-field-1',
    telegramId: '987654321',
    role: 'FIELD_ADMIN',
    name: 'مشرف موقع الخارجة',
    assignedSiteId: 'site-kharga',
  };

  const mockWorkers = [
    {
      id: 'w-1',
      code: 'OP-DRV-0001',
      name: 'أحمد محمود',
      nickname: 'أبو حميد',
      jobTitle: 'سائق لودر',
      siteId: 'site-kharga',
      contractType: 'PERMANENT',
      hireDate: new Date('2024-01-01'),
      status: 'ACTIVE',
      site: { id: 'site-kharga', name: 'منجم الخارجة' },
      leaves: [],
      disciplinaryAndBonuses: [],
      ppeAssets: [],
      advanceRequests: [],
    },
    {
      id: 'w-2',
      code: 'OP-HLP-0002',
      name: 'خالد عبد الله',
      nickname: 'خالد',
      jobTitle: 'مساعد فني',
      siteId: 'site-aswan',
      contractType: 'PERMANENT',
      hireDate: new Date('2024-01-01'),
      status: 'ACTIVE',
      site: { id: 'site-aswan', name: 'موقع أسوان' },
      leaves: [
        {
          departureDate: new Date('2026-07-01'),
          expectedReturnDate: new Date('2026-07-05'),
          actualReturnDate: null,
          overdueDays: 4, // 4 * 8 = 32 pts deduction -> leaveScore = 8
          isOverstayPardoned: false,
          status: 'OVERDUE',
        },
      ],
      disciplinaryAndBonuses: [
        { type: 'PENALTY_DAYS', decisionDate: new Date(), reason: 'غياب' },
        { type: 'PENALTY_CASH', decisionDate: new Date(), reason: 'مخالفة' }, // 2 * 10 = 20 pts deduction -> discScore = 10
      ],
      ppeAssets: [
        { assetType: 'SAFETY_HELMET', condition: 'LOST_NEGLIGENT', status: 'LOST' }, // -7.5
      ],
      advanceRequests: [
        { amountRequested: 2000, status: 'APPROVED', hasOverdueInstallments: true, overdueInstallmentsCount: 1 }, // -7.5
      ],
    },
  ];

  const mockSites = [
    { id: 'site-kharga', name: 'منجم الخارجة' },
    { id: 'site-aswan', name: 'موقع أسوان' },
  ];

  it('1. fetches workforce evaluations and computes statistics for SUPER_ADMIN', async () => {
    // Arrange
    // Default mocks configured in beforeEach

    // Act
    const data = await getWorkforceEvaluations(superAdminUser);

    // Assert
    expect(data.evaluations).toHaveLength(2);
    expect(data.stats.totalEvaluated).toBe(2);
    expect(data.sites).toHaveLength(2);

    // Worker 1: 100% committed
    const w1 = data.evaluations.find((e) => e.workerId === 'w-1');
    expect(w1?.totalScore).toBe(100);
    expect(w1?.tier).toBe('COMMITTED');
    expect(w1?.tierBadge).toBe('🟢');

    // Worker 2: Multiple infractions -> Under Review (< 60)
    const w2 = data.evaluations.find((e) => e.workerId === 'w-2');
    expect(w2?.totalScore).toBe(33); // 8 + 10 + 7.5 + 7.5
    expect(w2?.tier).toBe('UNDER_REVIEW');
    expect(w2?.tierBadge).toBe('🔴');

    expect(data.stats.committedCount).toBe(1);
    expect(data.stats.underReviewCount).toBe(1);
    expect(data.stats.averageScore).toBe(67);
    expect(data.stats.probationCount).toBe(0);
  });

  it('2. enforces site scoping for FIELD_ADMIN by assignedSiteId', async () => {
    // Arrange & Act
    await getWorkforceEvaluations(fieldAdminUser);

    // Assert
    expect(prisma.worker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          siteId: 'site-kharga',
        }),
      })
    );
    expect(prisma.worker.findMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          siteId: 'site-aswan',
        }),
      })
    );
  });

  it('3. filters by siteId when filterSiteId is passed', async () => {
    // Arrange & Act
    await getWorkforceEvaluations(superAdminUser, 'site-aswan');

    // Assert
    expect(prisma.worker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          siteId: 'site-aswan',
        }),
      })
    );
    expect(prisma.worker.findMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          siteId: 'site-kharga',
        }),
      })
    );
  });

  it('4. gracefully returns empty structure on database error without polluting console', async () => {
    // Arrange
    vi.mocked(prisma.worker.findMany).mockRejectedValueOnce(new Error('DB connection failed'));

    // Act
    const data = await getWorkforceEvaluations(superAdminUser);

    // Assert
    expect(data.evaluations).toHaveLength(0);
    expect(data.stats.totalEvaluated).toBe(0);
    expect(data.stats.committedCount).toBe(0);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error fetching workforce evaluations:',
      expect.any(Error)
    );
  });

  describe('Workforce Evaluations Dark Mode & Responsive Layout Parity', () => {
    const readComponent = (relPath: string): string => {
      const fs = require('node:fs');
      const path = require('node:path');
      return fs.readFileSync(path.resolve(__dirname, '..', relPath), 'utf-8');
    };

    it('5. evaluations-client.tsx supports dark mode across containers, filters, tables, and badges', () => {
      // Arrange
      const src = readComponent('src/app/admin/workforce/evaluations/evaluations-client.tsx');

      // Act & Assert
      // Containers & Borders
      expect(src).toContain('dark:border-slate-800');
      expect(src).toContain('dark:bg-slate-900');
      expect(src).toContain('dark:bg-slate-950');

      // Text colors
      expect(src).toContain('dark:text-slate-100');
      expect(src).toContain('dark:text-slate-300');
      expect(src).toContain('dark:text-slate-400');

      // Badges
      expect(src).toContain('dark:bg-emerald-950/50');
      expect(src).toContain('dark:bg-amber-950/50');
      expect(src).toContain('dark:bg-rose-950/50');

      // Table & hover
      expect(src).toContain('dark:bg-slate-800/80');
      expect(src).toContain('dark:divide-slate-800');
      expect(src).toContain('dark:hover:bg-slate-800/50');

      // Responsive dual views
      expect(src).toContain('block md:hidden');
      expect(src).toContain('hidden md:block');
      expect(src).toContain('overflow-x-auto');
      expect(src).toContain('min-w-[800px]');
      expect(src).not.toContain('table-layout: fixed; width: 100%');
    });

    it('6. evaluation-kpi-cards.tsx adapts to dashboard dark mode with appropriate contrasts', () => {
      // Arrange
      const src = readComponent('src/app/admin/workforce/evaluations/evaluation-kpi-cards.tsx');

      // Act & Assert
      expect(src).toContain('dark:bg-slate-900');
      expect(src).toContain('dark:border-slate-800');
      expect(src).toContain('dark:text-slate-100');
      expect(src).toContain('dark:text-slate-400');
      expect(src).toContain('dark:text-emerald-400');
      expect(src).toContain('dark:text-amber-400');
      expect(src).toContain('dark:text-rose-400');
      expect(src).toContain('dark:text-indigo-400');
      expect(src).not.toContain('text-black');
    });

    it('7. evaluation-details-modal.tsx honors dark mode for modal surface, sub-scores, and guidance', () => {
      // Arrange
      const src = readComponent('src/app/admin/workforce/evaluations/evaluation-details-modal.tsx');

      // Act & Assert
      // Modal surface & backdrop
      expect(src).toContain('dark:bg-black/70');
      expect(src).toContain('dark:bg-slate-900');
      expect(src).toContain('dark:border-slate-800');

      // Sub-scores cards
      expect(src).toContain('dark:bg-blue-950/30');
      expect(src).toContain('dark:bg-purple-950/30');
      expect(src).toContain('dark:bg-amber-950/30');
      expect(src).toContain('dark:bg-emerald-950/30');

      // Guidance & buttons
      expect(src).toContain('dark:text-amber-300');
      expect(src).toContain('dark:bg-slate-800');
      expect(src).toContain('dark:text-slate-200');
      expect(src).not.toContain('background-color: white !important');
    });

    it('8. integrates with useDashboardPreferences and enforces numeral/date parity', () => {
      // Arrange
      const clientSrc = readComponent('src/app/admin/workforce/evaluations/evaluations-client.tsx');
      const kpiSrc = readComponent('src/app/admin/workforce/evaluations/evaluation-kpi-cards.tsx');
      const modalSrc = readComponent('src/app/admin/workforce/evaluations/evaluation-details-modal.tsx');

      // Act & Assert
      // Hook imports
      expect(clientSrc).toContain("from '@/components/providers/dashboard-preferences-provider'");
      expect(kpiSrc).toContain("from '@/components/providers/dashboard-preferences-provider'");
      expect(modalSrc).toContain("from '@/components/providers/dashboard-preferences-provider'");

      // formatNumber parity
      expect(clientSrc).toContain('formatNumber(item.totalScore)');
      expect(clientSrc).toContain('formatNumber(item.leaveShiftScore)');
      expect(kpiSrc).toContain('formatNumber(stats.totalEvaluated)');
      expect(kpiSrc).toContain('formatNumber(stats.committedCount)');
      expect(modalSrc).toContain('formatNumber(worker.leaveShiftScore)');
      expect(modalSrc).toContain('formatNumber(worker.disciplinaryScore)');

      // formatDate in excel export
      expect(clientSrc).toContain('formatDate(new Date())');

      // ZeroState reset callback
      expect(clientSrc).toContain('onResetFilter');
      expect(clientSrc).not.toContain('Number(item.totalScore).toLocaleString()');
    });

    it('9. ensures modal accessibility and dropdown options dark mode compliance', () => {
      // Arrange
      const clientSrc = readComponent('src/app/admin/workforce/evaluations/evaluations-client.tsx');
      const modalSrc = readComponent('src/app/admin/workforce/evaluations/evaluation-details-modal.tsx');

      // Act & Assert
      // Select option dark mode tokens
      expect(clientSrc).toContain('dark:bg-slate-900 text-slate-900 dark:text-slate-100');

      // Modal accessibility: Escape key & backdrop click stopPropagation
      expect(modalSrc).toContain("e.key === 'Escape'");
      expect(modalSrc).toContain('e.stopPropagation()');
      expect(modalSrc).toContain('role="dialog"');
      expect(modalSrc).toContain('aria-modal="true"');
      expect(modalSrc).not.toContain('aria-hidden="true"');
    });
  });
});
