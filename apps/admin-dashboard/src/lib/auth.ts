import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import type { DashboardUser } from './rbac';
import { canAccessDashboard, type CanonicalRole } from '@alsaada/rbac';
import { isValidOpaqueTokenFormat } from './session';
import { prisma } from '@alsaada/database';

export async function getCurrentUser(): Promise<DashboardUser>;
export async function getCurrentUser(opts: { nullable: true }): Promise<DashboardUser | null>;
export async function getCurrentUser(opts?: { nullable?: boolean }): Promise<DashboardUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('alsaada_session')?.value;

  if (!sessionCookie || !isValidOpaqueTokenFormat(sessionCookie)) {
    return null;
  }

  // Authoritative Database SSOT Verification (Opaque Token Hash)
  const sessionHash = crypto.createHash('sha256').update(sessionCookie.trim()).digest('hex');
  try {
    const dbSession = await prisma.dashboardSession.findUnique({
      where: { sessionHash },
      include: {
        user: {
          include: { assignedSite: true },
        },
      },
    });

    if (!dbSession) {
      return null;
    }

    const now = new Date();
    // Enforce revokedAt, individual expiresAt, and absolute maxExpiresAt
    if (
      dbSession.revokedAt ||
      dbSession.expiresAt <= now ||
      (dbSession.maxExpiresAt && dbSession.maxExpiresAt <= now)
    ) {
      return null;
    }

    const user = dbSession.user;
    if (!user || user.deletedAt || user.isDeleted || !user.isActive || user.isBanned) {
      return null;
    }

    if (!canAccessDashboard(user.role as CanonicalRole)) {
      return null;
    }

    return {
      id: user.id,
      telegramId: user.telegramId ? String(user.telegramId) : null,
      name: user.fullName,
      role: user.role as CanonicalRole,
      assignedSiteId: user.assignedSiteId,
      assignedSiteName: user.assignedSite?.name,
      isRealSuperAdmin: user.role === 'SUPER_ADMIN',
    };
  } catch (dbErr) {
    // Fail-Closed principle: any database failure immediately denies access
    console.error('[Fail-Closed] Database error verifying session in getCurrentUser:', dbErr);
    return null;
  }
}

