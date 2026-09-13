import crypto from 'node:crypto';
import { prisma } from '../db.js';
import { config } from '../config/env.js';
import { redis } from '../redis.js';
import { TelemetryLogger } from '@alsaada/telemetry';
import {
  canAccessDashboard,
  DASHBOARD_AUTHORIZED_ROLES,
  normalizeOrigin,
  type CanonicalRole,
} from '@alsaada/rbac';

const logger = new TelemetryLogger({
  service: 'bot-server',
  defaultComponent: 'dashboard-auth-service',
});

export const AUTHORIZED_DASHBOARD_ROLES = DASHBOARD_AUTHORIZED_ROLES;
export type AuthorizedDashboardRole = (typeof DASHBOARD_AUTHORIZED_ROLES)[number];


export type DashboardAccessRejectionReason =
  | 'USER_NOT_FOUND'
  | 'ACCOUNT_INACTIVE'
  | 'ACCOUNT_BANNED'
  | 'UNAUTHORIZED_ROLE'
  | 'MAX_CONCURRENT_SESSIONS_REACHED';

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
  }>;
}

export type IssueDualDashboardAccessResult =
  | IssueDualDashboardAccessSuccess
  | IssueDashboardAccessDenied;

export class DashboardAuthService {
  /**
   * Check user status, verify authorization against @alsaada/rbac CANONICAL_ROLES,
   * issue concurrent local and tunnel 5-minute single-use tokens stored in dashboard_auth_links,
   * and record audit logs.
   */
  async issueDualDashboardAccess(
    input: IssueDashboardAccessInput
  ): Promise<IssueDualDashboardAccessResult> {
    const { telegramId, username, firstName, lastName, chatType = 'private' } = input;
    const traceId = crypto.randomUUID();

    // 1. Query user from database with assignedSite relation
    let user = await prisma.user.findFirst({
      where: { telegramId, isDeleted: false },
      include: { assignedSite: true },
    });

    // Support SuperAdmin auto-upsert if configured via env
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

    // 2. Authorization and status checks using @alsaada/rbac
    const isAuthorizedRole = user && canAccessDashboard(user.role as CanonicalRole);
    const isAccountActive = user && user.isActive && !user.isBanned;

    if (!user || !isAuthorizedRole || !isAccountActive) {
      const reason: DashboardAccessRejectionReason = !user
        ? 'USER_NOT_FOUND'
        : !user.isActive
        ? 'ACCOUNT_INACTIVE'
        : user.isBanned
        ? 'ACCOUNT_BANNED'
        : 'UNAUTHORIZED_ROLE';

      // Log access denial to AuditLog
      try {
        await prisma.auditLog.create({
          data: {
            traceId,
            actorTelegramId: telegramId,
            action: 'DASHBOARD_ACCESS_DENIED',
            entityType: 'DashboardAuth',
            entityId: user?.id || String(telegramId),
            beforePayload: {
              username: username || null,
              fullName: [firstName, lastName].filter(Boolean).join(' ') || null,
              chatType,
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
        telegramId,
      };
    }

    // 2.1 Check active sessions limit (Strict ceiling <= 3 concurrent sessions)
    const activeSessions = await prisma.dashboardSession.findMany({
      where: {
        actorTelegramId: user.telegramId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (activeSessions.length >= 3) {
      try {
        await prisma.auditLog.create({
          data: {
            traceId,
            actorTelegramId: telegramId,
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
        success: false,
        reason: 'MAX_CONCURRENT_SESSIONS_REACHED',
        user: {
          id: user.id,
          telegramId: user.telegramId,
          fullName: user.fullName,
          role: user.role,
          isActive: user.isActive,
          isBanned: user.isBanned,
        },
        telegramId,
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

    // 3. Generate shared groupId and two distinct cryptographically random 32-byte hex tokens
    const groupId = crypto.randomUUID();
    const localToken = crypto.randomBytes(32).toString('hex');
    const tunnelToken = crypto.randomBytes(32).toString('hex');

    const localHash = crypto.createHash('sha256').update(localToken).digest('hex');
    const tunnelHash = crypto.createHash('sha256').update(tunnelToken).digest('hex');

    const ttlMinutes = config.dashboardAuthLinkTtlMinutes || 5;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const localBase = normalizeOrigin(config.dashboardLocalUrl || 'http://localhost:3002');
    const tunnelBase = normalizeOrigin(config.dashboardTunnelUrl || localBase);

    // 4. Save both auth links into dashboard_auth_links table with shared groupId
    await prisma.$transaction([
      prisma.dashboardAuthLink.create({
        data: {
          groupId,
          originKind: 'LOCAL',
          targetOrigin: localBase,
          jtiHash: localHash,
          actorTelegramId: user.telegramId,
          expiresAt,
        },
      }),
      prisma.dashboardAuthLink.create({
        data: {
          groupId,
          originKind: 'TUNNEL',
          targetOrigin: tunnelBase,
          jtiHash: tunnelHash,
          actorTelegramId: user.telegramId,
          expiresAt,
        },
      }),
    ]);

    // 5. Construct direct URLs
    const localUrl = `${localBase}/api/auth/claim?token=${localToken}`;
    const tunnelUrl = `${tunnelBase}/api/auth/claim?token=${tunnelToken}`;

    // 6. Log issuance to AuditLog
    try {
      await prisma.auditLog.create({
        data: {
          traceId,
          actorTelegramId: telegramId,
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
      logger.warn('Failed to log dual links issuance audit record', {
        traceId,
        error: err,
      });
    }

    // 7. Cache in Redis if connected
    if (redis && redis.status === 'ready') {
      await redis.set(`auth_link:${localHash}`, user.id, 'EX', ttlMinutes * 60).catch(() => {});
      await redis.set(`auth_link:${tunnelHash}`, user.id, 'EX', ttlMinutes * 60).catch(() => {});
      await redis.set(`magic_token:${localHash}:issued`, user.id, 'EX', ttlMinutes * 60).catch(() => {});
    }

    return {
      success: true,
      user: {
        id: user.id,
        telegramId: user.telegramId,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
        isBanned: user.isBanned,
        assignedSiteId: user.assignedSiteId || null,
        assignedSiteName: user.assignedSite?.name || null,
      },
      groupId,
      localToken,
      tunnelToken,
      localUrl,
      tunnelUrl,
      token: localToken,
      magicUrl: localUrl,
      jti: localHash,
      expiresInMinutes: ttlMinutes,
      expiresAt: Math.floor(expiresAt.getTime() / 1000),
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
  async getActiveSessions(telegramId: bigint) {
    return prisma.dashboardSession.findMany({
      where: {
        actorTelegramId: telegramId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
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
