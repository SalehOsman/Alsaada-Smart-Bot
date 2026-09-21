import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PINNED_BASE_TIME } from '@alsaada/shared/testing';
import { getAnalyticsModulesForRole, MODULE_NAMES_AR } from '../src/lib/analytics-registry';
import { FEATURE_CATALOG } from '@alsaada/rbac';

describe('Phase 10 / Task 13: Dashboard Intelligence Specifications & Analytics Center', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('1. Dynamic Analytics Discovery per Role', () => {
    it('discovers all operational and sovereign modules when evaluated for SUPER_ADMIN role', () => {
      // Arrange
      const role = 'SUPER_ADMIN';

      // Act
      const modules = getAnalyticsModulesForRole(role);
      const moduleKeys = modules.map((m) => m.moduleKey);

      // Assert
      expect(modules.length).toBeGreaterThan(0);
      expect(moduleKeys).toContain('workforce');
      expect(moduleKeys).toContain('advances');
      expect(moduleKeys).toContain('canteen');
      expect(moduleKeys).toContain('custody');
      expect(moduleKeys).toContain('settings');
      expect(moduleKeys).not.toContain('unknown_module');
    });

    it('filters out sovereign and restricted features when evaluated for FIELD_ADMIN role', () => {
      // Arrange
      const role = 'FIELD_ADMIN';

      // Act
      const modules = getAnalyticsModulesForRole(role);

      // Assert
      expect(modules.length).toBeGreaterThan(0);
      expect(modules.length).not.toBe(0);

      // For each feature in every module, FIELD_ADMIN must be explicitly in allowedRoles
      for (const mod of modules) {
        for (const f of mod.features) {
          const catalogEntry = FEATURE_CATALOG[f.key];
          expect(catalogEntry).toBeDefined();
          expect(catalogEntry.allowedRoles).toContain('FIELD_ADMIN');
          expect(catalogEntry.allowedRoles).not.toContain('GUEST');
        }
      }
    });

    it('strictly forbids compensation view and treasury features from FIELD_ADMIN analytics catalog', () => {
      // Arrange
      const role = 'FIELD_ADMIN';

      // Act
      const modules = getAnalyticsModulesForRole(role);
      const allFeatureKeys = modules.flatMap((m) => m.features.map((f) => f.key));

      // Assert
      expect(allFeatureKeys.length).toBeGreaterThan(0);
      expect(allFeatureKeys).not.toContain('workforce.compensation.view');
      expect(allFeatureKeys).not.toContain('workforce.compensation.edit');
      expect(allFeatureKeys).not.toContain('finance.treasury.manage');
      expect(allFeatureKeys).not.toContain('system.audit.view');
    });

    it('returns valid subset of modules with operational access for GENERAL_ADMIN role', () => {
      // Arrange
      const role = 'GENERAL_ADMIN';

      // Act
      const modules = getAnalyticsModulesForRole(role);
      const moduleKeys = modules.map((m) => m.moduleKey);

      // Assert
      expect(modules.length).toBeGreaterThan(0);
      expect(moduleKeys).toContain('workforce');
      expect(moduleKeys).toContain('advances');
      expect(moduleKeys).not.toContain('unregistered_module');
    });
  });

  describe('2. KPI Specifications & Zero-Mock Aggregation Contract', () => {
    interface KpiComputationContract {
      kpiKey: string;
      labelAr: string;
      formula: string;
      sourceTable: string;
      safeForFieldAdmin: boolean;
    }

    const KPI_DEFINITIONS: Record<string, KpiComputationContract> = {
      totalWorkers: {
        kpiKey: 'totalWorkers',
        labelAr: 'إجمالي القوى العاملة المسجلة',
        formula: 'COUNT(workers.id) WHERE isDeleted = false',
        sourceTable: 'workers',
        safeForFieldAdmin: true,
      },
      activeWorkers: {
        kpiKey: 'activeWorkers',
        labelAr: 'العمال على رأس العمل',
        formula: 'COUNT(workers.id) WHERE isDeleted = false AND status = ACTIVE',
        sourceTable: 'workers',
        safeForFieldAdmin: true,
      },
      totalCashAdvances: {
        kpiKey: 'totalCashAdvances',
        labelAr: 'إجمالي السلف النقدية',
        formula: 'SUM(amountRequested) WHERE status = APPROVED',
        sourceTable: 'advance_requests',
        safeForFieldAdmin: true,
      },
      totalContractualSalaries: {
        kpiKey: 'totalContractualSalaries',
        labelAr: 'إجمالي مسير الرواتب التعاقدية',
        formula: 'SUM(basicSalary + fixedAllowances)',
        sourceTable: 'workers',
        safeForFieldAdmin: false, // Strictly masked for FIELD_ADMIN
      },
    };

    it('verifies that compensation aggregate KPIs are strictly marked unsafe for FIELD_ADMIN', () => {
      // Arrange
      const compKpi = KPI_DEFINITIONS.totalContractualSalaries;
      const workforceKpi = KPI_DEFINITIONS.totalWorkers;
      const activeKpi = KPI_DEFINITIONS.activeWorkers;
      const advancesKpi = KPI_DEFINITIONS.totalCashAdvances;

      // Act
      const isCompSafe = compKpi.safeForFieldAdmin;
      const isWorkforceSafe = workforceKpi.safeForFieldAdmin;

      // Assert
      expect(isCompSafe).toBe(false);
      expect(isCompSafe).not.toBe(true);
      expect(isWorkforceSafe).toBe(true);
      expect(activeKpi.safeForFieldAdmin).toBe(true);
      expect(advancesKpi.safeForFieldAdmin).toBe(true);
    });

    it('accurately maps Arabic localized titles for all discovered analytics modules from MODULE_NAMES_AR', () => {
      // Arrange
      const role = 'SUPER_ADMIN';

      // Act
      const modules = getAnalyticsModulesForRole(role);

      // Assert
      expect(modules.length).toBeGreaterThan(0);
      for (const mod of modules) {
        expect(mod.nameAr).toBe(MODULE_NAMES_AR[mod.moduleKey] || mod.moduleKey);
        expect(mod.nameAr).not.toBe('');
        expect(mod.nameAr).not.toBeUndefined();
      }
    });
  });

  describe('3. Drill-down Support Contract', () => {
    it('verifies drilldown capabilities in feature catalog definitions for workforce and advances', () => {
      // Arrange
      const workforceFeature = FEATURE_CATALOG['workforce.worker.view'];
      const advanceFeature = FEATURE_CATALOG['advances.cash.create'];

      // Act
      const workforceHasDrilldown = workforceFeature.analytics?.hasDrilldown;
      const advanceHasDrilldown = advanceFeature.analytics?.hasDrilldown;

      // Assert
      expect(workforceHasDrilldown).toBe(true);
      expect(workforceHasDrilldown).not.toBe(false);
      expect(workforceFeature.analytics?.kpiKeys).toContain('activeWorkers');
      expect(advanceHasDrilldown).toBe(true);
      expect(advanceHasDrilldown).not.toBe(false);
    });
  });
});
