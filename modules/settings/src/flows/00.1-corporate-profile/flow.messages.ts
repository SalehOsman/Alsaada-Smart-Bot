import type { InputRichMessage, RichBlockTableCell } from 'grammy/types';
import { formatBreadcrumbs } from '@alsaada/core-components';
import type { CompanyProfileDto, CompanyFieldKey } from './flow.types.js';

export const COMPANY_FIELD_LABELS: Record<CompanyFieldKey, string> = {
  legalName: 'اسم الشركة القانوني', tradeName: 'الاسم التجاري المختصر', commercialRegistrationNumber: 'رقم السجل التجاري',
  commercialRegistrationIssueDate: 'تاريخ إصدار السجل التجاري', commercialRegistrationExpiryDate: 'تاريخ انتهاء السجل التجاري',
  socialInsuranceNumber: 'الرقم التأميني للمؤسسة', taxRegistrationNumber: 'رقم البطاقة الضريبية', vatRegistrationNumber: 'رقم ضريبة القيمة المضافة',
  logoPath: 'لوجو الشركة', socialLinks: 'روابط التواصل الاجتماعي', headerImagePath: 'صورة هيدر المستندات', footerImagePath: 'صورة فوتر المستندات',
  primaryColor: 'اللون الأساسي', secondaryColor: 'اللون الثانوي', reportShortName: 'الاسم المختصر للتقارير',
  bankName: 'اسم البنك', bankAccountHolder: 'اسم صاحب الحساب', bankAccountNumber: 'رقم الحساب', bankIban: 'رقم IBAN', bankSwift: 'رمز SWIFT',
  headquartersAddress: 'المقر الرئيسي والإداري', primaryPhone: 'هاتف الإدارة والتواصل', officialEmail: 'البريد الإلكتروني الرسمي', baseCurrency: 'العملة الأساسية (EGP)',
};

function imageFileId(profile: CompanyProfileDto | null, key: 'logo' | 'header' | 'footer') {
  return key === 'logo' ? profile?.logoFileId : key === 'header' ? profile?.headerImageFileId : profile?.footerImageFileId;
}

export function formatCorporateProfileCard(profile: CompanyProfileDto | null, noticeText?: string): InputRichMessage {
  const fields: Array<[CompanyFieldKey, string]> = [
    ['legalName', '🏛️ اسم الشركة القانوني'], ['tradeName', '🏷️ الاسم التجاري المختصر'], ['commercialRegistrationNumber', '📜 رقم السجل التجاري'],
    ['commercialRegistrationIssueDate', '📅 تاريخ إصدار السجل التجاري'], ['commercialRegistrationExpiryDate', '⏳ تاريخ انتهاء السجل التجاري'],
    ['socialInsuranceNumber', '🛡️ الرقم التأميني للمؤسسة'], ['taxRegistrationNumber', '💳 البطاقة الضريبية'], ['vatRegistrationNumber', '🧾 رقم ضريبة القيمة المضافة'],
    ['headquartersAddress', '📍 المقر الرئيسي والإداري'], ['primaryPhone', '📞 هاتف الإدارة والدعم'], ['officialEmail', '✉️ البريد الإلكتروني الرسمي'],
    ['socialLinks', '🌐 روابط التواصل الاجتماعي'], ['baseCurrency', '💱 العملة الأساسية والمعتمدة'], ['reportShortName', '📝 الاسم المختصر للتقارير'],
    ['primaryColor', '🎨 اللون الأساسي'], ['secondaryColor', '🖌️ اللون الثانوي'], ['bankName', '🏦 اسم البنك'], ['bankAccountHolder', '👤 اسم صاحب الحساب'], ['bankAccountNumber', '💳 رقم الحساب'], ['bankIban', '🌐 رقم IBAN'], ['bankSwift', '🔐 رمز SWIFT'], ['logoPath', '🖼️ لوجو الشركة'], ['headerImagePath', '🧾 هيدر المستندات'], ['footerImagePath', '📄 فوتر المستندات'],
  ];
  const cells: RichBlockTableCell[][] = [[
    { text: { type: 'bold', text: '\u200Fالقيمة' }, is_header: true, align: 'center', valign: 'middle' },
    { text: { type: 'bold', text: '\u200Fالبيان' }, is_header: true, align: 'center', valign: 'middle' },
  ], ...fields.map(([key, label]): RichBlockTableCell[] => {
    const imageKey = key === 'logoPath' ? 'logo' : key === 'headerImagePath' ? 'header' : key === 'footerImagePath' ? 'footer' : null;
    const fileId = imageKey ? imageFileId(profile, imageKey) : null;
    const value = imageKey ? (fileId ? (imageKey === 'logo' ? '👁️ معاينة اللوجو' : '👁️ معاينة الصورة') : 'لا توجد صورة معتمدة') : (profile?.[key] || (key === 'baseCurrency' ? 'EGP' : 'غير مسجل'));
    const callback = imageKey && fileId ? 'action:company_image_preview:' + imageKey : 'action:confirm_edit_comp:' + key;
    const actionLabel = imageKey ? (fileId ? '👁️ معاينة' : '📤 رفع الصورة') : label;
    return [{ text: '\u200F' + value, align: 'right', valign: 'top' }, { text: { type: 'button', button: { text: '\u200F' + actionLabel, callback_data: callback, style: 'link' } }, align: 'right', valign: 'top' }];
  })];
  return { is_rtl: true, blocks: [
    { type: 'paragraph', text: '📍 المسار: ⚙️ الإعدادات ❯ 🏢 الكيان المؤسسي والمشاريع ❯ 🏢 الملف التعريفي' },
    ...(noticeText ? [{ type: 'paragraph' as const, text: { type: 'bold' as const, text: '✨ ' + noticeText } }] : []),
    { type: 'heading', size: 3, text: '🏢 الملف التعريفي والبيانات الرسمية للشركة' },
    { type: 'paragraph', text: 'البيانات المعتمدة في العقود والمخاطبات الرسمية وسندات صرف المستحقات:' },
    { type: 'table', cells, is_bordered: true, is_striped: true, is_compact: true },
    { type: 'paragraph', text: '👇 اضغط على اسم البيان داخل الجدول لبدء التعديل:' },
  ] };
}

