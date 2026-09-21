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
      // Arrange & Act & Assert
      expect(ZeroStateCard).toBeDefined();
      expect(typeof ZeroStateCard).toBe('function');
      expect(ZeroStateCard.name).toBe('ZeroStateCard');
    });
  });

  describe('Screen 1: Workforce Directory (directory-client.tsx)', () => {
    it('wraps table in overflow-x-auto container with min-w-[800px]', () => {
      // Arrange
      const src = readScreenSource('src/app/admin/workforce/directory/directory-client.tsx');

      // Act & Assert
      expect(src).toContain('overflow-x-auto');
      expect(src).toContain('min-w-[800px]');
      expect(src).not.toContain('table-layout: fixed; width: 100%');
    });

    it('renders ZeroStateCard on empty state', () => {
      // Arrange
      const src = readScreenSource('src/app/admin/workforce/directory/directory-client.tsx');

      // Act & Assert
      expect(src).toContain('ZeroStateCard');
      expect(src).toContain('filteredWorkers.length === 0');
      expect(src).toContain('لا توجد سجلات عمال مطابقة');
      expect(src).toContain('لم يتم العثور على أي عمال مطابقين');
    });

    it('enforces min 44x44px touch targets on interactive controls', () => {
      // Arrange
      const src = readScreenSource('src/app/admin/workforce/directory/directory-client.tsx');

      // Act & Assert
      expect(src).toContain('min-h-[44px]');
      expect(src).toContain('min-w-[44px]');
      expect(src).not.toContain('min-h-[20px]');
    });
  });

  describe('Screen 2: Sites Hub (sites/page.tsx)', () => {
    it('renders ZeroStateCard when sites list is empty', () => {
      // Arrange
      const src = readScreenSource('src/app/admin/settings/sites/page.tsx');

      // Act & Assert
      expect(src).toContain('ZeroStateCard');
      expect(src).toContain('sites.length === 0');
      expect(src).toContain('لا توجد مواقع مسجلة');
      expect(src).not.toContain('لا توجد بيانات بدون معالجة');
    });

    it('enforces touch targets >= 44px on links and buttons', () => {
      // Arrange
      const src = readScreenSource('src/app/admin/settings/sites/page.tsx');

      // Act & Assert
      expect(src).toContain('min-h-[44px]');
      expect(src).toContain('min-w-[44px]');
      expect(src).not.toContain('min-h-[24px]');
    });
  });

  describe('Screen 3: Jobs Matrix (jobs-client.tsx)', () => {
    it('wraps desktop table in overflow-x-auto with min-w-[700px]', () => {
      // Arrange
      const src = readScreenSource('src/app/admin/settings/jobs/jobs-client.tsx');

      // Act & Assert
      expect(src).toContain('overflow-x-auto');
      expect(src).toContain('min-w-[700px]');
      expect(src).not.toContain('overflow-scroll');
    });

    it('renders ZeroStateCard on empty filter result', () => {
      // Arrange
      const src = readScreenSource('src/app/admin/settings/jobs/jobs-client.tsx');

      // Act & Assert
      expect(src).toContain('ZeroStateCard');
      expect(src).toContain('filteredJobs.length === 0');
      expect(src).toContain('لا توجد مسميات مهنية مطابقة');
      expect(src).not.toContain('حدث خطأ غير معروف');
    });

    it('enforces >= 44px touch targets on interactive elements', () => {
      // Arrange
      const src = readScreenSource('src/app/admin/settings/jobs/jobs-client.tsx');

      // Act & Assert
      expect(src).toContain('min-h-[44px]');
      expect(src).not.toContain('h-[24px] w-[24px]');
    });
  });

  describe('Screen 4: Clearances (clearances-client.tsx)', () => {
    it('wraps both clearance and decision tables in overflow-x-auto with min-w-[800px]', () => {
      // Arrange
      const src = readScreenSource('src/app/admin/workforce/clearances/clearances-client.tsx');

      // Act & Assert
      expect(src).toContain('overflow-x-auto');
      expect(src).toContain('min-w-[800px]');
      expect(src).not.toContain('overflow-hidden min-w-full');
    });

    it('renders ZeroStateCard for both clearances and decisions empty states', () => {
      // Arrange
      const src = readScreenSource('src/app/admin/workforce/clearances/clearances-client.tsx');

      // Act & Assert
      expect(src).toContain('ZeroStateCard');
      expect(src).toContain('clearances.length === 0');
      expect(src).toContain('decisions.length === 0');
      expect(src).toContain('لا توجد طلبات مخالصة معلقة');
      expect(src).toContain('صندوق القرارات الإدارية خالٍ');
    });

    it('enforces >= 44px touch targets on tabs and action buttons', () => {
      // Arrange
      const src = readScreenSource('src/app/admin/workforce/clearances/clearances-client.tsx');

      // Act & Assert
      expect(src).toContain('min-h-[44px]');
      expect(src).toContain('min-w-[44px]');
      expect(src).not.toContain('min-h-[30px]');
    });
  });

  describe('Screen 5: Users & RBAC (users-client.tsx)', () => {
    it('wraps table in overflow-x-auto with min-w-[700px]', () => {
      // Arrange
      const src = readScreenSource('src/app/admin/settings/users/users-client.tsx');

      // Act & Assert
      expect(src).toContain('overflow-x-auto');
      expect(src).toContain('min-w-[700px]');
      expect(src).not.toContain('overflow-visible');
    });

    it('renders ZeroStateCard when no users match search filter', () => {
      // Arrange
      const src = readScreenSource('src/app/admin/settings/users/users-client.tsx');

      // Act & Assert
      expect(src).toContain('ZeroStateCard');
      expect(src).toContain('filtered.length === 0');
      expect(src).toContain('لا يوجد مستخدمون مطابقون لمعايير البحث');
      expect(src).not.toContain('لا توجد نتائج');
    });

    it('enforces >= 44px touch targets on back button and search input', () => {
      // Arrange
      const src = readScreenSource('src/app/admin/settings/users/users-client.tsx');

      // Act & Assert
      expect(src).toContain('min-h-[44px]');
      expect(src).toContain('min-w-[44px]');
      expect(src).not.toContain('h-8 w-8');
    });
  });

  describe('Screen 6: Audit Incident Vault (audit-vault/page.tsx)', () => {
    it('wraps crash vault and audit logs in overflow-x-auto with min-w-[700px]', () => {
      // Arrange
      const src = readScreenSource('src/app/admin/settings/audit-vault/page.tsx');

      // Act & Assert
      expect(src).toContain('overflow-x-auto');
      expect(src).toContain('min-w-[700px]');
      expect(src).not.toContain('table-fixed');
    });

    it('renders ZeroStateCard for clean crash vault and empty audit logs', () => {
      // Arrange
      const src = readScreenSource('src/app/admin/settings/audit-vault/page.tsx');

      // Act & Assert
      expect(src).toContain('ZeroStateCard');
      expect(src).toContain('errors.length === 0');
      expect(src).toContain('audits.length === 0');
      expect(src).toContain('لا توجد أعطال مسجلة');
      expect(src).toContain('لا توجد سجلات تدقيق جنائية');
    });

    it('eliminates lingering emerald-* color tokens in favor of brand tokens', () => {
      // Arrange
      const src = readScreenSource('src/app/admin/settings/audit-vault/page.tsx');

      // Act & Assert
      expect(src).not.toContain('text-emerald-');
      expect(src).not.toContain('bg-emerald-');
      expect(src).toContain('text-slate-');
    });

    it('enforces >= 44px touch target on header back button', () => {
      // Arrange
      const src = readScreenSource('src/app/admin/settings/audit-vault/page.tsx');

      // Act & Assert
      expect(src).toContain('min-h-[44px]');
      expect(src).toContain('min-w-[44px]');
      expect(src).not.toContain('min-h-[28px]');
    });
  });

  describe('Screen 7: Notification Policies (notifications/page.tsx)', () => {
    it('wraps notification topics table in overflow-x-auto with min-w-[700px]', () => {
      // Arrange
      const src = readScreenSource('src/app/admin/settings/notifications/page.tsx');

      // Act & Assert
      expect(src).toContain('overflow-x-auto');
      expect(src).toContain('min-w-[700px]');
      expect(src).not.toContain('overflow-hidden w-full');
    });

    it('renders ZeroStateCard if topics list is empty', () => {
      // Arrange
      const src = readScreenSource('src/app/admin/settings/notifications/page.tsx');

      // Act & Assert
      expect(src).toContain('ZeroStateCard');
      expect(src).toContain('topics.length === 0');
      expect(src).toContain('لا توجد سياسات توجيه مسجلة');
      expect(src).not.toContain('قائمة فارغة');
    });

    it('enforces >= 44px touch target on back button', () => {
      // Arrange
      const src = readScreenSource('src/app/admin/settings/notifications/page.tsx');

      // Act & Assert
      expect(src).toContain('min-h-[44px]');
      expect(src).toContain('min-w-[44px]');
      expect(src).not.toContain('min-h-[32px]');
    });
  });

  describe('Screen 8: Admin Overview (page.tsx)', () => {
    it('wires real database KPIs via getOverviewKpis', () => {
      // Arrange
      const src = readScreenSource('src/app/admin/page.tsx');

      // Act & Assert
      expect(src).toContain('getOverviewKpis');
      expect(src).toContain('kpis.activeWorkersCount');
      expect(src).toContain('kpis.activeSitesCount');
      expect(src).toContain('kpis.pendingItemsCount');
      expect(src).toContain('kpis.avgLatencyMs');
      expect(src).not.toContain('mockKpis');
    });

    it('enforces >= 44px touch targets on quick action links', () => {
      // Arrange
      const src = readScreenSource('src/app/admin/page.tsx');

      // Act & Assert
      expect(src).toContain('min-h-[44px]');
      expect(src).not.toContain('min-h-[25px]');
    });
  });
});
