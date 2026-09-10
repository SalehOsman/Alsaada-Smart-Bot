import type { PendingEditTicket, WorkerCardView, SalaryHistoryRecord, WorkerChangeLogRecord } from './flow.types.js';
import { formatShiftSystem, cleanMd } from '../../shared/module.messages.js';
import { formatSpoiler, formatExpandableQuote } from '@alsaada/core-components';
import { EGYPTIAN_GOVERNORATES } from '@alsaada/national-id-engine';

function formatDate(d?: Date | string | null): string {
  if (!d) return 'غير مسجل';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return 'غير مسجل';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export const CIGARETTE_POLICY_LABELS: Record<string, string> = {
  ONE_PACK_DAILY: 'علبة واحدة يومياً',
  TWO_PACKS_DAILY: 'علبتين يومياً',
  FULL_COVERAGE: 'تغطية استهلاك مفتوح',
  NONE: 'بدون مخصص سجائر',
  CUSTOM_BUDGET: 'ميزانية شهرية محددة',
};

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  DAILY_LABOR: 'عمالة يومية / مؤقتة',
  PERMANENT: 'عقد عمل دائم',
  SEASONAL: 'عقد عمل موسمي',
  FIXED_TERM: 'محدد المدة',
  PROBATION: 'تحت الاختبار',
};

