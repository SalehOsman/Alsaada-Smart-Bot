import crypto from 'node:crypto';
import { InlineKeyboard } from 'grammy';
import { TelemetryLogger } from '@alsaada/telemetry';
import { formatClickToCopy, DISABLED_LINK_PREVIEWS } from '@alsaada/core-components';
import { formatDateTime } from '@alsaada/regional-engine';
import type { MyContext } from '../types/context.js';
import { dashboardAuthService } from '../services/dashboard-auth.service.js';
import { screenFlowService } from '../services/screen-flow.service.js';
import { config } from '../config/env.js';

/**
 * Telegram Bot API rejects inline keyboard button URLs with non-FQDN hostnames (like 'localhost' or '127.0.0.1').
 * Maps loopback hosts to the universally resolvable '127.0.0.1.nip.io' which points to 127.0.0.1 on all machines.
 */
export function formatTelegramSafeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      parsed.hostname = '127.0.0.1.nip.io';
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

const logger = new TelemetryLogger({
  service: 'bot-server',
  defaultComponent: 'dashboard-command',
});

/**
 * Localized Arabic administrative titles SSOT for Canonical Roles.
 */
export const ROLE_ARABIC_TITLES: Record<string, string> = {
  SUPER_ADMIN: 'مدير عام المنظومة (سوبر أدمن)',
  GENERAL_ADMIN: 'الإدارة العامة للمنظومة',
  FIELD_ADMIN: 'مشرف موقع ميداني',
  WORKER_SUPERVISOR: 'عامل مشرف',
  WORKER: 'مستخدم ميداني',
  SUPPLIER: 'مورد',
  GUEST: 'زائر',
};

/**
 * Map user role enum to formal Arabic title
 */
export function getRoleTitle(role?: string | null): string {
  if (!role) return 'غير مسجل بالمنظومة';
  return ROLE_ARABIC_TITLES[role] ?? 'مستخدم ميداني';
}

/**
 * Robust HTML escaping for dynamic variables in Telegram HTML messages
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function resolveTraceId(ctx: MyContext): string {
  const candidate = Reflect.get(ctx, 'traceId');
  return typeof candidate === 'string' && candidate.length > 0
    ? candidate
    : crypto.randomUUID();
}

function buildDashboardRecoveryKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔄 إعادة المحاولة', 'menu:exec:dashboard')
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');
}

async function replyWithDashboardFailure(
  ctx: MyContext,
  traceId: string,
  error: unknown,
): Promise<void> {
  logger.error('Dashboard command failed', {
    traceId,
    action: 'dashboard.open',
    actor: ctx.from ? { telegramId: String(ctx.from.id) } : undefined,
    error,
  });

  try {
    const { errorVaultService } = await import('../services/error-vault.service.js');
    const savedLog = await errorVaultService.recordError({
      ctx,
      error,
      sourceLocation: 'dashboard.handler:handleDashboardCommand',
      severity: 'ERROR',
      api: ctx.api,
      traceId,
    });

    const actorName = ctx.from?.first_name
      ? `${ctx.from.first_name} ${ctx.from.last_name || ''}`.trim()
      : undefined;
    const actorTelegramId = ctx.from?.id ? BigInt(ctx.from.id) : undefined;

    const { text, keyboard } = await errorVaultService.buildUserErrorResponse(
      savedLog.errorReference,
      {
        actorName,
        actorTelegramId,
      },
    );

    // Prepend dashboard-specific retry button to recovery options
    keyboard.inline_keyboard.unshift([
      { text: '🔄 إعادة المحاولة', callback_data: 'menu:exec:dashboard' },
    ]);

    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (vaultError) {
    try {
      await ctx.reply(
        '⚠️ <b>تعذر فتح لوحة التحكم</b>\n\nحدث خطأ غير متوقع أثناء معالجة طلب فتح لوحة التحكم. يمكنك إعادة المحاولة أو العودة للقائمة الرئيسية.',
        {
          parse_mode: 'HTML',
          reply_markup: buildDashboardRecoveryKeyboard(),
        },
      );
    } catch (fallbackError) {
      logger.fatal('Dashboard failure response could not be delivered', {
        traceId,
        action: 'dashboard.failure-response',
        actor: ctx.from ? { telegramId: String(ctx.from.id) } : undefined,
        error: fallbackError,
      });
    }
  }
}

/**
 * Handler for /dashboard, /admin_dashboard, /panel and "لوحة التحكم" text triggers.
 *
 * NOTE: Architecture Rule strictly enforces ZERO direct `prisma.*` calls in handlers.
 * All user lookups, authorization decisions, token generation, and audit logging
 * are delegated entirely to `dashboardAuthService`.
 */
