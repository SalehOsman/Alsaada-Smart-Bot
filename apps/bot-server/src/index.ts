import dns from 'node:dns';

// Fix for Egyptian ISP IPv6 routing blackhole: prioritize IPv4 to eliminate 1.5s - 3s DNS timeouts
dns.setDefaultResultOrder('ipv4first');

import { run } from '@grammyjs/runner';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { webhookCallback } from 'grammy';
import { connectDatabase, disconnectDatabase, pingDatabase } from './db.js';
import { redis } from './redis.js';
import { createBot } from './bot.js';
import { config, validateStartupEnv } from './config/env.js';
import { systemDataService } from './services/system-data.service.js';
import { sessionMonitorService } from './services/session-monitor.service.js';
import { initializeRbacSyncListener } from './services/rbac-sync-listener.js';
import { formatVersionBanner } from '@alsaada/telemetry';

async function bootstrap() {
  console.log('================================================================');
  console.log(formatVersionBanner());
  console.log(`🌐 Node Environment: ${config.nodeEnv}`);
  console.log(`🔌 HTTP Port: ${config.port}`);
  console.log('================================================================');

  // 1. Strict Fail-Fast Environment Validation
  try {
    validateStartupEnv(config);
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
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

    let runner: ReturnType<typeof run> | null = null;
    if (!config.webhookUrl) {
      runner = run(bot, {
        runner: {
          fetch: {
            allowed_updates: ['message', 'callback_query'],
            timeout: 30,
          },
        },
      });
      console.log('⚡ [POLLING] grammY Runner started in polling mode.');
    }

    // ⚡ Start Session Monitor
    sessionMonitorService.startMonitoring(bot.api);

    // 4. Enterprise Hono Engine: Deep Health Probes & Local Webhook Handler
    const app = new Hono();

    // 4.1 Liveness Probe (process vitality)
    app.get('/health/liveness', (c) => {
      return c.json({
        status: 'live',
        service: 'bot-server',
        version: config.appVersion,
        timestamp: new Date().toISOString(),
      }, 200);
    });

    // 4.2 Readiness & Comprehensive Health Probes (runner/webhook, postgres, and redis)
    const handleDeepHealth = async (c: any) => {
      let isDbHealthy = false;
      let isRedisHealthy = false;
      const isRunnerHealthy = config.webhookUrl ? true : (runner?.isRunning() ?? false);

      let dbLatencyMs: number | null = null;
      try {
        dbLatencyMs = await pingDatabase();
        isDbHealthy = typeof dbLatencyMs === 'number' && dbLatencyMs >= 0;
      } catch {
        isDbHealthy = false;
      }

      try {
        const pingRes = await redis.ping();
        isRedisHealthy = pingRes === 'PONG';
      } catch {
        isRedisHealthy = false;
      }

      const allHealthy = isRunnerHealthy && isDbHealthy && isRedisHealthy;
      const statusCode = allHealthy ? 200 : 503;

      return c.json({
        status: allHealthy ? 'ready' : 'unhealthy',
        service: 'bot-server',
        mode: config.webhookUrl ? 'webhook' : 'polling',
        telegramApiRoot: config.telegramApiRoot,
        checks: {
          runner: isRunnerHealthy,
          database: isDbHealthy,
          redis: isRedisHealthy,
        },
        version: config.appVersion,
        commitSha: config.gitCommitSha,
        buildTime: config.buildTime,
        timestamp: new Date().toISOString(),
      }, statusCode);
    };

    app.get('/api/health', handleDeepHealth);
    app.get('/health/readiness', handleDeepHealth);
    app.get('/health', handleDeepHealth);
    app.get('/ping', handleDeepHealth);

    // 4.3 Webhook Handler (for Local Bot API or Cloud Webhooks)
    if (config.webhookUrl) {
      app.post('/webhook', webhookCallback(bot, 'hono'));
      console.log(`🔗 [WEBHOOK] Telegram Webhook registered on /webhook (URL: ${config.webhookUrl})`);
    }

    const server = serve({
      fetch: app.fetch,
      port: config.port,
    }, (info) => {
      console.log(`📡 [HEALTH] Hono Web & Health server listening on 0.0.0.0:${info.port}`);
    });

    const shutdown = async () => {
      console.log('\n🛑 [SHUTDOWN] Received termination signal. Stopping bot...');
      sessionMonitorService.stopMonitoring();
      server.close();
      if (runner && runner.isRunning()) {
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
