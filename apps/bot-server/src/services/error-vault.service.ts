import crypto from 'crypto';
import type { Api, BotError } from 'grammy';
import { InlineKeyboard } from 'grammy';
import type { MyContext } from '../types/context.js';
import { prisma } from '../db.js';
import { config } from '../config/env.js';
import { telemetryService } from './telemetry.service.js';
import type { SystemErrorLog } from '@alsaada/database';

export class ErrorVaultService {
  /**
   * 🛡️ توثيق العطل البرمجي وحفظ السجل الجنائي الكامل في PostgreSQL
   */
  async recordError(params: {
    ctx?: MyContext | undefined;
    error: unknown;
    sourceLocation?: string | undefined;
    severity?: 'WARNING' | 'ERROR' | 'CRITICAL' | 'FATAL' | undefined;
    api?: Api | undefined;
  }): Promise<SystemErrorLog> {
    const { ctx, error, sourceLocation = 'unknown_source', severity = 'ERROR', api } = params;

    const rawErrorMsg = error instanceof Error ? error.message : String(error);
    const stackTrace = error instanceof Error ? error.stack || '' : '';
    const telegramId = ctx?.from ? BigInt(ctx.from.id) : null;
    const actorRole = ctx?.effectiveRole || 'GUEST';

    let actionTrigger = 'unknown_action';
    if (ctx?.callbackQuery?.data) {
      actionTrigger = `cb:${ctx.callbackQuery.data}`;
    } else if (ctx?.message?.text) {
      actionTrigger = `msg:${ctx.message.text.slice(0, 50)}`;
    }

    // Flight recorder breadcrumbs
    const breadcrumbs = telegramId ? await telemetryService.getBreadcrumbs(telegramId) : [];

    // Calculate deterministic error hash for deduplication
    const errorHash = crypto
      .createHash('sha256')
      .update(`${sourceLocation}:${rawErrorMsg}`)
      .digest('hex')
      .slice(0, 16);

    // Look for recent identical unresolved error within the last 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const existing = await prisma.systemErrorLog.findFirst({
      where: {
        errorHash,
        isResolved: false,
        lastSeenAt: { gte: oneHourAgo },
      },
      orderBy: { createdAt: 'desc' },
    });

    let savedLog: SystemErrorLog;

    if (existing) {
      savedLog = await prisma.systemErrorLog.update({
        where: { id: existing.id },
        data: {
          occurrenceCount: { increment: 1 },
          lastSeenAt: new Date(),
          stackTrace,
          breadcrumbs: breadcrumbs.length > 0 ? (breadcrumbs as any) : existing.breadcrumbs,
        },
      });

      // Throttled notification: notify Super Admin only on recurrent milestones (e.g. 5th, 10th occurrence)
      if (savedLog.occurrenceCount % 5 === 0 && api) {
        await this.dispatchSuperAdminAlert(savedLog, api, true).catch(() => {});
      }
    } else {
      const errorReference = `#ERR-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      savedLog = await prisma.systemErrorLog.create({
        data: {
          errorReference,
          errorHash,
          occurrenceCount: 1,
          actorTelegramId: telegramId,
          actorRole,
          actionTrigger,
          sourceLocation,
          errorMessage: rawErrorMsg.slice(0, 1000),
          stackTrace: stackTrace.slice(0, 4000),
          breadcrumbs: breadcrumbs.length > 0 ? (breadcrumbs as any) : undefined,
          severity,
          isResolved: false,
        },
      });

      // Dispatch alert to Super Admin on new error
      if (api) {
        await this.dispatchSuperAdminAlert(savedLog, api, false).catch(() => {});
      }
    }

    return savedLog;
  }

  /**
   * 🚨 إرسال إنذار فوري ومباشر لحساب السوبر أدمن على تليجرام
   */
  async dispatchSuperAdminAlert(
    log: SystemErrorLog,
    api: Api,
    isRecurrent = false
  ): Promise<void> {
    if (!config.superAdminTelegramId || config.superAdminTelegramId === 0n) return;

    const titlePrefix = isRecurrent
      ? `🚨 *[تكرار عطل برمجي متكرر (${log.occurrenceCount}x)]*`
      : `⚠️ *[إنذار أمني وعطل برمجي جديد في البوت]*`;

    const breadcrumbSnippet = Array.isArray(log.breadcrumbs) && log.breadcrumbs.length > 0
      ? log.breadcrumbs.map((b: any, i: number) => `  ${i + 1}. \`${b.action}\``).join('\n')
      : '  _لا توجد خطوات مسجلة_';

    const alertText =
      `${titlePrefix}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔹 *رمز البلاغ:* \`${log.errorReference}\`\n` +
      `🔹 *الخطورة:* \`${log.severity}\`\n` +
      `🔹 *المستخدم المتأثر:* \`${log.actorTelegramId || 'غير معروف'}\` (${log.actorRole || 'GUEST'})\n` +
      `🔹 *الإجراء المسبب:* \`${log.actionTrigger}\`\n` +
      `🔹 *الموقع:* \`${log.sourceLocation}\`\n\n` +
      `💬 *نص الخطأ:* \`${log.errorMessage.slice(0, 200)}\`\n\n` +
      `✈️ *شريط خطوات المستخدم الأخيرة (Breadcrumbs):*\n` +
      `${breadcrumbSnippet}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `_يمكنك استعراض تفاصيل الخطأ كاملة وحله من مركز الإعدادات._`;

    const keyboard = new InlineKeyboard()
      .text('🔍 فحص تفاصيل الخطأ', `action:error_log:view:${log.id}`)
      .row()
      .text('✅ اعتماد حل المشكلة', `action:error_log:resolve:${log.id}`);

    try {
      await api.sendMessage(Number(config.superAdminTelegramId), alertText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch {
      // Non-blocking catch
    }
  }

  /**
   * 🛠️ بطاقة الخطأ التفاعلية للمستخدم مع رمز البلاغ وأزرار الرجوع (Rule 5.5)
   */
  buildUserErrorResponse(errorReference: string): {
    text: string;
    keyboard: InlineKeyboard;
  } {
    const text =
      `⚠️ *عذراً، حدث خطأ غير متوقع أثناء معالجة طلبك*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `تم توثيق وتمرير تقرير العطل تلقائياً لغرفة العمليات المركزية للمراجعة.\n` +
      `🔹 *رمز البلاغ المرجعي:* \`${errorReference}\`\n\n` +
      `يرجى إعادة المحاولة أو العودة للقائمة الرئيسية:`;

    const keyboard = new InlineKeyboard()
      .text('🔄 إعادة المحاولة', 'action:main_menu')
      .row()
      .text('🏠 القائمة الرئيسية', 'action:main_menu');

    return { text, keyboard };
  }

  /**
   * 🧯 معالج الأخطاء العام لـ bot.catch
   */
  async handleGlobalBotError(botError: BotError<MyContext>, api: Api): Promise<void> {
    const ctx = botError.ctx;
    const err = botError.error;

    console.error(`❌ [BOT ERROR VAULT] Intercepted update ${ctx?.update?.update_id}:`, err);

    try {
      const savedLog = await this.recordError({
        ctx,
        error: err,
        sourceLocation: 'bot.catch:global',
        severity: 'CRITICAL',
        api,
      });

      // If update was callback query, answer with friendly alert containing reference
      if (ctx?.callbackQuery) {
        await ctx
          .answerCallbackQuery({
            text: `⚠️ عطل غير متوقع (${savedLog.errorReference}). تم إخطار الإدارة.`,
            show_alert: true,
          })
          .catch(() => {});
      }

      // If chat is available, send user-facing error response card
      if (ctx?.chat) {
        const { text, keyboard } = this.buildUserErrorResponse(savedLog.errorReference);
        await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard }).catch(() => {});
      }
    } catch (vaultErr) {
      console.error('❌ [BOT ERROR VAULT FAILURE] Failed to record error to DB:', vaultErr);
    }
  }

  /**
   * 📋 جلب قائمة الأعطال الأخيرة مقسمة لصفحات
   */
  async getRecentErrors(page = 1, pageSize = 10): Promise<{
    items: SystemErrorLog[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * pageSize;
    const [total, items] = await Promise.all([
      prisma.systemErrorLog.count(),
      prisma.systemErrorLog.findMany({
        orderBy: { lastSeenAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  /**
   * ✅ تحديد العطل كمعالج ومحلول
   */
  async resolveError(errorId: string, resolvedById?: bigint): Promise<SystemErrorLog | null> {
    try {
      return await prisma.systemErrorLog.update({
        where: { id: errorId },
        data: {
          isResolved: true,
          resolvedAt: new Date(),
          resolvedById: resolvedById ?? null,
        },
      });
    } catch {
      return null;
    }
  }
}

export const errorVaultService = new ErrorVaultService();
