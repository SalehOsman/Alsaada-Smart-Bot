import React from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  MapPin,
  ArrowRight,
  Plus,
  CheckCircle2,
  Shield,
  Briefcase,
} from 'lucide-react';
import { requireDashboardUser } from '@/lib/auth';
import { getSitesHub } from '@/lib/data-fetchers';
import { ZeroStateCard } from '@/components/ui/zero-state-card';

export default async function SitesHubPage() {
  const user = await requireDashboardUser();

  const sites = await getSitesHub(user);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/settings"
            className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-orange-600 dark:text-orange-500" />
              <span>مركز إدارة المواقع والمشاريع الميدانية (Flow 00.2)</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              متابعة مواقع العمل المفتوحة والمشرفين المسندين وإحصائيات القوى العاملة الموزعة من واقع قاعدة البيانات الحقيقية.
            </p>
          </div>
        </div>

        <Link
          href="/admin/settings/assignments"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 transition-colors shadow-2xs min-h-[44px] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إسناد وتوزيع المشرفين</span>
        </Link>
      </div>

      {/* Sites Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {sites.length === 0 ? (
          <div className="col-span-1 md:col-span-2">
            <ZeroStateCard
              icon={Building2}
              title="لا توجد مواقع مسجلة"
              description="لم يتم العثور على أي مواقع عمل أو مشاريع ميدانية مفتوحة حالياً في قاعدة البيانات."
              actionText="إسناد وتوزيع المشرفين"
              actionHref="/admin/settings/assignments"
            />
          </div>
        ) : (
          sites.map((site) => (
            <div
              key={site.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs hover:border-orange-500 dark:hover:border-orange-500/80 hover:shadow-md transition-all space-y-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-mono text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded-md border border-orange-200/60 dark:border-orange-800/50">
                    {site.code}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-2">{site.name}</h3>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50">
                  <CheckCircle2 className="w-3.5 h-3.5 text-orange-600 dark:text-orange-500" />
                  <span>{site.status === 'ACTIVE' ? 'نشط ميدانياً' : 'متوقف'}</span>
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                <span>{site.location}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mb-1">
                    <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>العمالة الفعلية</span>
                  </div>
                  <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{site.workersCount} عامل</span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mb-1">
                    <Shield className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                    <span>المشرفون المسندون</span>
                  </div>
                  <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {site.assignedSupervisors.length} مشرف
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mb-2">المسؤولون والمشرفون على الموقع:</p>
                <div className="flex flex-wrap gap-2">
                  {site.assignedSupervisors.length === 0 ? (
                    <span className="text-xs text-slate-400 dark:text-slate-500 italic">لا يوجد مشرفون مسندون حالياً</span>
                  ) : (
                    site.assignedSupervisors.map((sup, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700 text-[11px] px-2.5 py-1 rounded-md"
                      >
                        <Briefcase className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                        <span>{sup}</span>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
