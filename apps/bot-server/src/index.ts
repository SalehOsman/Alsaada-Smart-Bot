import dns from 'node:dns';

// Fix for Egyptian ISP IPv6 routing blackhole: prioritize IPv4 to eliminate 1.5s - 3s DNS timeouts
dns.setDefaultResultOrder('ipv4first');

import { run } from '@grammyjs/runner';
import { connectDatabase, disconnectDatabase } from './db.js';
import { createBot } from './bot.js';
import { config } from './config/env.js';

async function bootstrap() {
  console.log('================================================================');
  console.log('🚀 Al-Saada Enterprise Engine v2.0 Starting...');
  console.log(`🌐 Node Environment: ${config.nodeEnv}`);
  console.log(`🔌 HTTP Port: ${config.port}`);
  console.log('================================================================');

  // 1. Connect to PostgreSQL
  try {
    await connectDatabase();
  } catch (error) {
    console.error('❌ [FATAL] Failed to connect to PostgreSQL database:', error);
    process.exit(1);
  }

  // 2. Validate Telegram Bot Credentials
  if (!config.botToken || config.botToken === 'YOUR_NEW_BOT_TOKEN_HERE') {
    console.warn('\n================================================================');
    console.warn('⚠️ [ACTION REQUIRED] BOT_TOKEN is not yet set in .env!');
    console.warn('Please open F:\\Alsaada-Smart-Bot\\.env and paste your bot token');
    console.warn('and SUPER_ADMIN_TELEGRAM_ID to activate the Telegram listener.');
    console.warn('================================================================\n');

    // Keep process alive to service database healthcheck
    const keepAliveInterval = setInterval(() => {}, 60000);
    process.on('SIGINT', () => {
      clearInterval(keepAliveInterval);
      disconnectDatabase().then(() => process.exit(0));
    });
    return;
  }

  // 3. Initialize & Start Telegram Bot
  try {
    const bot = createBot();
    const runner = run(bot, {
      runner: {
        fetch: {
          allowed_updates: ['message', 'callback_query'],
          timeout: 30,
        },
      },
    });

    console.log('🤖 [TELEGRAM] Bot runner started successfully with Long Polling.');
    console.log(`👑 [AUTH] Designated Super Admin ID: ${config.superAdminTelegramId}`);

    const shutdown = async () => {
      console.log('\n🛑 [SHUTDOWN] Received termination signal. Stopping bot...');
      if (runner.isRunning()) {
        await runner.stop();
      }
      await disconnectDatabase();
      console.log('✅ [SHUTDOWN] Clean exit completed.');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('❌ [BOT FATAL] Error initializing Telegram Bot:', error);
    process.exit(1);
  }
}

bootstrap();
