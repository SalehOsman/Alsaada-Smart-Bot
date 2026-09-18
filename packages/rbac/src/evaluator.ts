import type {
  AccessContext,
  AccessDecision,
  CanonicalRole,
  CascadingAccessContext,
  PermissionAction,
  ScopePermissionRule,
} from './types.js';
import { canAccessDashboard, isCanonicalRole } from './roles.js';
import { getFeatureContract } from './catalog.js';
import { getMaskedFields, isNonDelegatable } from './permissions.js';

export const SOVEREIGN_SUPER_ADMIN_KEYS = new Set([
  'system.users.manage',
  'system.roles.manage',
  'system.matrix.manage',
  'system.audit.view',
  'system.telemetry.view',
  'requests.bonus.approve',
  'workforce.compensation.edit',
]);

export function evaluateAccess(context: AccessContext): AccessDecision {
  const {
    role,
    permissionKey,
    action = 'view',
    siteId,
    targetSiteId,
    resourceId,
    isSelf = false,
    isActive = true,
    isBanned = false,
    channel = 'ALL',
    delegations = [],
  } = context;

  // 1. Hard Account Status Checks
  if (isBanned) {
    return { granted: false, reason: 'ACCOUNT_BANNED' };
  }
  if (!isActive) {
    return { granted: false, reason: 'ACCOUNT_INACTIVE' };
  }

  // 2. Canonical Role Enforcement (Strict DENY_BY_DEFAULT)
  if (!isCanonicalRole(role)) {
    return { granted: false, reason: 'INVALID_OR_DEPRECATED_ROLE' };
  }

  const canonicalRole = role as CanonicalRole;

  // 3. Channel / Dashboard Matrix Check
  if (channel === 'DASHBOARD' && !canAccessDashboard(canonicalRole)) {
    return { granted: false, reason: 'DASHBOARD_ACCESS_DENIED' };
  }

  // 4. Resolve Feature Contract
  const contract = getFeatureContract(permissionKey);

  // 5. SUPER_ADMIN Sovereign Evaluation
  if (canonicalRole === 'SUPER_ADMIN') {
    const masked = getMaskedFields(canonicalRole, permissionKey, { isSelf });
    return {
      granted: true,
      allowedActions: contract?.allowedActions ?? ['view', 'create', 'submit', 'edit', 'withdraw', 'approve', 'reject', 'settle', 'export', 'print', 'manage'],
      fieldMask: masked,
      scope: 'system',
    };
  }

  // 6. Sovereign / Non-Delegatable Safety Lock
  if (isNonDelegatable(permissionKey)) {
    // Exception: GENERAL_ADMIN for delegations management or approvals if specified in contract
    if (contract && contract.allowedRoles.includes(canonicalRole) && (contract.allowedActions.includes(action) || action === 'view')) {
      // Allowed if explicitly listed in feature contract
    } else {
      return { granted: false, reason: 'FEATURE_NOT_DELEGATABLE' };
    }
  }

  if (!contract) {
    return { granted: false, reason: 'PERMISSION_NOT_FOUND_IN_CATALOG' };
  }

  // Check if role is allowed directly on the contract
  const isDirectlyAllowedRole = contract.allowedRoles.includes(canonicalRole);

  // 7. GENERAL_ADMIN Evaluation
  if (canonicalRole === 'GENERAL_ADMIN') {
    if (!isDirectlyAllowedRole) {
      return { granted: false, reason: 'ROLE_NOT_AUTHORIZED_FOR_FEATURE' };
    }
    const masked = getMaskedFields(canonicalRole, permissionKey, { isSelf });
    return {
      granted: true,
      allowedActions: contract.allowedActions,
      fieldMask: masked,
      scope: 'all-sites',
    };
  }

  // 8. FIELD_ADMIN Evaluation
  if (canonicalRole === 'FIELD_ADMIN') {
    if (!isDirectlyAllowedRole) {
      return { granted: false, reason: 'ROLE_NOT_AUTHORIZED_FOR_FEATURE' };
    }

    // Site boundary enforcement: If targetSiteId is specified and differs from assigned siteId
    if (targetSiteId && siteId && targetSiteId !== siteId) {
      return { granted: false, reason: 'SITE_BOUNDARY_VIOLATION' };
    }

    // Check specific action
    if (!contract.allowedActions.includes(action)) {
      return { granted: false, reason: 'ACTION_NOT_PERMITTED_FOR_FEATURE' };
    }

    const masked = getMaskedFields(canonicalRole, permissionKey, { isSelf });
    return {
      granted: true,
      allowedActions: contract.allowedActions,
      fieldMask: masked,
      scope: 'assigned-site',
    };
  }

  // 9. WORKER_SUPERVISOR Evaluation
  if (canonicalRole === 'WORKER_SUPERVISOR') {
    // 9a. Self-service action check (allowed if WORKER is allowed and isSelf)
    if (contract.allowedRoles.includes('WORKER') && isSelf) {
      return {
        granted: true,
        allowedActions: contract.allowedActions,
        fieldMask: getMaskedFields(canonicalRole, permissionKey, { isSelf: true }),
        scope: 'self',
      };
    }

    // 9b. Delegated supervisor action check
    if (!contract.delegatable) {
      return { granted: false, reason: 'FEATURE_NOT_DELEGATABLE' };
    }

    const effectiveTargetSite = targetSiteId || siteId;
    const now = new Date();

    const activeDelegation = delegations.find((d) => {
      if (!d.isActive) return false;
      if (d.permissionKey !== permissionKey) return false;
      if (effectiveTargetSite && d.siteId !== effectiveTargetSite) return false;
      if (resourceId && d.resourceId && d.resourceId !== resourceId) return false;
      if (d.startsAt && new Date(d.startsAt) > now) return false;
      if (d.endsAt && new Date(d.endsAt) < now) return false;
      return true;
    });

    if (!activeDelegation) {
      return { granted: false, reason: 'NO_ACTIVE_DELEGATION_FOR_PERMISSION_OR_SITE' };
    }

    return {
      granted: true,
      allowedActions: contract.allowedActions,
      fieldMask: getMaskedFields(canonicalRole, permissionKey, { isSelf: false }),
      scope: 'assigned-resource',
    };
  }

  // 10. WORKER Evaluation
  if (canonicalRole === 'WORKER') {
    if (!isDirectlyAllowedRole) {
      return { granted: false, reason: 'ROLE_NOT_AUTHORIZED_FOR_FEATURE' };
    }
    if (contract.dataScope === 'self' && !isSelf) {
      return { granted: false, reason: 'WORKER_LIMITED_TO_SELF_SERVICE' };
    }
    return {
      granted: true,
      allowedActions: contract.allowedActions,
      fieldMask: getMaskedFields(canonicalRole, permissionKey, { isSelf }),
      scope: 'self',
    };
  }

  // 11. SUPPLIER Evaluation
  if (canonicalRole === 'SUPPLIER') {
    if (!isDirectlyAllowedRole || !isSelf) {
      return { granted: false, reason: 'SUPPLIER_LIMITED_TO_OWN_ACCOUNT' };
    }
    return {
      granted: true,
      allowedActions: contract.allowedActions,
      fieldMask: getMaskedFields(canonicalRole, permissionKey, { isSelf: true }),
      scope: 'self',
    };
  }

  // 12. GUEST Evaluation
  if (canonicalRole === 'GUEST') {
    if (!isDirectlyAllowedRole) {
      return { granted: false, reason: 'GUEST_ACCESS_DENIED' };
    }
    return {
      granted: true,
      allowedActions: contract.allowedActions,
      fieldMask: [],
      scope: 'self',
    };
  }

  return { granted: false, reason: 'DENIED_BY_DEFAULT' };
}

