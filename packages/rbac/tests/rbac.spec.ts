import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  evaluateAccess,
  canAccessDashboard,
  isCanonicalRole,
  isFieldMasked,
  projectSafeWorkerFields,
  CANONICAL_ROLES,
  CONTRACTUAL_COMPENSATION_FIELDS,
  isNonDelegatable,
  CanonicalRole,
  AccessContext,
} from '../src/index.js';

describe('Central RBAC Engine Specification (@alsaada/rbac)', () => {
  describe('1. Canonical Roles & Dashboard Access Gate', () => {
    it('defines exactly the 7 canonical roles with no additions or removals', () => {
      // Arrange
      const expectedRoles: CanonicalRole[] = [
        'SUPER_ADMIN',
        'GENERAL_ADMIN',
        'FIELD_ADMIN',
        'WORKER_SUPERVISOR',
        'WORKER',
        'SUPPLIER',
        'GUEST',
      ];

      // Act
      const actualRoles = CANONICAL_ROLES;

      // Assert
      expect(actualRoles).toHaveLength(7);
      expect(actualRoles).toEqual(expectedRoles);
      expect(actualRoles).not.toContain('EXECUTIVE');
    });

    it('identifies canonical roles and rejects deprecated or unknown roles', () => {
      // Arrange
      const validRoles = CANONICAL_ROLES;
      const invalidRoles = [
        'EXECUTIVE',
        'EXECUTIVE_DIRECTOR',
        'ACCOUNTANT',
        'PROJECT_MANAGER',
        'SITE_ENGINEER',
        'ADMIN',
        '',
        null,
      ];

      // Act
      const validResults = validRoles.map((role) => isCanonicalRole(role));
      const invalidResults = invalidRoles.map((role) => isCanonicalRole(role));

      // Assert
      validResults.forEach((res) => expect(res).toBe(true));
      invalidResults.forEach((res) => expect(res).toBe(false));
      expect(validResults).toHaveLength(7);
      expect(invalidResults).not.toContain(true);
    });

    it('strictly permits only SUPER_ADMIN, GENERAL_ADMIN, and FIELD_ADMIN into dashboard', () => {
      // Arrange
      const authorizedRoles: CanonicalRole[] = ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'];
      const unauthorizedRoles = [
        'WORKER_SUPERVISOR',
        'WORKER',
        'SUPPLIER',
        'GUEST',
        'EXECUTIVE',
        'ACCOUNTANT',
      ];

      // Act
      const authorizedResults = authorizedRoles.map((role) => canAccessDashboard(role));
      const unauthorizedResults = unauthorizedRoles.map((role) => canAccessDashboard(role as any));

      // Assert
      authorizedResults.forEach((res) => expect(res).toBe(true));
      unauthorizedResults.forEach((res) => expect(res).toBe(false));
      expect(authorizedResults).toHaveLength(3);
      expect(unauthorizedResults).not.toContain(true);
    });

    it('blocks dashboard channel access for unauthorized roles in evaluator', () => {
      // Arrange
      const workerPayload: AccessContext = {
        role: 'WORKER',
        permissionKey: 'workforce.worker.view',
        channel: 'DASHBOARD',
      };
      const supervisorPayload: AccessContext = {
        role: 'WORKER_SUPERVISOR',
        permissionKey: 'inventory.fuel.level.create',
        channel: 'DASHBOARD',
      };

      // Act
      const decisionWorker = evaluateAccess(workerPayload);
      const decisionSupervisor = evaluateAccess(supervisorPayload);

      // Assert
      expect(decisionWorker.granted).toBe(false);
      expect(decisionWorker.reason).toBe('DASHBOARD_ACCESS_DENIED');
      expect(decisionSupervisor.granted).toBe(false);
      expect(decisionSupervisor.reason).toBe('DASHBOARD_ACCESS_DENIED');
      expect(decisionWorker.granted).not.toBe(true);
    });
  });

  describe('2. Strict Contractual Compensation Masking', () => {
    it('strictly masks contractual compensation fields for FIELD_ADMIN', () => {
      // Arrange
      const perm = 'workforce.compensation.view';
      const sampleField = 'basicSalary';

      // Act
      const fieldAdminMasked = CONTRACTUAL_COMPENSATION_FIELDS.map((field) =>
        isFieldMasked('FIELD_ADMIN', perm, field)
      );
      const superAdminMasked = isFieldMasked('SUPER_ADMIN', perm, sampleField);
      const generalAdminMasked = isFieldMasked('GENERAL_ADMIN', perm, sampleField);

      // Assert
      fieldAdminMasked.forEach((masked) => expect(masked).toBe(true));
      expect(superAdminMasked).toBe(false);
      expect(generalAdminMasked).toBe(false);
      expect(fieldAdminMasked).not.toContain(false);
    });

    it('allows workers to view only their own compensation slip', () => {
      // Arrange
      const perm = 'workforce.compensation.view';
      const field = 'basicSalary';

      // Act
      const workerSelf = isFieldMasked('WORKER', perm, field, { isSelf: true });
      const workerOther = isFieldMasked('WORKER', perm, field, { isSelf: false });
      const supervisorSelf = isFieldMasked('WORKER_SUPERVISOR', perm, field, { isSelf: true });
      const supervisorOther = isFieldMasked('WORKER_SUPERVISOR', perm, field, { isSelf: false });

      // Assert
      expect(workerSelf).toBe(false);
      expect(workerOther).toBe(true);
      expect(supervisorSelf).toBe(false);
      expect(supervisorOther).toBe(true);
      expect(workerSelf).not.toBe(true);
    });

    it('projects safe worker fields by stripping masked fields', () => {
      // Arrange
      const rawWorker = {
        id: 'wrk-001',
        name: 'أحمد محمود',
        jobTitle: 'سائق معدات',
        siteId: 'STE-KHA',
        basicSalary: 8500,
        overtimeRate: 50,
        allowances: 1200,
        totalCompensation: 9700,
      };

      // Act
      const safeForFieldAdmin = projectSafeWorkerFields(rawWorker, 'FIELD_ADMIN');
      const safeForSuperAdmin = projectSafeWorkerFields(rawWorker, 'SUPER_ADMIN');

      // Assert
      expect(safeForFieldAdmin).toEqual({
        id: 'wrk-001',
        name: 'أحمد محمود',
        jobTitle: 'سائق معدات',
        siteId: 'STE-KHA',
      });
      expect((safeForFieldAdmin as any).basicSalary).toBeUndefined();
      expect((safeForFieldAdmin as any).totalCompensation).toBeUndefined();
      expect(safeForSuperAdmin.basicSalary).toBe(8500);
      expect(safeForSuperAdmin.totalCompensation).toBe(9700);
    });
  });

  describe('3. Worker Supervisor Delegation Lifecycles', () => {
    // Arrange — تثبيت الوقت لضمان حتمية اختبارات انتهاء التفويض (R5)
    const PINNED_DATE = new Date('2026-09-21T06:00:00.000Z');

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(PINNED_DATE);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('validates active worker supervisor delegation on matching site', () => {
      // Arrange
      const accessPayload: AccessContext = {
        role: 'WORKER_SUPERVISOR',
        permissionKey: 'inventory.fuel.level.create',
        action: 'create',
        siteId: 'STE-KHA',
        delegations: [
          {
            permissionKey: 'inventory.fuel.level.create',
            siteId: 'STE-KHA',
            isActive: true,
          },
        ],
      };

      // Act
      const decision = evaluateAccess(accessPayload);

      // Assert
      expect(decision.granted).toBe(true);
      expect(decision.scope).toBe('assigned-resource');
      expect(decision.granted).not.toBe(false);
    });

    it('denies worker supervisor when accessing a different site', () => {
      // Arrange
      const accessPayload: AccessContext = {
        role: 'WORKER_SUPERVISOR',
        permissionKey: 'inventory.fuel.level.create',
        action: 'create',
        siteId: 'STE-KHA',
        targetSiteId: 'STE-ASW',
        delegations: [
          {
            permissionKey: 'inventory.fuel.level.create',
            siteId: 'STE-KHA',
            isActive: true,
          },
        ],
      };

      // Act
      const decision = evaluateAccess(accessPayload);

      // Assert
      expect(decision.granted).toBe(false);
      expect(decision.reason).toBe('NO_ACTIVE_DELEGATION_FOR_PERMISSION_OR_SITE');
      expect(decision.granted).not.toBe(true);
    });

    it('denies worker supervisor when delegation is explicitly deactivated', () => {
      // Arrange — تفويض موجود لكنه معطّل صراحةً
      const accessPayload: AccessContext = {
        role: 'WORKER_SUPERVISOR',
        permissionKey: 'inventory.fuel.level.create',
        action: 'create',
        siteId: 'STE-KHA',
        delegations: [
          {
            permissionKey: 'inventory.fuel.level.create',
            siteId: 'STE-KHA',
            isActive: false,
          },
        ],
      };

      // Act
      const decision = evaluateAccess(accessPayload);

      // Assert — يُرفض مع بيان السبب الدقيق
      expect(decision.granted).toBe(false);
      expect(decision.reason).toBe('NO_ACTIVE_DELEGATION_FOR_PERMISSION_OR_SITE');
      expect(decision.granted).not.toBe(true);
    });

    it('denies worker supervisor when delegation has expired past its end date', () => {
      // Arrange — تفويض نشط لكنه منتهي الصلاحية (10 ثوانٍ قبل الوقت المثبت)
      const accessPayload: AccessContext = {
        role: 'WORKER_SUPERVISOR',
        permissionKey: 'inventory.fuel.level.create',
        action: 'create',
        siteId: 'STE-KHA',
        delegations: [
          {
            permissionKey: 'inventory.fuel.level.create',
            siteId: 'STE-KHA',
            isActive: true,
            endsAt: new Date(PINNED_DATE.getTime() - 10_000),
          },
        ],
      };

      // Act
      const decision = evaluateAccess(accessPayload);

      // Assert — يُرفض مع بيان السبب الدقيق
      expect(decision.granted).toBe(false);
      expect(decision.reason).toBe('NO_ACTIVE_DELEGATION_FOR_PERMISSION_OR_SITE');
      expect(decision.granted).not.toBe(true);
    });

    it('denies worker supervisor when delegations array is empty', () => {
      // Arrange — لا توجد تفويضات أصلاً (Edge Case — R7)
      const accessPayload: AccessContext = {
        role: 'WORKER_SUPERVISOR',
        permissionKey: 'inventory.fuel.level.create',
        action: 'create',
        siteId: 'STE-KHA',
        delegations: [],
      };

      // Act
      const decision = evaluateAccess(accessPayload);

      // Assert — يُرفض لعدم وجود أي تفويض نشط
      expect(decision.granted).toBe(false);
      expect(decision.reason).toBe('NO_ACTIVE_DELEGATION_FOR_PERMISSION_OR_SITE');
      expect(decision.granted).not.toBe(true);
    });

    it('strictly forbids delegation of sovereign/non-delegatable permissions', () => {
      // Arrange
      const accessPayload: AccessContext = {
        role: 'WORKER_SUPERVISOR',
        permissionKey: 'system.roles.manage',
        action: 'manage',
        siteId: 'STE-KHA',
        delegations: [
          {
            permissionKey: 'system.roles.manage',
            siteId: 'STE-KHA',
            isActive: true,
          },
        ],
      };

      // Act
      const isRolesNonDelegatable = isNonDelegatable('system.roles.manage');
      const isCompensationNonDelegatable = isNonDelegatable('workforce.compensation.edit');
      const decision = evaluateAccess(accessPayload);

      // Assert
      expect(isRolesNonDelegatable).toBe(true);
      expect(isCompensationNonDelegatable).toBe(true);
      expect(decision.granted).toBe(false);
      expect(decision.reason).toBe('FEATURE_NOT_DELEGATABLE');
      expect(decision.granted).not.toBe(true);
    });

    it('allows worker supervisor to perform worker self-service operations', () => {
      // Arrange
      const accessPayload: AccessContext = {
        role: 'WORKER_SUPERVISOR',
        permissionKey: 'advances.withdrawals.view',
        action: 'view',
        isSelf: true,
      };

      // Act
      const decision = evaluateAccess(accessPayload);

      // Assert
      expect(decision.granted).toBe(true);
      expect(decision.scope).toBe('self');
      expect(decision.granted).not.toBe(false);
    });
  });

  describe('4. Account Safety & Deny by Default', () => {
    it('denies banned accounts unconditionally', () => {
      // Arrange
      const accessPayload: AccessContext = {
        role: 'SUPER_ADMIN',
        permissionKey: 'workforce.worker.view',
        isBanned: true,
      };

      // Act
      const decision = evaluateAccess(accessPayload);

      // Assert
      expect(decision.granted).toBe(false);
      expect(decision.reason).toBe('ACCOUNT_BANNED');
      expect(decision.granted).not.toBe(true);
    });

    it('denies inactive accounts unconditionally', () => {
      // Arrange
      const accessPayload: AccessContext = {
        role: 'SUPER_ADMIN',
        permissionKey: 'workforce.worker.view',
        isActive: false,
      };

      // Act
      const decision = evaluateAccess(accessPayload);

      // Assert
      expect(decision.granted).toBe(false);
      expect(decision.reason).toBe('ACCOUNT_INACTIVE');
      expect(decision.granted).not.toBe(true);
    });

    it('denies unknown permission keys under DENY_BY_DEFAULT', () => {
      // Arrange
      const accessPayload: AccessContext = {
        role: 'FIELD_ADMIN',
        permissionKey: 'non_existent.feature.key',
      };

      // Act
      const decision = evaluateAccess(accessPayload);

      // Assert
      expect(decision.granted).toBe(false);
      expect(decision.reason).toBe('PERMISSION_NOT_FOUND_IN_CATALOG');
      expect(decision.granted).not.toBe(true);
    });

    it('enforces site boundary for FIELD_ADMIN', () => {
      // Arrange
      const accessPayload: AccessContext = {
        role: 'FIELD_ADMIN',
        permissionKey: 'workforce.worker.view',
        siteId: 'STE-KHA',
        targetSiteId: 'STE-ASW',
      };

      // Act
      const decision = evaluateAccess(accessPayload);

      // Assert
      expect(decision.granted).toBe(false);
      expect(decision.reason).toBe('SITE_BOUNDARY_VIOLATION');
      expect(decision.decisionTrace).toBeDefined();
      expect(decision.decisionTrace).toContain('SITE_BOUNDARY_CHECKED');
      expect(decision.granted).not.toBe(true);
    });

    it('proves decisionTrace includes SITE_BOUNDARY_CHECKED and SOVEREIGN_KEYS_CHECKED prior to ALLOW', () => {
      // Arrange
      const accessPayload: AccessContext = {
        role: 'FIELD_ADMIN',
        permissionKey: 'workforce.worker.view',
        action: 'view',
        siteId: 'STE-KHA',
        targetSiteId: 'STE-KHA',
      };

      // Act
      const decision = evaluateAccess(accessPayload);

      // Assert
      expect(decision.granted).toBe(true);
      expect(decision.decisionTrace).toBeDefined();
      const trace = decision.decisionTrace!;
      const siteIdx = trace.indexOf('SITE_BOUNDARY_CHECKED');
      const sovereignIdx = trace.indexOf('SOVEREIGN_KEYS_CHECKED');
      expect(siteIdx).not.toBe(-1);
      expect(sovereignIdx).not.toBe(-1);
      expect(siteIdx).toBeLessThan(sovereignIdx);
    });
  });
});
