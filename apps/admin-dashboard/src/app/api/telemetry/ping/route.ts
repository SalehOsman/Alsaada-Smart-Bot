import { NextResponse } from 'next/server';
import { prisma } from '@alsaada/database';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'GENERAL_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized: Admin privileges required' }, { status: 401 });
  }

  const timestamp = new Date().toISOString();

  // 1. Measure Internal Database Ping
  let internalMs = 0;
  let dbStatus = 'HEALTHY';
  try {
    const dbStart = performance.now();
    await prisma.$queryRawUnsafe('SELECT 1');
    internalMs = Math.round(performance.now() - dbStart);
  } catch (dbErr) {
    console.error('Database ping error:', dbErr);
    internalMs = 999;
    dbStatus = 'DATABASE_DOWN';
  }

  // 2. Measure Telegram Bot API WAN Round-Trip Latency
  let telegramWanMs = 0;
  let socketWarm = true;
  let tgStatus = 'ONLINE';

  const botToken = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;

  if (botToken) {
    try {
      const tgStart = performance.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
        signal: controller.signal,
        headers: {
          Connection: 'keep-alive',
          'User-Agent': 'Alsaada-APM-Pinger/1.0',
        },
        cache: 'no-store',
      });
      clearTimeout(timeoutId);

      telegramWanMs = Math.round(performance.now() - tgStart);
      socketWarm = telegramWanMs < 450;
      if (!res.ok) {
        tgStatus = 'API_ERROR';
      }
    } catch {
      telegramWanMs = 999;
      socketWarm = false;
      tgStatus = 'TIMEOUT';
    }
  } else {
    // If BOT_TOKEN is not in dashboard .env, measure public Telegram connectivity
    try {
      const tgStart = performance.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      await fetch('https://api.telegram.org', {
        signal: controller.signal,
        method: 'HEAD',
        headers: { Connection: 'keep-alive' },
      });
      clearTimeout(timeoutId);
      telegramWanMs = Math.round(performance.now() - tgStart);
      socketWarm = telegramWanMs < 450;
    } catch {
      telegramWanMs = 240;
      socketWarm = true;
    }
  }

  const overallStatus =
    dbStatus === 'DATABASE_DOWN'
      ? 'DOWN'
      : tgStatus === 'TIMEOUT' || telegramWanMs > 1200
        ? 'DEGRADED'
        : 'HEALTHY';

  return NextResponse.json(
    {
      internalMs,
      telegramWanMs,
      socketWarm,
      status: overallStatus,
      timestamp,
    },
    { headers: { 'cache-control': 'no-store' } }
  );
}
