/**
 * 01.8 Worker Offboarding & Financial Clearance — Messages & Formatting
 * Baseline SSOT: F:\HR\src\bot\conversations\end-of-service.conversation.ts
 * Master Plan 14: Dual-Role Cards, Settlement Documents, Negative Balance Red Alert & WhatsApp Links
 */

import { formatCurrency, formatDate } from '@alsaada/regional-engine';
import {
  formatClickToCopy,
  formatMonospace,
  buildWhatsAppLink,
  normalizeEgyptianPhone,
  type WhatsAppReceiptData,
} from '@alsaada/core-components';
import type {
  TerminationReason,
  OffboardReason,
  ClearancePayoutOption,
  ClearanceFinancialBreakdown,
  PendingDisciplinaryRecord,
} from './flow.types.js';
import {
  TERMINATION_REASON_LABELS,
  OFFBOARD_REASON_LABELS,
  CLEARANCE_PAYOUT_LABELS,
} from './flow.types.js';

// ============================================================================
// 1. Headers & Step Prompts
// ============================================================================

export function formatHubMenuHeader(pendingClearanceCount = 0, pendingDecisionsCount = 0): string {
  return [
    `🚪 *بوابة إنهاء الخدمة والمخالصات المالية المركزية*`,
    `────────────────────────────`,
    `مرحباً بك في المنظومة المركزية لإجراء المخالصات وتصفية المستحقات.\n`,
    `📊 *الموقف المعلق حالياً:*`,
    `• 📬 مخالصات ميدانية معلقة: *${pendingClearanceCount}* تقرير`,
    `• ⚖️ قرارات وجزاءات معلقة: *${pendingDecisionsCount}* معاملة\n`,
    `اختر العملية المراد البدء فيها:`,
  ].join('\n');
}

export function formatWorkerSelectHeader(): string {
  return [
    `📋 *إنهاء خدمة عامل وإخلاء طرف ومخالصة نهائية*`,
    `────────────────────────────`,
    `اختر العامل المراد إجراء إنهاء الخدمة والمخالصة له من القائمة الميدانية:`,
  ].join('\n');
}

export function formatReasonSelectHeader(workerName: string, workerCode: string): string {
  return [
    `⚠️ *تحديد سبب إنهاء الخدمة للعامل*`,
    `────────────────────────────`,
    `العامل: *${workerName}* (كود: ${formatClickToCopy(workerCode)})\n`,
    `👇 *اختر السبب المعتمد لإنهاء الخدمة:*`,
  ].join('\n');
}

export function formatPPEDamagePhotoPrompt(workerName: string): string {
  return [
    `📸 *إرفاق صورة إثبات تلفيات أو فقدان العهد الميدانية*`,
    `────────────────────────────`,
    `العامل: *${workerName}*\n`,
    `يرجى إرسال صورة فوتوغرافية واضحة من الموقع للعهد التالفة أو المفقودة.`,
    `سيتم أرشفة الصورة جنائياً وربط مسارها بسند المخالصة الرسمي.`,
  ].join('\n');
}

export function formatPayoutOptionPrompt(
  workerName: string,
  hasPendingDecisions: boolean,
  netAmount: number
): string {
  const formattedNet = formatCurrency(Math.abs(netAmount));
  const statusNote =
    netAmount >= 0
      ? `صافي المستحق للعامل: *${formattedNet}*`
      : `صافي المديونية المطلوبة من العامل: *${formattedNet}*`;

  if (hasPendingDecisions) {
    return [
      `💳 *تحديد خطة صرف المستحقات وتصفية الحساب*`,
      `────────────────────────────`,
      `العامل: *${workerName}* | ${statusNote}\n`,
      `⚠️ *تنبيه سيادي صارم:*`,
      `يوجد قرارات إدارية معلقة بحق العامل لم يتم البت فيها من الإدارة العليا.`,
      `وفقاً للائحة المالية للشركة: **يُحظر الصرف الفوري نهائياً** ويتم ترحيل وتجميد الصرف ليُصرف إجبارياً **مع مسير الرواتب الشهري (WITH_PAYROLL)** لحين تسوية كافة القرارات.`,
    ].join('\n');
  }

  return [
    `💳 *تحديد خطة صرف المستحقات وتصفية الحساب*`,
    `────────────────────────────`,
    `العامل: *${workerName}* | ${statusNote}\n`,
    `اختر طريقة الصرف المعتمدة:`,
  ].join('\n');
}

