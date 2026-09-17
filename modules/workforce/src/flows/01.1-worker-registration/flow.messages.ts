import { formatBreadcrumbs } from '@alsaada/core-components';
import { formatDateDMY, formatCurrency, normalizeDigits, parseFlexibleDate } from '@alsaada/regional-engine';
import { parseEgyptianNationalId } from '@alsaada/national-id-engine';
import { WorkerWizardStep, PAYOUT_METHOD_MAP, type PendingWorkerWizardState } from './flow.types.js';

const BASE_CRUMBS = ['📁 الموارد البشرية', '👥 شؤون العاملين', '➕ تعيين عامل جديد'];
const DIVIDER = '────────────────────────────';

function getWorkerAge(state: PendingWorkerWizardState): number | undefined {
  const birth = state.birthDate || state.aiDetectedData?.birthDate;
  if (birth) {
    const parsed = parseFlexibleDate(birth);
    if (parsed.isValid && parsed.date && !isNaN(parsed.date.getTime())) {
      const today = new Date();
      let age = today.getFullYear() - parsed.date.getFullYear();
      const m = today.getMonth() - parsed.date.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < parsed.date.getDate())) {
        age--;
      }
      return Math.max(0, age);
    }
  }

  if (state.idType === 'NATIONAL_ID' || !state.idType) {
    const rawId = state.idNumber || state.aiDetectedData?.nationalId;
    if (rawId) {
      const parsed = parseEgyptianNationalId(rawId);
      if (parsed.isValid && parsed.info?.age !== undefined) {
        return parsed.info.age;
      }
    }
  }

  if (state.aiDetectedData?.age !== undefined) {
    return state.aiDetectedData.age;
  }

  return undefined;
}

