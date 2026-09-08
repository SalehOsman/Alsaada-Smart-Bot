import type { PendingWorkerEditState, PendingEditTicket } from './flow.types.js';

export const WorkerEditMessages = {
  selectWorkerPrompt(isSuperAdmin: boolean): string {
    const title = isSuperAdmin ? '✏️ *تعديل بيانات عامل (تنفيذ فوري)*' : '📝 *طلب تعديل بيانات عامل*';
    return (
      `${title}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `يرجى اختيار العامل المطلوب تعديل بياناته:`
    );
  },

  selectFieldPrompt(workerName: string, workerCode: string): string {
    return (
      `✏️ *تعديل بيانات العامل*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *الاسم:* ${workerName}\n` +
      `• *الكود:* \`#${workerCode}\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `اختر الحقل الذي ترغب في تعديله:`
    );
  },

  inputNewValuePrompt(fieldName: string, oldValue?: string): string {
    const oldLine = oldValue ? `• *القيمة الحالية:* \`${oldValue}\`\n` : '';
    return (
      `✏️ *إدخال القيمة الجديدة*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *الحقل المطلوب تعديله:* ${fieldName}\n` +
      oldLine +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `يرجى كتابة القيمة الجديدة الآن وحذف الرسالة تلقائياً:`
    );
  },

  directEditSuccess(data: { workerCode: string; workerName: string; fieldName: string; newValue: string }): string {
    return (
      `✅ *تم تحديث بيانات العامل بنجاح فورياً*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *العامل:* ${data.workerName} (\`#${data.workerCode}\`)\n` +
      `• *الحقل المعدل:* ${data.fieldName}\n` +
      `• *القيمة الجديدة:* \`${data.newValue}\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `تم تطبيق التعديل وتحديث السجل وقيد الحركة في سجل التدقيق.`
    );
  },

  ticketSubmitted(data: { ticketId: string; workerName: string; fieldName: string; newValue: string }): string {
    return (
      `📨 *تم إرسال طلب التعديل بنجاح*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *رقم الطلب:* \`${data.ticketId}\`\n` +
      `• *العامل:* ${data.workerName}\n` +
      `• *الحقل:* ${data.fieldName}\n` +
      `• *القيمة المقترحة:* \`${data.newValue}\`\n` +
      `• *الحالة:* ⏳ بانتظار مراجعة واعتماد المدير العام\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `سيتم إشعارك فور اعتماد أو مراجعة الطلب.`
    );
  },

  pendingTicketsHeader(count: number): string {
    return (
      `📨 *طلبات تعديل بيانات العمال المعلقة (${count})*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `اختر طلباً لمراجعته والبت فيه بالموافقة أو الرفض:`
    );
  },

  reviewTicketCard(t: PendingEditTicket): string {
    return (
      `📋 *مراجعة طلب تعديل رقم: \`${t.requestId}\`*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *العامل:* ${t.workerName} (\`#${t.workerCode}\`)\n` +
      `• *مقدم الطلب:* ${t.requesterName} (${t.requesterRole})\n` +
      `• *الحقل المطلوب:* ${t.fieldName}\n` +
      `• *القيمة السابقة:* \`${t.oldValue}\`\n` +
      `• *القيمة الجديدة المقترحة:* \`${t.newValue}\`\n` +
      `• *سبب التعديل:* ${t.reason}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `يرجى اتخاذ القرار الإداري المناسب:`
    );
  },
};
