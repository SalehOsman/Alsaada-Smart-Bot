import { redis } from '../redis.js';
import { invalidateUserCache } from '../middlewares/auth.middleware.js';
import { prisma } from '../db.js';

export interface RbacSyncMessage {
  scopeType: 'ROLE' | 'DEPARTMENT' | 'JOB_TITLE' | 'SITE' | 'USER';
  scopeId: string;
  affectedUserIds?: string[];
  timestamp: number;
}

export const RBAC_SYNC_CHANNEL = 'channel:rbac:sync';

/**
 * Listens for targeted RBAC changes published by Dashboard or Bot
 * and invalidates ONLY the affected users' L1/L2 Redis caches (< 5ms latency).
 */
export function initializeRbacSyncListener(): void {
  if (!redis) {
    console.warn('⚠️ [RBAC SYNC] Redis not connected. Pub/Sub listener skipped.');
    return;
  }

  const subscriber = redis.duplicate();

  subscriber.subscribe(RBAC_SYNC_CHANNEL, (err) => {
    if (err) {
      console.error('❌ [RBAC SYNC] Failed to subscribe to channel:', err.message);
      return;
    }
    console.log(`📡 [RBAC SYNC] Subscribed to ${RBAC_SYNC_CHANNEL} for real-time permissions invalidation.`);
  });

  subscriber.on('message', async (channel, message) => {
    if (channel !== RBAC_SYNC_CHANNEL) return;

    try {
      const payload: RbacSyncMessage = JSON.parse(message);
      console.log(`⚡ [RBAC SYNC] Received permission change for scope [${payload.scopeType}:${payload.scopeId}]`);

      // 1. Direct user invalidation if affectedUserIds provided
      if (payload.affectedUserIds && payload.affectedUserIds.length > 0) {
        const users = await prisma.user.findMany({
          where: { id: { in: payload.affectedUserIds } },
          select: { telegramId: true },
        });

        for (const user of users) {
          await invalidateUserCache(user.telegramId);
        }
        console.log(`✅ [RBAC SYNC] Invalidated cache for ${users.length} direct user(s).`);
        return;
      }

      // 2. Targeted scope invalidation
      if (payload.scopeType === 'USER') {
        const user = await prisma.user.findUnique({
          where: { id: payload.scopeId },
          select: { telegramId: true },
        });
        if (user) {
          await invalidateUserCache(user.telegramId);
        }
      } else if (payload.scopeType === 'SITE') {
        const siteUsers = await prisma.user.findMany({
          where: { assignedSiteId: payload.scopeId },
          select: { telegramId: true },
        });
        for (const user of siteUsers) {
          await invalidateUserCache(user.telegramId);
        }
      } else if (payload.scopeType === 'ROLE') {
        const roleUsers = await prisma.user.findMany({
          where: { role: payload.scopeId },
          select: { telegramId: true },
        });
        for (const user of roleUsers) {
          await invalidateUserCache(user.telegramId);
        }
      }
    } catch (err: any) {
      console.error('❌ [RBAC SYNC] Error processing sync message:', err.message);
    }
  });
}
