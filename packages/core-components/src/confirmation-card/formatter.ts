import { formatCurrency, formatDateTime } from '@alsaada/regional-engine';

export interface ConfirmationCardData {
  operationTitle: string;
  voucherNumber?: string;
  workerName?: string;
  workerCode?: string;
  siteLocation?: string;
  amount?: number;
  currencySymbol?: string;
  quantity?: number;
  unitName?: string;
  unitPrice?: number;
  sourceAccount?: string;
  destinationAccount?: string;
  recordedBy: string;
  timestamp?: Date;
  notes?: string;
  warningAlert?: string;
}

/**
 * Formats a clean, standardized confirmation review card in Telegram Markdown.
 */
export function formatConfirmationCard(data: ConfirmationCardData): string {
  const lines: string[] = [];

  lines.push(`📋 *مراجعة وتأكيد: ${data.operationTitle}*`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━`);

  if (data.voucherNumber) {
    lines.push(`🔖 *رقم السند:* \`${data.voucherNumber}\``);
  }

  if (data.workerName) {
    const codeStr = data.workerCode ? ` (${data.workerCode})` : '';
    lines.push(`👤 *المستفيد:* ${data.workerName}${codeStr}`);
  }

  if (data.siteLocation) {
    lines.push(`📍 *الموقع:* ${data.siteLocation}`);
  }

  if (data.quantity !== undefined && data.unitPrice !== undefined) {
    const unit = data.unitName ?? 'وحدة';
    lines.push(`📦 *الكمية:* ${data.quantity} ${unit} × ${formatCurrency(data.unitPrice)}`);
  }

  if (data.amount !== undefined) {
    lines.push(`💰 *المبلغ الإجمالي:* *${formatCurrency(data.amount)}*`);
  }

  if (data.sourceAccount) {
    lines.push(`🏦 *خصماً من:* ${data.sourceAccount}`);
  }

  if (data.destinationAccount) {
    lines.push(`🎯 *إلى حساب:* ${data.destinationAccount}`);
  }

  if (data.notes) {
    lines.push(`📝 *ملاحظات:* ${data.notes}`);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`✍️ *المسؤول:* ${data.recordedBy}`);
  lines.push(`🕒 *التوقيت:* ${formatDateTime(data.timestamp ?? new Date())}`);

  if (data.warningAlert) {
    lines.push(`\n⚠️ *تنبيه أمني / رادار المخاطر:*`);
    lines.push(data.warningAlert);
  }

  return lines.join('\n');
}
