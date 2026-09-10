import type { EditablePersonalField } from './flow.types.js';
import { EDITABLE_FIELD_LABELS } from './flow.types.js';

export function formatFieldSelectionHeader(workerName: string, workerCode: string): string {
  return (
    `👤 *طلب تعديل وتحديث بيانات العامل ذاتياً*\n` +
    `────────────────────────────\n` +
    `العامل: *${workerName}* (كود: \`#${workerCode}\`)\n\n` +
    `🛡️ *ميثاق النزاهة والحظر المالي الصارم (Zero Financial Mutation):*\n` +
    `يحظر النظام تعديل الراتب أو اليومية أو المسمى أو الموقع ذاتياً.\n` +
    `يمكنك تحديث بيانات التواصل والمحفظة والعنوان فقط.\n\n` +
    `👇 *اختر البيان المراد تحديثه:*`
  );
}

export function formatInputPrompt(field: EditablePersonalField, currentVal?: string): string {
  const label = EDITABLE_FIELD_LABELS[field] || field;
  const curr = currentVal ? `\nالقيمة المسجلة حالياً: *${currentVal}*` : '';
  return (
    `✏️ *تحديث ${label}*\n` +
    `────────────────────────────${curr}\n\n` +
    `أرسل القيمة الجديدة الآن عبر الرسائل النصية:`
  );
}

export function formatConfirmation(field: EditablePersonalField, oldVal: string, newVal: string, reason?: string): string {
  const label = EDITABLE_FIELD_LABELS[field] || field;
  const reasonText = reason ? `\n🔹 *السبب:* ${reason}` : '';
  return (
    `📋 *مراجعة وتأكيد تعديل البيانات*\n` +
    `────────────────────────────\n` +
    `🔹 *البيان:* ${label}\n` +
    `🔹 *القيمة السابقة:* ${oldVal || 'غير مسجل'}\n` +
    `🔹 *القيمة الجديدة:* *${newVal}*${reasonText}\n\n` +
    `هل ترغب في حفظ التحديث فوراً واعتماده بالمنظومة؟`
  );
}

export function formatSuccess(resultText: string, refId: string): string {
  return (
    `✅ *تم تحديث بياناتك بنجاح!*\n` +
    `────────────────────────────\n` +
    `${resultText}\n\n` +
    `🔹 *الرقم المرجعي:* \`${refId}\`\n` +
    `تم توثيق التحديث في السجل الجنائي وتحديث ملفك بالبوابة.`
  );
}