// ============================================================================
// 2. Field Admin Operational Review Card (Zero Financial Leaks)
// ============================================================================

export interface FieldAdminReviewCardData {
  workerName: string;
  workerCode: string;
  jobTitle?: string | null | undefined;
  siteName?: string | null | undefined;
  reason: TerminationReason | OffboardReason;
  workedDays: number;
  ppeObservations?: string | null | undefined;
  leaveStatusText?: string | null | undefined;
  submitterName?: string | null | undefined;
  notes?: string | null | undefined;
}

export function formatFieldAdminReviewCard(data: FieldAdminReviewCardData): string {
  const reasonText =
    OFFBOARD_REASON_LABELS[data.reason as OffboardReason] ||
    TERMINATION_REASON_LABELS[data.reason as TerminationReason] ||
    data.reason;

  const lines: string[] = [
    `📋 *مراجعة تقرير إخلاء الطرف الميداني (طلب معلق)*`,
    `────────────────────────────`,
    `👤 *العامل:* *${data.workerName}* (كود: ${formatClickToCopy(data.workerCode)})`,
    `💼 *الوظيفة:* ${data.jobTitle || 'عامل موقع'} | 📍 *الموقع:* ${data.siteName || 'الموقع العام'}`,
  ];

  if (data.leaveStatusText) lines.push(`🏖️ *موقف الإجازة:* ${data.leaveStatusText}`);
  lines.push(`📋 *سبب ترك العمل:* ${reasonText}`);
  lines.push(`🦺 *موقف العهد:* ${data.ppeObservations || 'تم استرداد العهد سليمة ميدانياً'}`);
  lines.push(`📅 *أيام العمل الميدانية المثبتة:* *${data.workedDays}* يوم عمل`);
  if (data.notes) lines.push(`📝 *ملاحظات إضافية:* ${data.notes}`);
  if (data.submitterName) lines.push(`👤 *المشرف المحرر:* ${data.submitterName}`);

  lines.push(
    `────────────────────────────`,
    `🔒 *تنويه حوكمي ميداني:*`,
    `سيتم إرسال هذا التقرير للإدارة العليا (Super Admin) لاعتماد الموقف المالي وحساب المستحقات وإصدار سند المخالصة الرسمي.`
  );

  return lines.join('\n');
}

// ============================================================================
// 3. Super Admin Full Financial Settlement Card (#CLR-YYYY-XXX + SHA-256)
// ============================================================================

export interface SuperAdminSettlementCardData {
  clearanceNumber: string;
  workerName: string;
  workerCode: string;
  jobTitle?: string | null | undefined;
  siteName?: string | null | undefined;
  terminationDate?: Date | undefined;
  reason: TerminationReason | OffboardReason;
  breakdown: ClearanceFinancialBreakdown;
  payoutOption: ClearancePayoutOption;
  sha256Checksum?: string | null | undefined;
  hasLinkedTelegram?: boolean | undefined;
  notes?: string | null | undefined;
}

