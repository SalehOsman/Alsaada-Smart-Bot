import { InlineKeyboard } from 'grammy';
import { getWorkerDisplayName } from '@alsaada/core-components';
import type { UserListItemDto, UserDetailDto, WorkerCandidateDto } from './flow.types.js';

export function buildRoleBadge(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '👑 سوبر أدمن';
    case 'EXECUTIVE':
      return '👔 تنفيذي';
    case 'FIELD_ADMIN':
      return '🛡️ مشرف موقع';
    case 'ACCOUNTANT':
      return '💼 محاسب';
    case 'WORKER':
      return '👷 عامل';
    case 'SUPPLIER':
      return '🚚 مورد';
    case 'GUEST':
    default:
      return '👤 زائر';
  }
}

export function buildUserDirectoryKeyboard(
  users: UserListItemDto[],
  page: number,
  totalPages: number
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  users.forEach((u) => {
    const statusIcon = u.isBanned ? '🔴' : u.isActive ? '🟢' : '⚪';
    const roleShort = buildRoleBadge(u.role).split(' ')[0] || '👤';
    const workerTag = u.workerCode ? `[#${u.workerCode}] ` : '';
    const label = `${statusIcon} ${roleShort} ${workerTag}${u.fullName}`.slice(0, 36);
    keyboard.text(label, `urb:u:${u.telegramId}`).row();
  });

  // Pagination Controls
  const navRow = [];
  if (page > 1) {
    navRow.push(InlineKeyboard.text('◀️ السابق', `urb:p:${page - 1}`));
  }
  navRow.push(InlineKeyboard.text(`📄 ${page} / ${totalPages}`, 'urb:noop'));
  if (page < totalPages) {
    navRow.push(InlineKeyboard.text('التالي ▶️', `urb:p:${page + 1}`));
  }
  keyboard.row(...navRow);

  // Search and Action Buttons
  keyboard
    .text('🔍 بحث عن مستخدم', 'urb:s')
    .text('👷 ربط عامل بتليجرام', 'urb:lw')
    .row();

  keyboard
    .text('🔙 العودة لقسم الهوية', 'action:settings_sub:identity')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  return keyboard;
}

export function buildUserDetailKeyboard(user: UserDetailDto): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  keyboard
    .text('🔄 تغيير الرتبة والصلاحية', `urb:r:${user.telegramId}`)
    .row()
    .text('🛡️ تعيين كمشرف مهام ميداني', `urb:prm:${user.telegramId}`)
    .row();

  if (user.isBanned) {
    keyboard.text('🟢 فك الحظر وإعادة التنشيط', `urb:tb:${user.telegramId}`).row();
  } else {
    keyboard.text('🔴 حظر وتجميد الحساب', `urb:tb:${user.telegramId}`).row();
  }

  keyboard
    .text('🗑️ سحب الصلاحيات وفك الارتباط الفوري', `urb:rv:${user.telegramId}`)
    .row();

  keyboard
    .text('🔙 العودة لدليل المستخدمين', 'action:settings:user_rbac')
    .text('🏠 الرئيسية', 'action:main_menu');

  return keyboard;
}

export function buildRoleSelectionKeyboard(targetTelegramId: bigint): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const idStr = targetTelegramId.toString();

  keyboard
    .text('👑 مدير عام (سوبر أدمن)', `urb:sr:${idStr}:SUPER_ADMIN`)
    .row()
    .text('👔 إدارة تنفيذية ومالية', `urb:sr:${idStr}:EXECUTIVE`)
    .row()
    .text('🛡️ مشرف موقع وميداني', `urb:sr:${idStr}:FIELD_ADMIN`)
    .row()
    .text('🛡️ مشرف مهام عمالية (Worker Supervisor)', `urb:prm:${idStr}`)
    .row()
    .text('💼 محاسب مالي', `urb:sr:${idStr}:ACCOUNTANT`)
    .row()
    .text('👷 عامل (بوابة ذاتية)', `urb:sr:${idStr}:WORKER`)
    .row()
    .text('👤 زائر (تجريد من الصلاحيات)', `urb:sr:${idStr}:GUEST`)
    .row();

  keyboard
    .text('◀️ إلغاء ورجوع', `urb:u:${idStr}`)
    .text('🏠 الرئيسية', 'action:main_menu');

  return keyboard;
}

export function buildWorkerSupervisorProfilesKeyboard(targetTelegramId: bigint): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const idStr = targetTelegramId.toString();

  keyboard
    .text('⛽ مشرف الوقود والمحروقات', `urb:sp:${idStr}:FUEL_SUPERVISOR`)
    .row()
    .text('🛒 مشرف الكانتين والمقصف', `urb:sp:${idStr}:CANTEEN_SUPERVISOR`)
    .row()
    .text('🏠 مشرف السكن والإعاشة', `urb:sp:${idStr}:HOUSING_SUPERVISOR`)
    .row()
    .text('⏱️ مشرف التشغيل والورديات', `urb:sp:${idStr}:SHIFT_SUPERVISOR`)
    .row();

  keyboard
    .text('◀️ إلغاء ورجوع', `urb:u:${idStr}`)
    .text('🏠 الرئيسية', 'action:main_menu');

  return keyboard;
}

export function buildWorkerCandidatesKeyboard(workers: WorkerCandidateDto[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  workers.slice(0, 10).forEach((w) => {
    const displayName = getWorkerDisplayName({ name: w.name, nickname: w.nickname });
    const label = `👷 [${w.code}] ${displayName}`.slice(0, 36);
    keyboard.text(label, `urb:w:${w.id}`).row();
  });

  keyboard
    .text('🔙 العودة لقائمة المستخدمين', 'action:settings:user_rbac')
    .text('🏠 الرئيسية', 'action:main_menu');

  return keyboard;
}

export function buildPreviewConfirmKeyboard(workerId: string, telegramId: bigint): InlineKeyboard {
  const tgIdStr = telegramId.toString();
  return new InlineKeyboard()
    .text('✅ تأكيد واعتماد الربط الفوري', `urb:cp:${workerId}:${tgIdStr}`)
    .row()
    .text('❌ إلغاء وتراجع', 'action:settings:user_rbac');
}

export function buildConflictConfirmKeyboard(workerId: string, telegramId: bigint): InlineKeyboard {
  const tgIdStr = telegramId.toString();
  return new InlineKeyboard()
    .text('⚠️ تأكيد نقل الارتباط وتنزيل الحساب القديم', `urb:cc:${workerId}:${tgIdStr}`)
    .row()
    .text('❌ إلغاء العملية', 'action:settings:user_rbac');
}

export function buildLinkSuccessKeyboard(whatsAppUrl?: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (whatsAppUrl) {
    keyboard.url('📲 إرسال رابط التفعيل للعامل عبر واتساب', whatsAppUrl).row();
  }

  keyboard
    .text('👷 ربط عامل آخر', 'urb:lw')
    .text('📋 دليل المستخدمين', 'action:settings:user_rbac')
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  return keyboard;
}

export function buildCancelBackKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('❌ إلغاء والعودة', 'action:settings:user_rbac')
    .text('🏠 الرئيسية', 'action:main_menu');
}
