import { InlineKeyboard } from 'grammy';
import { MyContext } from '../types/context.js';
import { prisma } from '../db.js';
import { invalidateUserCache } from '../middlewares/auth.middleware.js';
import { systemDataService } from '../services/system-data.service.js';

/**
 * Lists all staff/admins and their current site assignments
 */
export async function renderAdminAssignmentsHub(
  ctx: MyContext,
  inPlace = false,
  noticeText?: string
): Promise<void> {
  if (!ctx.isRealSuperAdmin || !ctx.from) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({
        text: '🔒 هذا القسم مخصص حصرياً للمدير العام.',
        show_alert: true,
      });
    }
    return;
  }

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }

  // ⚡ L1 IN-MEMORY RAM (< 0.1ms) with SWR background revalidation via SystemDataService
  const users = await systemDataService.getAdminUsersList();

  const keyboard = new InlineKeyboard();

  users.forEach((u) => {
    const scopeLabel = u.assignedSite ? `📍 ${u.assignedSite.name}` : '🌐 وصول عام وشامل';
    keyboard
      .text(`👤 ${u.fullName} — [${scopeLabel}]`, `action:admin_assign:user:${u.telegramId}`)
      .row();
  });

  keyboard
    .text('🔙 العودة للحساب والأمان', 'action:settings_sub:identity')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (ctx.isImpersonating && ctx.isRealSuperAdmin) {
    keyboard
      .row()
      .text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
  }

  let banner = '';
  if (noticeText) {
    banner = `✨ *${noticeText}*\n────────────────────────────\n\n`;
  }

  const text =
    `${banner}` +
    `👥 *لوحة تعيين وتوزيع مدراء المواقع والفروع (Admin Site Scoping)*\n` +
    `────────────────────────────\n` +
    `🛡️ *محرك عزل الصلاحيات (RBAC Scoping):*\n` +
    `• تعيين المشرف على موقع محدد (أو المقر الرئيسي) يحصر كافة صلاحياته وعمالته وعهدته ومصروفاته في حدود موقعه فقط.\n` +
    `• ترك المستخدم دون تعيين يمنحه صلاحية عامة وشاملة لكافة المواقع.\n\n` +
    `👇 *اختر المستخدم المطلوب لتعديل نطاق إشرافه وموقعه:*`;

  if (inPlace && ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      return;
    } catch {}
  }

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

/**
 * Displays details of an admin and options to assign them to a site or global access
 */
export async function renderUserAssignmentCard(
  ctx: MyContext,
  targetTelegramId: bigint,
  inPlace = false,
  noticeText?: string
): Promise<void> {
  if (!ctx.isRealSuperAdmin || !ctx.from) return;

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }

  const targetUser = await prisma.user.findUnique({
    where: { telegramId: targetTelegramId },
    include: { assignedSite: true },
  });

  if (!targetUser) {
    return renderAdminAssignmentsHub(ctx, inPlace);
  }

  // ⚡ L1 IN-MEMORY RAM (< 0.1ms) with SWR background revalidation via SystemDataService
  const allSites = await systemDataService.getSites();
  const sites = allSites.filter((s) => s.status === 'ACTIVE');

  const keyboard = new InlineKeyboard();

  // Option 1: Global Access
  const isGlobal = !targetUser.assignedSiteId;
  keyboard
    .text(
      isGlobal ? '🔘 🌐 وصول عام وشامل (مفعل حالياً)' : '⚪ 🌐 منح وصول عام وشامل لكافة المواقع',
      `action:admin_assign:set:${targetTelegramId}:GLOBAL`
    )
    .row();

  // Option 2: Active Sites
  sites.forEach((site) => {
    const isSelected = targetUser.assignedSiteId === site.id;
    const bullet = isSelected ? '🔘' : '⚪';
    keyboard
      .text(
        `${bullet} ${site.name} (${site.code})`,
        `action:admin_assign:set:${targetTelegramId}:${site.id}`
      )
      .row();
  });

  keyboard
    .text('🔙 العودة لقائمة المدراء', 'action:settings:admin_assignments')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (ctx.isImpersonating && ctx.isRealSuperAdmin) {
    keyboard
      .row()
      .text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
  }

  let banner = '';
  if (noticeText) {
    banner = `✨ *${noticeText}*\n────────────────────────────\n\n`;
  }

  const currentScope = targetUser.assignedSite
    ? `📍 \`${targetUser.assignedSite.name} (${targetUser.assignedSite.code})\``
    : '`🌐 صلاحية عامة وشاملة (لكافة المواقع)`';

  const text =
    `${banner}` +
    `👤 *إدارة تعيين النطاق للمستخدم:* \`${targetUser.fullName}\`\n` +
    `────────────────────────────\n` +
    `🆔 *المعرف الرقمي:* \`${targetUser.telegramId}\`\n` +
    `👑 *الرتبة والدور:* \`${targetUser.role}\`\n` +
    `📌 *نطاق الصلاحيات الحالي:*\n${currentScope}\n` +
    `────────────────────────────\n` +
    `👇 *اختر الموقع المطلوب حصره عليه، أو امنحه وصولاً عاماً:*`;

  if (inPlace && ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      return;
    } catch {}
  }

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

/**
 * Handles setting a user's assigned site
 */
export async function handleSetUserSiteAssignment(
  ctx: MyContext,
  targetTelegramId: bigint,
  siteIdOrGlobal: string
): Promise<void> {
  if (!ctx.isRealSuperAdmin || !ctx.from) return;

  const assignedSiteId = siteIdOrGlobal === 'GLOBAL' ? null : siteIdOrGlobal;

  const updatedUser = await prisma.user.update({
    where: { telegramId: targetTelegramId },
    data: { assignedSiteId },
    include: { assignedSite: true },
  });

  await invalidateUserCache(targetTelegramId);
  await systemDataService.invalidateUser(targetTelegramId);

  const siteLabel = updatedUser.assignedSite
    ? `موقع ${updatedUser.assignedSite.name}`
    : 'وصول عام شامل';

  const notice = `تم تحديث نطاق إشراف (${updatedUser.fullName}) وحصره في: (${siteLabel}) بنجاح.`;
  await renderUserAssignmentCard(ctx, targetTelegramId, true, notice);
}
