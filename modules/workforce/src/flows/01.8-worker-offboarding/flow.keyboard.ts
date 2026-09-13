/**
 * 01.8 Worker Offboarding & Financial Clearance — Keyboards & Navigation
 * Baseline SSOT: F:\HR\src\bot\conversations\end-of-service.conversation.ts
 * Master Plan 14: Pickers, Super Admin Hub, Decision Inboxes, PPE Proof & Post-Completion
 */

import { InlineKeyboard } from 'grammy';
import {
  buildWorkerPickerKeyboard as coreBuildWorkerPickerKeyboard,
  buildCompletionKeyboard,
  type WorkerItem,
  type WorkerKeyboardOptions,
} from '@alsaada/core-components';
import type {
  TerminationReason,
  OffboardReason,
  PendingDisciplinaryRecord,
} from './flow.types.js';
import {
  TERMINATION_REASON_LABELS,
  OFFBOARD_REASON_LABELS,
} from './flow.types.js';

// ============================================================================
// 1. Worker Picker Keyboard (prioritizing nickname via core-components)
// ============================================================================

export type WorkerPickerItemInput = {
  id: string;
  name: string;
  code: string;
  nickname?: string | null | undefined;
  jobTitle?: string | null | undefined;
  siteName?: string | null | undefined;
  legacyCode?: string | null | undefined;
};

export function buildWorkerPickerKeyboard(
  input: WorkerPickerItemInput[] | WorkerKeyboardOptions,
  customOptions?: Partial<WorkerKeyboardOptions>
): InlineKeyboard {
  if (Array.isArray(input)) {
    const workerItems: WorkerItem[] = input.map((w) => {
      const item: WorkerItem = {
        id: w.id,
        code: w.code,
        name: w.name,
        nickname: w.nickname ?? null,
      };
      if (w.jobTitle) item.jobTitle = w.jobTitle;
      if (w.legacyCode) item.legacyCode = w.legacyCode;
      if (w.siteName) item.siteLocation = w.siteName;
      return item;
    });

    return coreBuildWorkerPickerKeyboard({
      workers: workerItems,
      pagination: {
        page: 1,
        pageSize: Math.max(20, workerItems.length),
        totalPages: 1,
        totalItems: workerItems.length,
      },
      workerCallbackPrefix: 'action:wob:pick:',
      cancelCallbackData: 'action:wob:cancel',
      ...customOptions,
    });
  }

  return coreBuildWorkerPickerKeyboard(input);
}

// ============================================================================
// 2. Super Admin Hub Opening Keyboard
// ============================================================================

export function buildSuperAdminHubKeyboard(
  pendingClearancesCount = 0,
  pendingDecisionsCount = 0
): InlineKeyboard {
  const kb = new InlineKeyboard();

  kb.text('➕ تسجيل إنهاء خدمة لعامل جديد', 'action:wob:hub:new').row();

  const clearanceLabel = `📬 اعتماد المخالصات الميدانية المعلقة (${pendingClearancesCount})`;
  kb.text(clearanceLabel, 'action:wob:hub:pending_clearance').row();

  const decisionLabel = `⚖️ صندوق القرارات المعلقة (${pendingDecisionsCount})`;
  kb.text(decisionLabel, 'action:wob:hub:pending_decisions').row();

  kb.text('🏠 القائمة الرئيسية', 'action:main_menu');
  return kb;
}

// ============================================================================
// 3. Pending Decisions Inbox & Quick Actions
// ============================================================================

export function buildPendingDecisionsInboxKeyboard(
  records: PendingDisciplinaryRecord[],
  currentIndex = 0,
  totalRecords = 0
): InlineKeyboard {
  const kb = new InlineKeyboard();
  const count = totalRecords || records.length;
  const current = records[currentIndex];

  if (!current) {
    kb.text('🔙 العودة لقائمة الخيارات', 'action:wob:pd:back');
    return kb;
  }

  // Row 1: Decision actions
  kb.text('✅ اعتماد', `action:wob:pd:app:${current.id}`)
    .text('❌ استبعاد / رفض', `action:wob:pd:rej:${current.id}`)
    .row();

  // Row 2: Adjustment
  kb.text('✏️ تعديل القيمة', `action:wob:pd:adj:${current.id}`).row();

  // Row 3: Pagination if multiple
  if (count > 1) {
    if (currentIndex > 0) {
      kb.text('◀️ السابق', `action:wob:pd:nav:${currentIndex - 1}`);
    } else {
      kb.text('⏹️', 'noop');
    }

    kb.text(`📄 ${currentIndex + 1}/${count}`, 'noop');

    if (currentIndex < count - 1) {
      kb.text('التالي ▶️', `action:wob:pd:nav:${currentIndex + 1}`);
    } else {
      kb.text('⏹️', 'noop');
    }
    kb.row();
  }

  // Row 4: Batch & Return
  kb.text('✅ اعتماد الكل', 'action:wob:pd:batch_app')
    .text('❌ رفض الكل', 'action:wob:pd:batch_rej')
    .row();

  kb.text('🔙 العودة للرئيسية', 'action:wob:pd:back');
  return kb;
}

