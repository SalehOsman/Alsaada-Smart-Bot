import type { Bot } from 'grammy';
import type { PrismaClient } from '@alsaada/database';
import type { WorkforceModuleContext } from './shared/module.types.js';
import { registerWorkforceRoutes } from './module.routes.js';
import { registerWorkforceHubRoutes } from './hub/hub.routes.js';
import { WorkerExpiryAlertService } from './services/worker-expiry-alert.service.js';
import { setWorkforcePrisma, setWorkforceEncryptionKey } from './services/worker-facade.service.js';

export interface WorkforceModuleOptions {
  prisma: PrismaClient;
  encryptionKey?: string;
  superAdminTelegramId?: bigint;
  autoStartExpiryAlerts?: boolean;
  onWorkerDemoted?: (demotedTelegramId: bigint) => Promise<void>;
}

export function registerWorkforceModule(
  bot: Bot<WorkforceModuleContext>,
  options: WorkforceModuleOptions
) {
  // Wire centralized prisma singleton and encryption key into workforce facade
  setWorkforcePrisma(options.prisma);
  if (options.encryptionKey) {
    setWorkforceEncryptionKey(options.encryptionKey);
  }

  const expiryAlertService = new WorkerExpiryAlertService({
    prisma: options.prisma,
    ...(options.encryptionKey ? { encryptionKey: options.encryptionKey } : {}),
    ...(options.superAdminTelegramId ? { superAdminTelegramId: options.superAdminTelegramId } : {}),
  });

  const routes = registerWorkforceRoutes(
    bot,
    options.prisma,
    options.encryptionKey,
    options.onWorkerDemoted
  );
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

  return { expiryAlertService, ...routes };
}

