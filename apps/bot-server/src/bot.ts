import { Bot } from 'grammy';
import { MyContext } from './types/context.js';
import { config } from './config/env.js';
import { authMiddleware } from './middlewares/auth.middleware.js';
import { handleStart } from './handlers/start.handler.js';
import { handlePing } from './handlers/ping.handler.js';

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

  return bot;
}
