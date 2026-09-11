import { normalizeDigits, formatCurrency, formatDate } from '@alsaada/regional-engine';

export interface WhatsAppReceiptData {
  phoneNumber?: string;
  companyName: string;
  voucherNumber: string;
  operationType: string;
  workerName: string;
  amount: number;
  date?: Date;
  supportContact?: string;
}

/**
 * Normalizes Egyptian mobile numbers into E.164 international format (e.g. 2010XXXXXXXX).
 */
export function normalizeEgyptianPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = normalizeDigits(phone.trim()).replace(/\D/g, '');

  // Local Egyptian 11-digit mobile: 010, 011, 012, 015
  if (/^01[0125]\d{8}$/.test(digits)) {
    return `20${digits.substring(1)}`;
  }

  // Already prefixed with country code 20
  if (/^201[0125]\d{8}$/.test(digits)) {
    return digits;
  }

  return null;
}

/**
 * Formats standard receipt text for WhatsApp notification.
 */
export function formatWhatsAppReceiptText(data: WhatsAppReceiptData): string {
  const dtStr = formatDate(data.date ?? new Date());
  const lines: string[] = [
    `*إشعار مالي معتمد — ${data.companyName}*`,
    `━━━━━━━━━━━━━━━━━━━━━`,
    `أهلاً بك يا ${data.workerName}،`,
    `تم قيد معاملة (${data.operationType}) بنجاح.`,
    `🔖 *رقم السند:* ${data.voucherNumber}`,
    `💰 *المبلغ:* ${formatCurrency(data.amount)}`,
    `📅 *التاريخ:* ${dtStr}`,
    `━━━━━━━━━━━━━━━━━━━━━`,
    `📌 هذا إشعار رسمي آلي مسجل في المنظومة.`,
  ];

  if (data.supportContact) {
    lines.push(`لأي استفسار أو مراجعة يرجى التواصل مع الإدارة: ${data.supportContact}`);
  }

  return lines.join('\n');
}

/**
 * Builds direct WhatsApp URL.
 */
export function buildWhatsAppLink(data: WhatsAppReceiptData): string | null {
  const normalizedPhone = normalizeEgyptianPhone(data.phoneNumber);
  if (!normalizedPhone) return null;

  const text = formatWhatsAppReceiptText(data);
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(text)}`;
}

export interface WhatsAppErrorReportData {
  errorReference: string;
  actorName?: string | undefined;
  actorTelegramId?: string | number | bigint | undefined;
  companyName?: string | undefined;
  occurredAt?: Date | undefined;
  siteName?: string | undefined;
}

/**
 * Formats standard error escalation report text for WhatsApp messaging to Super Admins.
 */
export function formatWhatsAppErrorReportText(data: WhatsAppErrorReportData): string {
  const dtStr = formatDate(data.occurredAt ?? new Date());
  const lines: string[] = [
    `🚨 *بلاغ عطل تشغيلي — منظومة السعادة سمارت بوت*`,
    `━━━━━━━━━━━━━━━━━━━━━`,
    `السلام عليكم ورحمة الله وبركاته،`,
    `تم اعتراض عطل فني في المنظومة ويتطلب إشعار الإدارة العليا:`,
    ``,
    `🔖 *رمز البلاغ المرجعي:* ${data.errorReference}`,
    `👤 *القائم بالعملية:* ${data.actorName || 'مستخدم ميداني'}`,
  ];

  if (data.actorTelegramId) {
    lines.push(`🆔 *المعرف الرقمي:* ${String(data.actorTelegramId)}`);
  }

  if (data.siteName) {
    lines.push(`📍 *الموقع الميداني:* ${data.siteName}`);
  }

  lines.push(`📅 *توقيت الحادثة:* ${dtStr}`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`📌 إشعار رسمي آلي موجه للمدير العام للمتابعة الميدانية.`);

  return lines.join('\n');
}

/**
 * Builds direct WhatsApp URL for escalating an error to a specific Super Admin.
 */
export function buildWhatsAppErrorUrl(
  phone: string | null | undefined,
  data: WhatsAppErrorReportData
): string | null {
  const normalizedPhone = normalizeEgyptianPhone(phone);
  if (!normalizedPhone) return null;
  const text = formatWhatsAppErrorReportText(data);
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(text)}`;
}

