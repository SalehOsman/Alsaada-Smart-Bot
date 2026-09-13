import React from 'react';
import Link from 'next/link';
import {
  Users,
  Building2,
  FileCheck2,
  UserPlus,
  ArrowUpRight,
  Sparkles,
  PackageCheck,
  Tractor,
  MapPin,
  Phone,
} from 'lucide-react';
import type { DashboardUser } from '@/lib/rbac';
import type { OverviewKpis, SiteHubItem, WorkforceDirectoryItem } from '@/lib/data-fetchers';

interface FieldAdminOverviewProps {
  user: DashboardUser;
  kpis: OverviewKpis;
  sites: SiteHubItem[];
  workers: WorkforceDirectoryItem[];
}

export function FieldAdminOverview({ user, kpis, sites, workers }: FieldAdminOverviewProps) {
  // Strictly filter workers for the assigned site only
  const siteWorkers = workers.filter((w) => {
    if (!user.assignedSiteName) return true;
    return w.siteName.includes(user.assignedSiteName) || user.assignedSiteName.includes(w.siteName);
  });

  const siteName = user.assignedSiteName || 'الموقع الميداني المسند';

  return (
    <div className="space-y-8">
      {/* Site Header Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-emerald-950 to-slate-900 rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg border border-emerald-500/20">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-xs font-semibold mb-4 border border-emerald-500/30">
            <MapPin className="w-3.5 h-3.5" />
            <span>بوابة الإشراف الميداني — {siteName}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2">
            مرحباً بك يا {user.name} 👋
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            المتابعة الميدانية للعمالة المسندة بموقع <b>{siteName}</b>، تحضير طلبات التعيين، المخالصات الميدانية، وصرف مهمات الوقاية والكانتين.
          </p>
        </div>
        <div className="absolute left-6 bottom-4 opacity-10 pointer-events-none hidden sm:block">
          <Building2 className="w-64 h-64 text-emerald-400" />
        </div>
      </div>

      {/* Field KPIs (STRICTLY NON-FINANCIAL: Zero Contractual Salaries/Wages) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200 shadow-xs hover:border-emerald-400 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">العمالة الحاضرة بالموقع</span>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900">{siteWorkers.length}</span>
            <span className="text-xs text-emerald-600 font-semibold">عامل بموقعك</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">مقيدون في كشف عمالة الموقع</p>
        </div>

        <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200 shadow-xs hover:border-emerald-400 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">الموقع الميداني المعتمد</span>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg sm:text-xl font-bold text-slate-900">{siteName}</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">نطاق الإشراف الميداني المخصص لك</p>
        </div>

        <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200 shadow-xs hover:border-emerald-400 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">حالة الربط مع تيليجرام</span>
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-indigo-700">متصل بالبوت 🟢</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">جلسة مؤمنة بالرقم التعريفي {user.telegramId || 'معتمد'}</p>
        </div>
      </div>

      {/* Field Shortcuts */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-emerald-600" />
          <span>الإجراءات الميدانية السريعة</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/admin/workforce/new"
            className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 group-hover:text-emerald-700">تعيين عامل جديد</p>
                <p className="text-xs text-slate-500">تسجيل وتسكين بالموقع</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
          </Link>

          <Link
            href="/admin/workforce/directory"
            className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/30 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 group-hover:text-blue-700">كشف عمالة الموقع</p>
                <p className="text-xs text-slate-500">{siteWorkers.length} عامل مسجل</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
          </Link>

          <Link
            href="/admin/workforce/clearances"
            className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50/30 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 group-hover:text-amber-700">مخالصات الموقع</p>
                <p className="text-xs text-slate-500">تسليم العهد وإنهاء الخدمة</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600" />
          </Link>

          <Link
            href="/admin/logistics/canteen"
            className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-purple-500 hover:bg-purple-50/30 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center">
                <PackageCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 group-hover:text-purple-700">الكانتين والمهمات</p>
                <p className="text-xs text-slate-500">صرف الوقاية والمسحوبات</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600" />
          </Link>
        </div>
      </div>

      {/* Site Workers Table (Zero Salaries displayed) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-900">سجل عمالة {siteName}</h2>
          </div>
          <Link
            href="/admin/workforce/directory"
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
          >
            عرض الكل والبحث ←
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
              <tr>
                <th className="py-3 px-4">اسم الشهرة / العامل</th>
                <th className="py-3 px-4">كود العامل</th>
                <th className="py-3 px-4">المهنة / الوظيفة</th>
                <th className="py-3 px-4">رقم الهاتف</th>
                <th className="py-3 px-4">الرقم القومي (محجوب)</th>
                <th className="py-3 px-4">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {siteWorkers.slice(0, 10).map((w) => (
                <tr key={w.id} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{w.nickname}</div>
                    <div className="text-[11px] text-slate-500">{w.fullName}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500">{w.code}</td>
                  <td className="py-3 px-4 text-slate-700">{w.jobTitle}</td>
                  <td className="py-3 px-4 font-mono text-slate-600 dir-ltr text-right">{w.phone}</td>
                  <td className="py-3 px-4 font-mono text-slate-400">{w.nationalIdMasked}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      نشط
                    </span>
                  </td>
                </tr>
              ))}
              {siteWorkers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    لا توجد عمالة مسجلة بهذا الموقع حتى الآن.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
