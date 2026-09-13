import crypto from 'node:crypto';
import { InlineKeyboard } from 'grammy';
import { TelemetryLogger } from '@alsaada/telemetry';
import { formatClickToCopy } from '@alsaada/core-components';
import { formatDateTime } from '@alsaada/regional-engine';
import type { MyContext } from '../types/context.js';
import { dashboardAuthService } from '../services/dashboard-auth.service.js';
import { config } from '../config/env.js';

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

    // Delegate authorization and dual token issuance to dashboardAuthService
    const result = await dashboardAuthService.issueDualDashboardAccess({
      telegramId,
      username: ctx.from.username ?? null,
      firstName: ctx.from.first_name ?? null,
      lastName: ctx.from.last_name ?? null,
      chatType: ctx.chat?.type ?? 'private',
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
      `🚀 <b>رابط الدخول المباشر للوحة التحكم المؤسسية — روابط الدخول المباشر للوحة التحكم المؤسسية</b>\n` +
      `────────────────────────────\n` +
      `مرحباً بك يا <b>${escapeHtml(user.fullName)}</b> (${escapeHtml(roleTitle)}).${siteInfo}\n\n` +
      `🔐 <b>تم إصدار رابطين متزامنين مؤمنين لحسابك:</b>\n` +
      `⏱️ <b>الصلاحية:</b> صالحان لمدة <b>5 دقائق فقط</b>.\n` +
      `🛡️ <b>الأمان:</b> استخدام لمرة واحدة ذرياً (Single-Use Token).\n\n` +
      `💻 <b>الرابط المحلي (Localhost):</b>\n` +
      `${formatClickToCopy(escapeHtml(localUrl), 'html')}\n\n` +
      `🌐 <b>رابط النفق الخارجي (Tunnel):</b>\n` +
      `${formatClickToCopy(escapeHtml(tunnelUrl), 'html')}\n\n` +
      `اضغط أدناه لفتح لوحة التحكم فوراً بالمتصفح:`;

    const keyboard = new InlineKeyboard()
      .url('🌐 فتح عبر النفق (Tunnel)', tunnelUrl)
      .row()
      .url('💻 فتح محلياً (Localhost)', localUrl)
      .row()
      .text('📋 جلساتي النشطة', 'sess_list')
      .row()
      .text('🏠 القائمة الرئيسية', 'action:main_menu');

    if (isPrivateChat) {
      await ctx.reply(card, { parse_mode: 'HTML', reply_markup: keyboard });
    } else {
      // If invoked inside a group or topic: send private message to user directly to prevent token leakage
      try {
        await ctx.api.sendMessage(Number(telegramId), card, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
        await ctx.reply('🔒 <b>تم إرسال رابط الدخول المباشر إلى محادثتك الخاصة</b> حفاظاً على سرية البيانات.', {
          parse_mode: 'HTML',
        });
      } catch (error) {
        logger.warn('Dashboard private delivery failed', {
          traceId,
          action: 'dashboard.private-delivery',
          actor: { telegramId: String(telegramId), role: user.role },
          error,
        });
        await ctx.reply(
          '⚠️ تعذر إرسال الرابط في الخاص. يرجى التكرم بفتح محادثة البوت بالخاص أولاً ثم كتابة الأمر <code>/dashboard</code>.',
          {
            parse_mode: 'HTML',
            reply_markup: buildDashboardRecoveryKeyboard(),
          },
        );
      }
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

  try {
    await ctx.answerCallbackQuery();
  } catch {
    // Ignore callback acknowledgement errors
  }

  // 1. Extend session: sess_ext:<uuid>
  if (data.startsWith('sess_ext:')) {
    const sessionId = data.slice('sess_ext:'.length).trim();
    const result = await dashboardAuthService.extendSession(sessionId, telegramId);

    if (result.success && result.newExpiresAt) {
      const formatted = formatDateTime(result.newExpiresAt);
      await ctx.reply(
        `✅ <b>تم تمديد الجلسة بنجاح</b>\n\n` +
        `⏳ تم تمديد صلاحية جلستك لمدة 8 ساعات إضافية حتى:\n` +
        `🕒 <b>${escapeHtml(formatted)}</b>`,
        { parse_mode: 'HTML' }
      );
    } else {
      await ctx.reply(`⚠️ تعذر تمديد الجلسة: الجلسة ملغاة أو منتهية بالفعل.`);
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
      await ctx.reply(`🛑 <b>تم إنهاء الجلسة فورياً بنجاح.</b>`, { parse_mode: 'HTML' });
    } else {
      await ctx.reply(`⚠️ تعذر إنهاء الجلسة: الجلسة غير موجودة.`);
    }
    return true;
  }

  // 3. List active sessions: sess_list
  if (data === 'sess_list') {
    const sessions = await dashboardAuthService.getActiveSessions(telegramId);
    if (sessions.length === 0) {
      await ctx.reply('ℹ️ <b>لا توجد أي جلسات نشطة حالياً لحسابك.</b>', { parse_mode: 'HTML' });
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

    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    return true;
  }

  // 4. Revoke all sessions: sess_rev_all
  if (data === 'sess_rev_all') {
    await dashboardAuthService.revokeAllSessions(telegramId, 'USER_REVOKED_ALL_TELEGRAM');
    await ctx.reply('🛑 <b>تم إنهاء كافة جلساتك النشطة في لوحة التحكم بنجاح.</b>', {
      parse_mode: 'HTML',
    });
    return true;
  }

  return false;
}
