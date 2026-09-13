import type { AccessContext, AccessDecision, CanonicalRole, PermissionAction } from './types.js';
import { canAccessDashboard, isCanonicalRole } from './roles.js';
import { getFeatureContract } from './catalog.js';
import { getMaskedFields, isNonDelegatable } from './permissions.js';

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
