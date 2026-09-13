import { InlineKeyboard, type Api } from 'grammy';
import { prisma } from '../db.js';
import { config } from '../config/env.js';
import { formatDateTime } from '@alsaada/regional-engine';
import { TelemetryLogger } from '@alsaada/telemetry';

const logger = new TelemetryLogger({
  service: 'bot-server',
  defaultComponent: 'session-monitor',
});

export class SessionMonitorService {
  private intervalTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start periodic background scan for expiring sessions
   */
  startMonitoring(botApi: Api, intervalMs: number = 60_000): void {
    if (this.intervalTimer) return;

    this.intervalTimer = setInterval(async () => {
      if (this.isRunning) return;
      this.isRunning = true;
      try {
        await this.checkExpiringSessions(botApi);
      } catch (err: unknown) {
        logger.warn('Session monitor check failed', { error: err });
      } finally {
        this.isRunning = false;
      }
    }, intervalMs);

    logger.info('Session monitor service started', { payload: { intervalMs } });
  }

  /**
   * Stop background monitoring
   */
  stopMonitoring(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
      logger.info('Session monitor service stopped');
    }
  }

  /**
   * Scans for active sessions expiring within configured window (default: 60 minutes)
   * that have not received an expiry warning notice yet.
   */
  async checkExpiringSessions(botApi: Api): Promise<number> {
    const now = new Date();
    const noticeMinutes = config.dashboardSessionNoticeMinutes || 60;
    const threshold = new Date(now.getTime() + noticeMinutes * 60 * 1000);

    const expiringSessions = await prisma.dashboardSession.findMany({
      where: {
        revokedAt: null,
        noticeSentAt: null,
        expiresAt: {
          gt: now,
          lte: threshold,
        },
      },
    });

    let noticesSent = 0;

    for (const session of expiringSessions) {
      try {
        const remainingMinutes = Math.max(
          1,
          Math.round((session.expiresAt.getTime() - now.getTime()) / 60_000)
        );
        const expiryFormatted = formatDateTime(session.expiresAt);
        const originDisplay =
          session.originKind === 'TUNNEL' ? 'نفق مشفر (Tunnel)' : 'اتصال محلي (Localhost)';

        const text =
          `⏳ <b>تنبيه أمني: اقتراب انتهاء جلسة لوحة التحكم</b>\n` +
          `────────────────────────────\n` +
          `قاربت جلستك النشطة في لوحة التحكم على الانتهاء خلال <b>${remainingMinutes} دقيقة</b>.\n\n` +
          `🌐 <b>نوع الاتصال:</b> ${originDisplay}\n` +
          `💻 <b>الجهاز / المتصفح:</b> <code>${session.deviceSummary || 'غير محدد'}</code>\n` +
          `🕒 <b>موعد الانتهاء:</b> <b>${expiryFormatted}</b>\n\n` +
          `يمكنك تمديد الجلسة لـ 8 ساعات إضافية أو إنهاؤها فوراً:`;

        // Strictly respect Telegram 64-byte callback_data limit:
        // 'sess_ext:' (9) + session.id UUID (36) = 45 bytes <= 64 bytes
        // 'sess_rev:' (9) + session.id UUID (36) = 45 bytes <= 64 bytes
        const keyboard = new InlineKeyboard()
          .text('⏳ تمديد الجلسة 8 ساعات', `sess_ext:${session.id}`)
          .row()
          .text('🛑 إنهاء الجلسة فوراً', `sess_rev:${session.id}`)
          .row()
          .text('📋 جلساتي النشطة', 'sess_list');

        await botApi.sendMessage(Number(session.actorTelegramId), text, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });

        // Mark noticeSentAt to prevent repeated notifications
        await prisma.dashboardSession.update({
          where: { id: session.id },
          data: { noticeSentAt: new Date() },
        });

        noticesSent++;
      } catch (err: unknown) {
        logger.warn('Failed to deliver expiring session notice to user', {
          payload: {
            actorTelegramId: String(session.actorTelegramId),
            sessionId: session.id,
          },
          error: err,
        });
      }
    }

    return noticesSent;
  }
}

export const sessionMonitorService = new SessionMonitorService();
