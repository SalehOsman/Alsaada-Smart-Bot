import React from 'react';
import Link from 'next/link';
import {
  Users,
  Building2,
  FileCheck2,
  Activity,
  UserPlus,
  ArrowUpRight,
  ArrowUpLeft,
  Sparkles,
  AlertTriangle,
  Wallet,
  BarChart3,
  PackageCheck,
} from 'lucide-react';
import type { DashboardUser } from '@/lib/rbac';
import type { OverviewKpis, SiteHubItem, WorkforceDirectoryItem } from '@/lib/data-fetchers';

interface GeneralAdminOverviewProps {
  user: DashboardUser;
  kpis: OverviewKpis;
  sites: SiteHubItem[];
  workers: WorkforceDirectoryItem[];
}

export function GeneralAdminOverview({ user, kpis, sites, workers }: GeneralAdminOverviewProps) {
  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-blue-950 rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg border border-blue-500/20">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-xs font-semibold mb-4 border border-blue-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>لوحة الإدارة العامة والرقابة التشغيلية</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2">
            مرحباً بك يا {user.name} 👋
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            المتابعة المركزية لحركات القوى العاملة، اعتمادات السلف والمخالصات، والرقابة على تدفقات العهد والمخازن.
          </p>
        </div>
        <div className="absolute left-6 bottom-4 opacity-10 pointer-events-none hidden sm:block">
          <Building2 className="w-64 h-64 text-blue-400" />
        </div>
      </div>

      {/* Operational KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <Link
          href="/admin/workforce/directory"
          aria-label="الانتقال إلى دليل القوى العاملة"
          className="group cursor-pointer bg-white dark:bg-slate-900 rounded-xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-orange-500/60 dark:hover:border-orange-500/60 hover:shadow-lg hover:scale-[1.01] transition-all relative block"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">القوى العاملة النشطة</span>
            <div className="flex items-center gap-1.5">
              <ArrowUpLeft className="w-4 h-4 text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 group-hover:text-orange-500 transition-all -translate-x-1 group-hover:translate-x-0" />
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">{kpis.activeWorkersCount}</span>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">عامل</span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">إجمالي المسجلين بكافة المواقع</p>
        </Link>

        <Link
          href="/admin/settings/sites"
          aria-label="الانتقال إلى المواقع النشطة"
          className="group cursor-pointer bg-white dark:bg-slate-900 rounded-xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-orange-500/60 dark:hover:border-orange-500/60 hover:shadow-lg hover:scale-[1.01] transition-all relative block"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">المواقع النشطة</span>
            <div className="flex items-center gap-1.5">
              <ArrowUpLeft className="w-4 h-4 text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 group-hover:text-orange-500 transition-all -translate-x-1 group-hover:translate-x-0" />
              <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">{kpis.activeSitesCount}</span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">مواقع قيد العمل</span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">المشاريع الميدانية الجارية</p>
        </Link>

        <Link
          href="/admin/approvals"
          aria-label="الانتقال إلى الطلبات بانتظار الاعتماد"
          className="group cursor-pointer bg-white dark:bg-slate-900 rounded-xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-orange-500/60 dark:hover:border-orange-500/60 hover:shadow-lg hover:scale-[1.01] transition-all relative block"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">الطلبات بانتظار الاعتماد</span>
            <div className="flex items-center gap-1.5">
              <ArrowUpLeft className="w-4 h-4 text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 group-hover:text-orange-500 transition-all -translate-x-1 group-hover:translate-x-0" />
              <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">{kpis.pendingItemsCount}</span>
            <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold">طلب معلق</span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">سلف، مخالصات، وإجازات تتطلب موافقة</p>
        </Link>

        <Link
          href="/admin/settings/telemetry"
          aria-label="الانتقال إلى مؤشر سرعة العمليات"
          className="group cursor-pointer bg-white dark:bg-slate-900 rounded-xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-orange-500/60 dark:hover:border-orange-500/60 hover:shadow-lg hover:scale-[1.01] transition-all relative block"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">مؤشر سرعة العمليات</span>
            <div className="flex items-center gap-1.5">
              <ArrowUpLeft className="w-4 h-4 text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 group-hover:text-orange-500 transition-all -translate-x-1 group-hover:translate-x-0" />
              <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">{kpis.avgLatencyMs}</span>
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">ms</span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">متوسط سرعة استجابة البوت الميداني</p>
        </Link>
      </div>

      {/* Operational Shortcuts */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-500" />
          <span>المراكز التشغيلية والإشرافية</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/admin/approvals"
            className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-500 dark:hover:border-rose-500 hover:bg-rose-50/30 dark:hover:bg-rose-950/20 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-rose-700 dark:group-hover:text-rose-400">مركز الاعتمادات</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{kpis.pendingItemsCount} طلب معلق</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-rose-600 dark:group-hover:text-rose-400" />
          </Link>

          <Link
            href="/admin/analytics"
            className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400">مركز الإحصائيات</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">تقارير وتحليلات الموديولات</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
          </Link>

          <Link
            href="/admin/workforce/directory"
            className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">دليل العاملين</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">إدارة وسجلات القوى العاملة</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />
          </Link>

          <Link
            href="/admin/finance/treasury"
            className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500 hover:bg-amber-50/30 dark:hover:bg-amber-950/20 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-700 dark:group-hover:text-amber-400">الخزائن والعهد</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">مرصد السيولة والمصروفات</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-amber-600 dark:group-hover:text-amber-400" />
          </Link>
        </div>
      </div>

      {/* Sites Status Grid */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-5">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-slate-700 dark:text-slate-300" />
          <span>حالة المواقع والمشاريع الميدانية</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sites.map((s) => (
            <div key={s.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{s.name}</h3>
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  {s.code}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{s.location}</p>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200 dark:border-slate-700 font-semibold">
                <span className="text-blue-700 dark:text-blue-400">{s.workersCount} عامل مسجل</span>
                <span className="text-emerald-700 dark:text-emerald-400">نشط</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
