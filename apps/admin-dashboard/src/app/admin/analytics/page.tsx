import React from 'react';
import {
  BarChart3,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  ArrowUpLeft,
  Activity,
  CheckCircle2,
  Clock,
  ReceiptText,
} from 'lucide-react';
import { requireDashboardUser } from '@/lib/auth';
import { getSitesHub, getModuleAnalyticsData } from '@/lib/data-fetchers';
import { getAnalyticsModulesForRole } from '@/lib/analytics-registry';
import { AnalyticsFilterBar } from './analytics-filter-bar';
import type { CanonicalRole } from '@alsaada/rbac';

interface AnalyticsPageProps {
  searchParams: Promise<{
    module?: string;
    feature?: string;
    period?: string;
    siteId?: string;
  }>;
}

export default async function AnalyticsCenterPage({ searchParams }: AnalyticsPageProps) {
  const user = await requireDashboardUser();
  const params = await searchParams;

  const sites = await getSitesHub(user);
  const availableModules = getAnalyticsModulesForRole(user.role as CanonicalRole);

  const selectedModuleKey = params.module || availableModules[0]?.moduleKey || 'workforce';
  const selectedPeriod = params.period || 'month';
  const selectedSiteId = user.role === 'FIELD_ADMIN' ? user.assignedSiteId || 'ALL' : params.siteId || 'ALL';
  const selectedFeatureKey = params.feature || '';

  const isFieldAdmin = user.role === 'FIELD_ADMIN';

  // Fetch real module-driven live analytics from PostgreSQL
  const analyticsData = await getModuleAnalyticsData(
    selectedModuleKey,
    selectedSiteId,
    selectedPeriod,
    user
  );

  const activeSiteName =
    selectedSiteId === 'ALL'
      ? 'كافة المواقع'
      : sites.find((s) => s.id === selectedSiteId)?.name || selectedSiteId;

  const periodLabelMap: Record<string, string> = {
    today: 'اليوم',
    week: 'هذا الأسبوع',
    month: 'هذا الشهر',
    all: 'سجل شامل',
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5 transition-colors">
        <div>
          <div className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full text-xs font-semibold mb-2 border border-indigo-200 dark:border-indigo-800">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>مركز الإحصائيات والتحليلات المؤسسي</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            تحليلات ومؤشرات الأداء التشغيلي: {analyticsData.moduleNameAr}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            بيانات حية ومؤشرات مجمعة من قاعدة البيانات حسب الموديول، الموقع الميداني، والفترة الزمنية.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-600 dark:text-slate-300 shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
            <span>{periodLabelMap[selectedPeriod] || selectedPeriod}</span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <Building2 className="w-3.5 h-3.5 text-emerald-500" />
            <span className="truncate max-w-[140px]">{activeSiteName}</span>
          </div>
        </div>
      </div>

      {/* 1. Sleek Dropdown Select Filter Bar */}
      <AnalyticsFilterBar
        availableModules={availableModules}
        selectedModuleKey={selectedModuleKey}
        selectedSiteId={selectedSiteId}
        selectedPeriod={selectedPeriod}
        selectedFeatureKey={selectedFeatureKey}
        sites={sites}
        isFieldAdmin={isFieldAdmin}
        assignedSiteName={user.assignedSiteName || undefined}
      />

      {/* 2. Live Module-Driven 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {analyticsData.kpis.map((kpi, idx) => {
          const colorStyles: Record<string, { border: string; text: string; bg: string }> = {
            blue: {
              border: 'border-blue-200 dark:border-blue-900/50',
              text: 'text-blue-600 dark:text-blue-400',
              bg: 'bg-blue-50 dark:bg-blue-950/40',
            },
            emerald: {
              border: 'border-emerald-200 dark:border-emerald-900/50',
              text: 'text-emerald-600 dark:text-emerald-400',
              bg: 'bg-emerald-50 dark:bg-emerald-950/40',
            },
            amber: {
              border: 'border-amber-200 dark:border-amber-900/50',
              text: 'text-amber-600 dark:text-amber-400',
              bg: 'bg-amber-50 dark:bg-amber-950/40',
            },
            rose: {
              border: 'border-rose-200 dark:border-rose-900/50',
              text: 'text-rose-600 dark:text-rose-400',
              bg: 'bg-rose-50 dark:bg-rose-950/40',
            },
            indigo: {
              border: 'border-indigo-200 dark:border-indigo-900/50',
              text: 'text-indigo-600 dark:text-indigo-400',
              bg: 'bg-indigo-50 dark:bg-indigo-950/40',
            },
            purple: {
              border: 'border-purple-200 dark:border-purple-900/50',
              text: 'text-purple-600 dark:text-purple-400',
              bg: 'bg-purple-50 dark:bg-purple-950/40',
            },
          };

          const activeColor = colorStyles[kpi.badgeColor || 'blue'] || colorStyles.blue;

          return (
            <div
              key={idx}
              className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2 transition-all hover:border-slate-300 dark:hover:border-slate-700"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                  {kpi.label}
                </span>
                {kpi.badge && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${activeColor.bg} ${activeColor.text} ${activeColor.border}`}
                  >
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
                    </span>
                    {kpi.badge}
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
                  {kpi.value}
                </span>
              </div>

              <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                {kpi.sublabel}
              </p>
            </div>
          );
        })}
      </div>

      {/* 3. Visual Breakdown Progress Bar */}
      {analyticsData.breakdown.items.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 sm:p-6 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                {analyticsData.breakdown.title}
              </h2>
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              توزيع نسبي حسب السجلات الحية
            </span>
          </div>

          {/* Multi-Segment Composite Bar */}
          <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 flex overflow-hidden gap-0.5 mb-4">
            {analyticsData.breakdown.items.map((item, i) => {
              const bgColors = [
                'bg-indigo-500',
                'bg-emerald-500',
                'bg-amber-500',
                'bg-rose-500',
                'bg-blue-500',
                'bg-purple-500',
              ];
              const barBg = item.colorClass || bgColors[i % bgColors.length];
              return (
                <div
                  key={i}
                  style={{ width: `${Math.max(4, item.percentage)}%` }}
                  className={`h-full ${barBg} transition-all duration-500`}
                  title={`${item.label}: ${item.count} (${item.percentage}%)`}
                />
              );
            })}
          </div>

          {/* Breakdown Items Legend Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {analyticsData.breakdown.items.map((item, i) => {
              const dotColors = [
                'bg-indigo-500',
                'bg-emerald-500',
                'bg-amber-500',
                'bg-rose-500',
                'bg-blue-500',
                'bg-purple-500',
              ];
              const dotBg = item.colorClass || dotColors[i % dotColors.length];
              return (
                <div
                  key={i}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full ${dotBg} shrink-0`} />
                    <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold font-mono text-slate-900 dark:text-slate-100">
                      {item.count}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      {item.percentage}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. REAL Operations Ledger Table (Replacing static metadata catalog) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 sm:p-6 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                سجل العمليات والمعاملات الحية — {analyticsData.moduleNameAr}
              </h2>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                سجل حقيقي لأحدث الحركات والعمليات المسجلة بالموقع المختار
              </p>
            </div>
          </div>
          <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
            {analyticsData.recentOperations.length} عملية معروضة
          </span>
        </div>

        {analyticsData.recentOperations.length === 0 ? (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-semibold">لا توجد عمليات مسجلة في هذا النطاق حالياً</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              جرّب تغيير الموقع الميداني أو توسيع الفترة الزمنية لاستعراض سجلات أوسع.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-semibold">
                <tr>
                  <th className="py-3 px-4">كود / مرجع المعاملة</th>
                  <th className="py-3 px-4">بيان العملية / الطرف المعني</th>
                  <th className="py-3 px-4">التصنيف / الموقع</th>
                  <th className="py-3 px-4">القيمة / المعيار</th>
                  <th className="py-3 px-4">التاريخ</th>
                  <th className="py-3 px-4">الحالة التشغيلية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {analyticsData.recentOperations.map((op) => (
                  <tr
                    key={op.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {op.reference}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      {op.title}
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                      {op.subtitle}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {op.amountFormatted || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">
                      {op.dateFormatted}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${op.statusBadgeClass}`}
                      >
                        {op.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
