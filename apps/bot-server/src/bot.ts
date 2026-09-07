import { Bot } from 'grammy';
import { MyContext } from './types/context.js';
import { config } from './config/env.js';
import { authMiddleware } from './middlewares/auth.middleware.js';
import { handleStart, renderRoleHome } from './handlers/start.handler.js';
import { handlePing } from './handlers/ping.handler.js';
import {
  handleSettings,
  handleGhostModeMenu,
  handleImpersonateRole,
  handleExitImpersonate,
  handleExitGhostCommand,
} from './handlers/settings.handler.js';
import { handleMenuPlaceholder } from './handlers/placeholder.handler.js';

export function createBot(): Bot<MyContext> {
  const token = config.botToken;
  if (!token || token === 'YOUR_NEW_BOT_TOKEN_HERE') {
    throw new Error('❌ [BOT FATAL] BOT_TOKEN is not set in .env. Please configure your bot token.');
  }

  const bot = new Bot<MyContext>(token);

  // 1. Error boundary
  bot.catch((err) => {
    console.error(`❌ [BOT ERROR] Error in update ${err.ctx?.update?.update_id}:`, err.error);
  });

  // 2. Authentication & Zero-Trust RBAC Middleware
  bot.use(authMiddleware);

  // 3. Base Commands
  bot.command('start', handleStart);
  bot.command(['ping', 'health', 'speed'], handlePing);
  bot.command(['settings', 'admin'], handleSettings);
  bot.command(['exit_ghost', 'exit_impersonate', 'exit_simulation'], handleExitGhostCommand);

  // 4. Navigation & Settings Callbacks
  bot.callbackQuery('action:main_menu', async (ctx) => {
    await ctx.answerCallbackQuery();
    await renderRoleHome(ctx, true);
  });
  bot.callbackQuery('menu:super_admin_settings', handleSettings);
  bot.callbackQuery('action:settings:ghost_mode', handleGhostModeMenu);
  bot.callbackQuery('action:settings:ping', handlePing);
  bot.callbackQuery('action:exit_impersonate', handleExitImpersonate);

  // 5. Dynamic Impersonation Callbacks (Regex)
  bot.callbackQuery(/^action:impersonate:(.+)$/, async (ctx) => {
    const role = ctx.match[1];
    await handleImpersonateRole(ctx, role);
  });

  // 6. Sub-Menu Placeholders (Catch-all for unbuilt domain buttons)
  bot.callbackQuery(/^menu:.+$/, handleMenuPlaceholder);

  return bot;
}