export function formatSuperAdminSettlementCard(data: SuperAdminSettlementCardData): string {
  const reasonText =
    OFFBOARD_REASON_LABELS[data.reason as OffboardReason] ||
    TERMINATION_REASON_LABELS[data.reason as TerminationReason] ||
    data.reason;
  const payoutText = CLEARANCE_PAYOUT_LABELS[data.payoutOption] || data.payoutOption;
  const dateStr = formatDate(data.terminationDate ?? new Date());
  const b = data.breakdown;

  let netSection = '';
  if (b.netSettlementAmount > 0) {
    netSection = `💰 *صافي المستحق صرفه للعامل:* +${formatCurrency(b.netSettlementAmount)}`;
  } else if (b.netSettlementAmount === 0) {
    netSection = `⚖️ *صافي الحساب:* ${formatCurrency(0)} (الحساب مسوى بالكامل)`;
  } else {
    netSection = `🚨 *صافي المديونية المستحقة على العامل:* -${formatCurrency(Math.abs(b.netSettlementAmount))}`;
  }

  const lines: string[] = [
    `📋 *سند المخالصة المالية وتصفية المستحقات النهائية*`,
    `────────────────────────────`,
    `🔖 *رقم السند:* ${formatClickToCopy(data.clearanceNumber)}`,
    `👤 *العامل:* *${data.workerName}* (كود: ${formatClickToCopy(data.workerCode)})`,
    `💼 *الوظيفة:* ${data.jobTitle || 'عامل'} | 📍 *الموقع:* ${data.siteName || 'الموقع العام'}`,
    `📅 *تاريخ التصفية:* ${dateStr} | 📋 *السبب:* ${reasonText}`,
    `────────────────────────────`,
    `*المستحقات المالية المعتمدة (+):*`,
    `• أجر أيام العمل (${b.workedDays} يوم × ${formatCurrency(b.dailyRate)}): +${formatCurrency(b.earnedSalary)}`,
  ];

  if (b.approvedBonuses > 0) lines.push(`• مكافآت وحوافز معتمدة: +${formatCurrency(b.approvedBonuses)}`);
  lines.push(
    `• *إجمالي المستحقات:* +${formatCurrency(b.totalCredits)}\n`,
    `*الاستقطاعات والمسحوبات (-):*`,
    `• سلف نقدية وأقساط مستحقة: -${formatCurrency(b.totalAdvances)}`
  );
  if (b.totalPenalties > 0) lines.push(`• جزاءات واستقطاعات إدارية: -${formatCurrency(b.totalPenalties)}`);
  if (b.assetDamageDeduction > 0) lines.push(`• خصم عهد ومهمات تالفة: -${formatCurrency(b.assetDamageDeduction)}`);

  lines.push(
    `• *إجمالي الاستقطاعات:* -${formatCurrency(b.totalDebits)}`,
    `────────────────────────────`,
    netSection,
    `💳 *طريقة وخطة الصرف:* ${payoutText}`
  );

  if (data.hasLinkedTelegram) {
    lines.push(`\n🔒 *إسقاط الصلاحيات السيادي:* تم هبوط حساب التليجرام لرتبة **زائر (GUEST)** وفصل الارتباط.`);
  }
  if (data.sha256Checksum) {
    lines.push(`\n🔒 *الهاش الجنائي المشفر (SHA-256):*\n${formatMonospace(data.sha256Checksum)}`);
  }

  return lines.join('\n');
}

// ============================================================================
// 4. Pending Decisions Inbox Cards
// ============================================================================

