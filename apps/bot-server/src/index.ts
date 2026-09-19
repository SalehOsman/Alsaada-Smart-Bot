import dns from 'node:dns';
import http from 'node:http';

// Fix for Egyptian ISP IPv6 routing blackhole: prioritize IPv4 to eliminate 1.5s - 3s DNS timeouts
dns.setDefaultResultOrder('ipv4first');

import { run } from '@grammyjs/runner';
import { connectDatabase, disconnectDatabase } from './db.js';
import { createBot } from './bot.js';
import { config, validateStartupEnv } from './config/env.js';
import { systemDataService } from './services/system-data.service.js';
import { sessionMonitorService } from './services/session-monitor.service.js';
import { initializeRbacSyncListener } from './services/rbac-sync-listener.js';

async function bootstrap() {
  console.log('================================================================');
  console.log('🚀 Al-Saada Enterprise Engine v2.0 Starting...');
  console.log(`🌐 Node Environment: ${config.nodeEnv}`);
  console.log(`🔌 HTTP Port: ${config.port}`);
  console.log('================================================================');

  // 1. Strict Fail-Fast Environment Validation
  try {
    validateStartupEnv(config);
  } catch (error: any) {
    console.error(error.message || error);
    process.exit(1);
  }

  // 2. Connect to PostgreSQL
  try {
    await connectDatabase();
    // ⚡ Prime L1 in-memory RAM cache for instant sub-millisecond responses
    await systemDataService.warmup();
    // 📡 Start Redis RBAC targeted invalidation listener
    initializeRbacSyncListener();
  } catch (error) {
    console.error('❌ [FATAL] Failed to connect to PostgreSQL database:', error);
    process.exit(1);
  }

  // 3. Initialize & Start Telegram Bot
  try {
    const bot = await createBot();

    // ⚡ Register universal fallback commands in the Telegram Side Menu (Menu Button)
    bot.api
      .setMyCommands([
        { command: 'start', description: '🏠 القائمة الرئيسية واللوحة التشغيلية' },
        { command: 'boost', description: '⚡ فحص وتسريع سرعة استجابة البوت' },
        { command: 'cancel', description: '❌ إلغاء المعاملة الحالية والتراجع' },
      ])
      .then(() => {
        console.log('📋 [TELEGRAM] Universal fallback side menu commands registered successfully.');
      })
      .catch((err) => {
        console.warn('⚠️ [TELEGRAM] Could not set side menu commands:', err.message);
      });


    const runner = run(bot, {
      runner: {
        fetch: {
          allowed_updates: ['message', 'callback_query'],
          timeout: 30,
        },
      },
    });

    // ⚡ Start Session Monitor
    sessionMonitorService.startMonitoring(bot.api);

    // 4. Lightweight Native HTTP Health Endpoint (for Docker Healthcheck & Provenance Verification)
    const healthServer = http.createServer((req, res) => {
      const url = req.url || '';
      if (url === '/api/health' || url === '/health' || url === '/ping') {
        const body = JSON.stringify({
          status: 'ready',
          service: 'bot-server',
          version: config.appVersion,
          commitSha: config.gitCommitSha,
          buildTime: config.buildTime,
          timestamp: new Date().toISOString(),
        });
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        });
        res.end(body);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    });

    healthServer.listen(config.port, '0.0.0.0', () => {
      console.log(`📡 [HEALTH] HTTP Health server listening on 0.0.0.0:${config.port}`);
    });

    const shutdown = async () => {
      console.log('\n🛑 [SHUTDOWN] Received termination signal. Stopping bot...');
      sessionMonitorService.stopMonitoring();
      healthServer.close();
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
