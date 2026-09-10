import type { Bot } from 'grammy';
import type { PrismaClient } from '@alsaada/database';
import type { WorkforceModuleContext } from './shared/module.types.js';
import { registerWorkforceRoutes } from './module.routes.js';
import { registerWorkforceHubRoutes } from './hub/hub.routes.js';
import { WorkerExpiryAlertService } from './services/worker-expiry-alert.service.js';

export interface WorkforceModuleOptions {
  prisma: PrismaClient;
  encryptionKey?: string;
  superAdminTelegramId?: bigint;
  autoStartExpiryAlerts?: boolean;
}

export function registerWorkforceModule(
  bot: Bot<WorkforceModuleContext>,
  options: WorkforceModuleOptions
): {
  expiryAlertService: WorkerExpiryAlertService;
} {
  const expiryAlertService = new WorkerExpiryAlertService({
    prisma: options.prisma,
    ...(options.encryptionKey ? { encryptionKey: options.encryptionKey } : {}),
    ...(options.superAdminTelegramId ? { superAdminTelegramId: options.superAdminTelegramId } : {}),
  });

  registerWorkforceRoutes(bot, options.prisma, options.encryptionKey);
  registerWorkforceHubRoutes(bot, options.prisma);

  if (options.autoStartExpiryAlerts !== false) {
    setTimeout(() => {
      expiryAlertService.checkAndDispatchExpiryAlerts(bot.api).catch((err) => {
        console.warn('⚠️ Expiry alert startup check failed:', err);
      });
    }, 10000);
    setInterval(() => {
      expiryAlertService.checkAndDispatchExpiryAlerts(bot.api).catch((err) => {
        console.warn('⚠️ Daily expiry alert scheduler failed:', err);
      });
    }, 24 * 60 * 60 * 1000);
  }

  return { expiryAlertService };
}

