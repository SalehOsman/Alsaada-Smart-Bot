import type { Bot } from 'grammy';
import type { PrismaClient } from '@alsaada/database';
import type { WorkforceModuleContext } from './shared/module.types.js';
import { registerWorkforceRoutes } from './module.routes.js';

export interface WorkforceModuleOptions {
  prisma: PrismaClient;
  encryptionKey?: string;
}

export function registerWorkforceModule(
  bot: Bot<WorkforceModuleContext>,
  options: WorkforceModuleOptions
): void {
  registerWorkforceRoutes(bot, options.prisma, options.encryptionKey);
}
