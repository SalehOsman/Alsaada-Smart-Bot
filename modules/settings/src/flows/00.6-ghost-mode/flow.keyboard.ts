import { InlineKeyboard } from 'grammy';

export function buildGhostModeMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('👔 الإدارة العامة (جينرال أدمن)', 'action:impersonate:GENERAL_ADMIN')
    .row()
    .text('🛡️ المشرف الميداني (أدمن موقع)', 'action:impersonate:FIELD_ADMIN')
    .row()
    .text('👷 تقمص دور عامل فعلي', 'action:impersonate:pick_worker')
    .text('🚚 تقمص دور مورد فعلي', 'action:impersonate:pick_supplier')
    .row()
    .text('👤 الزائر والمستخدم الجديد', 'action:impersonate:GUEST')
    .row()
    .text('🔙 العودة للإعدادات', 'menu:super_admin_settings')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');
}

export function buildWorkerPickerKeyboard(
  workers: Array<{ id: string; name: string; code: string; siteName?: string | undefined }>
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let i = 0; i < workers.length; i += 2) {
    const w1 = workers[i];
    const w2 = workers[i + 1];
    if (w1) {
      kb.text(`👷 ${w1.name} (${w1.code})`, `action:impersonate:worker:${w1.id}`);
    }
    if (w2) {
      kb.text(`👷 ${w2.name} (${w2.code})`, `action:impersonate:worker:${w2.id}`);
    }
    kb.row();
  }
  kb.text('◀️ رجوع لمحاكاة الأدوار', 'action:ghost_mode:menu').row();
  kb.text('🏠 القائمة الرئيسية', 'action:main_menu');
  return kb;
}

export function buildSupplierPickerKeyboard(
  suppliers: Array<{ id: string; name: string; code: string }>
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let i = 0; i < suppliers.length; i += 2) {
    const s1 = suppliers[i];
    const s2 = suppliers[i + 1];
    if (s1) {
      kb.text(`🚚 ${s1.name} (${s1.code})`, `action:impersonate:supplier:${s1.id}`);
    }
    if (s2) {
      kb.text(`🚚 ${s2.name} (${s2.code})`, `action:impersonate:supplier:${s2.id}`);
    }
    kb.row();
  }
  kb.text('◀️ رجوع لمحاكاة الأدوار', 'action:ghost_mode:menu').row();
  kb.text('🏠 القائمة الرئيسية', 'action:main_menu');
  return kb;
}

export function buildExitGhostKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
}

