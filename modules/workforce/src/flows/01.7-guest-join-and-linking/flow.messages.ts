export function formatSearchPrompt(companyName?: string): string {
  const company = companyName?.trim() || 'المنظومة';
  return (
    `📝 *تقديم طلب انضمام وربط حساب بالبوابة الرقمية*\n` +
    `────────────────────────────\n` +
    `أهلاً بك زميلنا العزيز 👋\n\n` +
    `لربط حسابك بسجلك الوظيفي المعتمد في ${company}، يرجى إرسال:\n` +
    `• *كودك الوظيفي* (مثال: \`OP-DRV-0015\` أو الكود القديم \`106\`)\n` +
    `• أو *الرقم القومي* المسجل في عقد العمل.\n\n` +
    `أرسل الكود أو الرقم القومي الآن:`
  );
}

export function formatApplicationSubmitted(workerName: string, workerCode: string, ticketNumber: string): string {
  return (
    `✅ *تم تقديم طلب الانضمام والربط بنجاح*\n` +
    `────────────────────────────\n` +
    `🔹 *الاسم المسجل:* *${workerName}*\n` +
    `🔹 *الكود الوظيفي:* \`#${workerCode}\`\n` +
    `🔹 *رقم التذكرة:* \`${ticketNumber}\`\n\n` +
    `🔐 *إجراءات المصادقة الأمنية الميدانية:*\n` +
    `سيتم فحص الطلب وإرسال رابط التفعيل المشفر إلى **رقم الواتساب الرسمي المسجل في ملفك الوظيفي**.\n` +
    `صلاحية الرابط هي 24 ساعة ومربوط بحسابك هذا حصراً.\n\n` +
    `يمكنك متابعة حالة الطلب في أي وقت عبر الأمر \`/status\` أو زر الاستعلام.`
  );
}

export function formatAdminApprovalCard(
  applicantName: string,
  applicantTelegramId: bigint,
  workerName: string,
  workerCode: string,
  officialPhone: string
): string {
  return (
    `🚨 *طلب انضمام وربط حساب جديد بانتظار الاعتماد*\n` +
    `────────────────────────────\n` +
    `👤 *مقدم الطلب عبر تليجرام:* *${applicantName}*\n` +
    `🆔 *معرف تليجرام:* \`${applicantTelegramId.toString()}\`\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `👷 *بيانات سجل العامل المطابق:*\n` +
    `• الاسم: *${workerName}*\n` +
    `• الكود: \`#${workerCode}\`\n` +
    `• رقم الهاتف المسجل رسمياً: \`${officialPhone}\`\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `اضغط أدناه لتوليد رابط التفعيل المشفر وإرساله مباشرة لواتساب العامل الرسمي:`
  );
}

export function formatWhatsAppMessageText(workerName: string, deepLink: string, companyName?: string): string {
  const company = companyName?.trim() || 'المنظومة';
  return (
    `مرحباً زميلنا العزيز/ ${workerName}،\n` +
    `بناءً على طلب ربط حسابك ببوابة ${company} الرقمية، نرسل إليك رابط التفعيل المشفر:\n` +
    `${deepLink}\n\n` +
    `⚠️ تنبيه أمني: هذا الرابط صالح لمدة 24 ساعة ومخصص حصرياً لهاتفك وحسابك، لا تشاركه مع أي شخص آخر.`
  );
}

export function formatLinkingSuccess(
  workerName: string,
  workerCode: string,
  jobTitle: string,
  siteName?: string,
  commitmentBadge?: string
): string {
  const siteLine = siteName ? `📍 *الموقع:* ${siteName}\n` : '';
  const scoreLine = commitmentBadge ? `⭐ *مؤشر الالتزام:* ${commitmentBadge}\n` : `⭐ *مؤشر الالتزام:* 🟢 *ملتزم* (100/100)\n`;
  return (
    `🎉 *تهانينا يا ${workerName}! تم تفعيل وربط حسابك بنجاح!*\n` +
    `────────────────────────────\n` +
    `🆔 *كودك الوظيفي:* \`#${workerCode}\`\n` +
    `💼 *الوظيفة:* ${jobTitle}\n` +
    siteLine +
    scoreLine +
    `────────────────────────────\n` +
    `أصبحت الآن متصلاً رسمياً بالبوابة الذاتية للعاملين. يمكنك استعراض كشف حسابك وتقديم طلباتك مباشرة.`
  );
}

export function formatApplicationStatus(hasPending: boolean, ticketNumber?: string, status = 'PENDING'): string {
  if (!hasPending) {
    return (
      `ℹ️ *حالة طلبات الانضمام*\n` +
      `────────────────────────────\n` +
      `لا يوجد لديك أي طلب انضمام قيد المراجعة حالياً.\n` +
      `يمكنك تقديم طلب جديد عبر الأمر \`/apply\` أو زر تقديم الطلب.`
    );
  }
  return (
    `📋 *حالة طلب الانضمام الخاص بك*\n` +
    `────────────────────────────\n` +
    `🔹 *رقم التذكرة:* \`${ticketNumber}\`\n` +
    `🔹 *الحالة الحالية:* ⏳ بانتظار إرسال رابط التفعيل المشفر لواتسابك الرسمي.\n\n` +
    `يرجى مراجعة رسائل الواتساب على رقمك المسجل بالشركة وفتح رابط التفعيل.`
  );
}