export function formatPendingDecisionsInboxCard(
  records: PendingDisciplinaryRecord[],
  currentIndex = 0,
  totalCount?: number
): string {
  const count = totalCount ?? records.length;
  if (count === 0 || !records[currentIndex]) {
    return [
      `⚖️ *صندوق القرارات والمعاملات المعلقة*`,
      `────────────────────────────`,
      `✅ لا توجد أي قرارات أو جزاءات معلقة بانتظار البت حالياً.`,
    ].join('\n');
  }

  const rec = records[currentIndex]!;
  const dateStr = formatDate(rec.createdAt);
  const typeLabel = rec.type.includes('BONUS') ? '🟢 مكافأة' : '🔴 جزاء إداري';
  const valLabel = rec.amount
    ? formatCurrency(rec.amount)
    : rec.daysEquivalent
    ? `${rec.daysEquivalent} يوم عمل`
    : 'غير محدد';

  const lines: string[] = [
    `⚖️ *صندوق القرارات والمعاملات المعلقة* (${currentIndex + 1} من ${count})`,
    `────────────────────────────`,
    `🔖 *رقم المعاملة:* ${formatClickToCopy(rec.recordNumber)}`,
    `👤 *العامل:* *${rec.workerName || 'العامل'}* (كود: ${formatClickToCopy(rec.workerCode || '')})`,
    `🏷️ *نوع القرار:* ${typeLabel}`,
    `💰 *القيمة المحتسبة:* *${valLabel}*`,
    `📝 *البيان والسبب الإداري:* ${rec.reason}`,
  ];

  if (rec.requesterName) lines.push(`👤 *مقدم الطلب:* ${rec.requesterName}`);
  lines.push(
    `📅 *تاريخ القيد:* ${dateStr}`,
    `────────────────────────────`,
    `اختر الإجراء الإداري المراد تنفيذه على هذا القرار:`
  );

  return lines.join('\n');
}

// ============================================================================
// 5. Red Alert Negative Balance Card
// ============================================================================

export interface NegativeBalanceAlertData {
  workerName: string;
  workerCode: string;
  breakdown: ClearanceFinancialBreakdown;
  jobTitle?: string | null | undefined;
  siteName?: string | null | undefined;
}

export function formatNegativeBalanceAlertCard(data: NegativeBalanceAlertData): string {
  const b = data.breakdown;
  const debt = Math.abs(b.netSettlementAmount);

  return [
    `🚨 *تنبيه مالي حرج: رصيد مخالصة سالب (مديونية مستحقة)*`,
    `────────────────────────────`,
    `👤 *العامل:* *${data.workerName}* (كود: ${formatClickToCopy(data.workerCode)})`,
    `💼 *الوظيفة:* ${data.jobTitle || 'عامل'} | 📍 *الموقع:* ${data.siteName || 'الموقع العام'}\n`,
    `📊 *كشف حساب العجز المالي:*`,
    `• إجمالي المستحقات (أيام عمل ومكافآت): +${formatCurrency(b.totalCredits)}`,
    `• إجمالي الاستقطاعات (سلف وجزاءات وعهد): -${formatCurrency(b.totalDebits)}`,
    `────────────────────────────`,
    `⚠️ *صافي المديونية المطلوبة من العامل للشركة:* *${formatCurrency(debt)}*\n`,
    `⚖️ *خيارات المعالجة السيادية للمدير العام:*`,
    `1️⃣ *[ 🤝 إسقاط وتراضي إداري ]*: إنهاء الخدمة وشطب الدين ودياً واعتباره ديناً معدوماً بالتراضي الإداري.`,
    `2️⃣ *[ 🚫 تثبيت مديونية وإدراج بالقائمة السوداء ]*: إدراج العامل بالقائمة السوداء وتثبيت المديونية رسمياً بحقه مع حظر إعادة التعيين نهائياً في أي موقع.`,
  ].join('\n');
}

// ============================================================================
// 6. WhatsApp Share Documents & Direct Links
// ============================================================================

export interface ClearanceWhatsAppShareData {
  clearanceNumber: string;
  workerName: string;
  workerCode: string;
  jobTitle?: string | null | undefined;
  siteName?: string | null | undefined;
  terminationDate?: Date | undefined;
  reason: TerminationReason | OffboardReason;
  breakdown: ClearanceFinancialBreakdown;
  payoutOption: ClearancePayoutOption;
  supervisorName?: string | null | undefined;
  companyName?: string | undefined;
}

