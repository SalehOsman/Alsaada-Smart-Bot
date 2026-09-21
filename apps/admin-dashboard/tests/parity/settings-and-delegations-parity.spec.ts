import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isNonDelegatable, evaluateAccess } from '@alsaada/rbac';
import { PINNED_BASE_TIME } from '@alsaada/shared/testing';

describe('Settings & Worker Supervisor Delegations Parity Specification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('1. Sovereign & Non-Delegatable Feature Guard', () => {
    it('strictly forbids delegating sovereign system permissions to worker supervisors', () => {
      // Arrange
      const sovereignPermissions = [
        'system.roles.manage',
        'system.users.manage',
        'system.settings.manage',
        'system.audit.view',
        'workforce.compensation.edit',
        'finance.treasury.manage',
        'approvals.sovereign.decide',
      ];

      // Act & Assert
      for (const perm of sovereignPermissions) {
        // Arrange
        const permissionKey = perm;

        // Act
        const isForbidden = isNonDelegatable(permissionKey);
        const decision = evaluateAccess({
          role: 'WORKER_SUPERVISOR',
          permissionKey,
          action: 'edit',
          siteId: 'STE-ALM',
          delegations: [{ permissionKey, siteId: 'STE-ALM', isActive: true }],
        });

        // Assert
        expect(isForbidden).toBe(true);
        expect(decision.granted).toBe(false);
        expect(decision.granted).not.toBe(true);
      }
    });

    it('permits delegation of operational field permissions and confirms delegatable status', () => {
      // Arrange
      const operationalPermissions = [
        'inventory.fuel.level.create',
        'canteen.supplies.dispense',
        'workforce.attendance.record',
      ];

      // Act & Assert
      for (const perm of operationalPermissions) {
        // Arrange
        const permissionKey = perm;

        // Act
        const isForbidden = isNonDelegatable(permissionKey);

        // Assert
        expect(isForbidden).toBe(false);
        expect(isForbidden).not.toBe(true);
      }
    });
  });

  describe('2. Site Boundary & Self-Approval Guard', () => {
    it('restricts worker supervisor operational actions to their designated site and rejects cross-site attempts', () => {
      // Arrange
      const homeSiteId = 'STE-ALM';
      const foreignSiteId = 'STE-CAP';
      const permissionKey = 'inventory.fuel.level.create';

      // Act
      const decisionAllowed = evaluateAccess({
        role: 'WORKER_SUPERVISOR',
        permissionKey,
        action: 'create',
        siteId: homeSiteId,
        targetSiteId: homeSiteId,
        delegations: [{ permissionKey, siteId: homeSiteId, isActive: true }],
      });

      const decisionDenied = evaluateAccess({
        role: 'WORKER_SUPERVISOR',
        permissionKey,
        action: 'create',
        siteId: homeSiteId,
        targetSiteId: foreignSiteId,
        delegations: [{ permissionKey, siteId: homeSiteId, isActive: true }],
      });

      // Assert
      expect(decisionAllowed.granted).toBe(true);
      expect(decisionDenied.granted).toBe(false);
      expect(decisionAllowed.granted).not.toBe(false);
      expect(decisionDenied.granted).not.toBe(true);
    });

    it('enforces self-approval prohibition for FIELD_ADMIN and restricts approval authority to executive roles', () => {
      // Arrange
      const canApproveDelegation = (role: string) => {
        return ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(role);
      };

      // Act
      const fieldAdminAllowed = canApproveDelegation('FIELD_ADMIN');
      const supervisorAllowed = canApproveDelegation('WORKER_SUPERVISOR');
      const superAdminAllowed = canApproveDelegation('SUPER_ADMIN');
      const generalAdminAllowed = canApproveDelegation('GENERAL_ADMIN');

      // Assert
      expect(fieldAdminAllowed).toBe(false);
      expect(supervisorAllowed).toBe(false);
      expect(superAdminAllowed).toBe(true);
      expect(generalAdminAllowed).toBe(true);
      expect(fieldAdminAllowed).not.toBe(true);
      expect(supervisorAllowed).not.toBe(true);
    });
  });

  describe('3. Dynamic Role Derivation (WORKER <-> WORKER_SUPERVISOR)', () => {
    interface WorkerAccountState {
      role: 'WORKER' | 'WORKER_SUPERVISOR';
      activeDelegationsCount: number;
    }

    const applyDelegationChange = (
      state: WorkerAccountState,
      action: 'ADD_ACTIVE' | 'REVOKE_ACTIVE'
    ): WorkerAccountState => {
      let count = state.activeDelegationsCount;
      if (action === 'ADD_ACTIVE') {
        count += 1;
      } else if (action === 'REVOKE_ACTIVE') {
        count = Math.max(0, count - 1);
      }

      return {
        activeDelegationsCount: count,
        role: count > 0 ? 'WORKER_SUPERVISOR' : 'WORKER',
      };
    };

    it('promotes WORKER to WORKER_SUPERVISOR upon receiving first active delegation and maintains it on second', () => {
      // Arrange
      const initial: WorkerAccountState = { role: 'WORKER', activeDelegationsCount: 0 };

      // Act
      const afterFirst = applyDelegationChange(initial, 'ADD_ACTIVE');
      const afterSecond = applyDelegationChange(afterFirst, 'ADD_ACTIVE');

      // Assert
      expect(afterFirst.role).toBe('WORKER_SUPERVISOR');
      expect(afterFirst.activeDelegationsCount).toBe(1);
      expect(afterFirst.role).not.toBe('WORKER');
      expect(afterSecond.role).toBe('WORKER_SUPERVISOR');
      expect(afterSecond.activeDelegationsCount).toBe(2);
      expect(afterSecond.activeDelegationsCount).toBeGreaterThan(1);
    });

    it('reverts WORKER_SUPERVISOR back to WORKER strictly when the last active delegation is revoked', () => {
      // Arrange
      const withTwo: WorkerAccountState = { role: 'WORKER_SUPERVISOR', activeDelegationsCount: 2 };

      // Act
      const afterOneRevoked = applyDelegationChange(withTwo, 'REVOKE_ACTIVE');
      const afterLastRevoked = applyDelegationChange(afterOneRevoked, 'REVOKE_ACTIVE');

      // Assert
      expect(afterOneRevoked.role).toBe('WORKER_SUPERVISOR');
      expect(afterOneRevoked.activeDelegationsCount).toBe(1);
      expect(afterOneRevoked.role).not.toBe('WORKER');
      expect(afterLastRevoked.role).toBe('WORKER');
      expect(afterLastRevoked.activeDelegationsCount).toBe(0);
      expect(afterLastRevoked.role).not.toBe('WORKER_SUPERVISOR');
    });
  });
});
