import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SuperAdminOverview } from '../src/components/dashboard/super-admin-overview';
import { GeneralAdminOverview } from '../src/components/dashboard/general-admin-overview';
import { FieldAdminOverview } from '../src/components/dashboard/field-admin-overview';
import { getAnalyticsModulesForRole } from '../src/lib/analytics-registry';
import type { DashboardUser } from '../src/lib/rbac';
import type { OverviewKpis, SiteHubItem, WorkforceDirectoryItem } from '../src/lib/data-fetchers';
import { PINNED_BASE_TIME } from '@alsaada/shared/testing';

describe('Task 8: Role-Based Overviews & Centralized Analytics Registry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockKpis: OverviewKpis = {
    activeWorkersCount: 42,
    activeSitesCount: 3,
    pendingItemsCount: 5,
    avgLatencyMs: 12,
  };

  const mockSites: SiteHubItem[] = [
    {
      id: 'site-alamein',
      name: 'مشروع العلمين الجديدة',
      code: 'ALM-01',
      location: 'الساحل الشمالي',
      workersCount: 25,
      assignedSupervisors: ['م. خالد المنصوري'],
      status: 'ACTIVE',
    },
    {
      id: 'site-capital',
      name: 'مشروع العاصمة الإدارية',
      code: 'CAP-01',
      location: 'العاصمة الجديدة',
      workersCount: 17,
      assignedSupervisors: ['م. إبراهيم المشرف'],
      status: 'ACTIVE',
    },
  ];

  const mockWorkers: WorkforceDirectoryItem[] = [
    {
      id: 'worker-1',
      code: 'WRK-001',
      nickname: 'الأسطى رجب',
      fullName: 'رجب كمال حسن',
      phone: '01012345678',
      nationalIdMasked: '**********1234',
      nationalIdFull: '29001011234567',
      siteName: 'مشروع العلمين الجديدة',
      jobTitle: 'حداد مسلح',
      dailyWage: 350,
      basicSalary: 9000,
      fixedAllowances: 1500,
      totalMonthlySalary: 10500,
      status: 'ACTIVE',
      telegramStatus: 'LINKED',
    },
    {
      id: 'worker-2',
      code: 'WRK-002',
      nickname: 'المعلم خميس',
      fullName: 'خميس عبد ربه',
      phone: '01198765432',
      nationalIdMasked: '**********5678',
      nationalIdFull: '28802025678901',
      siteName: 'مشروع العاصمة الإدارية',
      jobTitle: 'نجار مسلح',
      dailyWage: 370,
      basicSalary: 9500,
      fixedAllowances: 1600,
      totalMonthlySalary: 11100,
      status: 'ACTIVE',
      telegramStatus: 'UNLINKED',
    },
  ];

  describe('1. SuperAdminOverview', () => {
    it('renders sovereign controls and links for SUPER_ADMIN', () => {
      // Arrange
      const user: DashboardUser = {
        id: 'usr-super',
        name: 'المدير العام',
        role: 'SUPER_ADMIN',
        isRealSuperAdmin: true,
      };

      // Act
      const element = SuperAdminOverview({
        user,
        kpis: mockKpis,
        sites: mockSites,
        workers: mockWorkers,
      });
      const html = renderToString(element);

      // Assert
      expect(element).toBeDefined();
      expect(element.props.children).toBeDefined();
      expect(html).toContain('لوحة القيادة السيادية العليا — سوبر أدمن');
      expect(html).toContain('المدير العام');
      expect(html).toContain('/admin/workforce/directory');
      expect(html).not.toContain('مشرف موقع');
    });
  });

  describe('2. GeneralAdminOverview', () => {
    it('renders operational oversight without sovereign ghost mode or studio', () => {
      // Arrange
      const user: DashboardUser = {
        id: 'usr-general',
        name: 'مدير العمليات',
        role: 'GENERAL_ADMIN',
      };

      // Act
      const element = GeneralAdminOverview({
        user,
        kpis: mockKpis,
        sites: mockSites,
        workers: mockWorkers,
      });
      const html = renderToString(element);

      // Assert
      expect(element).toBeDefined();
      expect(html).toContain('لوحة الإدارة العامة والرقابة التشغيلية');
      expect(html).toContain('مدير العمليات');
      expect(html).not.toContain('لوحة القيادة السيادية العليا — سوبر أدمن');
      expect(html).not.toContain('/admin/settings/studio');
    });
  });

  describe('3. FieldAdminOverview & Contractual Compensation Masking', () => {
    it('strictly restricts Field Admin view to assigned site and hides all salary fields', () => {
      // Arrange
      const user: DashboardUser = {
        id: 'usr-field',
        name: 'مشرف موقع العلمين',
        role: 'FIELD_ADMIN',
        assignedSiteId: 'site-alamein',
        assignedSiteName: 'مشروع العلمين الجديدة',
      };

      // Act
      const element = FieldAdminOverview({
        user,
        kpis: mockKpis,
        sites: mockSites,
        workers: mockWorkers,
      });
      const html = renderToString(element);

      // Assert
      expect(element).toBeDefined();
      expect(html).toContain('مشرف موقع العلمين');
      // Deep verification: ensure zero compensation amounts or headers leak
      expect(html).not.toContain('الراتب الأساسي');
      expect(html).not.toContain('الأجر اليومي');
      expect(html).not.toContain('البدلات الثابتة');
      expect(html).not.toContain('10500');
      expect(html).not.toContain('11100');
    });
  });

  describe('4. Analytics Registry Discoverability', () => {
    it('discovers modules for SUPER_ADMIN comprehensively', () => {
      // Arrange & Act
      const modules = getAnalyticsModulesForRole('SUPER_ADMIN');
      const keys = modules.map((m) => m.moduleKey);

      // Assert
      expect(modules.length).toBeGreaterThanOrEqual(4);
      expect(keys).toContain('workforce');
      expect(keys).toContain('advances');
      expect(keys).not.toContain('non_existent_module');
    });

    it('filters modules and features strictly for FIELD_ADMIN', () => {
      // Arrange & Act
      const modules = getAnalyticsModulesForRole('FIELD_ADMIN');

      // Assert
      expect(modules.length).toBeGreaterThan(0);
      for (const mod of modules) {
        for (const f of mod.features) {
          // FIELD_ADMIN should never see sovereign compensation edit
          expect(f.key).not.toBe('workforce.compensation.edit');
        }
      }
      const allFeatureKeys = modules.flatMap((m) => m.features.map((f) => f.key));
      expect(allFeatureKeys).not.toContain('workforce.compensation.edit');
    });
  });
});