export function formatImagePreviewMessage(fileId: string, kind: 'logo' | 'header' | 'footer'): InputRichMessage {
  const title = kind === 'logo' ? '🖼️ معاينة لوجو الشركة' : kind === 'header' ? '🧾 معاينة هيدر المستندات' : '📄 معاينة فوتر المستندات';
  const field = kind === 'logo' ? 'logoPath' : kind === 'header' ? 'headerImagePath' : 'footerImagePath';
  return { is_rtl: true, blocks: [
    { type: 'heading', size: 3, text: { type: 'bold', text: title } },
    { type: 'paragraph', text: 'الصورة المعتمدة للهوية المؤسسية' },
    { type: 'photo', photo: { type: 'photo', media: fileId }, caption: { text: { type: 'italic', text: 'يمكنك تعديل الصورة من الزر أدناه.' } } },
    { type: 'buttons', align: 'center', buttons: [{ text: '✏️ تعديل الصورة', style: 'primary', callback_data: 'action:company_image_edit:' + field }, { text: '🔙 العودة لبيانات الشركة', style: 'link', callback_data: 'action:settings:company_profile' }] },
  ] };
}
export const formatLogoPreviewMessage = (fileId: string): InputRichMessage => formatImagePreviewMessage(fileId, 'logo');

export function formatEditConfirmationPrompt(fieldKey: CompanyFieldKey): string { const label = COMPANY_FIELD_LABELS[fieldKey] || fieldKey; return formatBreadcrumbs(['⚙️ الإعدادات', '🏢 الكيان والمشاريع', '🏢 الملف التعريفي', '✏️ تأكيد التعديل']) + '\n\n❓ هل تريد تعديل «' + label + '»؟'; }
export function formatEditFieldPrompt(fieldKey: CompanyFieldKey, currentValue: string): string { const label = COMPANY_FIELD_LABELS[fieldKey] || fieldKey; const image = fieldKey === 'logoPath' || fieldKey === 'headerImagePath' || fieldKey === 'footerImagePath'; return formatBreadcrumbs(['⚙️ الإعدادات', '🏢 الكيان والمشاريع', '🏢 الملف التعريفي', '✏️ تعديل بيان']) + '\n✏️ *تعديل: ' + label + '*\n────────────────────────────\n🔹 *القيمة الحالية المعتمدة:*\n`' + currentValue + '`\n\n' + (image ? '💬 *الرجاء إرسال صورة الآن من تيليجرام...*\n' : '💬 *الرجاء إرسال القيمة الجديدة الآن في رسالة نصية...*\n') + 'أو اضغط زر الإلغاء أدناه للإبقاء على القيمة الحالية.'; }
export function formatEditSuccessNotice(fieldKey: CompanyFieldKey, newValue: string): string { return 'تم تحديث [' + (COMPANY_FIELD_LABELS[fieldKey] || fieldKey) + '] بنجاح إلى: (' + newValue + ')'; }
