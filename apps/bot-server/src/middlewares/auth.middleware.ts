import { NextFunction } from 'grammy';
import { MyContext } from '../types/context.js';
import { prisma } from '../db.js';
import { config } from '../config/env.js';

export async function authMiddleware(ctx: MyContext, next: NextFunction): Promise<void> {
  const from = ctx.from;
  if (!from) {
    return next();
  }

  const telegramId = BigInt(from.id);
  const isSuperAdminEnv = config.superAdminTelegramId > 0n && telegramId === config.superAdminTelegramId;

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
  } catch (error) {
    console.error('❌ [AUTH ERROR] Failed to authenticate user in database:', error);
  }

  return next();
}
