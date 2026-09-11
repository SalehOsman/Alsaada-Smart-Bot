import { formatDateDMY } from '@alsaada/regional-engine';
import type { PendingWorkerWizardState } from './flow.types.js';

export const WorkerRegistrationMessages = {
  docTypePrompt(): string {
    return (
      `➕ *تسجيل وتعيين عامل / موظف جديد*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `مرحباً بك في معالج تسجيل ملفات العاملين بالشركة.\n` +
      `يرجى اختيار نوع وثيقة إثبات الشخصية للعامل:`
    );
  },

  photoFrontPrompt(isPassport: boolean): string {
    if (isPassport) {
      return (
        `🌍 *تسجيل عامل وافد (جواز سفر)*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `📸 يرجى إرسال *صورة صفحة البيانات الأساسية بجواز السفر* للتدقيق الذكي،\n` +
        `أو يمكنك الضغط على زر التخطي للإدخال اليدوي المباشر.`
      );
    }
    return (
      `🇪🇬 *تسجيل عامل مصري (بطاقة الرقم القومي)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `📸 يرجى إرسال *صورة واضحة لوجه بطاقة الرقم القومي* لاستخراج البيانات بدقة،\n` +
      `أو اضغط على زر التخطي للإدخال اليدوي المباشر.`
    );
  },

  photoBackPrompt(): string {
    return (
      `📸 *ظهر بطاقة الرقم القومي*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `تم استلام وجه البطاقة بنجاح.\n` +
      `يرجى الآن إرسال *صورة واضحة لظهر البطاقة* لقراءة العنوان ومحل الإقامة، أو اضغط تخطي:`
    );
  },

  namePrompt(): string {
    return (
      `👤 *الاسم الكامل للعامل*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `يرجى كتابة الاسم كاملاً (ثلاثياً أو رباعياً كما هو مدون في البطاقة الرسمية):`
    );
  },

  idNumberPrompt(isPassport: boolean): string {
    if (isPassport) {
      return (
        `🌍 *رقم جواز السفر*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `يرجى كتابة رقم جواز السفر (حروف وأرقام):`
      );
    }
    return (
      `🇪🇬 *الرقم القومي المصري*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `يرجى كتابة الرقم القومي المكون من 14 رقماً:`
    );
  },

  nicknamePrompt(name: string): string {
    return (
      `🏷️ *اسم الشهرة / اللقب*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `العامل: *${name}*\n` +
      `يرجى إدخال اسم الشهرة المتداول بالموقع، أو اضغط زر الاعتماد لاستخدام الاسم الأول والثاني:`
    );
  },

  phonePrompt(name: string): string {
    return (
      `📱 *رقم هاتف العامل*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `العامل: *${name}*\n` +
      `يرجى إدخال رقم هاتف العامل للتواصل وتفعيل حسابه بالبوت (مثال: 01012345678):`
    );
  },

  payoutMethodPrompt(): string {
    return (
      `💳 *وسيلة صرف الراتب والمستحقات*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `يرجى تحديد آلية الصرف المالية المعتمدة للعامل:`
    );
  },

  jobChoicePrompt(): string {
    return (
      `💼 *المسمى الوظيفي والمهنة*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `يرجى اختيار الوظيفة المعتمدة للعامل من القائمة:`
    );
  },

  siteChoicePrompt(): string {
    return (
      `📍 *موقع العمل الميداني*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `يرجى اختيار الموقع أو المشروع التابع له العامل:`
    );
  },

  startDatePrompt(): string {
    return (
      `📅 *تاريخ مباشرة العمل (تاريخ التعيين)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `يرجى تحديد تاريخ استلام العمل:`
    );
  },

  licensePrompt(): string {
    return (
      `🪪 *رخصة القيادة / تشغيل المعدات*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `يرجى تحديد نوع الرخصة للعامل:`
    );
  },

  militaryPrompt(): string {
    return (
      `🎖️ *الموقف من التجنيد*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `يرجى تحديد موقف الخدمة العسكرية للعامل:`
    );
  },

  emergencyPhonePrompt(): string {
    return (
      `🚨 *هاتف الطوارئ*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `يرجى إدخال رقم هاتف أحد الأقارب للطوارئ (أو اضغط تخطي):`
    );
  },

  insurancePrompt(): string {
    return (
      `🛡️ *الموقف التأميني*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `يرجى تحديد الحالة التأمينية السابقة للعامل:`
    );
  },

  maritalPrompt(): string {
    return (
      `💍 *الحالة الاجتماعية*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `يرجى تحديد الحالة الاجتماعية للعامل:`
    );
  },

  confirmationCard(state: PendingWorkerWizardState): string {
    const isNatId = state.idType === 'NATIONAL_ID';
    const idLabel = isNatId ? '🇪🇬 الرقم القومي' : '🌍 جواز السفر';
    const lines = [
      `📋 *مراجعة وتأكيد بيانات تعيين العامل*`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `👤 *الاسم الكامل:* ${state.name || '-'}`,
      `🏷️ *اسم الشهرة:* ${state.nickname || '-'}`,
      `${idLabel}: \`${state.idNumber || '-'}\``,
      `📱 *رقم الهاتف:* \`${state.phone || '-'}\``,
      `💼 *الوظيفة:* ${state.jobTitleName || '-'}`,
      `📍 *الموقع الميداني:* ${state.siteName || '-'}`,
      `📅 *تاريخ المباشرة:* ${state.hireDate || '-'}`,
      `💳 *وسيلة الصرف:* ${state.paymentMethod || 'نقدي بالموقع'}`,
      state.accountNumber ? `🔢 *رقم الحساب/المحفظة:* \`${state.accountNumber}\`` : '',
      `🪪 *الرخصة:* ${state.drivingLicense || 'لا توجد'}`,
      `🎖️ *التجنيد:* ${state.militaryStatus || 'غير محدد'}`,
      `🚨 *هاتف الطوارئ:* ${state.emergencyPhone || 'غير مسجل'}`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `هل تؤكد حفظ واعتماد تسجيل العامل في النظام؟`,
    ].filter(Boolean);

    return lines.join('\n');
  },

  registrationSuccess(data: { code: string; name: string; jobTitle: string; siteName?: string | undefined; hireDate: Date }): string {
    const formattedDate = formatDateDMY(data.hireDate);
    return (
      `✅ *تم تسجيل وتعيين العامل بنجاح*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *الاسم:* ${data.name}\n` +
      `🆔 *الكود الوظيفي:* \`#${data.code}\`\n` +
      `💼 *الوظيفة:* ${data.jobTitle}\n` +
      `📍 *الموقع:* ${data.siteName || 'الموقع العام'}\n` +
      `📅 *تاريخ المباشرة:* ${formattedDate}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `تم إنشاء ملف العامل بنجاح وتوليد رابط الدعوة الرسمي.`
    );
  },

  registrationNotification(data: { code: string; name: string; jobTitle: string; siteName?: string | undefined; hireDate: Date }): string {
    const formattedDate = formatDateDMY(data.hireDate);
    return (
      `👤 *تعيين عامل جديد في المنظومة*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *الاسم:* ${data.name}\n` +
      `• *الكود:* \`#${data.code}\`\n` +
      `• *الوظيفة:* ${data.jobTitle}\n` +
      `• *الموقع:* ${data.siteName || 'الموقع العام'}\n` +
      `• *تاريخ المباشرة:* ${formattedDate}`
    );
  },

  cancelled(): string {
    return `❌ تم إلغاء عملية تسجيل العامل. يمكنك البدء من جديد في أي وقت.`;
  },
};
