import crypto from 'crypto';
import type { Api, BotError } from 'grammy';
import { InlineKeyboard } from 'grammy';
import type { MyContext } from '../types/context.js';
import { prisma } from '../db.js';
import { config } from '../config/env.js';
import { telemetryService } from './telemetry.service.js';
import type { SystemErrorLog } from '@alsaada/database';
import {
  normalizeIncident,
  writeEmergencyIncident,
  type IncidentEnvironment,
} from '@alsaada/telemetry';

/**
 * Robust HTML escaping for dynamic variables in Telegram HTML messages
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function resolveTraceId(
  ctx: MyContext | undefined,
  error: unknown,
  explicitTraceId: string | undefined,
): string {
  if (explicitTraceId) return explicitTraceId;

  if (ctx) {
    const contextTraceId = Reflect.get(ctx, 'traceId');
    if (typeof contextTraceId === 'string' && contextTraceId.length > 0) {
      return contextTraceId;
    }

    const session = Reflect.get(ctx, 'session');
    if (session && typeof session === 'object') {
      const sessionTraceId = Reflect.get(session, 'traceId');
      if (typeof sessionTraceId === 'string' && sessionTraceId.length > 0) {
        return sessionTraceId;
      }
    }
  }

  if (error && typeof error === 'object') {
    const errorTraceId = Reflect.get(error, 'traceId');
    if (typeof errorTraceId === 'string' && errorTraceId.length > 0) {
      return errorTraceId;
    }
  }

  return crypto.randomUUID();
}

function resolveEnvironment(value: string | undefined): IncidentEnvironment {
  if (value === 'development' || value === 'test' || value === 'staging') {
    return value;
  }
  return 'production';
}

function formatBreadcrumbSnippet(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) {
    return '  <i>لا توجد خطوات مسجلة</i>';
  }

  const actions = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const action = Reflect.get(entry, 'action');
      return typeof action === 'string' ? action : null;
    })
    .filter((action): action is string => action !== null);

  return actions.length > 0
    ? actions.map((action, index) => `  ${index + 1}. <code>${escapeHtml(action)}</code>`).join('\n')
    : '  <i>لا توجد خطوات مسجلة</i>';
}

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
    traceId?: string | undefined;
  }): Promise<SystemErrorLog> {
    const { ctx, error, sourceLocation = 'unknown_source', severity = 'ERROR', api } = params;

    const telegramId = ctx?.from ? BigInt(ctx.from.id) : null;
    const actorRole = ctx?.effectiveRole || 'GUEST';

    let actionTrigger = 'unknown_action';
    if (ctx?.callbackQuery?.data) {
      actionTrigger = `cb:${ctx.callbackQuery.data}`;
    } else if (ctx?.message?.text) {
      actionTrigger = `msg:${ctx.message.text.slice(0, 50)}`;
    }

    const traceId = resolveTraceId(ctx, error, params.traceId);
    const breadcrumbs = telegramId ? await telemetryService.getBreadcrumbs(telegramId) : [];
    const incident = normalizeIncident({
      traceId,
      source: 'bot',
      service: 'bot-server',
      severity,
      action: actionTrigger,
      sourceLocation,
      error,
      ...(telegramId !== null ? { actorTelegramId: telegramId } : {}),
      actorRole,
      breadcrumbs,
      release: process.env.npm_package_version,
      environment: resolveEnvironment(process.env.NODE_ENV),
    });
    const breadcrumbPayload = incident.breadcrumbs.map((breadcrumb) => ({
      action: breadcrumb.action,
      ...(breadcrumb.timestamp !== undefined ? { timestamp: breadcrumb.timestamp } : {}),
    }));

    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const existing = await prisma.systemErrorLog.findFirst({
        where: {
          errorHash: incident.fingerprint,
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
            traceId: existing.traceId || incident.traceId,
            occurrenceCount: { increment: 1 },
            lastSeenAt: new Date(),
            stackTrace: incident.stack ?? null,
            ...(breadcrumbPayload.length > 0 ? { breadcrumbs: breadcrumbPayload } : {}),
          },
        });

        if (savedLog.occurrenceCount % 5 === 0 && api) {
          try {
            await this.dispatchSuperAdminAlert(savedLog, api, true);
          } catch {
            writeEmergencyIncident(incident.traceId, 'INCIDENT_RECURRENT_ALERT_FAILURE');
          }
        }
      } else {
        const errorReference = `#ERR-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;

        savedLog = await prisma.systemErrorLog.create({
          data: {
            traceId: incident.traceId,
            service: incident.service,
            errorReference,
            errorHash: incident.fingerprint,
            occurrenceCount: 1,
            actorTelegramId: incident.actorTelegramId ?? null,
            actorRole: incident.actorRole ?? null,
            actionTrigger: incident.action,
            sourceLocation: incident.sourceLocation,
            errorMessage: incident.message,
            stackTrace: incident.stack ?? null,
            ...(breadcrumbPayload.length > 0 ? { breadcrumbs: breadcrumbPayload } : {}),
            severity: incident.severity,
            isResolved: false,
          },
        });

        if (api) {
          try {
            await this.dispatchSuperAdminAlert(savedLog, api, false);
          } catch {
            writeEmergencyIncident(incident.traceId, 'INCIDENT_NEW_ALERT_FAILURE');
          }
        }
      }

      return savedLog;
    } catch (persistenceError) {
      writeEmergencyIncident(incident.traceId, 'INCIDENT_PERSISTENCE_FAILURE');
      throw persistenceError;
    }
  }

  /**
   * 🚨 إرسال إنذار فوري ومباشر لحسابات السوبر أدمنز على تليجرام في الخاص حصراً (Zero Data Leak)
   */
  async dispatchSuperAdminAlert(
    log: SystemErrorLog,
    api: Api,
    isRecurrent = false
  ): Promise<void> {
    const titlePrefix = isRecurrent
      ? `🚨 <b>[تكرار عطل برمجي متكرر (${log.occurrenceCount}x)]</b>`
      : `⚠️ <b>[إنذار أمني وعطل برمجي جديد في البوت]</b>`;

    const breadcrumbSnippet = formatBreadcrumbSnippet(log.breadcrumbs);

    const alertText =
      `${titlePrefix}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔹 <b>رمز البلاغ:</b> <code>${escapeHtml(log.errorReference)}</code>\n` +
      `🔹 <b>الخطورة:</b> <code>${escapeHtml(log.severity)}</code>\n` +
      `🔹 <b>المستخدم المتأثر:</b> <code>${escapeHtml(String(log.actorTelegramId || 'غير معروف'))}</code> (${escapeHtml(log.actorRole || 'GUEST')})\n` +
      `🔹 <b>الإجراء المسبب:</b> <code>${escapeHtml(log.actionTrigger || 'غير محدد')}</code>\n` +
      `🔹 <b>الموقع:</b> <code>${escapeHtml(log.sourceLocation || 'غير محدد')}</code>\n\n` +
      `💬 <b>نص الخطأ:</b> <code>${escapeHtml(log.errorMessage.slice(0, 200))}</code>\n\n` +
      `✈️ <b>شريط خطوات المستخدم الأخيرة (Breadcrumbs):</b>\n` +
      `${breadcrumbSnippet}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `<i>يمكنك استعراض تفاصيل الخطأ كاملة وحله من مركز الإعدادات.</i>`;

    const keyboard = new InlineKeyboard()
      .text('🔍 فحص تفاصيل الخطأ', `action:error_log:view:${log.id}`)
      .row()
      .text('✅ اعتماد حل المشكلة', `action:error_log:resolve:${log.id}`);

    // Fetch all active Super Admins to send private DMs
    const superAdmins = await prisma.user.findMany({
      where: { role: 'SUPER_ADMIN', isActive: true },
      select: { telegramId: true },
    });

    const targetTelegramIds = new Set<number>();
    for (const sa of superAdmins) {
      if (sa.telegramId) targetTelegramIds.add(Number(sa.telegramId));
    }
    if (config.superAdminTelegramId && config.superAdminTelegramId !== 0n) {
      targetTelegramIds.add(Number(config.superAdminTelegramId));
    }

    for (const tgId of targetTelegramIds) {
      try {
        await api.sendMessage(tgId, alertText, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
      } catch {
        // Fallback to plain text if HTML formatting or keyboard fails
        try {
          const plainAlert = `⚠️ إنذار عطل برمجي: رمز البلاغ ${log.errorReference} - ${log.errorMessage.slice(0, 100)}`;
          await api.sendMessage(tgId, plainAlert);
        } catch {
          writeEmergencyIncident(
            log.traceId || crypto.randomUUID(),
            'INCIDENT_ADMIN_ALERT_DELIVERY_FAILURE',
          );
        }
      }
    }
  }

  /**
   * 🛠️ بطاقة الخطأ التفاعلية للمستخدم مع رمز البلاغ وأزرار الواتساب المباشرة لكافة السوبر أدمنز
   */
  async buildUserErrorResponse(
    errorReference: string,
    actorContext?: {
      actorName?: string | undefined;
      actorTelegramId?: bigint | undefined;
      siteName?: string | undefined;
    }
  ): Promise<{
    text: string;
    keyboard: InlineKeyboard;
  }> {
    const text =
      `⚠️ <b>عذراً، حدث خطأ غير متوقع أثناء معالجة طلبك</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `تم توثيق وتمرير تقرير العطل تلقائياً لغرفة العمليات المركزية للمراجعة.\n` +
      `🔹 <b>رمز البلاغ المرجعي:</b> <code>${escapeHtml(errorReference)}</code>\n\n` +
      `يمكنك إرسال تفاصيل البلاغ مباشرة لإدارة الشركة عبر واتساب، أو العودة للقائمة الرئيسية:`;

    const keyboard = new InlineKeyboard();

    // Query active Super Admins to generate personalized WhatsApp buttons
    try {
      const superAdmins = await prisma.user.findMany({
        where: { role: 'SUPER_ADMIN', isActive: true },
        select: { fullName: true, phoneEncrypted: true },
        orderBy: { createdAt: 'asc' },
      });

      for (const admin of superAdmins) {
        if (admin.phoneEncrypted && config.databaseEncryptionKey) {
          try {
            const { decryptField } = await import('@alsaada/database');
            const phone = decryptField(admin.phoneEncrypted, config.databaseEncryptionKey);
            const { buildWhatsAppErrorUrl } = await import('@alsaada/core-components');
            const waUrl = buildWhatsAppErrorUrl(phone, {
              errorReference,
              actorName: actorContext?.actorName,
              actorTelegramId: actorContext?.actorTelegramId,
              siteName: actorContext?.siteName,
            });

            if (waUrl) {
              const adminLabel = admin.fullName ? ` (${admin.fullName})` : '';
              keyboard.url(`📲 إرسال العطل للمدير العام${adminLabel} عبر واتساب`, waUrl).row();
            }
          } catch {
            writeEmergencyIncident(errorReference, 'INCIDENT_WHATSAPP_LINK_FAILURE');
          }
        }
      }
    } catch {
      writeEmergencyIncident(errorReference, 'INCIDENT_ADMIN_LOOKUP_FAILURE');
    }

    keyboard
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
    const traceId = resolveTraceId(ctx, err, undefined);

    try {
      const savedLog = await this.recordError({
        ctx,
        error: err,
        sourceLocation: 'bot.catch:global',
        severity: 'CRITICAL',
        api,
        traceId,
      });

      // If update was callback query, answer with friendly alert containing reference
      if (ctx?.callbackQuery) {
        try {
          await ctx.answerCallbackQuery({
            text: `⚠️ عطل غير متوقع (${savedLog.errorReference}). تم إخطار الإدارة.`,
            show_alert: true,
          });
        } catch {
          writeEmergencyIncident(traceId, 'INCIDENT_CALLBACK_ALERT_FAILURE');
        }
      }

      // If chat is available, send user-facing error response card
      if (ctx?.chat) {
        const actorName = ctx.from?.first_name ? `${ctx.from.first_name} ${ctx.from.last_name || ''}`.trim() : undefined;
        const actorTelegramId = ctx.from?.id ? BigInt(ctx.from.id) : undefined;
        const { text, keyboard } = await this.buildUserErrorResponse(savedLog.errorReference, {
          actorName,
          actorTelegramId,
        });

        try {
          await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
        } catch {
          try {
            const fallbackText = `⚠️ حدث خطأ غير متوقع أثناء معالجة طلبك.\nرمز البلاغ: ${savedLog.errorReference}\nيرجى إبلاغ الدعم الفني.`;
            await ctx.reply(fallbackText);
          } catch {
            writeEmergencyIncident(traceId, 'INCIDENT_USER_FALLBACK_DELIVERY_FAILURE');
          }
        }
      }
    } catch {
      writeEmergencyIncident(traceId, 'INCIDENT_PIPELINE_FAILURE');
      if (ctx?.chat) {
        try {
          await ctx.reply(
            `⚠️ تعذر تسجيل تفاصيل العطل مؤقتاً. الرقم المرجعي: ${traceId}\nيمكنك إعادة المحاولة أو العودة للقائمة الرئيسية.`,
            { reply_markup: new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu') },
          );
        } catch {
          writeEmergencyIncident(traceId, 'INCIDENT_PIPELINE_USER_RESPONSE_FAILURE');
        }
      }
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
      writeEmergencyIncident(crypto.randomUUID(), 'INCIDENT_RESOLUTION_FAILURE');
      return null;
    }
  }
}

export const errorVaultService = new ErrorVaultService();
