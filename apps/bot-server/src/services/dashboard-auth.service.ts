import crypto from 'node:crypto';
import { prisma } from '../db.js';
import { config } from '../config/env.js';
import { redis } from '../redis.js';
import { TelemetryLogger } from '@alsaada/telemetry';
import {
  canAccessDashboard,
  DASHBOARD_AUTHORIZED_ROLES,
  validateDashboardAuthOrigins,
  type CanonicalRole,
  type DashboardAuthOrigins,
  type DashboardAuthOriginsResult,
} from '@alsaada/rbac';
import type { User, Site } from '@alsaada/database';

const logger = new TelemetryLogger({
  service: 'bot-server',
  defaultComponent: 'dashboard-auth-service',
});

export const AUTHORIZED_DASHBOARD_ROLES = DASHBOARD_AUTHORIZED_ROLES;
export type AuthorizedDashboardRole = (typeof DASHBOARD_AUTHORIZED_ROLES)[number];

export type UserWithAssignedSite = User & { assignedSite: Site | null };

export interface DashboardSessionView {
  id: string;
  expiresAt: Date;
  extensionCount: number;
  originKind: 'LOCAL' | 'TUNNEL';
  deviceSummary: string | null;
}

export type DashboardAccessRejectionReason =
  | 'USER_NOT_FOUND'
  | 'ACCOUNT_INACTIVE'
  | 'ACCOUNT_BANNED'
  | 'UNAUTHORIZED_ROLE'
  | 'MAX_CONCURRENT_SESSIONS_REACHED'
  | 'CONFIG_ERROR';

export interface IssueDashboardAccessInput {
  telegramId: bigint;
  username?: string | null | undefined;
  firstName?: string | null | undefined;
  lastName?: string | null | undefined;
  chatType?: string | undefined;
}

export interface IssueDualDashboardAccessSuccess {
  success: true;
  user: {
    id: string;
    telegramId: bigint;
    fullName: string;
    role: string;
    isActive: boolean;
    isBanned: boolean;
    assignedSiteId: string | null;
    assignedSiteName: string | null;
  };
  groupId: string;
  localToken: string;
  tunnelToken: string;
  localUrl: string;
  tunnelUrl: string;
  token: string;
  magicUrl: string;
  jti: string;
  expiresInMinutes: number;
  expiresAt: number;
}

export interface IssueDashboardAccessDenied {
  success: false;
  reason: DashboardAccessRejectionReason;
  user: {
    id: string;
    telegramId: bigint;
    fullName: string;
    role: string;
    isActive: boolean;
    isBanned: boolean;
  } | null;
  telegramId: bigint;
  activeSessions?: Array<{
    id: string;
    originKind: string;
    deviceSummary: string | null;
    expiresAt: Date;
    createdAt: Date;
    extensionCount: number;
  }> | undefined;
}

export type IssueDualDashboardAccessResult =
  | IssueDualDashboardAccessSuccess
  | IssueDashboardAccessDenied;

export class DashboardAuthService {
  /**
   * Helper: Resolve user from database or upsert Super Admin if configured in env
   */
  private async resolveUser(input: IssueDashboardAccessInput): Promise<UserWithAssignedSite | null> {
    const { telegramId, username, firstName, lastName } = input;

    let user = await prisma.user.findFirst({
      where: { telegramId, isDeleted: false },
      include: { assignedSite: true },
    });

    const isSuperAdminEnv =
      config.superAdminTelegramId > 0n && telegramId === config.superAdminTelegramId;

    if (isSuperAdminEnv && (!user || user.role !== 'SUPER_ADMIN')) {
      const fallbackName = [firstName, lastName].filter(Boolean).join(' ') || 'Super Admin';
      user = await prisma.user.upsert({
        where: { telegramId },
        update: { role: 'SUPER_ADMIN', isActive: true, isBanned: false },
        create: {
          telegramId,
          username: username || null,
          fullName: fallbackName,
          role: 'SUPER_ADMIN',
          isActive: true,
          isBanned: false,
        },
        include: { assignedSite: true },
      });
    }

    return user;
  }

  /**
   * Helper: Check if user role and account status are authorized for dashboard access
   */
  private checkUserAuthorization(user: UserWithAssignedSite | null): {
    authorized: boolean;
    reason?: DashboardAccessRejectionReason;
  } {
    if (!user) {
      return { authorized: false, reason: 'USER_NOT_FOUND' };
    }
    if (!user.isActive) {
      return { authorized: false, reason: 'ACCOUNT_INACTIVE' };
    }
    if (user.isBanned) {
      return { authorized: false, reason: 'ACCOUNT_BANNED' };
    }
    if (!canAccessDashboard(user.role as CanonicalRole)) {
      return { authorized: false, reason: 'UNAUTHORIZED_ROLE' };
    }
    return { authorized: true };
  }

