import { NextFunction } from 'grammy';
import { MyContext } from '../types/context.js';
import { prisma } from '../db.js';
import { config } from '../config/env.js';
import { getImpersonatedRole } from '../redis.js';

export async function authMiddleware(ctx: MyContext, next: NextFunction): Promise<void> {
  const from = ctx.from;
  if (!from) {
    return next();
  }

  const telegramId = BigInt(from.id);
  const isSuperAdminEnv = config.superAdminTelegramId > 0n && telegramId === config.superAdminTelegramId;
  ctx.isRealSuperAdmin = isSuperAdminEnv;

  try {
    let user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      // Auto-provision Super Admin if ID matches SUPER_ADMIN_TELEGRAM_ID
      const initialRole = isSuperAdminEnv ? 'SUPER_ADMIN' : 'GUEST';
      user = await prisma.user.create({
        data: {
          telegramId,
          username: from.username || null,
          fullName: [from.first_name, from.last_name].filter(Boolean).join(' ') || 'مستخدم جديد',
          role: initialRole,
          isActive: isSuperAdminEnv ? true : false,
        },
      });
      console.log(`👤 [AUTH] New user provisioned: ${user.fullName} (${user.telegramId}) as ${user.role}`);
    } else if (isSuperAdminEnv && user.role !== 'SUPER_ADMIN') {
      user = await prisma.user.update({
        where: { telegramId },
        data: { role: 'SUPER_ADMIN', isActive: true },
      });
    }

    ctx.dbUser = user;

    // Check for active impersonation mode if user is Super Admin
    if (isSuperAdminEnv) {
      const impRole = await getImpersonatedRole(telegramId);
      if (impRole) {
        ctx.effectiveRole = impRole;
        ctx.isImpersonating = true;
      } else {
        ctx.effectiveRole = 'SUPER_ADMIN';
        ctx.isImpersonating = false;
      }
    } else {
      ctx.effectiveRole = user.role || 'GUEST';
      ctx.isImpersonating = false;
    }
  } catch (error) {
    console.error('❌ [AUTH ERROR] Failed to authenticate user in database:', error);
    ctx.effectiveRole = isSuperAdminEnv ? 'SUPER_ADMIN' : 'GUEST';
    ctx.isImpersonating = false;
  }

  return next();
}

