import { formatDateDMY } from '@alsaada/regional-engine';
import type { WorkerProfile360 } from './flow.types.js';

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

  profile360Card(p: WorkerProfile360): string {
    const formattedHireDate = formatDateDMY(p.hireDate);
    const formattedExpiryDate = p.idCardExpiryDate ? formatDateDMY(p.idCardExpiryDate) : undefined;
    const isPassport = p.idType === 'PASSPORT';
    const idLabel = isPassport ? '🌍 جواز السفر' : '🇪🇬 الرقم القومي';

    const lines = [
      `👤 *بطاقة العامل الشاملة (360°)*`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `• *الاسم الكامل:* ${p.name}`,
      p.nickname ? `• *اسم الشهرة:* ${p.nickname}` : '',
      `• *الكود الوظيفي:* \`#${p.code}\``,
      p.legacyCode ? `• *الكود القديم:* \`${p.legacyCode}\`` : '',
      `• *المسمى الوظيفي:* ${p.jobTitle}`,
      p.departmentName ? `• *القسم:* ${p.departmentName}` : '',
      `• *الموقع الميداني:* ${p.siteName || 'الموقع العام'}`,
      `• *تاريخ مباشرة العمل:* ${formattedHireDate}`,
      p.shiftSystem ? `• *نظام الدوام:* ${p.shiftSystem}` : '',
      p.dailyWageMasked ? `• *اليومية / الراتب:* ${p.dailyWageMasked}` : '',
      `━━━━━━━━━━━━━━━━━━━━━`,
      `📋 *بيانات الهوية والاتصال:*`,
      `• *نوع الوثيقة:* ${idLabel}`,
      `• *رقم الإثبات:* \`${p.idNumberMasked}\``,
      formattedExpiryDate ? `• *تاريخ انتهاء الوثيقة:* ${formattedExpiryDate}` : '',
      p.phone ? `• *رقم الهاتف:* \`${p.phone}\`` : '',
      p.emergencyPhone ? `• *هاتف الطوارئ:* \`${p.emergencyPhone}\`${p.emergencyContactName ? ` (${p.emergencyContactName})` : ''}` : '',
      p.address ? `• *محل الإقامة:* ${p.address}` : '',
      `━━━━━━━━━━━━━━━━━━━━━`,
      `🛡️ *الحالة التشغيلية والسلامة:*`,
      `• *الحالة بالمنظومة:* ${p.status === 'ACTIVE' ? '🟢 نشط وعلى رأس العمل' : '⚪ منتهي الخدمة / مؤرشف'}`,
      p.drivingLicense ? `• *رخصة القيادة:* ${p.drivingLicense}` : '',
      p.militaryStatus ? `• *الخدمة العسكرية:* ${p.militaryStatus}` : '',
      p.maritalStatus ? `• *الحالة الاجتماعية:* ${p.maritalStatus}` : '',
      p.paymentMethod ? `• *وسيلة الصرف:* ${p.paymentMethod}` : '',
    ].filter(Boolean);

    return lines.join('\n');
  },

  notFound(): string {
    return `⚠️ لم يتم العثور على سجل العامل المطلوب. قد يكون قد تم حذفه أو نقله.`;
  },
};