  /**
   * Helper: Record audit log for rejected access
   */
  private async recordAccessDeniedAudit(params: {
    traceId: string;
    telegramId: bigint;
    reason: DashboardAccessRejectionReason;
    user: UserWithAssignedSite | null;
    input: IssueDashboardAccessInput;
  }): Promise<void> {
    const { traceId, telegramId, reason, user, input } = params;
    try {
      await prisma.auditLog.create({
        data: {
          traceId,
          actorTelegramId: telegramId,
          action: 'DASHBOARD_ACCESS_DENIED',
          entityType: 'DashboardAuth',
          entityId: user?.id || String(telegramId),
          beforePayload: {
            username: input.username || null,
            fullName: [input.firstName, input.lastName].filter(Boolean).join(' ') || null,
            chatType: input.chatType || 'private',
          },
          afterPayload: {
            reason,
            role: user?.role || 'UNREGISTERED',
            attemptedAt: new Date().toISOString(),
          },
        },
      });
    } catch (err: unknown) {
      logger.warn('Failed to log rejected dashboard access audit record', {
        traceId,
        error: err,
      });
    }
  }

  /**
   * Helper: Validate concurrent sessions ceiling (<= 3 active sessions)
   */
  private async checkConcurrentSessions(
    user: UserWithAssignedSite,
    traceId: string
  ): Promise<{
    allowed: boolean;
    activeSessions?: Array<{
      id: string;
      originKind: string;
      deviceSummary: string | null;
      expiresAt: Date;
      createdAt: Date;
      extensionCount: number;
    }>;
  }> {
    const activeSessions = await prisma.dashboardSession.findMany({
      where: {
        actorTelegramId: user.telegramId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (activeSessions && activeSessions.length >= 3) {
      try {
        await prisma.auditLog.create({
          data: {
            traceId,
            actorTelegramId: user.telegramId,
            action: 'DASHBOARD_ACCESS_DENIED_MAX_SESSIONS',
            entityType: 'DashboardAuth',
            entityId: user.id,
            afterPayload: {
              activeCount: activeSessions.length,
              maxAllowed: 3,
            },
          },
        });
      } catch (err: unknown) {
        logger.warn('Failed to log max sessions denial', { traceId, error: err });
      }

      return {
        allowed: false,
        activeSessions: activeSessions.map((s) => ({
          id: s.id,
          originKind: s.originKind,
          deviceSummary: s.deviceSummary,
          expiresAt: s.expiresAt,
          createdAt: s.createdAt,
          extensionCount: s.extensionCount,
        })),
      };
    }

    return { allowed: true };
  }

  /**
   * Helper: Resolve and validate origins using pure @alsaada/rbac contract
   */
  private resolveOrigins(traceId: string): DashboardAuthOriginsResult {
    const res = validateDashboardAuthOrigins({
      localUrl: config.dashboardLocalUrl,
      tunnelUrl: config.dashboardTunnelUrl,
    });
    if (!res.ok) {
      logger.error('Failed to validate dashboard origins configuration during token issuance', {
        traceId,
        action: 'dashboard.origins.validate',
        error: res.code,
      });
    }
    return res;
  }

  /**
   * Helper: Persist dual links, log issuance audit, and populate Redis cache
   */
  private async persistDualAuthLinks(params: {
    user: UserWithAssignedSite;
    origins: DashboardAuthOrigins;
    traceId: string;
    ttlMinutes: number;
  }): Promise<{
    groupId: string;
    localToken: string;
    tunnelToken: string;
    localUrl: string;
    tunnelUrl: string;
    localHash: string;
    expiresAt: Date;
  }> {
    const { user, origins, traceId, ttlMinutes } = params;
    const groupId = crypto.randomUUID();
    const localToken = crypto.randomBytes(32).toString('hex');
    const tunnelToken = crypto.randomBytes(32).toString('hex');

    const localHash = crypto.createHash('sha256').update(localToken).digest('hex');
    const tunnelHash = crypto.createHash('sha256').update(tunnelToken).digest('hex');
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await prisma.$transaction([
      prisma.dashboardAuthLink.create({
        data: {
          groupId,
          originKind: 'LOCAL',
          targetOrigin: origins.localOrigin,
          jtiHash: localHash,
          actorTelegramId: user.telegramId,
          expiresAt,
        },
      }),
      prisma.dashboardAuthLink.create({
        data: {
          groupId,
          originKind: 'TUNNEL',
          targetOrigin: origins.tunnelOrigin,
          jtiHash: tunnelHash,
          actorTelegramId: user.telegramId,
          expiresAt,
        },
      }),
    ]);

    const localUrl = `${origins.localOrigin}/api/auth/claim?token=${localToken}`;
    const tunnelUrl = `${origins.tunnelOrigin}/api/auth/claim?token=${tunnelToken}`;

    try {
      await prisma.auditLog.create({
        data: {
          traceId,
          actorTelegramId: user.telegramId,
          action: 'DASHBOARD_DUAL_LINKS_ISSUED',
          entityType: 'DashboardAuthLink',
          entityId: user.id,
          afterPayload: {
            userId: user.id,
            role: user.role,
            groupId,
            expiresAt: expiresAt.toISOString(),
          },
        },
      });
    } catch (err: unknown) {
      logger.warn('Failed to log dual links issuance audit record', { traceId, error: err });
    }

    if (redis && redis.status === 'ready') {
      try {
        await Promise.all([
          redis.set(`auth_link:${localHash}`, user.id, 'EX', ttlMinutes * 60),
          redis.set(`auth_link:${tunnelHash}`, user.id, 'EX', ttlMinutes * 60),
          redis.set(`magic_token:${localHash}:issued`, user.id, 'EX', ttlMinutes * 60),
        ]);
      } catch (redisErr: unknown) {
        logger.warn('Failed to cache auth link in Redis (best-effort)', { traceId, error: redisErr });
      }
    }

    return { groupId, localToken, tunnelToken, localUrl, tunnelUrl, localHash, expiresAt };
  }

  /**
   * Check user status, verify authorization against @alsaada/rbac CANONICAL_ROLES,
   * issue concurrent local and tunnel 5-minute single-use tokens stored in dashboard_auth_links,
   * and record audit logs.
   */
  async issueDualDashboardAccess(
    input: IssueDashboardAccessInput
  ): Promise<IssueDualDashboardAccessResult> {
    const traceId = crypto.randomUUID();

    // 1. Resolve user
    const user = await this.resolveUser(input);

    // 2. Authorization and status checks
    const authCheck = this.checkUserAuthorization(user);
    if (!authCheck.authorized) {
      const reason = authCheck.reason!;
      await this.recordAccessDeniedAudit({
        traceId,
        telegramId: input.telegramId,
        reason,
        user,
        input,
      });

      return {
        success: false,
        reason,
        user: user
          ? {
              id: user.id,
              telegramId: user.telegramId,
              fullName: user.fullName,
              role: user.role,
              isActive: user.isActive,
              isBanned: user.isBanned,
            }
          : null,
        telegramId: input.telegramId,
      };
    }

    // 3. Check active sessions limit (Strict ceiling <= 3 concurrent sessions)
    const sessionCheck = await this.checkConcurrentSessions(user!, traceId);
    if (!sessionCheck.allowed) {
      return {
        success: false,
        reason: 'MAX_CONCURRENT_SESSIONS_REACHED',
        user: {
          id: user!.id,
          telegramId: user!.telegramId,
          fullName: user!.fullName,
          role: user!.role,
          isActive: user!.isActive,
          isBanned: user!.isBanned,
        },
        telegramId: input.telegramId,
        ...(sessionCheck.activeSessions ? { activeSessions: sessionCheck.activeSessions } : {}),
      };
    }

    // 4. Validate origins configuration
    const originsRes = this.resolveOrigins(traceId);
    if (!originsRes.ok) {
      return {
        success: false,
        reason: 'CONFIG_ERROR',
        user: null,
        telegramId: input.telegramId,
      };
    }

    // 5. Generate and persist dual links
    const ttlMinutes = config.dashboardAuthLinkTtlMinutes || 5;
    const links = await this.persistDualAuthLinks({
      user: user!,
      origins: originsRes.origins,
      traceId,
      ttlMinutes,
    });

    return {
      success: true,
      user: {
        id: user!.id,
        telegramId: user!.telegramId,
        fullName: user!.fullName,
        role: user!.role,
        isActive: user!.isActive,
        isBanned: user!.isBanned,
        assignedSiteId: user!.assignedSiteId || null,
        assignedSiteName: user!.assignedSite?.name || null,
      },
      groupId: links.groupId,
      localToken: links.localToken,
      tunnelToken: links.tunnelToken,
      localUrl: links.localUrl,
      tunnelUrl: links.tunnelUrl,
      token: links.localToken,
      magicUrl: links.localUrl,
      jti: links.localHash,
      expiresInMinutes: ttlMinutes,
      expiresAt: Math.floor(links.expiresAt.getTime() / 1000),
    };
  }

  /**
   * Backwards compatible method
   */
  async issueDashboardAccess(
    input: IssueDashboardAccessInput
  ): Promise<IssueDualDashboardAccessResult> {
    return this.issueDualDashboardAccess(input);
  }

  /**
   * Extend an active dashboard session by 8 hours
   */
  async extendSession(
    sessionId: string,
    actorTelegramId: bigint
  ): Promise<{ success: boolean; newExpiresAt?: Date; reason?: string; extensionCount?: number }> {
    const session = await prisma.dashboardSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.revokedAt) {
      return { success: false, reason: 'SESSION_NOT_FOUND_OR_REVOKED' };
    }

    if (session.expiresAt <= new Date()) {
      return { success: false, reason: 'SESSION_EXPIRED' };
    }

    const isOwner = session.actorTelegramId === actorTelegramId;
    const isSuper = config.superAdminTelegramId === actorTelegramId;
    if (!isOwner && !isSuper) {
      return { success: false, reason: 'UNAUTHORIZED' };
    }

    // Strict single extension rule: Max 1 extension per session (Plan 22 Task 7.1)
    if (session.extensionCount >= 1) {
      return { success: false, reason: 'MAX_EXTENSIONS_REACHED' };
    }

    // Strict 16-hour total ceiling from session creation
    const maxExpiresAt =
      session.maxExpiresAt ||
      new Date(session.createdAt.getTime() + 16 * 3600 * 1000);

    const extensionHours = config.dashboardSessionExtensionHours || 8;
    const candidateExpiresAt = new Date(
      session.expiresAt.getTime() + extensionHours * 3600 * 1000
    );

    const newExpiresAt =
      candidateExpiresAt > maxExpiresAt ? maxExpiresAt : candidateExpiresAt;

    const updated = await prisma.dashboardSession.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
        extensionCount: 0,
        expiresAt: { gt: new Date() },
      },
      data: {
        extensionCount: 1,
        extendedAt: new Date(),
        expiresAt: newExpiresAt,
        maxExpiresAt,
        noticeSentAt: null,
      },
    });