// ============================================================================
// 4. Disciplinary Radar Keyboard (In-Wizard)
// ============================================================================

export interface DisciplinaryRadarKeyboardOptions {
  isSuperAdmin?: boolean | undefined;
  superAdminWhatsAppUrl?: string | null | undefined;
}

export function buildDisciplinaryRadarKeyboard(
  hasPending: boolean,
  options?: DisciplinaryRadarKeyboardOptions
): InlineKeyboard {
  const kb = new InlineKeyboard();

  if (options?.isSuperAdmin) {
    if (hasPending) {
      kb.text('✅ اعتماد كافة القرارات ودمجها بالمخالصة', 'action:wob:disc:approve_all').row();
      kb.text('❌ استبعاد كافة القرارات المعلقة', 'action:wob:disc:reject_all').row();
      kb.text('🔘 تخصيص قرارات محددة (اعتماد فردي)', 'action:wob:disc:custom').row();
      kb.text('⏩ ترحيل للمسير واستكمال المخالصة', 'action:wob:disc:defer').row();
    } else {
      kb.text('✅ متابعة إلى سبب إنهاء الخدمة ◀️', 'action:wob:disc:proceed').row();
    }
  } else {
    // Field Admin
    if (hasPending && options?.superAdminWhatsAppUrl) {
      kb.url('📲 إرسال تنبيه للسوبر أدمن عبر واتساب', options.superAdminWhatsAppUrl).row();
    }
    kb.text('✅ متابعة رفع تقرير إخلاء الطرف ◀️', 'action:wob:disc:proceed').row();
  }

  kb.text('◀️ السابق', 'action:wob:back:worker');
  return kb;
}

// ============================================================================
// 5. Termination Reason Picker Keyboard
// ============================================================================

export function buildReasonKeyboard(options?: { includeBack?: boolean }): InlineKeyboard {
  const kb = new InlineKeyboard();
  const reasons = Object.keys(OFFBOARD_REASON_LABELS) as OffboardReason[];

  for (const r of reasons) {
    kb.text(OFFBOARD_REASON_LABELS[r], `action:wob:r:${r}`).row();
  }

  if (options?.includeBack !== false) {
    kb.text('◀️ السابق', 'action:wob:back:radar').text('❌ إلغاء', 'action:wob:cancel');
  } else {
    kb.text('🔙 إلغاء', 'action:wob:cancel');
  }

  return kb;
}

// ============================================================================
// 6. Worked Days Picker Keyboard
// ============================================================================

export interface WorkedDaysKeyboardOptions {
  daysBeforeLeave?: number | undefined;
  daysUntilExpectedReturn?: number | undefined;
  daysUntilToday?: number | undefined;
  isWorkerOnLeave?: boolean | undefined;
}

export function buildWorkedDaysKeyboard(options: WorkedDaysKeyboardOptions): InlineKeyboard {
  const kb = new InlineKeyboard();

  if (options.isWorkerOnLeave) {
    const beforeLeave = options.daysBeforeLeave ?? 0;
    const untilReturn = options.daysUntilExpectedReturn ?? 30;
    const untilToday = options.daysUntilToday ?? new Date().getDate();

    kb.text(`📅 حتى تاريخ النزول (${beforeLeave} يوم)`, 'action:wob:days:leave_start').row();
    kb.text(`🎯 حتى تاريخ العودة (${untilReturn} يوم)`, 'action:wob:days:leave_return').row();
    kb.text(`📅 حتى اليوم (${untilToday} يوم عمل)`, 'action:wob:days:today').row();
    kb.text('📅 حتى نهاية الشهر (30 يوم)', 'action:wob:days:month_end').row();
    kb.text('0️⃣ صفر يوم (في إجازة كامل الشهر)', 'action:wob:days:zero').row();
  } else {
    const untilToday = options.daysUntilToday ?? new Date().getDate();
    kb.text(`📅 حتى اليوم (${untilToday} يوم عمل)`, 'action:wob:days:today').row();
    kb.text('📅 حتى نهاية الشهر (30 يوم)', 'action:wob:days:month_end').row();
  }

  kb.text('✍️ كتابة عدد أيام آخر...', 'action:wob:days:custom').row();
  kb.text('◀️ السابق', 'action:wob:back:reason');
  return kb;
}

