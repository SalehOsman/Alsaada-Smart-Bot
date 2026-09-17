import { InlineKeyboard } from 'grammy';
import type { UserRole } from '../shared/module.types.js';
import { WORKFORCE_FLOW_METADATA } from '../flows.manifest.js';

export interface DynamicSubHubCounts {
  pendingEditCount?: number | undefined;
  pendingDecisionsCount?: number | undefined;
}

export function hasAccessToFlow(userRole: UserRole | string, allowedRoles: UserRole[]): boolean {
  if (userRole === 'SUPER_ADMIN') return true;
  return (allowedRoles as string[]).includes(userRole);
}

export function buildHrSubHubKeyboard(
  subKey: string,
  userRole: UserRole | string,
  isSuperAdmin: boolean,
  counts?: DynamicSubHubCounts
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // Find all flow metadata buttons designated for this sub-section
  const matchingFlows = WORKFORCE_FLOW_METADATA
    .filter((f) => f.menuButton && f.menuButton.subSection === subKey)
    .filter((f) => hasAccessToFlow(userRole, f.allowedRoles))
    .sort((a, b) => (a.menuButton?.order ?? 0) - (b.menuButton?.order ?? 0));

  for (const flow of matchingFlows) {
    if (flow.menuButton) {
      if (flow.menuButton.requiresSuperAdmin && !isSuperAdmin) {
        continue;
      }
      keyboard.text(flow.menuButton.label, flow.menuButton.callbackData).row();
    }
  }

  // Inject dynamic review/approval counters for super admins in onboarding sub-hub
  if (subKey === 'onboarding' && isSuperAdmin && counts) {
    if (counts.pendingEditCount && counts.pendingEditCount > 0) {
      keyboard.text(`📨 مراجعة طلبات التعديل المعلقة (${counts.pendingEditCount})`, 'action:worker_edit:pending_list').row();
    }
    if (counts.pendingDecisionsCount && counts.pendingDecisionsCount > 0) {
      keyboard.text(`⚖️ صندوق القرارات المعلقة (${counts.pendingDecisionsCount})`, 'action:wob:hub:pending_decisions').row();
    }
  }

  // Handle worker_excel specific layout
  if (subKey === 'worker_excel') {
    keyboard
      .text('📊 تنزيل كشف العاملين (إكسيل)', 'action:worker_export:start')
      .row()
      .text('📥 تنزيل قالب استيراد العمالة', 'action:worker:download_excel')
      .row();

    if (isSuperAdmin) {
      keyboard.text('📤 رفع كشف العمال (إكسيل)', 'action:worker:upload_excel').row();
    }
  }

  // Handle other sub-hubs (advances, leaves, payroll, admin_affairs)
  if (subKey === 'advances') {
    keyboard
      .text('➕ طلب / تسجيل سلفة جديدة', 'action:advances:request')
      .row()
      .text('💸 تسجيل مسحوب نقدي ميداني', 'action:advances:cash_withdrawal')
      .row()
      .text('📋 سجل السلف والمسحوبات النشطة', 'action:advances:active_list')
      .row()
      .text('📊 كشف حساب وتصفية عامل', 'action:advances:worker_statement')
      .row();
  } else if (subKey === 'leaves') {
    keyboard
      .text('➕ تسجيل إجازة أو نزول لعامل', 'action:leaves:request')
      .row()
      .text('🛬 تسجيل عودة واستئناف العمل', 'action:leaves:return')
      .row()
      .text('📍 كشف التواجد الميداني وحضور اليوم', 'action:leaves:daily_attendance')
      .row()
      .text('📋 سجل الإجازات والنزول المفتوح', 'action:leaves:active_list')
      .row();
  } else if (subKey === 'payroll') {
    keyboard
      .text('📊 مسير الرواتب الشهري العام', 'action:payroll:monthly_sheet')
      .row()
      .text('🧾 إصدار وتوزيع قسائم الرواتب', 'action:payroll:slips')
      .row()
      .text('⚙️ إعدادات البدلات والاستقطاعات', 'action:payroll:allowances_settings')
      .row()
      .text('💰 ترحيل الرواتب والمطابقة البنكية', 'action:payroll:bank_export')
      .row();
  } else if (subKey === 'admin_affairs') {
    keyboard
      .text('🪪 تنبيهات سريان البطاقات والوثائق', 'action:admin_affairs:expiry_alerts')
      .row()
      .text('⛺ سكن العمال والمخيم والإعاشة', 'action:admin_affairs:camp_management')
      .row()
      .text('⚖️ الجزاءات والإنذارات والمكافآت', 'action:admin_affairs:penalties_rewards')
      .row()
      .text('📄 الشهادات والخطابات الإدارية', 'action:admin_affairs:letters')
      .row();
  }

  return keyboard;
}