    if (updated.count === 0) {
      return { success: false, reason: 'MAX_EXTENSIONS_REACHED' };
    }

    await prisma.auditLog.create({
      data: {
        actorTelegramId,
        action: 'DASHBOARD_SESSION_EXTENDED',
        entityType: 'DashboardSession',
        entityId: sessionId,
        afterPayload: {
          newExpiresAt: newExpiresAt.toISOString(),
          extendedHours: extensionHours,
          extensionCount: session.extensionCount + 1,
          maxExpiresAt: maxExpiresAt.toISOString(),
        },
      },
    });

    return { success: true, newExpiresAt, extensionCount: session.extensionCount + 1 };
  }

  /**
   * Revoke an active dashboard session immediately
   */
  async revokeSession(
    sessionId: string,
    reason: string,
    actorTelegramId: bigint
  ): Promise<{ success: boolean; reason?: string }> {
    const session = await prisma.dashboardSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return { success: false, reason: 'SESSION_NOT_FOUND' };
    }

    const isOwner = session.actorTelegramId === actorTelegramId;
    const isSuper = config.superAdminTelegramId === actorTelegramId;
    if (!isOwner && !isSuper) {
      return { success: false, reason: 'UNAUTHORIZED' };
    }

    await prisma.dashboardSession.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
        revocationReason: reason.slice(0, 100),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorTelegramId,
        action: 'DASHBOARD_SESSION_REVOKED',
        entityType: 'DashboardSession',
        entityId: sessionId,
        afterPayload: { reason },
      },
    });

    return { success: true };
  }

  /**
   * Get all currently active sessions for a user
   */
  async getActiveSessions(telegramId: bigint): Promise<DashboardSessionView[]> {
    const rawSessions = await prisma.dashboardSession.findMany({
      where: {
        actorTelegramId: telegramId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        expiresAt: true,
        extensionCount: true,
        originKind: true,
        deviceSummary: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return (rawSessions || []).map((s) => ({
      id: s.id,
      expiresAt: s.expiresAt,
      extensionCount: s.extensionCount,
      originKind: s.originKind === 'TUNNEL' ? 'TUNNEL' : 'LOCAL',
      deviceSummary: s.deviceSummary,
    }));
  }

  /**
   * Revoke all active sessions for a user
   */
  async revokeAllSessions(telegramId: bigint, reason: string = 'USER_REVOKED_ALL') {
    return prisma.dashboardSession.updateMany({
      where: {
        actorTelegramId: telegramId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revocationReason: reason,
      },
    });
  }
}

export const dashboardAuthService = new DashboardAuthService();
