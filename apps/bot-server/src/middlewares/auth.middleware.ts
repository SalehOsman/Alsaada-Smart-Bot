import { NextFunction } from 'grammy';
import { MyContext } from '../types/context.js';
import { prisma } from '../db.js';
import { config } from '../config/env.js';
import { redis, getImpersonatedRole, getImpersonatedEntity, getAdminDualMode } from '../redis.js';
import { fastCache } from '../services/fast-cache.service.js';

export const USER_CACHE_PREFIX = 'cache:user:';

export async function invalidateUserCache(telegramId: bigint): Promise<void> {
  try {
    await fastCache.invalidateUserContext(telegramId);
    await fastCache.invalidate(`auth:user:${telegramId}`);
    await fastCache.invalidate(`auth:imp:${telegramId}`);
    await fastCache.invalidate(`auth:ent:${telegramId}`);
    await fastCache.invalidate(`auth:dual:${telegramId}`);
    if (!redis.status || redis.status === 'ready') {
      await redis.del(`${USER_CACHE_PREFIX}${telegramId}`);
    }
  } catch {}
}


async function resolveDefaultFieldAdminSiteId(): Promise<string | null> {
  return fastCache.rememberSWR('system:default_field_admin_site', 300, async () => {
    let activeSite = await prisma.site.findFirst({
      where: { status: 'ACTIVE', workers: { some: { isDeleted: false } } },
      select: { id: true },
    });
    if (!activeSite) {
      activeSite = await prisma.site.findFirst({
        where: { status: 'ACTIVE' },
        select: { id: true },
      });
    }
    return activeSite?.id ?? null;
  });
}

export async function authMiddleware(ctx: MyContext, next: NextFunction): Promise<void> {
  const from = ctx.from;
  if (!from) {
    return next();
  }

  const telegramId = BigInt(from.id);
  const isSuperAdminEnv = config.superAdminTelegramId > 0n && telegramId === config.superAdminTelegramId;
  ctx.isRealSuperAdmin = isSuperAdminEnv;

  try {
    // ⚡ L1 IN-MEMORY RAM AUTH LOOKUP (< 0.01ms) with SWR background revalidation (TTL: 60s)
    const user = await fastCache.rememberUserContext(telegramId, async () => {
      let dbUser = await prisma.user.findUnique({
        where: { telegramId },
      });

      if (!dbUser) {
        // Auto-provision Super Admin if ID matches SUPER_ADMIN_TELEGRAM_ID
        const initialRole = isSuperAdminEnv ? 'SUPER_ADMIN' : 'GUEST';
        dbUser = await prisma.user.create({
          data: {
            telegramId,
            username: from.username || null,
            fullName: [from.first_name, from.last_name].filter(Boolean).join(' ') || 'مستخدم جديد',
            role: initialRole,
            isActive: isSuperAdminEnv ? true : false,
          },
        });
        console.log(`👤 [AUTH] New user provisioned: ${dbUser.fullName} (${dbUser.telegramId}) as ${dbUser.role}`);
      } else if (isSuperAdminEnv && dbUser.role !== 'SUPER_ADMIN') {
        dbUser = await prisma.user.update({
          where: { telegramId },
          data: { role: 'SUPER_ADMIN', isActive: true },
        });
      }

      return dbUser;
    });

    ctx.dbUser = user;

    // Check for active impersonation mode if user is Super Admin (< 0.1ms via L1 cache)
    if (isSuperAdminEnv) {
      const impRole = await fastCache.rememberSWR(`auth:imp:${telegramId}`, 120, async () => {
        return getImpersonatedRole(telegramId);
      });
      if (impRole) {
        ctx.effectiveRole = impRole;
        ctx.isImpersonating = true;
        const impEntity = await fastCache.rememberSWR(`auth:ent:${telegramId}`, 120, async () => {
          return getImpersonatedEntity(telegramId);
        });
        if (impEntity) {
          ctx.impersonatedEntity = impEntity;
          if (impEntity.type === 'WORKER') {
            ctx.workerId = impEntity.id;
            if (impEntity.code) ctx.workerCode = impEntity.code;
            if (impEntity.siteId) ctx.assignedSiteId = impEntity.siteId;
          } else if (impEntity.type === 'SITE') {
            if (impEntity.siteId) ctx.assignedSiteId = impEntity.siteId;
          }
        }
        if (ctx.effectiveRole === 'FIELD_ADMIN' && !ctx.assignedSiteId) {
          const defaultSiteId = await resolveDefaultFieldAdminSiteId();
          if (defaultSiteId) ctx.assignedSiteId = defaultSiteId;
        }
      } else {
        ctx.effectiveRole = 'SUPER_ADMIN';
        ctx.isImpersonating = false;
      }
    } else {
      if (user && !user.isActive) {
        ctx.effectiveRole = 'GUEST';
      } else {
        ctx.effectiveRole = user?.role || 'GUEST';
        if (user?.assignedSiteId) {
          ctx.assignedSiteId = user.assignedSiteId;
        }
        if (user?.workerId) {
          ctx.workerId = user.workerId;
        }
        if (ctx.effectiveRole === 'FIELD_ADMIN' && !ctx.assignedSiteId) {
          const defaultSiteId = await resolveDefaultFieldAdminSiteId();
          if (defaultSiteId) ctx.assignedSiteId = defaultSiteId;
        }
      }
      ctx.isImpersonating = false;
    }

    // Check for active dual mode if user is FIELD_ADMIN (or impersonating FIELD_ADMIN)
    if (ctx.effectiveRole === 'FIELD_ADMIN') {
      const isDual = await fastCache.rememberSWR(`auth:dual:${telegramId}`, 120, async () => {
        return getAdminDualMode(telegramId);
      });
      if (isDual) {
        ctx.effectiveRole = 'WORKER';
        ctx.isDualWorkerMode = true;
      } else {
        ctx.isDualWorkerMode = false;
      }
    } else {
      ctx.isDualWorkerMode = false;
    }
  } catch (error) {
    console.error('❌ [AUTH ERROR] Failed to authenticate user in database:', error);
    ctx.effectiveRole = isSuperAdminEnv ? 'SUPER_ADMIN' : 'GUEST';
    ctx.isImpersonating = false;
    ctx.isDualWorkerMode = false;
  }

  return next();
}
