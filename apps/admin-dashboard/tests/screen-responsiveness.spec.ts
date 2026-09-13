import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ZeroStateCard } from '../src/components/ui/zero-state-card';

describe('Screen Refactoring & Responsiveness Parity (Milestone 4)', () => {
  const readScreenSource = (relativePath: string): string => {
    const fullPath = path.resolve(__dirname, '..', relativePath);
    return fs.readFileSync(fullPath, 'utf-8');
  };

  describe('ZeroStateCard Component Contract', () => {
    it('ZeroStateCard is exported and callable', () => {
      expect(ZeroStateCard).toBeDefined();
      expect(typeof ZeroStateCard).toBe('function');
    });
  });

  describe('Screen 1: Workforce Directory (directory-client.tsx)', () => {
    const src = readScreenSource('src/app/admin/workforce/directory/directory-client.tsx');

    it('wraps table in overflow-x-auto container with min-w-[800px]', () => {
      expect(src).toContain('overflow-x-auto');
      expect(src).toContain('min-w-[800px]');
    });

    it('renders ZeroStateCard on empty state', () => {
      expect(src).toContain('ZeroStateCard');
      expect(src).toContain('filteredWorkers.length === 0');
      expect(src).toContain('لا توجد سجلات عمال مطابقة');
      expect(src).toContain('لم يتم العثور على أي عمال مطابقين');
    });

    it('enforces min 44x44px touch targets on interactive controls', () => {
      expect(src).toContain('min-h-[44px]');
      expect(src).toContain('min-w-[44px]');
    });
  });

  describe('Screen 2: Sites Hub (sites/page.tsx)', () => {
    const src = readScreenSource('src/app/admin/settings/sites/page.tsx');

    it('renders ZeroStateCard when sites list is empty', () => {
      expect(src).toContain('ZeroStateCard');
      expect(src).toContain('sites.length === 0');
      expect(src).toContain('لا توجد مواقع مسجلة');
    });

    it('enforces touch targets >= 44px on links and buttons', () => {
      expect(src).toContain('min-h-[44px]');
      expect(src).toContain('min-w-[44px]');
    });
  });

  describe('Screen 3: Jobs Matrix (jobs-client.tsx)', () => {
    const src = readScreenSource('src/app/admin/settings/jobs/jobs-client.tsx');

    it('wraps desktop table in overflow-x-auto with min-w-[700px]', () => {
      expect(src).toContain('overflow-x-auto');
      expect(src).toContain('min-w-[700px]');
    });

    it('renders ZeroStateCard on empty filter result', () => {
      expect(src).toContain('ZeroStateCard');
      expect(src).toContain('filteredJobs.length === 0');
      expect(src).toContain('لا توجد مسميات مهنية مطابقة');
    });

    it('enforces >= 44px touch targets on interactive elements', () => {
      expect(src).toContain('min-h-[44px]');
    });
  });

  describe('Screen 4: Clearances (clearances-client.tsx)', () => {
    const src = readScreenSource('src/app/admin/workforce/clearances/clearances-client.tsx');

    it('wraps both clearance and decision tables in overflow-x-auto with min-w-[800px]', () => {
      expect(src).toContain('overflow-x-auto');
      expect(src).toContain('min-w-[800px]');
    });

    it('renders ZeroStateCard for both clearances and decisions empty states', () => {
      expect(src).toContain('ZeroStateCard');
      expect(src).toContain('clearances.length === 0');
      expect(src).toContain('decisions.length === 0');
      expect(src).toContain('لا توجد طلبات مخالصة معلقة');
      expect(src).toContain('صندوق القرارات الإدارية خالٍ');
    });

    it('enforces >= 44px touch targets on tabs and action buttons', () => {
      expect(src).toContain('min-h-[44px]');
      expect(src).toContain('min-w-[44px]');
    });
  });

  describe('Screen 5: Users & RBAC (users-client.tsx)', () => {
    const src = readScreenSource('src/app/admin/settings/users/users-client.tsx');

    it('wraps table in overflow-x-auto with min-w-[700px]', () => {
      expect(src).toContain('overflow-x-auto');
      expect(src).toContain('min-w-[700px]');
    });

    it('renders ZeroStateCard when no users match search filter', () => {
      expect(src).toContain('ZeroStateCard');
      expect(src).toContain('filtered.length === 0');
      expect(src).toContain('لا يوجد مستخدمون مطابقون لمعايير البحث');
    });

    it('enforces >= 44px touch targets on back button and search input', () => {
      expect(src).toContain('min-h-[44px]');
      expect(src).toContain('min-w-[44px]');
    });
  });

  describe('Screen 6: Audit Incident Vault (audit-vault/page.tsx)', () => {
    const src = readScreenSource('src/app/admin/settings/audit-vault/page.tsx');

    it('wraps crash vault and audit logs in overflow-x-auto with min-w-[700px]', () => {
      expect(src).toContain('overflow-x-auto');
      expect(src).toContain('min-w-[700px]');
    });

    it('renders ZeroStateCard for clean crash vault and empty audit logs', () => {
      expect(src).toContain('ZeroStateCard');
      expect(src).toContain('errors.length === 0');
      expect(src).toContain('audits.length === 0');
      expect(src).toContain('لا توجد أعطال مسجلة');
      expect(src).toContain('لا توجد سجلات تدقيق جنائية');
    });

    it('eliminates lingering emerald-* color tokens in favor of brand tokens', () => {
      expect(src).not.toContain('text-emerald-');
      expect(src).not.toContain('bg-emerald-');
    });

    it('enforces >= 44px touch target on header back button', () => {
      expect(src).toContain('min-h-[44px]');
      expect(src).toContain('min-w-[44px]');
    });
  });

  describe('Screen 7: Notification Policies (notifications/page.tsx)', () => {
    const src = readScreenSource('src/app/admin/settings/notifications/page.tsx');

    it('wraps notification topics table in overflow-x-auto with min-w-[700px]', () => {
      expect(src).toContain('overflow-x-auto');
      expect(src).toContain('min-w-[700px]');
    });

    it('renders ZeroStateCard if topics list is empty', () => {
      expect(src).toContain('ZeroStateCard');
      expect(src).toContain('topics.length === 0');
      expect(src).toContain('لا توجد سياسات توجيه مسجلة');
    });

    it('enforces >= 44px touch target on back button', () => {
      expect(src).toContain('min-h-[44px]');
      expect(src).toContain('min-w-[44px]');
    });
  });

  describe('Screen 8: Admin Overview (page.tsx)', () => {
    const src = readScreenSource('src/app/admin/page.tsx');

    it('wires real database KPIs via getOverviewKpis', () => {
      expect(src).toContain('getOverviewKpis');
      expect(src).toContain('kpis.activeWorkersCount');
      expect(src).toContain('kpis.activeSitesCount');
      expect(src).toContain('kpis.pendingItemsCount');
      expect(src).toContain('kpis.avgLatencyMs');
    });

    it('enforces >= 44px touch targets on quick action links', () => {
      expect(src).toContain('min-h-[44px]');
    });
  });
});
