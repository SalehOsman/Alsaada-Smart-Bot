import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import type { DashboardUser } from './rbac';
import { canAccessDashboard, type CanonicalRole } from '@alsaada/rbac';
import { DEMO_USERS } from './users';
import { verifySessionToken } from './session';
import { prisma } from '@alsaada/database';

export { DEMO_USERS };

export async function getCurrentUser(): Promise<DashboardUser>;
export async function getCurrentUser(opts: { nullable: true }): Promise<DashboardUser | null>;
export async function getCurrentUser(opts?: { nullable?: boolean }): Promise<DashboardUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('alsaada_session')?.value;
  const roleCookie = cookieStore.get('alsaada_admin_role')?.value;

  // 1. Resolve authenticated user from cryptographic session token
  if (!sessionCookie) {
    return null;
  }

  const payload = await verifySessionToken(sessionCookie);
  if (!payload) {
    return null;
  }

  // 2. Database session validity check
  if (payload.sessionId) {
    try {
      const sessionHash = crypto.createHash('sha256').update(payload.sessionId).digest('hex');
      const dbSession = await prisma.dashboardSession.findUnique({
        where: { sessionHash },
      });

      if (!dbSession || dbSession.revokedAt || dbSession.expiresAt < new Date()) {
        return null;
      }
    } catch {
      // In case DB is temporarily unreachable, proceed with token verification
    }
  }

  // 3. Role simulator support ONLY for authenticated Super Admin
  if (roleCookie && DEMO_USERS[roleCookie]) {
    if (payload.role === 'SUPER_ADMIN' || payload.isRealSuperAdmin) {
      return DEMO_USERS[roleCookie];
    }
  }

  // 4. Resolve user from database & verify RBAC access
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { assignedSite: true },
    });

    if (dbUser && !dbUser.deletedAt && dbUser.isActive && !dbUser.isBanned) {
      if (!canAccessDashboard(dbUser.role as CanonicalRole)) {
        return null;
      }

      return {
        id: dbUser.id,
        telegramId: dbUser.telegramId ? String(dbUser.telegramId) : null,
        name: dbUser.fullName,
        role: dbUser.role as CanonicalRole,
        assignedSiteId: dbUser.assignedSiteId,
        assignedSiteName: dbUser.assignedSite?.name,
        isRealSuperAdmin: dbUser.role === 'SUPER_ADMIN',
      };
    }
  } catch {
    // Database query failed
  }

  if (!canAccessDashboard(payload.role as CanonicalRole)) {
    return null;
  }

  return {
    id: payload.userId,
    telegramId: payload.telegramId,
    name: payload.name,
    role: payload.role as CanonicalRole,
    assignedSiteId: payload.assignedSiteId,
    assignedSiteName: payload.assignedSiteName,
    isRealSuperAdmin: payload.isRealSuperAdmin ?? (payload.role === 'SUPER_ADMIN'),
  };
}