export const WorkerRegistrationMessages = {
  docTypePrompt(): string {
    return (
      formatBreadcrumbs([...BASE_CRUMBS, 'نوع الوثيقة']) +
      `➕ *تسجيل وتعيين عامل جديد — [الخطوة 1 من 12: وثيقة إثبات الشخصية]*\n` +
      `${DIVIDER}\n` +
      `مرحباً بك في معالج تسجيل وتعيين العاملين بالمنظومة.\n` +
      `يرجى اختيار نوع وثيقة إثبات الشخصية للعامل:\n` +
      `(بطاقة الرقم القومي للمصريين، أو جواز سفر للوافدين)`
    );
  },

  photoFrontPrompt(isPassport: boolean): string {
    if (isPassport) {
      return (
        formatBreadcrumbs([...BASE_CRUMBS, 'بيانات الجواز']) +
        `🌍 *تسجيل وتعيين عامل جديد — [الخطوة 2 من 12: صورة جواز السفر]*\n` +
        `${DIVIDER}\n` +
        `📸 *يرجى إرسال صورة واضحة لصفحة البيانات الأساسية بجواز السفر للتدقيق الذكي:*\n` +
        `(أو اضغط زر التخطي أدناه للمتابعة والإدخال اليدوي المباشر)`
      );
    }
    return (
      formatBreadcrumbs([...BASE_CRUMBS, 'وجه البطاقة']) +
      `🇪🇬 *تسجيل وتعيين عامل جديد — [الخطوة 2 من 12: صورة بطاقة الرقم القومي (الوجه)]*\n` +
      `${DIVIDER}\n` +
      `📸 *يرجى إرسال صورة واضحة لوجه بطاقة الرقم القومي لاستخراج البيانات بدقة:*\n` +
      `(أو اضغط زر التخطي أدناه للمتابعة والإدخال اليدوي المباشر)`
    );
  },

  photoBackPrompt(): string {
    return (
      formatBreadcrumbs([...BASE_CRUMBS, 'ظهر البطاقة']) +
      `📸 *تسجيل وتعيين عامل جديد — [الخطوة 2 من 12: صورة بطاقة الرقم القومي (الظهر)]*\n` +
      `${DIVIDER}\n` +
      `✅ تم استلام وجه البطاقة بنجاح.\n` +
      `يرجى الآن إرسال *صورة واضحة لظهر البطاقة* لقراءة العنوان ومحل الإقامة، أو اضغط زر التخطي:`
    );
  },

  aiProcessingPrompt(): string {
    return (
      formatBreadcrumbs([...BASE_CRUMBS, 'فحص وقراءة البطاقة']) +
      `🤖 *تسجيل وتعيين عامل جديد — [قراءة وفحص البطاقة بالذكاء الاصطناعي]*\n` +
      `${DIVIDER}\n` +
      `⏳ *جارٍ تنزيل الصورة وتحليل البيانات الرسمية بالذكاء الاصطناعي...*\n` +
      `يرجى الانتظار بضع ثوانٍ حتى يتم استخراج وتدقيق البيانات تلقائياً.`
    );
  },

  namePrompt(): string {
    return (
      formatBreadcrumbs([...BASE_CRUMBS, 'الاسم الرسمي']) +
      `👤 *تسجيل وتعيين عامل جديد — [الخطوة 3 من 12: الاسم الرباعي الرسمي]*\n` +
      `${DIVIDER}\n` +
      `💬 *يرجى كتابة الاسم الرسمي للعامل كاملاً (ثلاثياً أو رباعياً كما هو مدون في البطاقة الرسمية):*\n` +
      `(مثال: أحمد محمد مصطفى إبراهيم)`
    );
  },

  idNumberPrompt(isPassport: boolean): string {
    if (isPassport) {
      return (
        formatBreadcrumbs([...BASE_CRUMBS, 'رقم الجواز']) +
        `🌍 *تسجيل وتعيين عامل جديد — [الخطوة 5 من 12: رقم جواز السفر]*\n` +
        `${DIVIDER}\n` +
        `💬 *يرجى كتابة رقم جواز السفر الرسمي (حروف إنجليزية وأرقام):*\n` +
        `(مثال: A12345678)`
      );
    }
    return (
      formatBreadcrumbs([...BASE_CRUMBS, 'الرقم القومي']) +
      `🇪🇬 *تسجيل وتعيين عامل جديد — [الخطوة 5 من 12: الرقم القومي المصري]*\n` +
      `${DIVIDER}\n` +
      `💬 *يرجى كتابة الرقم القومي الرسمي المكون من 14 رقماً:*\n` +
      `(مثال: 29501012701234)`
    );
  },

  nicknamePrompt(name: string): string {
    return (
      formatBreadcrumbs([...BASE_CRUMBS, 'اسم الشهرة']) +
      `🏷️ *تسجيل وتعيين عامل جديد — [الخطوة 4 من 12: اسم الشهرة واللقب]*\n` +
      `${DIVIDER}\n` +
      `العامل: *${name}*\n` +
      `💬 *يرجى إدخال اسم الشهرة المتداول للعامل بالموقع، أو اضغط زر الاعتماد أدناه:*\n` +
      `(مثال: أبو حميد أو حمو)`
    );
  },

  phonePrompt(name: string): string {
    return (
      formatBreadcrumbs([...BASE_CRUMBS, 'رقم الهاتف']) +
      `📱 *تسجيل وتعيين عامل جديد — [الخطوة 6 من 12: رقم هاتف التواصل]*\n` +
      `${DIVIDER}\n` +
      `العامل: *${name}*\n` +
      `💬 *يرجى إدخال رقم هاتف العامل للتواصل وتفعيل حسابه بالمنظومة:*\n` +
      `(مثال: 01012345678 أو 01123456789)`
    );
  },

  payoutTransferChoicePrompt(phone: string): string {
    const normPhone = phone ? normalizeDigits(phone) : '';
    return (
      formatBreadcrumbs([...BASE_CRUMBS, 'بيانات التحويل']) +
      `💳 *تسجيل وتعيين عامل جديد — [الخطوة 7 من 12: آلية وبيانات تحويل الراتب]*\n` +
      `${DIVIDER}\n` +
      `📱 رقم الهاتف المسجل: \`${normPhone}\`\n\n` +
      `💬 *هل رقم تحويل الراتب والمستحقات (المحفظة / إنستاباي) هو نفس رقم الهاتف الشخصي أعلاه؟*\n` +
      `(اختر "نعم" للمحفظة على نفس الرقم، أو "لا" لإدخال رقم آخر، أو اختر "استلام نقدي بالخزينة")`
    );
  },

  customWalletPrompt(): string {
    return (
      formatBreadcrumbs([...BASE_CRUMBS, 'رقم الحساب']) +
      `💳 *تسجيل وتعيين عامل جديد — [الخطوة 7 من 12: رقم المحفظة أو الحساب]*\n` +
      `${DIVIDER}\n` +
      `💬 *يرجى إدخال رقم هاتف المحفظة (11 رقماً) أو حساب إنستاباي أو الحساب البنكي:*\n` +
      `(مثال: 01098765432 أو username@instapay)`
    );
  },

  payoutMethodPrompt(walletNumber?: string): string {
    const normWallet = walletNumber && walletNumber !== '-' ? normalizeDigits(walletNumber) : undefined;
    return (
      formatBreadcrumbs([...BASE_CRUMBS, 'وسيلة الصرف']) +
      `💳 *تسجيل وتعيين عامل جديد — [الخطوة 7 من 12: وسيلة الصرف المعتمدة]*\n` +
      `${DIVIDER}\n` +
      (normWallet ? `الرقم المسجل للتحويل: \`${normWallet}\`\n\n` : '') +
      `💬 *يرجى تحديد آلية الصرف والتحويل المعتمدة لصرف راتب ومستحقات العامل:*\n` +
      `(اختر الوسيلة المناسبة من الخيارات أدناه)`
    );
  },

  jobChoicePrompt(): string {
    return (
      formatBreadcrumbs([...BASE_CRUMBS, 'المسمى الوظيفي']) +
      `💼 *تسجيل وتعيين عامل جديد — [الخطوة 8 من 12: المسمى الوظيفي والمهنة]*\n` +
      `${DIVIDER}\n` +
      `💬 *يرجى اختيار الوظيفة أو المهنة المعتمدة للعامل من القائمة:*\n` +
      `(يتم تحديد مربوط الراتب وساعات ودورة العمل تلقائياً بناءً على المهنة)`
    );
  },

  siteChoicePrompt(): string {
    return (
      formatBreadcrumbs([...BASE_CRUMBS, 'موقع العمل']) +
      `📍 *تسجيل وتعيين عامل جديد — [الخطوة 9 من 12: موقع العمل الميداني]*\n` +
      `${DIVIDER}\n` +
      `💬 *يرجى اختيار موقع العمل أو المشروع الميداني التابع له العامل:*\n` +
      `(اختر الموقع التابع له من القائمة أدناه)`
    );
  },

  startDatePrompt(): string {
    return (
      formatBreadcrumbs([...BASE_CRUMBS, 'تاريخ المباشرة']) +
      `📅 *تسجيل وتعيين عامل جديد — [الخطوة 10 من 12: تاريخ مباشرة العمل]*\n` +
      `${DIVIDER}\n` +
      `💬 *يرجى تحديد تاريخ مباشرة وبدء العمل الفعلي للعامل بالموقع:*\n` +
      `(اختر من الخيارات السريعة أدناه أو حدد إدخال تاريخ مخصص)`
    );
  },

  customStartDatePrompt(): string {
    return (
      formatBreadcrumbs([...BASE_CRUMBS, 'تاريخ مخصص']) +
      `✍️ *تسجيل وتعيين عامل جديد — [الخطوة 10 من 12: إدخال تاريخ مباشرة مخصص]*\n` +
      `${DIVIDER}\n` +
      `💬 *يرجى كتابة تاريخ بدء ومباشرة العمل بصيغة (YYYY-MM-DD):*\n` +
      `(مثال: 2026-09-01 أو 2026-08-15)`
    );
  },

  licensePrompt(): string {
    return (
      formatBreadcrumbs([...BASE_CRUMBS, 'رخصة القيادة']) +
      `🚗 *تسجيل وتعيين عامل جديد — [الخطوة 11 من 12 (1/5): موقف ونوع رخصة القيادة]*\n` +
      `${DIVIDER}\n` +
      `💬 *اختر نوع رخصة القيادة الحاصل عليها العامل، أو اضغط تخطي:*\n` +
      `(اختر نوع الرخصة المناسبة من الخيارات أدناه)`
    );
  },

  militaryPrompt(): string {
    return (
      formatBreadcrumbs([...BASE_CRUMBS, 'الموقف التجنيدي']) +
      `🎖️ *تسجيل وتعيين عامل جديد — [الخطوة 11 من 12 (2/5): الموقف من الخدمة العسكرية]*\n` +
      `${DIVIDER}\n` +
      `💬 *اختر الموقف التجنيدي الرسمي للعامل، أو اضغط تخطي:*\n` +
      `(اختر الحالة التجنيدية المناسبة من الخيارات أدناه)`
    );
  },

  emergencyPhonePrompt(): string {
    return (
      formatBreadcrumbs([...BASE_CRUMBS, 'هاتف الطوارئ']) +
      `🚨 *تسجيل وتعيين عامل جديد — [الخطوة 11 من 12 (3/5): هاتف الطوارئ (Emergency Contact)]*\n` +
      `${DIVIDER}\n` +
      `💬 *أدخل رقم هاتف شخص من أقارب العامل (أب / أخ / زوجة / قريب)، أو اضغط تخطي:*\n` +
      `(مثال: 01012345678)`
    );
  },

  insurancePrompt(): string {
    return (
      formatBreadcrumbs([...BASE_CRUMBS, 'الموقف التأميني']) +
      `🛡️ *تسجيل وتعيين عامل جديد — [الخطوة 11 من 12 (4/5): الموقف التأميني السابق بجهة أخرى]*\n` +
      `${DIVIDER}\n` +
      `💬 *اختر الحالة التأمينية السابقة للعامل، أو اضغط تخطي:*\n` +
      `(اختر الحالة التأمينية المناسبة من الخيارات أدناه)`
    );
  },

  maritalPrompt(): string {
    return (
      formatBreadcrumbs([...BASE_CRUMBS, 'الحالة الاجتماعية']) +
      `💍 *تسجيل وتعيين عامل جديد — [الخطوة 11 من 12 (5/5): الحالة الاجتماعية للعامل]*\n` +
      `${DIVIDER}\n` +
      `💬 *اختر الحالة الاجتماعية للعامل، أو اضغط تخطي:*\n` +
      `(اختر الحالة الاجتماعية المناسبة من الخيارات أدناه)`
    );
  },

  confirmationCard(state: PendingWorkerWizardState, userRole?: string): string {
    const isNatId = state.idType === 'NATIONAL_ID';
    const idLabel = isNatId ? '🇪🇬 الرقم القومي' : '🌍 جواز السفر';
    const basic = Number(state.basicSalary || 0);
    const add = Number(state.additionalSalary || 0);
    const gross = basic + add;
    const canViewSalary = userRole === 'SUPER_ADMIN' || userRole === 'GENERAL_ADMIN';
    const payoutLabel = (state.paymentMethod && PAYOUT_METHOD_MAP[state.paymentMethod]?.label) || state.paymentMethod || 'استلام نقدي بالخزينة / الموقع';
    const age = getWorkerAge(state);
    const underageNotice = age !== undefined && age < 18
      ? '⚠️ *تنبيه قانوني:* العامل أصغر من سن العمل القانوني (أقل من 18 سنة)'
      : '';

    const idNumberStr = state.idNumber ? normalizeDigits(state.idNumber) : '-';
    const phoneStr = state.phone ? normalizeDigits(state.phone) : '-';
    const hireDateStr = state.hireDate ? normalizeDigits(state.hireDate) : '-';
    const shiftSystemStr = normalizeDigits(state.shiftSystem || '20 يوم عمل / 10 راحة');
    const emergencyPhoneStr = state.emergencyPhone && state.emergencyPhone !== '-'
      ? normalizeDigits(state.emergencyPhone)
      : 'غير مسجل';

    const salaryLines = canViewSalary
      ? [
          DIVIDER,
          `💵 *الراتب الأساسي الشهري:* ${formatCurrency(basic)}`,
          `➕ *الراتب الإضافي الشهري:* ${formatCurrency(add)}`,
          `💰 *إجمالي الراتب الشهري:* ${formatCurrency(gross)}`,
        ]
      : [];

    const lines = [
      formatBreadcrumbs([...BASE_CRUMBS, 'تأكيد التسجيل']) +
      `📋 *تسجيل وتعيين عامل جديد — [الخطوة 12 من 12: مراجعة وتأكيد بيانات التعيين]*`,
      DIVIDER,
      `👤 *الاسم الكامل:* ${state.name || '-'}`,
      `🏷️ *اسم الشهرة:* ${state.nickname || '-'}`,
      `${idLabel}: \`${idNumberStr}\``,
      `📱 *رقم الهاتف:* \`${phoneStr}\``,
      `💼 *الوظيفة:* ${state.jobTitleName || '-'}`,
      `📍 *الموقع الميداني:* ${state.siteName || '-'}`,
      `📅 *تاريخ المباشرة:* ${hireDateStr}`,
      `🔄 *دورة العمل:* ${shiftSystemStr}`,
      underageNotice,
      ...salaryLines,
      DIVIDER,
      `💳 *وسيلة الصرف:* ${payoutLabel}`,
      state.accountNumber && state.accountNumber !== '-' ? `🔢 *رقم الحساب/المحفظة:* \`${normalizeDigits(state.accountNumber)}\`` : '',
      state.walletWarning ? `⚠️ *تحذير المحفظة:* ${state.walletWarning}` : '',
      `🚗 *الرخصة:* ${state.drivingLicense || 'لا توجد رخصة'}`,
      `🎖️ *التجنيد:* ${state.militaryStatus || 'غير محدد'}`,
      `🚨 *هاتف الطوارئ:* ${emergencyPhoneStr}`,
      `🛡️ *الموقف التأميني:* ${state.insuranceStatus || 'غير مؤمن'}`,
      `💍 *الحالة الاجتماعية:* ${state.maritalStatus || 'غير محدد'}`,
      DIVIDER,
      `💬 *هل تؤكد حفظ واعتماد تسجيل العامل في النظام وقيد ملفه رسمياً؟*`,
    ].filter(Boolean);

    return lines.join('\n');
  },

  registrationSuccess(data: { code: string; name: string; jobTitle: string; siteName?: string | undefined; hireDate: Date; companyName?: string | undefined }): string {
    const formattedDate = formatDateDMY(data.hireDate);
    const companyHeader = data.companyName ? `🏢 *${data.companyName}*\n` : '';
    return (
      formatBreadcrumbs([...BASE_CRUMBS, 'تم التعيين']) +
      `✅ *تم تسجيل وتعيين العامل بنجاح*\n` +
      companyHeader +
      `${DIVIDER}\n` +
      `👤 *الاسم:* ${data.name}\n` +
      `🆔 *الكود الوظيفي:* \`#${data.code}\`\n` +
      `💼 *الوظيفة:* ${data.jobTitle}\n` +
      `📍 *الموقع الميداني:* ${data.siteName || 'الموقع العام'}\n` +
      `📅 *تاريخ المباشرة:* ${formattedDate}\n` +
      `${DIVIDER}\n` +
      `تم إنشاء ملف العامل بنجاح وتوليد رابط الدعوة الرسمي.`
    );
  },

  registrationNotification(data: { code: string; name: string; jobTitle: string; siteName?: string | undefined; hireDate: Date }): string {
    const formattedDate = formatDateDMY(data.hireDate);
    return (
      `👤 *تعيين عامل جديد في المنظومة*\n` +
      `${DIVIDER}\n` +
      `• *الاسم:* ${data.name}\n` +
      `• *الكود:* \`#${data.code}\`\n` +
      `• *الوظيفة:* ${data.jobTitle}\n` +
      `• *الموقع الميداني:* ${data.siteName || 'الموقع العام'}\n` +
      `• *تاريخ المباشرة:* ${formattedDate}`
    );
  },

  cancelled(): string {
    return (
      formatBreadcrumbs([...BASE_CRUMBS, 'إلغاء']) +
      `❌ *تم إلغاء عملية تسجيل وتعيين العامل*\n` +
      `${DIVIDER}\n` +
      `تم تفريغ مسودة البيانات بالكامل. يمكنك إعادة البدء في أي وقت.`
    );
  },

  aiConfirmationCard(state: PendingWorkerWizardState): string {
    const isPassport = state.idType === 'PASSPORT';
    const idLabel = isPassport ? '🌍 رقم جواز السفر' : '🇪🇬 الرقم القومي (14 رقماً)';
    const detected = state.aiDetectedData;
    const name = detected?.name || state.name || '-';
    const rawIdVal = detected?.nationalId || detected?.passportNumber || state.idNumber || '-';
    const idVal = rawIdVal !== '-' ? normalizeDigits(rawIdVal) : '-';
    const rawBirthStr = detected?.birthDate || state.birthDate || '-';
    const birthStr = rawBirthStr !== '-' ? normalizeDigits(rawBirthStr) : '-';
    const age = getWorkerAge(state);
    const ageStr = age !== undefined ? normalizeDigits(`(${age} سنة)`) : '';
    const genderStr = (detected?.gender || state.gender) === 'FEMALE' ? 'أنثى' : 'ذكر';
    const govStr = detected?.governorateName || 'غير محدد';
    const addressStr = detected?.address || state.address || 'غير محدد';
    const rawExpiryStr = detected?.expiryDate || state.expiryDate || 'سارية';
    const expiryStr = rawExpiryStr !== 'سارية' ? normalizeDigits(rawExpiryStr) : 'سارية';

    const underageNotice = age !== undefined && age < 18
      ? `\n⚠️ *تنبيه قانوني:* العامل أصغر من سن العمل القانوني (أقل من 18 سنة)`
      : '';

    return (
      formatBreadcrumbs([...BASE_CRUMBS, 'مراجعة القراءة الذكية']) +
      `🤖 *تسجيل وتعيين عامل جديد — [مراجعة واعتماد بيانات الذكاء الاصطناعي]*\n` +
      `${DIVIDER}\n` +
      `👤 *الاسم الكامل المقروء:* ${name}\n` +
      `${idLabel}: \`${idVal}\`\n` +
      `🎂 *تاريخ الميلاد:* \`${birthStr}\` ${ageStr}\n` +
      `⚧ *النوع:* ${genderStr} | 🏛️ *المحافظة:* ${govStr}\n` +
      `🏠 *محل الإقامة (العنوان):* ${addressStr}\n` +
      `📅 *تاريخ انتهاء السريان:* \`${expiryStr}\`` +
      `${underageNotice}\n` +
      `${DIVIDER}\n` +
      `💬 *تم استخراج البيانات الرسمية بالذكاء الاصطناعي بدقة.*\n` +
      `• اضغط *[ ✅ اعتماد ومتابعة ]* للموافقة والانتقال لبيانات الراتب والوظيفة.\n` +
      `• أو اضغط على أي زر أدناه لتعديل الاسم، الرقم، العنوان، أو السريان.`
    );
  },

  aiEditNamePrompt(currentName?: string): string {
    return (
      formatBreadcrumbs([...BASE_CRUMBS, 'تعديل الاسم']) +
      `✏️ *تسجيل وتعيين عامل جديد — [تعديل الاسم المستخرج]*\n` +
      `${DIVIDER}\n` +
      (currentName ? `الاسم الحالي: *${currentName}*\n\n` : '') +
      `💬 *يرجى إرسال الاسم الرسمي الصحيح للعامل (ثلاثياً أو رباعياً):*\n` +
      `(مثال: أحمد محمود علي إبراهيم)`
    );
  },

  aiEditIdPrompt(currentId?: string, isPassport = false): string {
    const label = isPassport ? 'رقم جواز السفر' : 'الرقم القومي (14 رقماً)';
    const normId = currentId ? normalizeDigits(currentId) : undefined;
    return (
      formatBreadcrumbs([...BASE_CRUMBS, 'تعديل الرقم']) +
      `✏️ *تسجيل وتعيين عامل جديد — [تعديل ${label}]*\n` +
      `${DIVIDER}\n` +
      (normId ? `الرقم الحالي: \`${normId}\`\n\n` : '') +
      `💬 *يرجى إرسال الرقم الرسمي الصحيح:*\n` +
      (isPassport ? `(مثال: A12345678)` : `(مثال: 29501012701234)`)
    );
  },

  aiEditAddressPrompt(currentAddress?: string): string {
    return (
      formatBreadcrumbs([...BASE_CRUMBS, 'تعديل العنوان']) +
      `✏️ *تسجيل وتعيين عامل جديد — [تعديل محل الإقامة والعنوان]*\n` +
      `${DIVIDER}\n` +
      (currentAddress ? `العنوان الحالي: *${currentAddress}*\n\n` : '') +
      `💬 *يرجى كتابة العنوان ومحل الإقامة الصحيح المدون بالبطاقة:*\n` +
      `(مثال: الأقصر - إسنا - قرية النمسا)`
    );
  },

  aiEditExpiryPrompt(currentExpiry?: string): string {
    const normExpiry = currentExpiry ? normalizeDigits(currentExpiry) : undefined;
    return (
      formatBreadcrumbs([...BASE_CRUMBS, 'تعديل السريان']) +
      `✏️ *تسجيل وتعيين عامل جديد — [تعديل تاريخ انتهاء السريان]*\n` +
      `${DIVIDER}\n` +
      (normExpiry ? `التاريخ الحالي: \`${normExpiry}\`\n\n` : '') +
      `💬 *يرجى كتابة تاريخ انتهاء السريان (DD-MM-YYYY أو YYYY-MM-DD):*\n` +
      `(مثال: 26-05-2028 أو 2028-05-26)`
    );
  },

  getStepPrompt(step: WorkerWizardStep, state: PendingWorkerWizardState, userRole?: string): string {
    switch (step) {
      case WorkerWizardStep.DOC_TYPE:
        return this.docTypePrompt();
      case WorkerWizardStep.PHOTO_FRONT:
        return this.photoFrontPrompt(state.idType === 'PASSPORT');
      case WorkerWizardStep.PHOTO_BACK:
        return this.photoBackPrompt();
      case WorkerWizardStep.AI_CONFIRMATION:
        return this.aiConfirmationCard(state);
      case WorkerWizardStep.AI_EDIT_NAME:
        return this.aiEditNamePrompt(state.aiDetectedData?.name || state.name);
      case WorkerWizardStep.AI_EDIT_ID:
        return this.aiEditIdPrompt(
          state.aiDetectedData?.nationalId || state.aiDetectedData?.passportNumber || state.idNumber,
          state.idType === 'PASSPORT'
        );
      case WorkerWizardStep.AI_EDIT_ADDRESS:
        return this.aiEditAddressPrompt(state.aiDetectedData?.address || state.address);
      case WorkerWizardStep.AI_EDIT_EXPIRY:
        return this.aiEditExpiryPrompt(state.aiDetectedData?.expiryDate || state.expiryDate);
      case WorkerWizardStep.FULL_NAME:
        return this.namePrompt();
      case WorkerWizardStep.NICKNAME:
        return this.nicknamePrompt(state.name || '');
      case WorkerWizardStep.ID_NUMBER:
        return this.idNumberPrompt(state.idType === 'PASSPORT');
      case WorkerWizardStep.PHONE:
        return this.phonePrompt(state.name || '');
      case WorkerWizardStep.PAYOUT_TRANSFER_CHOICE:
        return this.payoutTransferChoicePrompt(state.phone || '');
      case WorkerWizardStep.CUSTOM_WALLET_INPUT:
        return this.customWalletPrompt();
      case WorkerWizardStep.PAYOUT_METHOD_CHOICE:
        return this.payoutMethodPrompt(state.accountNumber);
      case WorkerWizardStep.JOB_CHOICE:
        return this.jobChoicePrompt();
      case WorkerWizardStep.SITE_CHOICE:
        return this.siteChoicePrompt();
      case WorkerWizardStep.START_DATE_CHOICE:
        return this.startDatePrompt();
      case WorkerWizardStep.CUSTOM_START_DATE_INPUT:
        return this.customStartDatePrompt();
      case WorkerWizardStep.DRIVING_LICENSE:
        return this.licensePrompt();
      case WorkerWizardStep.MILITARY_STATUS:
        return this.militaryPrompt();
      case WorkerWizardStep.EMERGENCY_PHONE:
        return this.emergencyPhonePrompt();
      case WorkerWizardStep.INSURANCE_STATUS:
        return this.insurancePrompt();
      case WorkerWizardStep.MARITAL_STATUS:
        return this.maritalPrompt();
      case WorkerWizardStep.CONFIRMATION:
        return this.confirmationCard(state, userRole);
      default:
        return this.docTypePrompt();
    }
  },
};