export function formatClearanceWhatsAppText(data: ClearanceWhatsAppShareData): string {
  const b = data.breakdown;
  const reasonText =
    OFFBOARD_REASON_LABELS[data.reason as OffboardReason] ||
    TERMINATION_REASON_LABELS[data.reason as TerminationReason] ||
    data.reason;
  const payoutText = CLEARANCE_PAYOUT_LABELS[data.payoutOption] || data.payoutOption;
  const dateStr = formatDate(data.terminationDate ?? new Date());
  const company = data.companyName || 'شركة السعادة';

  const netLine =
    b.netSettlementAmount >= 0
      ? `• *صافي المستحق صرفه للعامل:* +${formatCurrency(b.netSettlementAmount)}`
      : `• *صافي المديونية المستحقة على العامل:* -${formatCurrency(Math.abs(b.netSettlementAmount))}`;

  const lines: string[] = [
    `*${company}*`,
    `*وثيقة إخلاء طرف وتصفية حساب نهائية — #${data.clearanceNumber}*`,
    `--------------------------------`,
    `السلام عليكم ورحمة الله وبركاته،`,
    `• *العامل:* ${data.workerName} (كود: #${data.workerCode})`,
    `• *الوظيفة:* ${data.jobTitle || 'عامل'} | *الموقع:* ${data.siteName || 'الموقع العام'}`,
    `• *تاريخ إخلاء الطرف:* ${dateStr}`,
    `• *السبب:* ${reasonText}`,
    `--------------------------------`,
    `*المستحقات المالية:*`,
    `• أجر أيام العمل (${b.workedDays} يوم × ${formatCurrency(b.dailyRate)}): +${formatCurrency(b.earnedSalary)}`,
  ];

  if (b.approvedBonuses > 0) lines.push(`• مكافآت وحوافز معتمدة: +${formatCurrency(b.approvedBonuses)}`);
  lines.push(`\n*الاستقطاعات والمسحوبات:*`, `• سلف نقدية ومسحوبات: -${formatCurrency(b.totalAdvances)}`);
  if (b.totalPenalties > 0) lines.push(`• جزاءات وخصومات إدارية: -${formatCurrency(b.totalPenalties)}`);
  if (b.assetDamageDeduction > 0) lines.push(`• خصم عهد ومهمات: -${formatCurrency(b.assetDamageDeduction)}`);

  lines.push(
    `--------------------------------`,
    netLine,
    `• *طريقة الصرف:* ${payoutText}`,
    `• *مسؤول الاعتماد:* ${data.supervisorName || 'الإدارة العامة'}`,
    `--------------------------------`,
    `مع خالص تمنياتنا لكم بدوام التوفيق والنجاح.`
  );

  return lines.join('\n');
}

export function buildClearanceWhatsAppUrl(
  phone: string | null | undefined,
  data: ClearanceWhatsAppShareData
): string | null {
  const normPhone = normalizeEgyptianPhone(phone);
  const text = formatClearanceWhatsAppText(data);
  if (!normPhone) return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  return `https://wa.me/${normPhone}?text=${encodeURIComponent(text)}`;
}

export interface PendingDecisionsAlertData {
  workerName: string;
  workerCode: string;
  jobTitle?: string | null | undefined;
  siteName?: string | null | undefined;
  records: PendingDisciplinaryRecord[];
  companyName?: string | undefined;
}

export function formatPendingDecisionsWhatsAppAlertText(data: PendingDecisionsAlertData): string {
  const company = data.companyName || 'شركة السعادة';
  const list = data.records
    .slice(0, 5)
    .map((r, i) => {
      const type = r.type.includes('BONUS') ? 'مكافأة' : 'جزاء';
      const val = r.amount ? `${r.amount} ج.م` : `${r.daysEquivalent || 0} يوم`;
      return `• *${i + 1}. [${r.recordNumber}] ${type} (${val})*\n  ▫️ البيان: ${r.reason}`;
    })
    .join('\n');

  return [
    `*${company}*`,
    `*تنبيه إداري: معاملات وقرارات معلقة للعامل قبل إخلاء الطرف*`,
    `--------------------------------`,
    `أخي الفاضل / المدير العام (Super Admin)،`,
    `نحيطكم علماً بوجود (${data.records.length}) قرارات ومعاملات إدارية معلقة بذمة العامل قبل اعتماد المخالصة:\n`,
    `• *العامل:* ${data.workerName} (كود: #${data.workerCode})`,
    `• *الوظيفة:* ${data.jobTitle || 'عامل'} | *الموقع:* ${data.siteName || 'الموقع العام'}`,
    `--------------------------------`,
    `*قائمة المعاملات المعلقة:*`,
    list,
    `--------------------------------`,
    `يرجى التكرم بالاطلاع واتخاذ القرار الإداري والمالي المناسب لاعتماد المخالصة.`,
  ].join('\n');
}

