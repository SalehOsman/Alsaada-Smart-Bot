import type { CompanyProfileDto, CompanyFieldKey } from './flow.types.js';

export const COMPANY_FIELD_LABELS: Record<CompanyFieldKey, string> = {
  legalName: 'اسم الشركة القانوني',
  tradeName: 'الاسم التجاري المختصر',
  commercialRegistrationNumber: 'رقم السجل التجاري',
  taxRegistrationNumber: 'رقم البطاقة الضريبية',
  headquartersAddress: 'المقر الرئيسي والإداري',
  primaryPhone: 'هاتف الإدارة والتواصل',
  officialEmail: 'البريد الإلكتروني الرسمي',
  baseCurrency: 'العملة الأساسية (EGP)',
};

export function formatCorporateProfileCard(profile: CompanyProfileDto | null, noticeText?: string): string {
  let banner = '';
  if (noticeText) {
    banner = `✨ *${noticeText}*\n────────────────────────────\n\n`;
  }

  return (
    `${banner}` +
    `🏢 *الملف التعريفي والبيانات الرسمية للشركة*\n` +
    `────────────────────────────\n` +
    `البيانات المعتمدة في العقود والمخاطبات الرسمية وسندات صرف المستحقات:\n\n` +
    `🏛️ *اسم الشركة القانوني:*\n\`${profile?.legalName || 'غير مسجل'}\`\n\n` +
    `🏷️ *الاسم التجاري المختصر:*\n\`${profile?.tradeName || 'غير مسجل'}\`\n\n` +
    `📜 *رقم السجل التجاري:*\n\`${profile?.commercialRegistrationNumber || 'غير مسجل'}\`\n\n` +
    `💳 *البطاقة الضريبية:*\n\`${profile?.taxRegistrationNumber || 'غير مسجل'}\`\n\n` +
    `📍 *المقر الرئيسي والإداري:*\n\`${profile?.headquartersAddress || 'غير مسجل'}\`\n\n` +
    `📞 *هاتف الإدارة والدعم:*\n\`${profile?.primaryPhone || 'غير مسجل'}\`\n\n` +
    `✉️ *البريد الإلكتروني الرسمي:*\n\`${profile?.officialEmail || 'غير مسجل'}\`\n\n` +
    `💱 *العملة الأساسية والمعتمدة:*\n\`${profile?.baseCurrency || 'EGP'}\`\n` +
    `────────────────────────────\n` +
    `👇 *اختر أي بيان أعلاه لتعديله وتحديثه فورياً:*`
  );
}

export function formatEditFieldPrompt(fieldKey: CompanyFieldKey, currentValue: string): string {
  const label = COMPANY_FIELD_LABELS[fieldKey] || fieldKey;
  return (
    `✏️ *تعديل: ${label}*\n` +
    `────────────────────────────\n` +
    `🔹 *القيمة الحالية المعتمدة:*\n\`${currentValue}\`\n\n` +
    `💬 *الرجاء إرسال القيمة الجديدة الآن في رسالة نصية...*\n` +
    `أو اضغط زر الإلغاء أدناه للإبقاء على القيمة الحالية.`
  );
}

export function formatEditSuccessNotice(fieldKey: CompanyFieldKey, newValue: string): string {
  const label = COMPANY_FIELD_LABELS[fieldKey] || fieldKey;
  return `تم تحديث [${label}] بنجاح إلى: (${newValue})`;
}
