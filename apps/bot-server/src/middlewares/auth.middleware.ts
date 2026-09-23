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

      const currentFullName = [from.first_name, from.last_name].filter(Boolean).join(' ') || (isSuperAdminEnv ? 'مدير عام المنظومة' : 'مستخدم جديد');
      const currentUsername = from.username || null;

      if (!dbUser) {
        // Auto-provision Super Admin dynamically on first use if ID matches SUPER_ADMIN_TELEGRAM_ID
        const initialRole = isSuperAdminEnv ? 'SUPER_ADMIN' : 'GUEST';
        dbUser = await prisma.user.create({
          data: {
            telegramId,
            username: currentUsername,
            fullName: currentFullName,
            role: initialRole,
            isActive: isSuperAdminEnv ? true : false,
          },
        });
        console.log(`👤 [AUTH] New user provisioned: ${dbUser.fullName} (${dbUser.telegramId}) as ${dbUser.role}`);
      } else if (isSuperAdminEnv) {
        // Ensure Super Admin remains active and update latest profile data from Telegram on first/subsequent use
        const needsUpdate =
          dbUser.role !== 'SUPER_ADMIN' ||
          !dbUser.isActive ||
          (currentUsername && dbUser.username !== currentUsername) ||
          (currentFullName !== 'مدير عام المنظومة' && dbUser.fullName !== currentFullName);

        if (needsUpdate) {
          dbUser = await prisma.user.update({
            where: { telegramId },
            data: {
              role: 'SUPER_ADMIN',
              isActive: true,
              ...(currentUsername ? { username: currentUsername } : {}),
              ...(currentFullName ? { fullName: currentFullName } : {}),
            },
          });
          console.log(`👤 [AUTH] Super Admin profile updated on access: ${dbUser.fullName} (${dbUser.telegramId})`);
        }
      }

      return dbUser;
    });

    ctx.dbUser = user;

    // Check if real company profile is set up or needs initial setup
    if (isSuperAdminEnv) {
      const isCompanyCustomized = await fastCache.rememberSWR('auth:company_setup_verified', 300, async () => {
        try {
          const profile = await prisma.companyProfile.findFirst({
            select: { tradeName: true, legalName: true },
          });
          return Boolean(
            profile &&
            profile.tradeName &&
            profile.tradeName !== 'المنظومة الذكية' &&
            profile.legalName !== 'المنظومة المؤسسية'
          );
        } catch {
          return true;
        }
      });
      ctx.needsInitialSetup = !isCompanyCustomized;
    }

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
      } else {
        ctx.effectiveRole = 'SUPER_ADMIN';
        ctx.isImpersonating = false;
      }
    } else {
      if (user && (!user.isActive || user.isBanned)) {
        ctx.effectiveRole = 'GUEST';
        ctx.isBanned = Boolean(user.isBanned);
      } else {
        ctx.effectiveRole = user?.role || 'GUEST';
        ctx.isBanned = false;
        if (user?.assignedSiteId) {
          ctx.assignedSiteId = user.assignedSiteId;
        }
        if (user?.workerId) {
          ctx.workerId = user.workerId;
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

  if (ctx.isBanned) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({
        text: '⛔ تم تعليق حسابك من قِبل إدارة المنظومة. يرجى مراجعة المسؤول المباشر.',
        show_alert: true,
      }).catch(() => {});
    } else {
      await ctx.reply('⛔ *تم تعليق حسابك من قِبل إدارة المنظومة.*\nيرجى مراجعة المسؤول المباشر.', {
        parse_mode: 'Markdown',
      }).catch(() => {});
    }
    return; // إيقاف تمرير الطلب نهائياً
  }

  return next();
}
