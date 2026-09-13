import React from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Calendar,
  Building2,
  Filter,
  Users,
  Activity,
  ArrowDownRight,
  Sparkles,
  Layers,
} from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getOverviewKpis, getSitesHub } from '@/lib/data-fetchers';
import { getAnalyticsModulesForRole } from '@/lib/analytics-registry';
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
  const user = await getCurrentUser();
  const params = await searchParams;

  const [kpis, sites] = await Promise.all([
    getOverviewKpis(user),
    getSitesHub(user),
  ]);

  const availableModules = getAnalyticsModulesForRole(user.role as CanonicalRole);
  const selectedModuleKey = params.module || availableModules[0]?.moduleKey || 'workforce';
  const selectedModule = availableModules.find((m) => m.moduleKey === selectedModuleKey);

  const selectedFeatureKey = params.feature || selectedModule?.features[0]?.key || '';
  const selectedPeriod = params.period || 'month';
  const selectedSiteId = user.role === 'FIELD_ADMIN' ? user.assignedSiteId || '' : params.siteId || 'ALL';

  const isFieldAdmin = user.role === 'FIELD_ADMIN';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold mb-2 border border-indigo-200">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>مركز الإحصائيات والتحليلات المؤسسي</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            تحليلات ومؤشرات الأداء التشغيلي
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            استكشاف مؤشرات الأداء الحية حسب الموديول، الوظيفة، الموقع، والفترة الزمنية.
          </p>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
          <Filter className="w-4 h-4 text-indigo-600" />
          <span>محددات التحليل والتصفية المباشرة</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Module Selector */}
          <div>
            <label className="block font-semibold text-slate-600 mb-1.5">الموديول البرمجي</label>
            <div className="flex flex-wrap gap-1.5">
              {availableModules.map((m) => (
                <Link
                  key={m.moduleKey}
                  href={`/admin/analytics?module=${m.moduleKey}&period=${selectedPeriod}&siteId=${selectedSiteId}`}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                    m.moduleKey === selectedModuleKey
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {m.nameAr.split(' ')[1] || m.nameAr}
                </Link>
              ))}
            </div>
          </div>

          {/* Period Selector */}
          <div>
            <label className="block font-semibold text-slate-600 mb-1.5">الفترة الزمنية</label>
            <div className="flex items-center gap-1.5">
              {[
                { key: 'today', label: 'اليوم' },
                { key: 'week', label: 'هذا الأسبوع' },
                { key: 'month', label: 'هذا الشهر' },
                { key: 'all', label: 'الكل' },
              ].map((p) => (
                <Link
                  key={p.key}
                  href={`/admin/analytics?module=${selectedModuleKey}&feature=${selectedFeatureKey}&period=${p.key}&siteId=${selectedSiteId}`}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                    p.key === selectedPeriod
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {p.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Site Selector */}
          <div>
            <label className="block font-semibold text-slate-600 mb-1.5">الموقع الميداني</label>
            {isFieldAdmin ? (
              <div className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold border border-slate-200 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>{user.assignedSiteName || 'موقعك المسند (قراءة فقط)'}</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                <Link
                  href={`/admin/analytics?module=${selectedModuleKey}&feature=${selectedFeatureKey}&period=${selectedPeriod}&siteId=ALL`}
                  className={`px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
                    selectedSiteId === 'ALL'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  كافة المواقع
                </Link>
                {sites.map((s) => (
                  <Link
                    key={s.id}
                    href={`/admin/analytics?module=${selectedModuleKey}&feature=${selectedFeatureKey}&period=${selectedPeriod}&siteId=${s.id}`}
                    className={`px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
                      selectedSiteId === s.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {s.name.split('-')[0].trim()}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Feature Selector */}
          <div>
            <label className="block font-semibold text-slate-600 mb-1.5">الوظيفة / التدفق</label>
            <div className="flex flex-wrap gap-1.5">
              {selectedModule?.features.map((f) => (
                <Link
                  key={f.key}
                  href={`/admin/analytics?module=${selectedModuleKey}&feature=${f.key}&period=${selectedPeriod}&siteId=${selectedSiteId}`}
                  className={`px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
                    f.key === selectedFeatureKey
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {f.flowCode} {f.nameAr}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Analytics KPI Dashboard Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">القوى العاملة المتأثرة</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-slate-900">{kpis.activeWorkersCount}</span>
            <span className="text-xs text-blue-600 font-semibold">عامل</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">نطاق الموقع المختار</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">معدل المعاملات المنجزة</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-slate-900">100%</span>
            <span className="text-xs text-emerald-600 font-semibold">مزامنة تامة</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">حفظ فوري بقاعدة البيانات</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">الطلبات قيد المراجعة</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-slate-900">{kpis.pendingItemsCount}</span>
            <span className="text-xs text-rose-600 font-semibold">طلب معلق</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">بانتظار الاعتماد الإداري</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">زمن الاستجابة الميداني (APM)</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-slate-900">{kpis.avgLatencyMs}</span>
            <span className="text-xs text-indigo-600 font-semibold">ms</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">سرعة تداول البيانات في الميدان</p>
        </div>
      </div>

      {/* Analytics Data Detail Box */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">
              سجل تفاصيل التحليلات: {selectedModule?.nameAr}
            </h2>
          </div>
          <span className="text-xs font-mono bg-slate-100 px-2.5 py-1 rounded text-slate-600 border border-slate-200">
            الفترة: {selectedPeriod} | الموقع: {selectedSiteId}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
              <tr>
                <th className="py-3 px-4">كود التدفق</th>
                <th className="py-3 px-4">اسم الوظيفة الميدانية</th>
                <th className="py-3 px-4">مفاتيح المؤشرات (KPI Keys)</th>
                <th className="py-3 px-4">تحليل تفصيلي (Drilldown)</th>
                <th className="py-3 px-4">حالة الموديول</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {selectedModule?.features.map((f) => (
                <tr key={f.key} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{f.flowCode}</td>
                  <td className="py-3 px-4 font-semibold">{f.nameAr}</td>
                  <td className="py-3 px-4 font-mono text-slate-500">
                    {f.kpiKeys.join(', ') || 'مؤشر قياسي'}
                  </td>
                  <td className="py-3 px-4">
                    {f.hasDrilldown ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                        متاح للتعمق ✓
                      </span>
                    ) : (
                      <span className="text-slate-400">مؤشر مجمع</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      نشط ومطابق
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