export function buildPendingDecisionsWhatsAppUrl(
  superAdminPhone: string | null | undefined,
  data: PendingDecisionsAlertData
): string | null {
  const normPhone = normalizeEgyptianPhone(superAdminPhone);
  const text = formatPendingDecisionsWhatsAppAlertText(data);
  if (!normPhone) return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  return `https://wa.me/${normPhone}?text=${encodeURIComponent(text)}`;
}

export function buildStandardClearanceWhatsAppLink(data: WhatsAppReceiptData): string | null {
  return buildWhatsAppLink(data);
}

// ============================================================================
// 7. Backward Compatibility Functions (Preserved for Handler & Existing Tests)
// ============================================================================

export function formatConfirmationCard(
  workerName: string,
  workerCode: string,
  reason: TerminationReason,
  hasLinkedTelegram: boolean,
  notes?: string
): string {
  const reasonText = TERMINATION_REASON_LABELS[reason] || reason;
  const telegramDemoteWarning = hasLinkedTelegram
    ? `\n🔒 *إسقاط الصلاحيات اللحظي:* حساب التليجرام المرتبط سيتم هبوطه فوراً لصفة **زائر (GUEST)**، وتصفير الصلاحيات والأوامر الجانبية لمنع أي تسريب بيانات.`
    : `\nℹ️ العامل ليس لديه حساب تليجرام مفعل حالياً.`;

  return [
    `🚨 *تأكيد نهائي: اعتماد سند إنهاء الخدمة وإخلاء الطرف*`,
    `────────────────────────────`,
    `🔹 *العامل:* *${workerName}* (${formatClickToCopy(workerCode)})`,
    `🔹 *السبب المعتمد:* ${reasonText}`,
    notes ? `🔹 *الملاحظات:* ${notes}` : '',
    telegramDemoteWarning,
    `\nهل ترغب في اعتماد المخالصة وإغلاق السجل الوظيفي نهائياً؟`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatSuccessCard(
  workerName: string,
  workerCode: string,
  refId: string,
  demoted: boolean
): string {
  const demotedText = demoted
    ? `\n✅ *تم هبوط حساب التليجرام لدور زائر (GUEST) وتصفير أوامره فورياً.*`
    : '';

  return [
    `🎉 *تم اعتماد إنهاء الخدمة والمخالصة بنجاح*`,
    `────────────────────────────`,
    `🔹 *العامل:* *${workerName}* (${formatClickToCopy(workerCode)})`,
    `🔹 *رقم سند المخالصة:* ${formatClickToCopy(refId)}`,
    `🔹 *حالة السجل:* 🔴 منهي الخدمة ومؤرشف جنائياً`,
    demotedText,
    `\nتم قيد العملية في السجل الجنائي وترحيلها لطابور المزامنة الخلفية.`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatOffboardingNotification(
  workerName: string,
  workerCode: string,
  reason: TerminationReason,
  refId: string,
  siteName?: string
): string {
  const reasonText = TERMINATION_REASON_LABELS[reason] || reason;
  return [
    `🚨 *إشعار إنهاء خدمة وإخلاء طرف عامل*`,
    `────────────────────────────`,
    `• *العامل:* ${workerName} (${formatClickToCopy(workerCode)})`,
    `• *السبب المعتمد:* ${reasonText}`,
    `• *الموقع:* ${siteName || 'الموقع العام'}`,
    `• *رقم سند المخالصة:* ${formatClickToCopy(refId)}`,
  ].join('\n');
}
