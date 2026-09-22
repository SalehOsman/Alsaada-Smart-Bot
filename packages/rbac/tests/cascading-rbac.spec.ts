import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  evaluateCascadingAccess,
  getAllWorkerSupervisorProfiles,
  getWorkerSupervisorProfile,
  isWorkerSupervisorProfileKey,
  WORKER_SUPERVISOR_PROFILES,
  type ScopePermissionRule,
} from '../src/index.js';

describe('Hardened Cascading RBAC Evaluator & Supervisor Lifecycles Specification', () => {
  const PINNED_BASE_TIME = new Date('2026-03-03T12:00:00.000Z');
  let stdoutSpy: { mockRestore: () => void };
  let stderrSpy: { mockRestore: () => void };
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleInfoSpy.mockRestore();
  });

  describe('1. Five-Layer Cascading Hierarchy & Explicit DENY Trumps ALLOW', () => {
    it('enforces USER level rule over lower levels (USER > ROLE)', () => {
      // Arrange
      const rules: ScopePermissionRule[] = [
        {
          scopeType: 'ROLE',
          scopeId: 'FIELD_ADMIN',
          featureKey: 'advances.cash.create',
          action: 'create',
          policy: 'ALLOW',
        },
        {
          scopeType: 'USER',
          scopeId: 'user-001',
          featureKey: 'advances.cash.create',
          action: 'create',
          policy: 'DENY',
        },
      ];

      // Act
      const decision = evaluateCascadingAccess({
        role: 'FIELD_ADMIN',
        userId: 'user-001',
        siteId: 'STE-KHA',
        permissionKey: 'advances.cash.create',
        action: 'create',
        rules,
      });

      // Assert
      expect(decision.granted).toBe(false);
      expect(decision.reason).toBe('EXPLICIT_DENIED');
    });

    it('enforces SITE level rule over DEPARTMENT and ROLE levels', () => {
      // Arrange
      const rules: ScopePermissionRule[] = [
        {
          scopeType: 'DEPARTMENT',
          scopeId: 'dept-ops',
          featureKey: 'canteen.sale.create',
          action: 'create',
          policy: 'ALLOW',
        },
        {
          scopeType: 'SITE',
          scopeId: 'STE-KHA',
          featureKey: 'canteen.sale.create',
          action: 'create',
          policy: 'DENY',
        },
      ];

      // Act
      const decision = evaluateCascadingAccess({
        role: 'FIELD_ADMIN',
        userId: 'user-002',
        siteId: 'STE-KHA',
        departmentId: 'dept-ops',
        permissionKey: 'canteen.sale.create',
        action: 'create',
        rules,
      });

      // Assert
      expect(decision.granted).toBe(false);
      expect(decision.reason).toBe('EXPLICIT_DENIED');
    });

    it('grants permission when a layer provides ALLOW and no higher layer denies', () => {
      // Arrange
      const rules: ScopePermissionRule[] = [
        {
          scopeType: 'JOB_TITLE',
          scopeId: 'job-fuel-manager',
          featureKey: 'inventory.fuel.level.create',
          action: 'create',
          policy: 'ALLOW',
        },
      ];

      // Act
      const decision = evaluateCascadingAccess({
        role: 'WORKER',
        userId: 'user-003',
        siteId: 'STE-KHA',
        jobTitleId: 'job-fuel-manager',
        permissionKey: 'inventory.fuel.level.create',
        action: 'create',
        rules,
      });

      // Assert
      expect(decision.granted).toBe(true);
      expect(decision.allowedActions).toContain('create');
    });

    it('enforces DENY over ALLOW when conflicting policies exist within the same level', () => {
      // Arrange
      const rules: ScopePermissionRule[] = [
        {
          scopeType: 'ROLE',
          scopeId: 'FIELD_ADMIN',
          featureKey: 'custody.expense.create',
          action: 'create',
          policy: 'ALLOW',
        },
        {
          scopeType: 'ROLE',
          scopeId: 'FIELD_ADMIN',
          featureKey: 'custody.expense.create',
          action: 'create',
          policy: 'DENY',
        },
      ];

      // Act
      const decision = evaluateCascadingAccess({
        role: 'FIELD_ADMIN',
        userId: 'user-004',
        siteId: 'STE-KHA',
        permissionKey: 'custody.expense.create',
        action: 'create',
        rules,
      });

      // Assert
      expect(decision.granted).toBe(false);
      expect(decision.reason).toBe('EXPLICIT_DENIED');
    });
  });

  describe('2. Immutable Super Admin Bypass', () => {
    it('SUPER_ADMIN bypasses explicit DENY rules unconditionally', () => {
      // Arrange
      const rules: ScopePermissionRule[] = [
        {
          scopeType: 'USER',
          scopeId: 'super-admin-01',
          featureKey: 'system.roles.manage',
          action: 'manage',
          policy: 'DENY',
        },
      ];

      // Act
      const decision = evaluateCascadingAccess({
        role: 'SUPER_ADMIN',
        userId: 'super-admin-01',
        permissionKey: 'system.roles.manage',
        action: 'manage',
        rules,
      });

      // Assert
      expect(decision.granted).toBe(true);
      expect(decision.reason).toBe('IMMUTABLE_BYPASS');
      expect(decision.scope).toBe('system');
    });

    it('SUPER_ADMIN is never frozen when on leave', () => {
      // Arrange
      const input = {
        role: 'SUPER_ADMIN' as const,
        userId: 'super-admin-01',
        permissionKey: 'system.users.manage',
        action: 'manage' as const,
        isOnLeave: true,
        freezeBotAccessOnLeave: true,
      };

      // Act
      const decision = evaluateCascadingAccess(input);

      // Assert
      expect(decision.granted).toBe(true);
      expect(decision.reason).toBe('IMMUTABLE_BYPASS');
    });
  });

  describe('3. Configurable Leave Policy (Bot Freeze & Vacation Permissions)', () => {
    it('freezes operational bot features when supervisor is on leave by default (freezeBotAccessOnLeave = true)', () => {
      // Arrange
      const input = {
        role: 'FIELD_ADMIN' as const,
        userId: 'admin-001',
        siteId: 'STE-KHA',
        permissionKey: 'advances.cash.create',
        action: 'create' as const,
        isOnLeave: true,
        freezeBotAccessOnLeave: true,
      };

      // Act
      const decision = evaluateCascadingAccess(input);

      // Assert
      expect(decision.granted).toBe(false);
      expect(decision.reason).toBe('ON_LEAVE_FREEZE');
    });

    it('allows remote operational monitoring when management unfreezes leave (freezeBotAccessOnLeave = false)', () => {
      // Arrange
      const input = {
        role: 'FIELD_ADMIN' as const,
        userId: 'admin-002',
        siteId: 'STE-KHA',
        permissionKey: 'advances.cash.create',
        action: 'create' as const,
        isOnLeave: true,
        freezeBotAccessOnLeave: false,
      };

      // Act
      const decision = evaluateCascadingAccess(input);

      // Assert
      expect(decision.granted).toBe(true);
      expect(decision.scope).toBe('assigned-site');
    });

    it('allows self-service compensation slip review during leave even when freezeBotAccessOnLeave = true', () => {
      // Arrange
      const input = {
        role: 'FIELD_ADMIN' as const,
        userId: 'admin-003',
        siteId: 'STE-KHA',
        permissionKey: 'workforce.compensation.view',
        action: 'view' as const,
        isSelf: true,
        isOnLeave: true,
        freezeBotAccessOnLeave: true,
      };

      // Act
      const decision = evaluateCascadingAccess(input);

      // Assert
      expect(decision.granted).toBe(true);
      expect(decision.scope).toBe('self');
    });
  });

  describe('4. Field Admin Full Site Operational Scope & Cryptographic Masking', () => {
    it('grants FIELD_ADMIN all site operational features without picking single jobs', () => {
      // Arrange
      const features = [
        'workforce.worker.create',
        'advances.cash.create',
        'canteen.sale.create',
        'custody.expense.create',
        'inventory.fuel.level.create',
        'requests.bonus.submit',
      ];

      // Act
      const decisions = features.map((feature) =>
        evaluateCascadingAccess({
          role: 'FIELD_ADMIN',
          userId: 'admin-005',
          siteId: 'STE-KHA',
          permissionKey: feature,
        })
      );

      // Assert
      expect(decisions).toHaveLength(6);
      decisions.forEach((decision) => {
        expect(decision.granted).toBe(true);
        expect(decision.scope).toBe('assigned-site');
      });
    });

    it('strictly denies sovereign administrative features to FIELD_ADMIN', () => {
      // Arrange
      const sovereignFeatures = [
        'system.roles.manage',
        'system.matrix.manage',
        'system.audit.view',
        'requests.bonus.approve',
        'workforce.compensation.edit',
      ];

      // Act
      const decisions = sovereignFeatures.map((feature) =>
        evaluateCascadingAccess({
          role: 'FIELD_ADMIN',
          userId: 'admin-005',
          siteId: 'STE-KHA',
          permissionKey: feature,
        })
      );

      // Assert
      expect(decisions).toHaveLength(5);
      decisions.forEach((decision) => {
        expect(decision.granted).toBe(false);
        expect(decision.reason).toBe('ROLE_NOT_AUTHORIZED_FOR_FEATURE');
      });
    });

    it('strictly masks salary and contractual compensation fields for FIELD_ADMIN', () => {
      // Arrange
      const input = {
        role: 'FIELD_ADMIN' as const,
        userId: 'admin-005',
        siteId: 'STE-KHA',
        permissionKey: 'workforce.compensation.view',
        isSelf: false,
      };

      // Act
      const decision = evaluateCascadingAccess(input);

      // Assert
      expect(decision.granted).toBe(true);
      expect(decision.fieldMask).toBeDefined();
      expect(decision.fieldMask).toContain('basicSalary');
      expect(decision.fieldMask).toContain('overtimeRate');
      expect(decision.fieldMask).toContain('totalCompensation');
    });

    it('enforces site boundary restrictions when FIELD_ADMIN targets another site', () => {
      // Arrange
      const input = {
        role: 'FIELD_ADMIN' as const,
        userId: 'admin-005',
        siteId: 'STE-KHA',
        targetSiteId: 'STE-ASW',
        permissionKey: 'advances.cash.create',
      };

      // Act
      const decision = evaluateCascadingAccess(input);

      // Assert
      expect(decision.granted).toBe(false);
      expect(decision.reason).toBe('SITE_BOUNDARY_VIOLATION');
    });
  });

  describe('5. Worker Supervisor Profile Templates Engine', () => {
    it('defines exactly the 4 standard worker supervisor profiles', () => {
      // Arrange
      const expectedCount = 4;

      // Act
      const profiles = getAllWorkerSupervisorProfiles();

      // Assert
      expect(profiles).toHaveLength(expectedCount);
      const keys = profiles.map((p) => p.key);
      expect(keys).toContain('FUEL_SUPERVISOR');
      expect(keys).toContain('CANTEEN_SUPERVISOR');
      expect(keys).toContain('HOUSING_SUPERVISOR');
      expect(keys).toContain('SHIFT_SUPERVISOR');
    });

    it('validates profile keys with isWorkerSupervisorProfileKey', () => {
      // Arrange
      const validKey1 = 'FUEL_SUPERVISOR';
      const validKey2 = 'CANTEEN_SUPERVISOR';
      const validKey3 = 'HOUSING_SUPERVISOR';
      const validKey4 = 'SHIFT_SUPERVISOR';
      const invalidKey = 'UNKNOWN_PROFILE';

      // Act
      const res1 = isWorkerSupervisorProfileKey(validKey1);
      const res2 = isWorkerSupervisorProfileKey(validKey2);
      const res3 = isWorkerSupervisorProfileKey(validKey3);
      const res4 = isWorkerSupervisorProfileKey(validKey4);
      const resInvalid = isWorkerSupervisorProfileKey(invalidKey);

      // Assert
      expect(res1).toBe(true);
      expect(res2).toBe(true);
      expect(res3).toBe(true);
      expect(res4).toBe(true);
      expect(resInvalid).toBe(false);
    });

    it('provides accurate permissions for FUEL_SUPERVISOR', () => {
      // Arrange
      const profileKey = 'FUEL_SUPERVISOR';

      // Act
      const profile = getWorkerSupervisorProfile(profileKey);

      // Assert
      expect(profile).toBeDefined();
      expect(profile?.permissions).toEqual([
        {
          permissionKey: 'inventory.fuel.level.create',
          actions: ['create', 'view'],
        },
      ]);
    });

    it('provides accurate permissions for CANTEEN_SUPERVISOR', () => {
      // Arrange
      const profileKey = 'CANTEEN_SUPERVISOR';

      // Act
      const profile = getWorkerSupervisorProfile(profileKey);

      // Assert
      expect(profile).toBeDefined();
      expect(profile?.permissions.map((p) => p.permissionKey)).toEqual([
        'canteen.sale.create',
        'canteen.sale.view',
      ]);
    });
  });
});