/**
 * Hardened Cascading RBAC Evaluator (Explicit DENY Trumps ALLOW)
 * Hierarchical Precedence: USER > SITE > JOB_TITLE > DEPARTMENT > ROLE
 * Supports Configurable Leave Policies, Immutable Super Admin Bypass, and Field Admin Full Site Scope
 */
export function evaluateCascadingAccess(context: CascadingAccessContext): AccessDecision {
  const {
    role,
    userId,
    departmentId,
    jobTitleId,
    siteId,
    targetSiteId,
    permissionKey,
    action = 'view',
    resourceId,
    isSelf = false,
    isActive = true,
    isBanned = false,
    isOnLeave = false,
    freezeBotAccessOnLeave = true,
    channel = 'ALL',
    rules = [],
    delegations = [],
  } = context;

  // 1. Hard Account Status Checks
  if (isBanned) {
    return { granted: false, reason: 'ACCOUNT_BANNED' };
  }
  if (!isActive) {
    return { granted: false, reason: 'ACCOUNT_INACTIVE' };
  }

  // 2. Canonical Role Check
  if (!isCanonicalRole(role)) {
    return { granted: false, reason: 'INVALID_OR_DEPRECATED_ROLE' };
  }

  const canonicalRole = role as CanonicalRole;

  // 3. SUPER_ADMIN Sovereign Evaluation (IMMUTABLE_BYPASS)
  // Super Admin cannot be blocked by leave policies, explicit DENYs, or matrix rules.
  if (canonicalRole === 'SUPER_ADMIN') {
    const contract = getFeatureContract(permissionKey);
    const masked = getMaskedFields(canonicalRole, permissionKey, { isSelf });
    return {
      granted: true,
      allowedActions: contract?.allowedActions ?? [
        'view',
        'create',
        'submit',
        'edit',
        'withdraw',
        'approve',
        'reject',
        'settle',
        'export',
        'print',
        'manage',
      ],
      fieldMask: masked,
      scope: 'system',
      reason: 'IMMUTABLE_BYPASS',
    };
  }

  // 4. Configurable Leave Policy Check
  if (isOnLeave) {
    if (freezeBotAccessOnLeave) {
      // If self-service personal records (compensation slip or personal withdrawal history), allow view
      const isPersonalSelfRecord =
        isSelf &&
        (permissionKey === 'workforce.compensation.view' ||
          permissionKey === 'advances.withdrawals.view');
      if (!isPersonalSelfRecord) {
        return { granted: false, reason: 'ON_LEAVE_FREEZE' };
      }
    }
    // If freezeBotAccessOnLeave === false, management has allowed remote monitoring, continue evaluation
  }

  // 5. Channel / Dashboard Matrix Check
  if (channel === 'DASHBOARD' && !canAccessDashboard(canonicalRole)) {
    return { granted: false, reason: 'DASHBOARD_ACCESS_DENIED' };
  }

  // 6. Explicit Cascading Rules Evaluation (Precedence: USER > SITE > JOB_TITLE > DEPARTMENT > ROLE)
  // Rule: Layer N checks its rules. Explicit DENY halts immediately. If ALLOW found and no DENY, grants.
  if (rules && rules.length > 0) {
    const hierarchyOrder: Array<{ type: ScopePermissionRule['scopeType']; id?: string | null | undefined }> = [
      { type: 'USER', id: userId },
      { type: 'SITE', id: siteId },
      { type: 'JOB_TITLE', id: jobTitleId },
      { type: 'DEPARTMENT', id: departmentId },
      { type: 'ROLE', id: role },
    ];

    for (const level of hierarchyOrder) {
      if (!level.id) continue;

      const matchingRules = rules.filter(
        (r) =>
          r.scopeType === level.type &&
          r.scopeId === level.id &&
          r.featureKey === permissionKey &&
          (r.action === action || r.action === 'manage')
      );

      if (matchingRules.length > 0) {
        // If conflicting rules within the same level, DENY wins (Least Privilege)
        const hasDeny = matchingRules.some((r) => r.policy === 'DENY');
        if (hasDeny) {
          return { granted: false, reason: 'EXPLICIT_DENIED' };
        }

        const allowRule = matchingRules.find((r) => r.policy === 'ALLOW');
        if (allowRule) {
          return {
            granted: true,
            allowedActions: [allowRule.action],
            scope:
              level.type === 'USER'
                ? 'self'
                : level.type === 'SITE'
                  ? 'assigned-site'
                  : 'all-sites',
            fieldMask: getMaskedFields(canonicalRole, permissionKey, { isSelf }),
          };
        }
      }
    }
  }

  // 7. Site Boundary Check for Site-scoped roles (FIELD_ADMIN / WORKER_SUPERVISOR)
  if (targetSiteId && siteId && targetSiteId !== siteId) {
    return { granted: false, reason: 'SITE_BOUNDARY_VIOLATION' };
  }

  // 8. Special Scope: FIELD_ADMIN Site Full Operational Scope
  if (canonicalRole === 'FIELD_ADMIN') {
    // Sovereign admin keys are strictly restricted to SUPER_ADMIN / GENERAL_ADMIN
    if (SOVEREIGN_SUPER_ADMIN_KEYS.has(permissionKey)) {
      return { granted: false, reason: 'ROLE_NOT_AUTHORIZED_FOR_FEATURE' };
    }

    const contract = getFeatureContract(permissionKey);
    if (!contract) {
      return { granted: false, reason: 'PERMISSION_NOT_FOUND_IN_CATALOG' };
    }

    // FIELD_ADMIN automatically inherits access to all operational site flows
    const masked = getMaskedFields(canonicalRole, permissionKey, { isSelf });
    return {
      granted: true,
      allowedActions: contract.allowedActions,
      fieldMask: masked,
      scope: isSelf ? 'self' : 'assigned-site',
    };
  }

  // 9. Fallback to Standard evaluateAccess
  return evaluateAccess({
    role: canonicalRole,
    permissionKey,
    action,
    siteId,
    targetSiteId,
    resourceId,
    isSelf,
    isActive,
    isBanned,
    channel,
    delegations,
  });
}

