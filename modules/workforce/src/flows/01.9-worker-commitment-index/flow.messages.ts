import { formatBreadcrumbs } from '@alsaada/core-components';
import type { CommitmentStatsSummary } from './flow.types.js';

export const WorkerCommitmentMessages = {
  mainMenu(stats: CommitmentStatsSummary, siteName?: string): string {
    const breadcrumb = formatBreadcrumbs(['👤 شؤون العاملين', '⭐ مؤشر الالتزام والموثوقية']);
    const siteLine = siteName ? `📍 *نطاق الموقع الميداني:* ${siteName}\n` : '';
    return (
      `${breadcrumb}` +
      `⭐ *منظومة مؤشر التزام وموثوقية العمال (NEW-80)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      siteLine +
      `• إجمالي العمالة المقيمة: *${stats.totalEvaluated} عامل*\n` +
      `• متوسط الالتزام العام: *${stats.averageScore} / 100*\n` +
      `• 🟢 ملتزمون (80-100): *${stats.committedCount} عامل*\n` +
      `• 🟡 متوسطو الالتزام (60-79): *${stats.moderateCount} عامل*\n` +
      `• 🔴 قيد المتابعة (<60): *${stats.underReviewCount} عامل*\n` +
      `• ⚪ حديثو تعيين / تجربة: *${stats.probationCount} عامل*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `اختر الإجراء المطلوب من القائمة أدناه:`
    );
  },

  pickerHeader(total: number, page: number, totalPages: number, siteName?: string, searchQuery?: string): string {
    const breadcrumb = formatBreadcrumbs(['👤 شؤون العاملين', '⭐ مؤشر الالتزام', '🔍 اختيار عامل']);
    const siteStr = siteName ? ` بالموقع (${siteName})` : '';
    const searchStr = searchQuery ? `\n🔍 *تصفية البحث النشطة:* \`${searchQuery}\`` : '';
    return (
      `${breadcrumb}` +
      `🔍 *قائمة اختيار العاملين لاستعلام مؤشر الالتزام*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• إجمالي العمال المتاحين${siteStr}: *${total} عامل*\n` +
      `• الصفحة: *${page} من ${totalPages}*${searchStr}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `اختر العامل لعرض كارت التقييم الشامل ومحاور الانضباط:`
    );
  },

  searchPrompt(): string {
    const breadcrumb = formatBreadcrumbs(['👤 شؤون العاملين', '⭐ مؤشر الالتزام', '🔍 استعلام']);
    return (
      `${breadcrumb}` +
      `🔍 *استعلام تقييم ومؤشر التزام عامل*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `أرسل اسم العامل أو اسم الشهرة أو الكود الوظيفي (مثال: \`OP-DRV-0015\`):`
    );
  },

  workerNotFound(query?: string): string {
    const q = query ? ` "${query}"` : '';
    return `❌ تعذر العثور على أي عامل مطابق للبحث${q}.\nيرجى التأكد من الكود أو الاسم والمحاولة مجدداً.`;
  },

  underReviewListHeader(total: number, page: number, totalPages: number, siteName?: string): string {
    const breadcrumb = formatBreadcrumbs(['👤 شؤون العاملين', '⭐ مؤشر الالتزام', '⚠️ قيد المتابعة']);
    const siteStr = siteName ? ` بالموقع (${siteName})` : '';
    return (
      `${breadcrumb}` +
      `⚠️ *كشف العمال قيد المتابعة والتدقيق الإداري (< 60 نقطة)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• إجمالي العمال قيد المتابعة${siteStr}: *${total} عامل*\n` +
      `• الصفحة: *${page} من ${totalPages}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `اضغط على اسم العامل لعرض كارت التقييم التفصيلي وإرشادات التعافي:`
    );
  },

  honorRollListHeader(total: number, page: number, totalPages: number, siteName?: string): string {
    const breadcrumb = formatBreadcrumbs(['👤 شؤون العاملين', '⭐ مؤشر الالتزام', '🏆 لوحة الشرف']);
    const siteStr = siteName ? ` بالموقع (${siteName})` : '';
    return (
      `${breadcrumb}` +
      `🏆 *لوحة شرف العمال الأكثر التزاماً وانضباطاً (80-100)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• عمال التميز والانضباط${siteStr}: *${total} عامل*\n` +
      `• الصفحة: *${page} من ${totalPages}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `اضغط على اسم العامل لعرض كارت التقييم التفصيلي ومحاور التميز:`
    );
  },

  exportSuccessCaption(total: number, siteName?: string): string {
    const siteStr = siteName ? ` لموقع ${siteName}` : ' لكافة المواقع التشغيلية';
    return (
      `📊 *تم تصدير كشف تقييمات ومؤشر التزام العمال بنجاح*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• النطاق: *${siteStr}*\n` +
      `• عدد العمال المدرجين: *${total} عامل*\n` +
      `• التنسيق: ملف Excel معتمد RTL متوافق مع معايير المنظومة.`
    );
  },
};
