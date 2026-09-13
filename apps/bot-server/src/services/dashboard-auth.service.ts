import crypto from 'node:crypto';
import { prisma } from '../db.js';
import { config } from '../config/env.js';
import { redis } from '../redis.js';
import { TelemetryLogger } from '@alsaada/telemetry';
import {
  canAccessDashboard,
  DASHBOARD_AUTHORIZED_ROLES,
  type CanonicalRole,
} from '@alsaada/rbac';

const logger = new TelemetryLogger({
  service: 'bot-server',
  defaultComponent: 'dashboard-auth-service',
});

export const AUTHORIZED_DASHBOARD_ROLES = DASHBOARD_AUTHORIZED_ROLES;
export type AuthorizedDashboardRole = (typeof DASHBOARD_AUTHORIZED_ROLES)[number];

export interface MagicTokenPayload {
  userId: string;
  telegramId: string;
  role: string;
  name: string;
  assignedSiteId: string | null;
  assignedSiteName: string | null;
  jti: string;
  iat: number;
  exp: number;
}

/**
 * Generate a cryptographically signed HMAC-SHA256 Magic Token
 * Format: ${base64url(payload)}.${hmacSignature}
 */
export function generateMagicToken(
  payload: MagicTokenPayload,
  botToken: string = config.botToken
): string {
  const dataB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', botToken).update(dataB64).digest('base64url');
  return `${dataB64}.${signature}`;
}

/**
 * Verify and decode an HMAC-SHA256 Magic Token
 */
export function verifyMagicToken(
  token: string,
  botToken: string = config.botToken
): { valid: boolean; payload?: MagicTokenPayload; error?: string } {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'INVALID_TOKEN_FORMAT' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'INVALID_TOKEN_FORMAT' };
  }

  const dataB64 = parts[0];
  const providedSig = parts[1];
  if (!dataB64 || !providedSig) {
    return { valid: false, error: 'INVALID_TOKEN_FORMAT' };
  }

  const expectedSig = crypto.createHmac('sha256', botToken).update(dataB64).digest('base64url');
  const providedSigBuf = Buffer.from(providedSig, 'utf8');
  const expectedSigBuf = Buffer.from(expectedSig, 'utf8');

  if (
    providedSigBuf.length !== expectedSigBuf.length ||
    !crypto.timingSafeEqual(providedSigBuf, expectedSigBuf)
  ) {
    return { valid: false, error: 'SIGNATURE_MISMATCH' };
  }

  try {
    const rawJson = Buffer.from(dataB64, 'base64url').toString('utf8');
    const payload = JSON.parse(rawJson) as MagicTokenPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) {
      return { valid: false, payload, error: 'TOKEN_EXPIRED' };
    }
    return { valid: true, payload };
  } catch {
    return { valid: false, error: 'MALFORMED_PAYLOAD' };
  }
}

export type DashboardAccessRejectionReason =
  | 'USER_NOT_FOUND'
  | 'ACCOUNT_INACTIVE'
  | 'ACCOUNT_BANNED'
  | 'UNAUTHORIZED_ROLE';

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

    // 3. Generate two distinct cryptographically random 32-byte hex tokens
    const localToken = crypto.randomBytes(32).toString('hex');
    const tunnelToken = crypto.randomBytes(32).toString('hex');

    const localHash = crypto.createHash('sha256').update(localToken).digest('hex');
    const tunnelHash = crypto.createHash('sha256').update(tunnelToken).digest('hex');

    const ttlMinutes = config.dashboardAuthLinkTtlMinutes || 5;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    // 4. Save both auth links into dashboard_auth_links table
    await prisma.$transaction([
      prisma.dashboardAuthLink.create({
        data: {
          jtiHash: localHash,
          actorTelegramId: user.telegramId,
          targetOrigin: 'LOCAL',
          expiresAt,
        },
      }),
      prisma.dashboardAuthLink.create({
        data: {
          jtiHash: tunnelHash,
          actorTelegramId: user.telegramId,
          targetOrigin: 'TUNNEL',
          expiresAt,
        },
      }),
    ]);

    // 5. Construct direct URLs
    const localBase = config.dashboardLocalUrl || 'http://localhost:3002';
    const tunnelBase = config.dashboardTunnelUrl || localBase;

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
  ): Promise<{ success: boolean; newExpiresAt?: Date; reason?: string }> {
    const session = await prisma.dashboardSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.revokedAt) {
      return { success: false, reason: 'SESSION_NOT_FOUND_OR_REVOKED' };
    }

    const isOwner = session.actorTelegramId === actorTelegramId;
    const isSuper = config.superAdminTelegramId === actorTelegramId;
    if (!isOwner && !isSuper) {
      return { success: false, reason: 'UNAUTHORIZED' };
    }

    const extensionHours = config.dashboardSessionExtensionHours || 8;
    const newExpiresAt = new Date(Date.now() + extensionHours * 3600 * 1000);

    await prisma.dashboardSession.update({
      where: { id: sessionId },
      data: {
        expiresAt: newExpiresAt,
        noticeSentAt: null,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorTelegramId,
        action: 'DASHBOARD_SESSION_EXTENDED',
        entityType: 'DashboardSession',
        entityId: sessionId,
        afterPayload: {
          newExpiresAt: newExpiresAt.toISOString(),
          extendedHours: extensionHours,
        },
      },
    });

    return { success: true, newExpiresAt };
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
