import type { Bot } from 'grammy';
import type { PrismaClient } from '@alsaada/database';
import type { WorkforceModuleContext } from '../shared/module.types.js';
import { shouldRenderInPlace } from '@alsaada/core-components';
import { HrHubHandler } from './hr-hub.handler.js';
import {
  handleSwitchToWorker,
  handleSwitchToFieldAdmin,
  handleSwitchRoleCommand,
} from './identity-switch.handler.js';

export function registerWorkforceHubRoutes(
  bot: Bot<WorkforceModuleContext>,
  prisma: PrismaClient
): void {
  const hrHubHandler = new HrHubHandler(prisma);

  // HR Hub Domain Navigation
  bot.callbackQuery('menu:domain:hr', async (ctx) => {
    const inPlace = await shouldRenderInPlace(ctx, true);
    await hrHubHandler.renderHrHub(ctx, inPlace);
  });

  bot.callbackQuery(/^menu:hr_sub:(.+)$/, async (ctx) => {
    const subKey = ctx.match[1]!;
    const inPlace = await shouldRenderInPlace(ctx, true);
    await hrHubHandler.renderHrSubHub(ctx, subKey, inPlace);
  });

  bot.callbackQuery(
    /^(?:action:advances:|action:leaves:|action:payroll:|action:admin_affairs:)/,
    async (ctx) => {
      await hrHubHandler.handleHrPlaceholder(ctx);
    }
  );

  // Identity Switch (Field Admin <-> Worker Dual Mode)
  bot.callbackQuery('action:switch_identity:worker', async (ctx) => {
    await handleSwitchToWorker(ctx);
  });

  bot.callbackQuery('action:switch_identity:field_admin', async (ctx) => {
    await handleSwitchToFieldAdmin(ctx);
  });

  bot.command(['switch_role', 'switch_mode'], handleSwitchRoleCommand);
}
