import React from 'react';
import Link from 'next/link';
import {
  Users,
  Building2,
  FileCheck2,
  Activity,
  ShieldCheck,
  UserPlus,
  ArrowUpRight,
  ArrowUpLeft,
  Sparkles,
  AlertTriangle,
  Server,
  BarChart3,
  Lock,
} from 'lucide-react';
import type { DashboardUser } from '@/lib/rbac';
import type { OverviewKpis, SiteHubItem, WorkforceDirectoryItem } from '@/lib/data-fetchers';

interface SuperAdminOverviewProps {
  user: DashboardUser;
  kpis: OverviewKpis;
  sites: SiteHubItem[];
  workers: WorkforceDirectoryItem[];
}

export function SuperAdminOverview({ user, kpis, sites, workers }: SuperAdminOverviewProps) {
  return (
    <div className="space-y-8">
      {/* Sovereign Header Banner */}
      <div className="bg-gradient-to-l from-slate-950 via-slate-900 to-amber-950 rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg border border-amber-500/20">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full text-xs font-semibold mb-4 border border-amber-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>لوحة القيادة السيادية العليا — سوبر أدمن</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2">
            مرحباً بك يا {user.name} 👋
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            الرقابة اللحظية الكاملة لكافة المواقع الميدانية، الخزينة والسيولة، الاعتمادات، والتدقيق الجنائي المشفر.
          </p>
        </div>
        <div className="absolute left-6 bottom-4 opacity-10 pointer-events-none hidden sm:block">
          <ShieldCheck className="w-64 h-64 text-amber-400" />
        </div>
      </div>

      {/* Sovereign KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <Link
          href="/admin/workforce/directory"
          aria-label="الانتقال إلى دليل القوى العاملة"
          className="group cursor-pointer bg-white dark:bg-slate-900 rounded-xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-orange-500/60 dark:hover:border-orange-500/60 hover:shadow-lg hover:scale-[1.01] transition-all relative block"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">إجمالي القوى العاملة</span>
            <div className="flex items-center gap-1.5">
              <ArrowUpLeft className="w-4 h-4 text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 group-hover:text-orange-500 transition-all -translate-x-1 group-hover:translate-x-0" />
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">{kpis.activeWorkersCount}</span>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">عامل نشط</span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">كافة المواقع والمشاريع المركزية</p>
        </Link>

        <Link
          href="/admin/settings/sites"
          aria-label="الانتقال إلى المواقع الميدانية والمشاريع"
          className="group cursor-pointer bg-white dark:bg-slate-900 rounded-xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-orange-500/60 dark:hover:border-orange-500/60 hover:shadow-lg hover:scale-[1.01] transition-all relative block"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">المواقع المفتوحة</span>
            <div className="flex items-center gap-1.5">
              <ArrowUpLeft className="w-4 h-4 text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 group-hover:text-orange-500 transition-all -translate-x-1 group-hover:translate-x-0" />
              <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">{kpis.activeSitesCount}</span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">مواقع نشطة</span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">مشاريع تحت التشغيل الميداني</p>
        </Link>

        <Link
          href="/admin/approvals"
          aria-label="الانتقال إلى شاشة الموافقات والاعتمادات المعلقة"
          className="group cursor-pointer bg-white dark:bg-slate-900 rounded-xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-orange-500/60 dark:hover:border-orange-500/60 hover:shadow-lg hover:scale-[1.01] transition-all relative block"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">الطلبات والمعاملات المعلقة</span>
            <div className="flex items-center gap-1.5">
              <ArrowUpLeft className="w-4 h-4 text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 group-hover:text-orange-500 transition-all -translate-x-1 group-hover:translate-x-0" />
              <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">{kpis.pendingItemsCount}</span>
            <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold">تتطلب اعتماداً</span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">مخالصات، سلف، وإجازات بانتظار القرار</p>
        </Link>

        <Link
          href="/admin/settings/telemetry"
          aria-label="الانتقال إلى مرصد زمن الاستجابة ومراقبة الأداء"
          className="group cursor-pointer bg-white dark:bg-slate-900 rounded-xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-orange-500/60 dark:hover:border-orange-500/60 hover:shadow-lg hover:scale-[1.01] transition-all relative block"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">مرصد زمن الاستجابة (APM)</span>
            <div className="flex items-center gap-1.5">
              <ArrowUpLeft className="w-4 h-4 text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 group-hover:text-orange-500 transition-all -translate-x-1 group-hover:translate-x-0" />
              <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">{kpis.avgLatencyMs}</span>
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">مللي ثانية (ms)</span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">متوسط سرعة استجابة أوامر البوت</p>
        </Link>
      </div>

      {/* Sovereign Quick Command Center */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5 text-amber-600 dark:text-amber-500" />
          <span>مركز الأوامر والتحكم السيادي</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/admin/analytics"
            className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500 hover:bg-amber-50/30 dark:hover:bg-amber-950/20 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-700 dark:group-hover:text-amber-400">مركز الإحصائيات</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">تحليلات الموديولات والـ KPIs</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-amber-600 dark:group-hover:text-amber-400" />
          </Link>

          <Link
            href="/admin/settings/users"
            className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400">إدارة الصلاحيات والمستخدمين</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">تعيين الأدوار والتفويضات</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
          </Link>

          <Link
            href="/admin/settings/audit-vault"
            className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">خزينة التدقيق الجنائي</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">سجل الأحداث والهاش التراكمي</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />
          </Link>

          <Link
            href="/admin/approvals"
            className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-500 dark:hover:border-rose-500 hover:bg-rose-50/30 dark:hover:bg-rose-950/20 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-rose-700 dark:group-hover:text-rose-400">مركز الاعتمادات والقرارات</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{kpis.pendingItemsCount} طلبات معلقة</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-rose-600 dark:group-hover:text-rose-400" />
          </Link>
        </div>
      </div>

      {/* Sites & Locations Registry */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">مصفوفة المواقع الميدانية والمشاريع</h2>
          </div>
          <Link
            href="/admin/settings/sites"
            className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300"
          >
            إدارة المواقع ←
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-semibold">
              <tr>
                <th className="py-3 px-4">اسم الموقع / المشروع</th>
                <th className="py-3 px-4">كود الموقع</th>
                <th className="py-3 px-4">عدد العمالة المسجلة</th>
                <th className="py-3 px-4">المشرفون المسندون</th>
                <th className="py-3 px-4">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {sites.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">{s.name}</td>
                  <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">{s.code}</td>
                  <td className="py-3 px-4 font-semibold text-blue-700 dark:text-blue-400">{s.workersCount} عامل</td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{s.assignedSupervisors.join('، ') || 'غير مسند'}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                      نشط ميدانياً
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