// ============================================================================
// 7. PPE Audit Keyboard (with Damaged Photo Button)
// ============================================================================

export function buildPPEAuditKeyboard(hasAssets: boolean): InlineKeyboard {
  const kb = new InlineKeyboard();

  kb.text('✅ استرداد كافة العهد بحالة ممتازة', 'action:wob:ppe:intact').row();
  kb.text('⚠️ توجد تلفيات أو نواقص بالعهد', 'action:wob:ppe:damaged').row();
  kb.text('📸 إرفاق صورة إثبات التلفيات', 'action:wob:ppe:photo').row();

  if (!hasAssets) {
    kb.text('⏩ خلو طرف بدون عهد مسجلة', 'action:wob:ppe:skip').row();
  }

  kb.text('◀️ السابق', 'action:wob:back:days');
  return kb;
}

// ============================================================================
// 8. Payout Option Keyboard (Blocking IMMEDIATE if pending decisions exist)
// ============================================================================

export function buildPayoutOptionKeyboard(hasPendingDecisions: boolean): InlineKeyboard {
  const kb = new InlineKeyboard();

  if (hasPendingDecisions) {
    kb.text('🔒 فوري (محجوب لوجود قرارات معلقة)', 'action:wob:payout:immediate_blocked').row();
    kb.text('💳 مجدول مع مسير الرواتب الشهري (إلزامي)', 'action:wob:payout:with_payroll').row();
  } else {
    kb.text('💵 صرف فوري نقدي وإقفال الحساب', 'action:wob:payout:immediate').row();
    kb.text('💳 مجدول مع مسير الرواتب الشهري', 'action:wob:payout:with_payroll').row();
  }

  kb.text('◀️ السابق', 'action:wob:back:ppe');
  return kb;
}

// ============================================================================
// 9. Negative Balance Resolution Keyboard
// ============================================================================

export function buildNegativeBalanceKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  kb.text('🤝 إسقاط وتراضي إداري', 'action:wob:neg:written_off').row();
  kb.text('🚫 تثبيت مديونية وإدراج بالقائمة السوداء', 'action:wob:neg:blacklisted').row();
  kb.text('◀️ السابق', 'action:wob:back:payout');
  return kb;
}

// ============================================================================
// 10. Confirmation Keyboard
// ============================================================================

export function buildConfirmKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🚨 تأكيد إنهاء الخدمة والمخالصة', 'action:wob:confirm')
    .row()
    .text('◀️ السابق', 'action:wob:back:confirm')
    .text('❌ تراجع وإلغاء', 'action:wob:cancel');
}

// ============================================================================
// 11. Post-Action Completion Keyboard (using @alsaada/core-components)
// ============================================================================

export interface ClearanceCompletionKeyboardOptions {
  whatsappUrl?: string | null | undefined;
  whatsappButtonText?: string | undefined;
  isFieldAdmin?: boolean | undefined;
  mainMenuCallbackData?: string | undefined;
}

export function buildClearanceCompletionKeyboard(
  options: ClearanceCompletionKeyboardOptions
): InlineKeyboard {
  return buildCompletionKeyboard({
    whatsappUrl: options.whatsappUrl ?? null,
    whatsappButtonText:
      options.whatsappButtonText ??
      (options.isFieldAdmin
        ? '📲 إرسال تقرير إخلاء الطرف للإدارة عبر واتساب'
        : '📲 إرسال إشعار المخالصة للعامل عبر واتساب'),
    repeatButtonText: options.isFieldAdmin
      ? '➕ رفع تقرير إخلاء طرف لعامل آخر'
      : '➕ إجراء مخالصة لعامل آخر',
    repeatCallbackData: 'wizard:worker_offboard:start',
    sectionButtonText: '🔙 العودة لقسم شؤون العاملين',
    sectionCallbackData: 'menu:hr_sub:onboarding',
    mainMenuCallbackData: options.mainMenuCallbackData ?? 'action:main_menu',
  });
}

export function buildSuccessKeyboard(options?: { whatsappUrl?: string | null | undefined }): InlineKeyboard {
  return buildClearanceCompletionKeyboard({
    whatsappUrl: options?.whatsappUrl,
  });
}