export const WorkerEditMessages = {
  selectWorkerPrompt(_isSuperAdmin?: boolean): string {
    return (
      `✏️ *تعديل بيانات عامل*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `يرجى اختيار العامل المطلوب تعديل بياناته:`
    );
  },

  tab1PersonalCard(worker: WorkerCardView, isSuperAdmin: boolean): string {
    const title = '✏️ *بطاقة العامل — 👤 البيانات الشخصية والهوية*';
    const govName = worker.governorateName || (worker.governorateCode ? (EGYPTIAN_GOVERNORATES[worker.governorateCode]?.nameAr || worker.governorateCode) : 'غير محددة');
    const hint = isSuperAdmin ? '💡 _اضغط على أي حقل بالأسفل لتعديله مباشرة:_' : '💡 _اضغط على أي حقل بالأسفل لتقديم طلب تعديل:_';
    return (
      `${title}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *الاسم الكامل:* ${cleanMd(worker.name)}\n` +
      `• *اسم الشهرة المعتمد:* *${cleanMd(worker.nickname) || 'غير مسجل'}*\n` +
      `• *كود النظام:* \`#${worker.code}\`\n` +
      `• *الكود الأرشيفي:* \`${worker.legacyCode || 'لا يوجد'}\`\n` +
      `• *الرقم القومي:* \`${worker.nationalId || 'غير مسجل'}\`\n` +
      `• *تاريخ انتهاء البطاقة:* \`${formatDate(worker.idCardExpiryDate)}\`\n` +
      `• *المحافظة:* ${cleanMd(govName)}\n` +
      `• *العنوان التفصيلي:* ${cleanMd(worker.address) || 'غير مسجل'}\n` +
      `• *الموقف التجنيدي:* ${cleanMd(worker.militaryStatus) || 'غير مسجل'}\n` +
      `• *الحالة الاجتماعية:* ${cleanMd(worker.maritalStatus) || 'غير مسجل'}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      hint
    );
  },

  tab2JobCard(worker: WorkerCardView, isSuperAdmin: boolean): string {
    const title = '✏️ *بطاقة العامل — 💼 بيانات الوظيفة والتشغيل*';
    const contractTypeAr = worker.contractTypeAr || (worker.contractType ? (CONTRACT_TYPE_LABELS[worker.contractType] || cleanMd(worker.contractType)) : 'عمالة يومية / مؤقتة');
    const hint = isSuperAdmin ? '💡 _اضغط على أي حقل بالأسفل لتعديله مباشرة:_' : '💡 _اضغط على أي حقل بالأسفل لتقديم طلب تعديل:_';
    return (
      `${title}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *الاسم:* ${cleanMd(worker.name)} (${cleanMd(worker.nickname) || 'بدون شهرة'})\n` +
      `• *كود العامل:* \`#${worker.code}\`\n` +
      `• *المسمى الوظيفي:* ${cleanMd(worker.jobRef?.name || worker.jobRef?.title || worker.jobTitle || 'غير محدد')}\n` +
      `• *الموقع الميداني:* ${cleanMd(worker.site?.name || 'غير محدد')}\n` +
      `• *الإدارة / القسم:* ${cleanMd(worker.department?.name || 'العمليات الميدانية')}\n` +
      `• *نظام الوردية:* ${formatShiftSystem(worker.shiftSystem)}\n` +
      `• *نوع التعاقد:* ${contractTypeAr}\n` +
      `• *تاريخ التعيين:* \`${formatDate(worker.hireDate)}\`\n` +
      `• *حالة التشغيل:* ${worker.status === 'ACTIVE' ? 'نشط ميدانياً 🟢' : cleanMd(worker.status) || 'نشط'}\n` +
      `• *رخصة القيادة:* ${cleanMd(worker.drivingLicense) || 'بدون رخصة'}\n` +
      `• *عنبر السكن بالكامب:* ${cleanMd(worker.barracksUnit) || 'غير محدد'}\n` +
      `• *رقم السرير / الغرفة:* ${cleanMd(worker.bedNumber) || 'غير محدد'}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      hint
    );
  },


  tab3FinanceCard(worker: WorkerCardView, isSuperAdmin: boolean): string {
    const title = '✏️ *بطاقة العامل — 💰 البيانات المالية والمخصصات*';
    const policyLabel = CIGARETTE_POLICY_LABELS[worker.canteenCigarettePolicy || 'NONE'] || cleanMd(worker.canteenCigarettePolicy) || 'بدون مخصص';
    const brandLabel = cleanMd(worker.cigaretteBrand || (worker.canteenItem ? worker.canteenItem.name : 'غير محدد'));

    const bSal = Number(worker.basicSalary || 0);
    const aSal = Number(worker.fixedAllowances || 0);
    const gSal = bSal + aSal;
    const dWage = gSal > 0 ? (gSal / 30).toFixed(2) : Number(worker.dailyWage || 0);

    const basicSalDisplay = bSal > 0
      ? (isSuperAdmin ? `\`${bSal} ج.م\`` : formatSpoiler(`\`${bSal} ج.م\``, 'markdown'))
      : '`غير محدد`';
    const addSalDisplay = aSal > 0
      ? (isSuperAdmin ? `\`${aSal} ج.م\`` : formatSpoiler(`\`${aSal} ج.م\``, 'markdown'))
      : '`0 ج.م`';
    const grossDisplay = gSal > 0
      ? (isSuperAdmin ? `\`${gSal} ج.م\`` : formatSpoiler(`\`${gSal} ج.م\``, 'markdown'))
      : '`غير محدد`';
    const dailyDisplay = isSuperAdmin ? `\`${dWage} ج.م\`` : formatSpoiler(`\`${dWage} ج.م\``, 'markdown');

    return (
      `${title}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *الاسم:* ${cleanMd(worker.name)} (${cleanMd(worker.nickname) || 'بدون شهرة'})\n` +
      `• *كود العامل:* \`#${worker.code}\`\n` +
      `• *طريقة الصرف:* ${cleanMd(worker.paymentMethod) || 'نقداً بالخزينة (كاش)'}\n` +
      `• *رقم الحساب / المحفظة:* \`${worker.accountNumber || 'غير مسجل'}\`\n` +
      `• *اسم صاحب المحفظة:* ${cleanMd(worker.walletOwnerName) || 'مسجل باسم العامل'}\n` +
      `• *معرف إنستاباي:* \`${worker.instaPayHandle || 'لا يوجد'}\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `💵 *هيكل الراتب والتعاقد الشهري:*\n` +
      `• *الراتب الأساسي الشهري:* ${basicSalDisplay}\n` +
      `• *الراتب الإضافي الشهري:* ${addSalDisplay}\n` +
      `• *إجمالي الراتب الشهري:* ${grossDisplay}\n` +
      `• *أجر اليوم الحسابي (30 يوم):* ${dailyDisplay}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *الرقم التأميني:* \`${worker.insuranceNumber || 'غير مسجل'}\`\n` +
      `• *الموقف من التأمينات:* ${cleanMd(worker.insuranceStatus) || 'غير مؤمن عليه'}\n` +
      `• *سياسة مخصص السجائر:* ${policyLabel}\n` +
      `• *صنف السجائر المعتمد:* ${brandLabel}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 _اضغط على أي حقل بالأسفل لتعديله مباشرة:_`
    );
  },

  tab4DocsCard(worker: WorkerCardView, isSuperAdmin: boolean): string {
    const title = '✏️ *بطاقة العامل — 📞 الاتصال والسلامة والمستندات*';
    const phoneVal = worker.phone ? `\`${worker.phone}\`` : '`غير مسجل`';
    const emVal = worker.emergencyPhone ? `\`${worker.emergencyPhone}\`` : '`غير مسجل`';
    const medVal = worker.medicalNotes
      ? `\n${formatExpandableQuote(cleanMd(worker.medicalNotes), 'markdown')}`
      : 'لا توجد ملاحظات طبية خاصة';
    const hint = isSuperAdmin ? '💡 _اضغط على أي حقل بالأسفل لتعديله مباشرة:_' : '💡 _اضغط على أي حقل بالأسفل لتقديم طلب تعديل:_';
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
      `• *الملاحظات الطبية والحساسية:* ${medVal}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      hint
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
      `يرجى كتابة القيمة الجديدة الآن:`
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
      `تم تطبيق التعديل وتحديث السجل وقيد الحركة في سجل تدقيق الملف.`
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

  // ═══════════════════════════════════════════════════════════════
  // 💰 معالج تعديل الراتب المتزامن (Salary Adjustment Wizard)
  // ═══════════════════════════════════════════════════════════════

  salaryWizardStep1Basic(workerName: string, currentBase: number): string {
    return (
      `💰 *معالج تعديل الراتب — الخطوة (1 من 4)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *العامل:* ${cleanMd(workerName)}\n` +
      `• *الراتب الأساسي الحالي:* \`${currentBase} ج.م\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `يرجى إدخال *الراتب الأساسي الجديد* (بالجنيه المصري):`
    );
  },

  salaryWizardStep2Additional(workerName: string, newBase: number, currentAdd: number): string {
    return (
      `💰 *معالج تعديل الراتب — الخطوة (2 من 4)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *العامل:* ${cleanMd(workerName)}\n` +
      `• *الراتب الأساسي الجديد:* \`${newBase} ج.م\`\n` +
      `• *الراتب الإضافي الحالي:* \`${currentAdd} ج.م\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `يرجى إدخال *الراتب الإضافي الجديد* (بالجنيه المصري) أو أرسل \`0\` إذا لم يكن له إضافي:`
    );
  },

  salaryWizardStep3EffectiveDate(workerName: string, newBase: number, newAdd: number): string {
    const gross = newBase + newAdd;
    return (
      `📅 *معالج تعديل الراتب — الخطوة (3 من 4)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *العامل:* ${cleanMd(workerName)}\n` +
      `• *الراتب الأساسي الجديد:* \`${newBase} ج.م\`\n` +
      `• *الراتب الإضافي الجديد:* \`${newAdd} ج.م\`\n` +
      `• *إجمالي الراتب الجديد:* \`${gross} ج.م\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `حدد تاريخ بدء *سريان الراتب الجديد* للمحاسبة والاستحقاقات:`
    );
  },

  salaryWizardStep4Reason(workerName: string, newBase: number, newAdd: number, effectiveLabel: string): string {
    return (
      `📝 *معالج تعديل الراتب — الخطوة (4 من 4)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *العامل:* ${cleanMd(workerName)}\n` +
      `• *الراتب المقترح:* \`${newBase} أساسي + ${newAdd} إضافي = ${newBase + newAdd} ج.م\`\n` +
      `• *تاريخ السريان:* ${effectiveLabel}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `يرجى كتابة *سبب التعديل أو القرار الإداري* (مثال: ترقية استثنائية، زيادة سنوية، تسوية موقع):`
    );
  },

  salaryWizardConfirmCard(data: {
    workerName: string;
    workerCode: string;
    currentBase: number;
    currentAdd: number;
    currentGross: number;
    newBase: number;
    newAdd: number;
    newGross: number;
    effectiveDateLabel: string;
    reason: string;
  }): string {
    const diff = data.newGross - data.currentGross;
    const diffSign = diff >= 0 ? `+${diff}` : `${diff}`;
    const newDaily = (data.newGross / 30).toFixed(2);

    return (
      `📋 *مراجعة وتأكيد تعديل راتب العامل*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *العامل:* ${cleanMd(data.workerName)} (\`#${data.workerCode}\`)\n` +
      `• *الراتب السابق:* \`${data.currentBase} أساسي + ${data.currentAdd} إضافي = ${data.currentGross} ج.م\`\n` +
      `• *الراتب الجديد المعتمد:* \`${data.newBase} أساسي + ${data.newAdd} إضافي = ${data.newGross} ج.م\`\n` +
      `• *الفارق الصافي:* \`${diffSign} ج.م\`\n` +
      `• *اليومية الحسابية الجديدة:* \`${newDaily} ج.م / يوم\`\n` +
      `• *تاريخ بدء السريان:* ${data.effectiveDateLabel}\n` +
      `• *سبب القرار الإداري:* ${cleanMd(data.reason)}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚠️ *تنبيه محاسبي:* سيتم قيد هذا التعديل في السجل التاريخي للأجور بشكل دائم (Append-Only) لحساب المستحقات والبدلات بدقة بأثر رجعي أو مستقبلي.`
    );
  },

  salaryAdjustmentSuccess(data: {
    workerCode: string;
    workerName: string;
    newBase: number;
    newAdd: number;
    newGross: number;
    effectiveDateLabel: string;
  }): string {
    return (
      `✅ *تم اعتماد وقيد تعديل الراتب بنجاح دائم*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *العامل:* ${cleanMd(data.workerName)} (\`#${data.workerCode}\`)\n` +
      `• *الراتب الأساسي:* \`${data.newBase} ج.م\`\n` +
      `• *الراتب الإضافي:* \`${data.newAdd} ج.م\`\n` +
      `• *إجمالي الراتب المعتمد:* \`${data.newGross} ج.م\`\n` +
      `• *تاريخ بدء السريان:* ${data.effectiveDateLabel}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `تم تحديث ملف العامل وقيد حركة الأجر في السجل التاريخي المحاسبي.`
    );
  },

  // ═══════════════════════════════════════════════════════════════
  // 📜 شاشات السجلات التاريخية والتدقيق (Timelines)
  // ═══════════════════════════════════════════════════════════════

  salaryHistoryTimeline(workerName: string, workerCode: string, records: SalaryHistoryRecord[]): string {
    if (records.length === 0) {
      return (
        `💰 *سجل تدرج الرواتب والزيادات*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `• *العامل:* ${cleanMd(workerName)} (\`#${workerCode}\`)\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `لا توجد حركات رواتب مسجلة حتى الآن.`
      );
    }

    let body = `💰 *سجل تدرج الرواتب والزيادات التاريخي*\n━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *العامل:* ${cleanMd(workerName)} (\`#${workerCode}\`)\n` +
      `• *إجمالي الحركات المسجلة:* ${records.length}\n━━━━━━━━━━━━━━━━━━━━━\n\n`;

    records.forEach((r, idx) => {
      const diff = r.newGrossSalary - r.previousGrossSalary;
      const diffText = r.previousGrossSalary > 0 ? (diff >= 0 ? ` (+${diff})` : ` (${diff})`) : ' (أول تعيين)';
      body += `*${idx + 1}. سريان شهر:* \`${r.effectiveMonth}\` (${formatDate(r.effectiveDate)})\n`;
      body += `   • *الأساسي:* \`${r.newBasicSalary} ج.م\` | *الإضافي:* \`${r.newAdditionalSalary} ج.م\`\n`;
      body += `   • *الإجمالي:* \`${r.newGrossSalary} ج.م\`${diffText}\n`;
      body += `   • *السبب:* ${cleanMd(r.reason)}\n`;
      if (r.approvedByName) {
        body += `   • *المعتمد:* ${cleanMd(r.approvedByName)}\n`;
      }
      body += `   • *تاريخ القيد:* \`${formatDate(r.createdAt)}\`\n`;
      body += `─────────────────────\n`;
    });

    return body;
  },

  workerChangeLogTimeline(workerName: string, workerCode: string, records: WorkerChangeLogRecord[]): string {
    if (records.length === 0) {
      return (
        `📜 *سجل تعديلات ملف العامل*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `• *العامل:* ${cleanMd(workerName)} (\`#${workerCode}\`)\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `لا توجد أي تعديلات إدارية سابقة على هذا الملف.`
      );
    }

    let body = `📜 *سجل التعديلات الإدارية على ملف العامل*\n━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *العامل:* ${cleanMd(workerName)} (\`#${workerCode}\`)\n` +
      `• *عدد التعديلات:* ${records.length}\n━━━━━━━━━━━━━━━━━━━━━\n\n`;

    records.slice(0, 15).forEach((c, idx) => {
      body += `*${idx + 1}. تعديل:* ${cleanMd(c.fieldNameAr)}\n`;
      body += `   • *القيمة السابقة:* \`${c.oldDisplayValue || c.oldValue || 'فارغ'}\`\n`;
      body += `   • *القيمة الجديدة:* \`${c.newDisplayValue || c.newValue || '-'}\`\n`;
      if (c.reason) body += `   • *السبب:* ${cleanMd(c.reason)}\n`;
      body += `   • *بواسطة:* ${cleanMd(c.actorName || c.actorRole)} (\`${formatDate(c.createdAt)}\`)\n`;
      body += `─────────────────────\n`;
    });

    return body;
  },
};