export async function handleDashboardCommand(ctx: MyContext): Promise<void> {
  const traceId = resolveTraceId(ctx);
  try {
    if (ctx.callbackQuery) {
      try {
        await ctx.answerCallbackQuery();
      } catch (error) {
        logger.warn('Dashboard callback acknowledgement failed', {
          traceId,
          action: 'dashboard.callback-ack',
          error,
        });
      }
    }

    if (!ctx.from) return;

    const telegramId = BigInt(ctx.from.id);
    const isPrivateChat = ctx.chat?.type === 'private';

    // Strictly enforce private chat access: Never issue tokens or links in groups/supergroups
    if (!isPrivateChat) {
      await ctx.reply(
        '🔒 <b>عذراً، الوصول إلى لوحة التحكم متاح حصرياً عبر المحادثة الخاصة مع البوت.</b>\n\n' +
        'يرجى فتح المحادثة الخاصة مع البوت والضغط على زر <b>«🖥️ فتح لوحة التحكم»</b>.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Delegate authorization and dual token issuance to dashboardAuthService
    const result = await dashboardAuthService.issueDualDashboardAccess({
      telegramId,
      username: ctx.from.username ?? null,
      firstName: ctx.from.first_name ?? null,
      lastName: ctx.from.last_name ?? null,
      chatType: 'private',
    });

    if (!result.success) {
      const user = result.user;
      const roleDisplay = user ? getRoleTitle(user.role) : 'غير مسجل بالمنظومة';
      const statusDisplay = !user
        ? 'غير مسجل'
        : !user.isActive
        ? 'معطل مؤقتاً'
        : user.isBanned
        ? 'محظور'
        : 'غير مصرح له باللوحة';

      const rejectionText =
        `🚫 <b>عذراً، الوصول غير مصرح به</b>\n\n` +
        `لوحة التحكم المؤسسية مخصصة حصرياً لكادر الإدارة الميدانية والتنفيذية المصرح لهم (سوبر أدمن، جينرال أدمن، مشرف موقع).\n\n` +
        `🔹 <b>المعرف الرقمي:</b> <code>${telegramId}</code>\n` +
        `🔹 <b>الصفة الحالية:</b> <b>${escapeHtml(roleDisplay)}</b>\n` +
        `🔹 <b>حالة الحساب:</b> <b>${escapeHtml(statusDisplay)}</b>\n\n` +
        `يرجى مراجعة إدارة الموارد البشرية أو المدير العام لتفويض صلاحيات حسابك.`;

      const rejectionKb = new InlineKeyboard().text('🏠 القائمة الرئيسية', 'action:main_menu');
      await ctx.reply(rejectionText, { parse_mode: 'HTML', reply_markup: rejectionKb });
      return;
    }

    const { user, localUrl, tunnelUrl } = result;
    const roleTitle = getRoleTitle(user.role);
    const siteInfo = user.assignedSiteName
      ? `\n🏢 <b>الموقع الميداني:</b> <b>${escapeHtml(user.assignedSiteName)}</b>`
      : '';

    const card =
      `🚀 <b>لوحة التحكم المؤسسية — رابط الدخول المباشر للوحة التحكم المؤسسية</b>\n` +
      `────────────────────────────\n` +
      `مرحباً بك يا <b>${escapeHtml(user.fullName)}</b> (${escapeHtml(roleTitle)}).${siteInfo}\n\n` +
      `🔐 <b>تم إصدار تصريح دخول آمن لحسابك:</b>\n` +
      `⏱️ <b>الصلاحية:</b> صالح للاستخدام لمدة <b>5 دقائق فقط</b>.\n` +
      `🛡️ <b>الأمان:</b> استخدام لمرة واحدة ذرياً (Single-Use Magic Token).\n\n` +
      `👇 <b>اختر طريقة فتح لوحة التحكم عبر الأزرار أدناه:</b>`;

    const safeTunnelUrl = formatTelegramSafeUrl(tunnelUrl);
    const safeLocalUrl = formatTelegramSafeUrl(localUrl);

    const buildFullKeyboard = () =>
      new InlineKeyboard()
        .url('🌐 فتح عبر النفق (Tunnel)', safeTunnelUrl)
        .row()
        .url('💻 فتح محلياً (Localhost)', safeLocalUrl)
        .row()
        .text('📋 جلساتي النشطة', 'sess_list')
        .row()
        .text('🏠 القائمة الرئيسية', 'action:main_menu');

    const buildSafeKeyboard = () =>
      new InlineKeyboard()
        .url('🌐 فتح عبر النفق (Tunnel)', safeTunnelUrl)
        .row()
        .text('📋 جلساتي النشطة', 'sess_list')
        .row()
        .text('🏠 القائمة الرئيسية', 'action:main_menu');

    async function sendDashboardCard(
      sendFn: (text: string, options: any) => Promise<any>,
    ): Promise<void> {
      try {
        await sendFn(card, {
          parse_mode: 'HTML',
          reply_markup: buildFullKeyboard(),
          link_preview_options: DISABLED_LINK_PREVIEWS,
        });
      } catch (sendError: unknown) {
        const errMsg = sendError instanceof Error ? sendError.message : String(sendError);
        // Telegram Bot API rejects inline buttons containing non-FQDN hostnames with "Wrong HTTP URL"
        if (
          errMsg.includes('Wrong HTTP URL') ||
          errMsg.includes('inline keyboard button URL')
        ) {
          logger.warn(
            'Telegram rejected localhost inline keyboard URL button. Gracefully delivering card without localhost button',
            {
              traceId,
              action: 'dashboard.send-fallback-no-localhost-btn',
              error: errMsg,
            },
          );
          await sendFn(card, {
            parse_mode: 'HTML',
            reply_markup: buildSafeKeyboard(),
            link_preview_options: DISABLED_LINK_PREVIEWS,
          });
          return;
        }
        throw sendError;
      }
    }

    if (ctx.callbackQuery?.message && typeof ctx.editMessageText === 'function') {
      try {
        await sendDashboardCard((text, options) => ctx.editMessageText(text, options));
        if (ctx.chat) {
          await screenFlowService.trackActiveScreen(
            telegramId,
            ctx.chat.id,
            ctx.callbackQuery.message.message_id,
            'dashboard',
            false,
          ).catch(() => {});
        }
        return;
      } catch {
        // If edit fails (e.g. message text identical), fall through
      }
    }

    await screenFlowService.cleanupUnfinishedFlow(ctx, 'dashboard').catch(() => {});
    let sentMsgId: number | undefined;
    await sendDashboardCard(async (text, options) => {
      const sent = await ctx.reply(text, options);
      sentMsgId = sent?.message_id;
      return sent;
    });
    if (ctx.chat && sentMsgId) {
      await screenFlowService.trackActiveScreen(
        telegramId,
        ctx.chat.id,
        sentMsgId,
        'dashboard',
        false,
      ).catch(() => {});
    }
  } catch (err: unknown) {
    await replyWithDashboardFailure(ctx, traceId, err);
  }
}

/**
 * Handle session management callbacks (sess_ext, sess_rev, sess_list, sess_rev_all)
 */
export async function handleSessionCallbacks(ctx: MyContext): Promise<boolean> {
  const data = ctx.callbackQuery?.data;
  if (!data) return false;
  if (!data.startsWith('sess_')) return false;

  const telegramId = ctx.from ? BigInt(ctx.from.id) : 0n;
  if (telegramId === 0n) return false;

  // Helper to render screen in-place or fallback to reply
  const renderScreen = async (text: string, keyboard: InlineKeyboard): Promise<void> => {
    if (ctx.callbackQuery?.message && typeof ctx.editMessageText === 'function') {
      try {
        await ctx.editMessageText(text, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
          link_preview_options: DISABLED_LINK_PREVIEWS,
        });
        if (ctx.chat) {
          await screenFlowService.trackActiveScreen(
            telegramId,
            ctx.chat.id,
            ctx.callbackQuery.message.message_id,
            'dashboard_sessions',
            false,
          ).catch(() => {});
        }
        return;
      } catch {
        // Fallback to reply
      }
    }
    const sent = await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
      link_preview_options: DISABLED_LINK_PREVIEWS,
    });
    if (ctx.chat && sent?.message_id) {
      await screenFlowService.trackActiveScreen(
        telegramId,
        ctx.chat.id,
        sent.message_id,
        'dashboard_sessions',
        false,
      ).catch(() => {});
    }
  };

  // 1. Extend session: sess_ext:<uuid>
  if (data.startsWith('sess_ext:')) {
    const sessionId = data.slice('sess_ext:'.length).trim();
    const result = await dashboardAuthService.extendSession(sessionId, telegramId);

    if (result.success && result.newExpiresAt) {
      const formatted = formatDateTime(result.newExpiresAt);
      try {
        await ctx.answerCallbackQuery({ text: '⏳ تم تمديد الجلسة بنجاح لمدة 8 ساعات إضافية', show_alert: false });
      } catch {}
      const text =
        `✅ <b>تم تمديد الجلسة بنجاح</b>\n\n` +
        `⏳ تم تمديد صلاحية جلستك لمدة 8 ساعات إضافية حتى:\n` +
        `🕒 <b>${escapeHtml(formatted)}</b>`;
      const kb = new InlineKeyboard()
        .text('📋 قائمة الجلسات النشطة', 'sess_list')
        .row()
        .text('🔙 العودة لرابط لوحة التحكم', 'menu:exec:dashboard')
        .row()
        .text('🏠 القائمة الرئيسية', 'action:main_menu');
      await renderScreen(text, kb);
    } else {
      try {
        await ctx.answerCallbackQuery({ text: '⚠️ تعذر تمديد الجلسة: الجلسة ملغاة أو منتهية بالفعل.', show_alert: true });
      } catch {}
    }
    return true;
  }

  // 2. Revoke session: sess_rev:<uuid>
  if (data.startsWith('sess_rev:')) {
    const sessionId = data.slice('sess_rev:'.length).trim();
    const result = await dashboardAuthService.revokeSession(
      sessionId,
      'USER_TELEGRAM_REVOCATION',
      telegramId
    );

    if (result.success) {
      try {
        await ctx.answerCallbackQuery({ text: '🛑 تم إنهاء الجلسة فورياً بنجاح', show_alert: false });
      } catch {}
    } else {
      try {
        await ctx.answerCallbackQuery({ text: '⚠️ تعذر إنهاء الجلسة: غير موجودة', show_alert: true });
      } catch {}
    }

    const statusHeader = result.success
      ? `🛑 <b>تم إنهاء الجلسة فورياً بنجاح.</b>\n\n`
      : `⚠️ تعذر إنهاء الجلسة: غير موجودة أو منتهية بالفعل.\n\n`;

    const rawSessions = await dashboardAuthService.getActiveSessions(telegramId).catch(() => []);
    const sessions = Array.isArray(rawSessions) ? rawSessions : [];
    if (sessions.length === 0) {
      const emptyKeyboard = new InlineKeyboard()
        .text('🔙 العودة لرابط لوحة التحكم', 'menu:exec:dashboard')
        .row()
        .text('🏠 القائمة الرئيسية', 'action:main_menu');
      await renderScreen(`${statusHeader}ℹ️ <b>لا توجد أي جلسات نشطة حالياً لحسابك.</b>`, emptyKeyboard);
      return true;
    }

    let text = `${statusHeader}📋 <b>جلسات لوحة التحكم النشطة لحسابك (${sessions.length}):</b>\n────────────────────────────\n`;
    const keyboard = new InlineKeyboard();

    for (const [i, s] of sessions.entries()) {
      const expiryFormatted = formatDateTime(s.expiresAt);
      text += `\n<b>جلسة #${i + 1}</b> [${s.originKind}]\n`;
      text += `💻 الجهاز: ${escapeHtml(s.deviceSummary || 'غير محدد')}\n`;
      text += `🕒 تنتهي: ${expiryFormatted}\n`;

      keyboard.text(`🛑 إنهاء جلسة #${i + 1}`, `sess_rev:${s.id}`).row();
    }

    keyboard
      .text('🛑 إنهاء جميع الجلسات', 'sess_rev_all')
      .row()
      .text('🔙 العودة', 'menu:exec:dashboard');

    await renderScreen(text, keyboard);
    return true;
  }

  // 3. List active sessions: sess_list
  if (data === 'sess_list') {
    try {
      await ctx.answerCallbackQuery();
    } catch {}

    const sessions = await dashboardAuthService.getActiveSessions(telegramId);
    if (sessions.length === 0) {
      const emptyKeyboard = new InlineKeyboard()
        .text('🔙 العودة لرابط لوحة التحكم', 'menu:exec:dashboard')
        .row()
        .text('🏠 القائمة الرئيسية', 'action:main_menu');
      await renderScreen('ℹ️ <b>لا توجد أي جلسات نشطة حالياً لحسابك.</b>', emptyKeyboard);
      return true;
    }

    let text = `📋 <b>جلسات لوحة التحكم النشطة لحسابك (${sessions.length}):</b>\n────────────────────────────\n`;
    const keyboard = new InlineKeyboard();

    for (const [i, s] of sessions.entries()) {
      const expiryFormatted = formatDateTime(s.expiresAt);
      text += `\n<b>جلسة #${i + 1}</b> [${s.originKind}]\n`;
      text += `💻 الجهاز: ${escapeHtml(s.deviceSummary || 'غير محدد')}\n`;
      text += `🕒 تنتهي: ${expiryFormatted}\n`;

      keyboard.text(`🛑 إنهاء جلسة #${i + 1}`, `sess_rev:${s.id}`).row();
    }

    keyboard
      .text('🛑 إنهاء جميع الجلسات', 'sess_rev_all')
      .row()
      .text('🔙 العودة', 'menu:exec:dashboard');

    await renderScreen(text, keyboard);
    return true;
  }

  // 4. Revoke all sessions: sess_rev_all
  if (data === 'sess_rev_all') {
    await dashboardAuthService.revokeAllSessions(telegramId, 'USER_REVOKED_ALL_TELEGRAM');
    try {
      await ctx.answerCallbackQuery({ text: '🛑 تم إنهاء كافة جلساتك النشطة بنجاح', show_alert: true });
    } catch {}

    const emptyKeyboard = new InlineKeyboard()
      .text('🔙 العودة لرابط لوحة التحكم', 'menu:exec:dashboard')
      .row()
      .text('🏠 القائمة الرئيسية', 'action:main_menu');

    await renderScreen('🛑 <b>تم إنهاء كافة جلساتك النشطة في لوحة التحكم بنجاح.</b>', emptyKeyboard);
    return true;
  }

  return false;
}
