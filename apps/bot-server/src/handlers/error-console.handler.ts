import { InlineKeyboard } from 'grammy';
import type { MyContext } from '../types/context.js';
import { prisma } from '../db.js';
import { errorVaultService } from '../services/error-vault.service.js';
import { telemetryService, type UserBreadcrumb } from '../services/telemetry.service.js';
import { formatDateTime } from '@alsaada/regional-engine';

/**
 * 📋 استعراض قائمة الأعطال المسجلة للسوبر أدمن
 */
export async function renderErrorLogsList(
  ctx: MyContext,
  page = 1,
  inPlace = true
): Promise<void> {
  if (!ctx.isRealSuperAdmin) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: '🔒 غير مصرح لك بدخول هذا السجل.', show_alert: true });
    }
    return;
  }

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }

  const { items, total, totalPages } = await errorVaultService.getRecentErrors(page, 6);
  const unresolvedCount = await prisma.systemErrorLog.count({ where: { isResolved: false } }).catch(() => 0);

  const text =
    `⚠️ *سجل مراقبة الأعطال والأخطاء المركزية (Crash Vault)*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 *إحصائيات الأعطال:*\n` +
    `• إجمالي الأعطال المسجلة: *${total}*\n` +
    `• الأعطال المعلقة بانتظار الحل: *${unresolvedCount} عطل نشط*\n` +
    `• الصفحة الحالية: *${page} من ${totalPages}*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    (items.length === 0
      ? `🟢 *سجل الأعطال نظيف تماماً! لم يتم رصد أي أخطاء نشطة.*`
      : `اختر أي عطل من القائمة أدناه لفحص تفاصيله الجنائية:`);

  const keyboard = new InlineKeyboard();

  // Item rows
  for (const err of items) {
    const statusIcon = err.isResolved ? '🟢' : '🔴';
    const repText = err.occurrenceCount > 1 ? ` (${err.occurrenceCount}x)` : '';
    const label = `${statusIcon} ${err.errorReference}${repText} - ${err.actionTrigger || 'عطل'}`;
    keyboard.text(label.slice(0, 45), `action:error_log:view:${err.id}`).row();
  }

  // Pagination row
  const navRow = [];
  if (page > 1) {
    navRow.push({ text: '◀️ السابق', callback_data: `action:error_log:page:${page - 1}` });
  }
  if (totalPages > 1) {
    navRow.push({ text: `📄 ${page}/${totalPages}`, callback_data: 'action:noop' });
  }
  if (page < totalPages) {
    navRow.push({ text: 'التالي ▶️', callback_data: `action:error_log:page:${page + 1}` });
  }
  if (navRow.length > 0) {
    for (const btn of navRow) {
      keyboard.text(btn.text, btn.callback_data);
    }
    keyboard.row();
  }

  keyboard
    .text('🔄 تحديث السجل', `action:error_log:page:${page}`)
    .text('📊 مؤشرات APM', 'action:settings:perf_logs')
    .row()
    .text('🔙 العودة لقسم أداء وتشغيل المنظومة', 'action:settings_sub:system')
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (inPlace && ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      return;
    } catch {
      // Fallback
    }
  }

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

/**
 * 🔍 استعراض بطاقة العطل التفصيلية والتحليل الجنائي
 */
export async function renderErrorLogDetail(
  ctx: MyContext,
  errorId: string,
  inPlace = true
): Promise<void> {
  if (!ctx.isRealSuperAdmin) return;
  if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

  const err = await prisma.systemErrorLog.findUnique({ where: { id: errorId } });
  if (!err) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: '⚠️ لم يتم العثور على سجل هذا العطل.' });
    }
    return renderErrorLogsList(ctx, 1, inPlace);
  }

  const formattedCreated = formatDateTime(err.createdAt);
  const formattedLastSeen = formatDateTime(err.lastSeenAt);
  const statusLabel = err.isResolved ? '🟢 تم الحل والمعالجة بنجاح' : '🔴 نشط بانتظار التدخل';

  const breadcrumbsList = Array.isArray(err.breadcrumbs) && err.breadcrumbs.length > 0
    ? (err.breadcrumbs as unknown as UserBreadcrumb[]).map((b, i) => `  ${i + 1}. \`${b.action}\``).join('\n')
    : '  _لا توجد خطوات سابقة مسجلة_';

  const text =
    `🔍 *تفاصيل البلاغ الجنائي للعطل (${err.errorReference})*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `• *الحالة:* ${statusLabel}\n` +
    `• *مستوى الخطورة:* \`${err.severity}\`\n` +
    `• *تكرار الحدوث:* *${err.occurrenceCount} مرة*\n` +
    `• *أول ظهور:* ${formattedCreated}\n` +
    `• *آخر ظهور:* ${formattedLastSeen}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *بيانات المستخدم والإجراء:*\n` +
    `• *معرف المستخدم:* \`${err.actorTelegramId || 'غير معروف'}\` (${err.actorRole || 'GUEST'})\n` +
    `• *الإجراء المسبب:* \`${err.actionTrigger || 'غير محدد'}\`\n` +
    `• *الموقع البرمجي:* \`${err.sourceLocation || 'غير محدد'}\`\n\n` +
    `💬 *نص رسالة الخطأ:*\n` +
    `\`\`\`\n${err.errorMessage.slice(0, 300)}\n\`\`\`\n\n` +
    `✈️ *الصندوق الأسود (آخر خطوات المستخدم قبل العطل):*\n` +
    `${breadcrumbsList}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `اضغط أدناه لتغيير حالة المشكلة أو الرجوع:`;

  const keyboard = new InlineKeyboard();

  if (!err.isResolved) {
    keyboard.text('✅ اعتماد حل المشكلة وإغلاقها', `action:error_log:resolve:${err.id}`).row();
  }

  keyboard
    .text('◀️ العودة لسجل الأعطال', 'action:settings:error_logs')
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (inPlace && ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      return;
    } catch {
      // Fallback
    }
  }

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

/**
 * ✅ اعتماد حل الخطأ وإغلاقه
 */
export async function handleResolveError(ctx: MyContext, errorId: string): Promise<void> {
  if (!ctx.isRealSuperAdmin) return;
  const adminId = ctx.from ? BigInt(ctx.from.id) : undefined;
  await errorVaultService.resolveError(errorId, adminId);

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({
      text: '✅ تم اعتماد حل المشكلة وتحديث السجل كـ (محلول).',
      show_alert: true,
    });
  }

  await renderErrorLogDetail(ctx, errorId, true);
}

/**
 * 📊 لوحة مؤشرات الأداء والعمليات (APM Telemetry Dashboard)
 */
export async function renderPerformanceDashboard(
  ctx: MyContext,
  inPlace = true
): Promise<void> {
  if (!ctx.isRealSuperAdmin) return;
  if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

  const metrics = await telemetryService.getPerformanceSummary24h();

  let slowestList = '  _لا توجد عمليات بطيئة مسجلة._';
  if (metrics.slowestOps.length > 0) {
    slowestList = metrics.slowestOps
      .map((op, i) => `  ${i + 1}. \`${op.action}\` ⏱️ *${op.timeMs}ms*`)
      .join('\n');
  }

  const text =
    `📊 *لوحة مؤشرات الأداء والسرعة اللحظية (APM Dashboard)*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `متابعة حية لسرعة استجابة المحرك والعمليات التفاعلية خلال آخر 24 ساعة.\n\n` +
    `⚡ *المؤشرات الإجمالية:*\n` +
    `• إجمالي العمليات المسجلة: *${metrics.totalOps} حركة*\n` +
    `• متوسط سرعة الاستجابة: *${metrics.avgLatencyMs}ms* (المعيار < 15ms)\n\n` +
    `🎯 *توزيع سرعة الاستجابة:*\n` +
    `  🟢 فائق السرعة (< 50ms): *${metrics.greenPct}%*\n` +
    `  🟡 مقبول ومستقر (50-250ms): *${metrics.yellowPct}%*\n` +
    `  🔴 بطيء ويحتاج تحسين (> 250ms): *${metrics.redPct}%*\n\n` +
    `🐢 *أبطأ 5 عمليات تم رصدها:*\n` +
    `${slowestList}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `اختر الإجراء المطلوب:`;

  const keyboard = new InlineKeyboard()
    .text('🔄 تحديث المؤشرات', 'action:settings:perf_logs')
    .text('⚠️ سجل الأعطال', 'action:settings:error_logs')
    .row()
    .text('🔙 العودة لقسم أداء وتشغيل المنظومة', 'action:settings_sub:system')
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (inPlace && ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      return;
    } catch {}
  }

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}
