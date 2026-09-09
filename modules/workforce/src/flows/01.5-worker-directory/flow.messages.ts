import { formatDateDMY } from '@alsaada/regional-engine';
import type { WorkerProfile360 } from './flow.types.js';

import { formatShiftSystem, cleanMd } from '../../shared/module.messages.js';

export const WorkerDirectoryMessages = {
  directoryHeader(total: number, page: number, totalPages: number, searchQuery?: string): string {
    const searchLine = searchQuery ? `🔍 *نتائج البحث عن:* "${searchQuery}"\n` : '';
    return (
      `📋 *دليل وسجل العاملين الشامل (360°)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      searchLine +
      `• إجمالي العمالة: *${total} عامل*\n` +
      `• الصفحة: *${page} من ${totalPages}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `اضغط على اسم العامل لعرض بطاقة الملف الشاملة:`
    );
  },

  searchPrompt(): string {
    return (
      `🔍 *البحث في دليل العاملين*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `يرجى كتابة اسم العامل أو اسم الشهرة أو الكود الوظيفي للبحث المباشر:`
    );
  },

  profile360Card(p: WorkerProfile360, isIdRevealed = false): string {
    const formattedHireDate = formatDateDMY(p.hireDate);
    const formattedExpiryDate = p.idCardExpiryDate ? formatDateDMY(p.idCardExpiryDate) : undefined;
    const isPassport = p.idType === 'PASSPORT';
    const idLabel = isPassport ? '🌍 جواز السفر' : '🇪🇬 الرقم القومي';
    const displayedId = isIdRevealed && p.idNumberFull
      ? `${p.idNumberFull} 🔓`
      : `${p.idNumberMasked} 🔒`;

    const lines = [
      `👤 *بطاقة العامل الشاملة (360°)*`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `• *الاسم الكامل:* ${cleanMd(p.name)}`,
      p.nickname ? `• *اسم الشهرة:* ${cleanMd(p.nickname)}` : '',
      `• *الكود الوظيفي:* \`#${p.code}\``,
      p.legacyCode ? `• *الكود القديم:* \`${p.legacyCode}\`` : '',
      `• *المسمى الوظيفي:* ${cleanMd(p.jobTitle)}`,
      p.departmentName ? `• *القسم:* ${cleanMd(p.departmentName)}` : '',
      `• *الموقع الميداني:* ${cleanMd(p.siteName) || 'الموقع العام'}`,
      `• *تاريخ مباشرة العمل:* ${formattedHireDate}`,
      p.shiftSystem ? `• *نظام الدوام:* ${formatShiftSystem(p.shiftSystem)}` : '',
      p.dailyWageMasked ? `• *اليومية / الراتب:* ${cleanMd(p.dailyWageMasked)}` : '',
      `━━━━━━━━━━━━━━━━━━━━━`,
      `📋 *بيانات الهوية والاتصال:*`,
      `• *نوع الوثيقة:* ${idLabel}`,
      `• *رقم الإثبات:* \`${displayedId}\``,
      formattedExpiryDate ? `• *تاريخ انتهاء الوثيقة:* ${formattedExpiryDate}` : '',
      p.phone ? `• *رقم الهاتف:* \`${p.phone}\`` : '',
      p.emergencyPhone ? `• *هاتف الطوارئ:* \`${p.emergencyPhone}\`${p.emergencyContactName ? ` (${cleanMd(p.emergencyContactName)})` : ''}` : '',
      p.address ? `• *محل الإقامة:* ${cleanMd(p.address)}` : '',
      `━━━━━━━━━━━━━━━━━━━━━`,
      `🛡️ *الحالة التشغيلية والسلامة:*`,
      `• *الحالة بالمنظومة:* ${p.status === 'ACTIVE' ? '🟢 نشط وعلى رأس العمل' : '⚪ منتهي الخدمة / مؤرشف'}`,
      p.drivingLicense ? `• *رخصة القيادة:* ${cleanMd(p.drivingLicense)}` : '',
      p.militaryStatus ? `• *الخدمة العسكرية:* ${cleanMd(p.militaryStatus)}` : '',
      p.maritalStatus ? `• *الحالة الاجتماعية:* ${cleanMd(p.maritalStatus)}` : '',
      p.paymentMethod ? `• *وسيلة الصرف:* ${cleanMd(p.paymentMethod)}` : '',
      `━━━━━━━━━━━━━━━━━━━━━`,
      `📁 *اكتمال الملف والبيانات:*`,
      p.isProfileComplete
        ? `• *الحالة:* 🟢 مكتمل بنسبة 100%`
        : `• *الحالة:* ⚠️ غير مكتمل (${p.completionPercentage}%)\n• *المستندات/البيانات الناقصة:*\n  ▫️ ${p.missingItems.map(cleanMd).join('\n  ▫️ ')}`,
    ].filter(Boolean);

    return lines.join('\n');
  },

  formatMissingDataWhatsAppMessage(p: { name: string; nickname?: string | null; missingItems: string[] }): string {
    const displayName = p.nickname || p.name;
    const itemsList = p.missingItems.map((item, idx) => `${idx + 1}. ${item}`).join('\n');
    return (
      `السلام عليكم زميلنا العزيز / ${displayName}،\n` +
      `تحية طيبة من إدارة الموارد البشرية بشركة السعادة.\n\n` +
      `نرجو من سيادتكم التكرم بموافاتنا بالبيانات والمستندات التالية لاستكمال ملفكم الوظيفي بالمنظومة:\n` +
      `${itemsList}\n\n` +
      `شاكرين ومقدرين حسن تعاونكم معنا.`
    );
  },

  missingDataDispatchCard(p: WorkerProfile360, messageText: string): string {
    const displayName = p.nickname || p.name;
    return (
      `📲 *طلب استكمال النواقص والمستندات عبر واتساب*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *العامل:* ${cleanMd(displayName)} (\`#${p.code}\`)\n` +
      `• *رقم الهاتف:* \`${p.phone || 'غير مسجل'}\`\n` +
      `• *نسبة اكتمال الملف:* ${p.completionPercentage}%\n\n` +
      `📋 *النواقص المطلوب استيفاؤها:*\n` +
      p.missingItems.map((item, i) => `  ▫️ ${i + 1}. ${cleanMd(item)}`).join('\n') +
      `\n\n💬 *نص الرسالة المجهز (انسخه بنقرة واحدة):*\n` +
      `\`\`\`\n${messageText}\n\`\`\`\n\n` +
      `_اضغط على زر فتح شات واتساب أدناه لمراسلة العامل وإرسال الرسالة فوراً._`
    );
  },

  notFound(): string {
    return `⚠️ لم يتم العثور على سجل العامل المطلوب. قد يكون قد تم حذفه أو نقله.`;
  },
};
