import { InlineKeyboard } from 'grammy';
import type { AdminAssignmentDto, SiteOptionDto } from './flow.types.js';

export function buildAdminAssignmentsHubKeyboard(users: AdminAssignmentDto[], isImpersonating?: boolean): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  users.forEach((u) => {
    const scopeLabel = u.assignedSiteName ? `📍 ${u.assignedSiteName}` : '🌐 وصول عام وشامل';
    keyboard
      .text(`👤 ${u.fullName} — [${scopeLabel}]`, `action:admin_assign:user:${u.telegramId}`)
      .row();
  });

  keyboard
    .text('🔙 العودة للحساب والأمان', 'action:settings_sub:identity')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (isImpersonating) {
    keyboard.row().text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
  }

  return keyboard;
}

export function buildUserAssignmentCardKeyboard(user: AdminAssignmentDto, sites: SiteOptionDto[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  const isGlobal = !user.assignedSiteId;
  keyboard
    .text(isGlobal ? '🔘 🌐 صلاحية عامة وشاملة (الحالي)' : '⚪ 🌐 صلاحية عامة وشاملة (إلغاء التقييد)', `action:admin_assign:set:${user.telegramId}:GLOBAL`)
    .row();

  sites.forEach((s) => {
    const isCurrent = user.assignedSiteId === s.id;
    const prefix = isCurrent ? '🔘' : '⚪';
    keyboard
      .text(`${prefix} 📍 ${s.name} (${s.code})`, `action:admin_assign:set:${user.telegramId}:${s.id}`)
      .row();
  });

  keyboard
    .text('🔙 العودة لقائمة المسؤولين', 'action:settings:admin_assignments')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  return keyboard;
}
