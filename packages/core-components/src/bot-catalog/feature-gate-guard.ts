import { BotNodeStatus, DisabledBehavior, type BotMenuNodeDTO, type FeatureGateCheckResult } from './types.js';

export class FeatureGateGuard {
  /**
   * Evaluates whether a user can access and execute a feature node.
   * Enforces non-disablable sovereign anchors (isProtected = true).
   */
  public static checkFeatureAccess(node: BotMenuNodeDTO | null | undefined, userRole?: string): FeatureGateCheckResult {
    if (!node) {
      return {
        allowed: false,
        status: BotNodeStatus.DISABLED,
        isProtected: false,
        reason: 'NOT_FOUND',
        maintenanceMessage: 'العنصر المطلوب غير موجود في سجل النظام.',
      };
    }

    // Sovereign anchor: immune to deactivation
    if (node.isProtected) {
      return {
        allowed: true,
        status: BotNodeStatus.ACTIVE,
        isProtected: true,
      };
    }

    // Role check
    if (userRole && node.allowedRoles && node.allowedRoles.length > 0) {
      if (!node.allowedRoles.includes(userRole) && userRole !== 'SUPER_ADMIN') {
        return {
          allowed: false,
          status: node.status,
          behavior: node.disabledBehavior,
          isProtected: false,
          reason: 'ROLE_UNAUTHORIZED',
          maintenanceMessage: 'ليس لديك الصلاحية الكافية للوصول إلى هذا الإجراء.',
        };
      }
    }

    // Status check
    if (node.status === BotNodeStatus.ACTIVE) {
      return {
        allowed: true,
        status: BotNodeStatus.ACTIVE,
        isProtected: false,
      };
    }

    // Disabled or Maintenance
    const isMaint = node.status === BotNodeStatus.MAINTENANCE;
    const defaultMsg = isMaint
      ? 'هذه الوظيفة تحت الصيانة الدورية المجدولة حالياً وسيتم إعادتها للعمل قريباً.'
      : 'هذه الوظيفة موقوفة مؤقتاً بتوجيه من إدارة النظام.';

    return {
      allowed: false,
      status: node.status,
      behavior: node.disabledBehavior,
      isProtected: false,
      reason: isMaint ? 'MAINTENANCE' : 'INACTIVE',
      maintenanceMessage: node.maintenanceMessage?.trim() || defaultMsg,
    };
  }

  /**
   * Checks access by matching node unique code.
   */
  public static checkFeatureByCode(code: string, nodes: BotMenuNodeDTO[], userRole?: string): FeatureGateCheckResult {
    const node = nodes.find((n) => n.code === code);
    return this.checkFeatureAccess(node, userRole);
  }

  /**
   * Checks access by matching node callbackData.
   */
  public static checkFeatureByCallback(callbackData: string, nodes: BotMenuNodeDTO[], userRole?: string): FeatureGateCheckResult {
    const node = nodes.find((n) => n.callbackData === callbackData);
    return this.checkFeatureAccess(node, userRole);
  }

  /**
   * Throws an error if access is denied. Useful for programmatic guards inside flow handlers.
   */
  public static assertFeatureActive(node: BotMenuNodeDTO | null | undefined, userRole?: string): void {
    const check = this.checkFeatureAccess(node, userRole);
    if (!check.allowed) {
      const msg = check.maintenanceMessage || 'Feature access denied.';
      const err = new Error(msg);
      (err as unknown as Record<string, unknown>).featureGateReason = check.reason;
      throw err;
    }
  }
}
