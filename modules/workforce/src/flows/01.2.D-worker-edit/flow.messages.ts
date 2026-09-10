import type { PendingEditTicket, WorkerCardView } from './flow.types.js';

function formatDate(d?: Date | string | null): string {
  if (!d) return 'غير مسجل';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return 'غير مسجل';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

import { formatShiftSystem, cleanMd } from '../../shared/module.messages.js';

export const CIGARETTE_POLICY_LABELS: Record<string, string> = {
  ONE_PACK_DAILY: 'علبة واحدة يومياً',
  TWO_PACKS_DAILY: 'علبتين يومياً',
  FULL_COVERAGE: 'تغطية استهلاك مفتوح',
  NONE: 'بدون مخصص سجائر',
  CUSTOM_BUDGET: 'ميزانية شهرية محددة',
};

export const WorkerEditMessages = {
  selectWorkerPrompt(isSuperAdmin: boolean): string {
    const title = isSuperAdmin ? '✏️ *تعديل بيانات عامل (تنفيذ فوري)*' : '📝 *طلب تعديل بيانات عامل*';
    return (
      `${title}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `يرجى اختيار العامل المطلوب تعديل بياناته:`
    );
  },

  tab1PersonalCard(worker: WorkerCardView, isSuperAdmin: boolean): string {
    const title = isSuperAdmin ? '✏️ *بطاقة العامل — 👤 البيانات الشخصية والهوية*' : '📋 *ملف العامل — 👤 البيانات الشخصية والهوية*';
    return (
      `${title}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *الاسم الكامل:* ${cleanMd(worker.name)}\n` +
      `• *اسم الشهرة المعتمد:* *${cleanMd(worker.nickname) || 'غير مسجل'}*\n` +
      `• *كود النظام:* \`#${worker.code}\`\n` +
      `• *الكود الأرشيفي:* \`${worker.legacyCode || 'لا يوجد'}\`\n` +
      `• *الرقم القومي:* \`${worker.nationalId || 'غير مسجل'}\`\n` +
      `• *تاريخ انتهاء البطاقة:* \`${formatDate(worker.idCardExpiryDate)}\`\n` +
      `• *المحافظة:* ${cleanMd(worker.governorateCode) || 'غير محددة'}\n` +
      `• *العنوان التفصيلي:* ${cleanMd(worker.address) || 'غير مسجل'}\n` +
      `• *الموقف التجنيدي:* ${cleanMd(worker.militaryStatus) || 'غير مسجل'}\n` +
      `• *الحالة الاجتماعية:* ${cleanMd(worker.maritalStatus) || 'غير مسجل'}\n` +
      `• *فصيلة الدم:* \`${worker.bloodType || 'غير مسجلة'}\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 _اضغط على أي حقل بالأسفل لتعديله مباشرة:_`
    );
  },

  tab2JobCard(worker: WorkerCardView, isSuperAdmin: boolean): string {
    const title = isSuperAdmin ? '✏️ *بطاقة العامل — 💼 بيانات الوظيفة والتشغيل*' : '📋 *ملف العامل — 💼 بيانات الوظيفة والتشغيل*';
    return (
      `${title}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *الاسم:* ${cleanMd(worker.name)} (${cleanMd(worker.nickname) || 'بدون شهرة'})\n` +
      `• *كود العامل:* \`#${worker.code}\`\n` +
      `• *المسمى الوظيفي:* ${cleanMd(worker.jobRef?.name || worker.jobRef?.title || worker.jobTitle || 'غير محدد')}\n` +
      `• *الموقع الميداني:* ${cleanMd(worker.site?.name || 'غير محدد')}\n` +
      `• *الإدارة / القسم:* ${cleanMd(worker.department?.name || 'العمليات الميدانية')}\n` +
      `• *نظام الوردية:* ${formatShiftSystem(worker.shiftSystem)}\n` +
      `• *نوع التعاقد:* ${cleanMd(worker.contractType) || 'يومية حرة'}\n` +
      `• *تاريخ التعيين:* \`${formatDate(worker.hireDate)}\`\n` +
      `• *حالة التشغيل:* ${worker.status === 'ACTIVE' ? 'نشط ميدانياً 🟢' : cleanMd(worker.status) || 'نشط'}\n` +
      `• *رخصة القيادة:* ${cleanMd(worker.drivingLicense) || 'بدون رخصة'}\n` +
      `• *عنبر السكن بالكامب:* ${cleanMd(worker.barracksUnit) || 'غير محدد'}\n` +
      `• *رقم السرير / الغرفة:* ${cleanMd(worker.bedNumber) || 'غير محدد'}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 _اضغط على أي حقل بالأسفل لتعديله مباشرة:_`
    );
  },

  tab3FinanceCard(worker: WorkerCardView, isSuperAdmin: boolean): string {
    const title = isSuperAdmin ? '✏️ *بطاقة العامل — 💰 البيانات المالية والمخصصات*' : '📋 *ملف العامل — 💰 البيانات المالية والمخصصات*';
    const policyLabel = CIGARETTE_POLICY_LABELS[worker.canteenCigarettePolicy || 'NONE'] || cleanMd(worker.canteenCigarettePolicy) || 'بدون مخصص';
    const brandLabel = cleanMd(worker.cigaretteBrand || (worker.canteenItem ? worker.canteenItem.name : 'غير محدد'));

    return (
      `${title}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *الاسم:* ${cleanMd(worker.name)} (${cleanMd(worker.nickname) || 'بدون شهرة'})\n` +
      `• *كود العامل:* \`#${worker.code}\`\n` +
      `• *طريقة الصرف:* ${cleanMd(worker.paymentMethod) || 'نقداً بالخزينة (كاش)'}\n` +
      `• *رقم الحساب / المحفظة:* \`${worker.accountNumber || 'غير مسجل'}\`\n` +
      `• *اسم صاحب المحفظة:* ${cleanMd(worker.walletOwnerName) || 'مسجل باسم العامل'}\n` +
      `• *معرف إنستاباي:* \`${worker.instaPayHandle || 'لا يوجد'}\`\n` +
      `• *الراتب الأساسي الشهري:* \`${worker.basicSalary ? String(worker.basicSalary) + ' ج.م' : 'غير محدد'}\`\n` +
      `• *البدلات الثابتة الشهرية:* \`${worker.fixedAllowances ? String(worker.fixedAllowances) + ' ج.م' : '0 ج.م'}\`\n` +
      `• *الرقم التأميني:* \`${worker.insuranceNumber || 'غير مسجل'}\`\n` +
      `• *الموقف من التأمينات:* ${cleanMd(worker.insuranceStatus) || 'غير مؤمن عليه'}\n` +
      `• *سياسة مخصص السجائر:* ${policyLabel}\n` +
      `• *صنف السجائر المعتمد:* ${brandLabel}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 _اضغط على أي حقل بالأسفل لتعديله مباشرة:_`
    );
  },

  tab4DocsCard(worker: WorkerCardView, isSuperAdmin: boolean): string {
    const title = isSuperAdmin ? '✏️ *بطاقة العامل — 📞 الاتصال والسلامة والمستندات*' : '📋 *ملف العامل — 📞 الاتصال والسلامة والمستندات*';
    const phoneVal = worker.phone ? `\`${worker.phone}\`` : '`غير مسجل`';
    const emVal = worker.emergencyPhone ? `\`${worker.emergencyPhone}\`` : '`غير مسجل`';
    return (
      `${title}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *الاسم:* ${cleanMd(worker.name)} (${cleanMd(worker.nickname) || 'بدون شهرة'})\n` +
      `• *كود العامل:* \`#${worker.code}\`\n` +
      `• *رقم الهاتف والواتساب:* ${phoneVal}\n` +
      `• *هاتف الطوارئ البديل:* ${emVal}\n` +
      `• *اسم جهة الطوارئ:* ${cleanMd(worker.emergencyContactName) || 'غير مسجل'}\n` +
      `• *مقاس حذاء السيفتي:* \`${worker.ppeShoeSize || 'غير محدد'}\`\n` +
      `• *مقاس زي العمل (اليونيفورم):* \`${worker.ppeUniformSize || 'غير محدد'}\`\n` +
      `• *الملاحظات الطبية والحساسية:* ${cleanMd(worker.medicalNotes) || 'لا توجد ملاحظات طبية خاصة'}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 _اضغط على أي حقل بالأسفل لتعديله مباشرة:_`
    );
  },

  selectFieldPrompt(workerName: string, workerCode: string, nickname?: string | null): string {
    const nickLine = nickname ? `• *اسم الشهرة:* ${cleanMd(nickname)}\n` : '';
    return (
      `✏️ *تعديل بيانات العامل*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *الاسم:* ${cleanMd(workerName)}\n` +
      nickLine +
      `• *الكود:* \`#${workerCode}\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `اختر الحقل الذي ترغب في تعديله:`
    );
  },

  selectCigarettePolicyPrompt(workerName: string, currentPolicy?: string | null): string {
    const cur = currentPolicy ? CIGARETTE_POLICY_LABELS[currentPolicy] || cleanMd(currentPolicy) : 'بدون مخصص';
    return (
      `🚬 *تحديد مخصص السجائر للعامل*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *العامل:* ${cleanMd(workerName)}\n` +
      `• *المخصص الحالي:* ${cur}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `*الخطوة 1 من 2:* اختر سياسة مخصص السجائر المناسبة:`
    );
  },

  selectCigaretteBrandPrompt(workerName: string, policy: string): string {
    const pLabel = CIGARETTE_POLICY_LABELS[policy] || cleanMd(policy);
    return (
      `🚬 *تحديد صنف ونوع السجائر*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *العامل:* ${cleanMd(workerName)}\n` +
      `• *السياسة المعتمدة:* ${pLabel}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `*الخطوة 2 من 2:* اختر صنف السجائر المصروف من المخزن:`
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
