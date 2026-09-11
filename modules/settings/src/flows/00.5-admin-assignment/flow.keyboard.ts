import { InlineKeyboard } from 'grammy';
import type { AdminAssignmentDto, SiteOptionDto } from './flow.types.js';

export function buildAdminAssignmentsHubKeyboard(users: AdminAssignmentDto[], isImpersonating?: boolean): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  users.forEach((u) => {
    const isGlobal = !u.assignedSiteId;
    const badge = isGlobal ? '🌟' : '🛡️';
    const scopeLabel = u.assignedSiteName ? `📍 ${u.assignedSiteName}` : '🌐 وصول عام';
    keyboard
      .text(`${badge} ${u.fullName} — [${scopeLabel}]`, `adm:u:${u.telegramId}`)
      .row();
  });

  keyboard
    .text('🔙 العودة للكيان والمشاريع', 'action:settings_sub:corporate')
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
    .text(isGlobal ? '🔘 🌐 صلاحية عامة وشاملة (الحالي)' : '⚪ 🌐 صلاحية عامة وشاملة (إلغاء التقييد)', `adm:s:${user.telegramId}:GLOBAL`)
    .row();

  sites.forEach((s) => {
    const isCurrent = user.assignedSiteId === s.id;
    const prefix = isCurrent ? '🔘' : '⚪';
    const countText = typeof s.workersCount === 'number' ? ` — 👥 ${s.workersCount}` : '';
    // Formatted label under 34 chars to prevent truncation on mobile screens
    const siteLabel = `${prefix} (${s.code}) ${s.name.slice(0, 14)}${countText}`;
    keyboard
      .text(siteLabel, `adm:s:${user.telegramId}:${s.id}`)
      .row();
  });

  keyboard
    .text('🔙 العودة لقائمة المسؤولين', 'action:settings:admin_assignments')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  return keyboard;
}
