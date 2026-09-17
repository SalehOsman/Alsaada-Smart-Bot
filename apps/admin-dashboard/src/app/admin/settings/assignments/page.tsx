import React from 'react';
import Link from 'next/link';
import {
  Users,
  Building2,
  MapPin,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { requireDashboardUser } from '@/lib/auth';
import { getSitesHub, getUsersManagementData } from '@/lib/data-fetchers';
import { ZeroStateCard } from '@/components/ui/zero-state-card';

export default async function SupervisorAssignmentsPage() {
  const user = await requireDashboardUser();

  const sites = await getSitesHub(user);
  const users = await getUsersManagementData();

  // Extract all supervisor-level users
  const supervisorRoles = ['FIELD_ADMIN', 'GENERAL_ADMIN', 'WORKER_SUPERVISOR'];
  const fieldSupervisors = users.filter((u) => supervisorRoles.includes(u.role));

  const assignedSitesCount = sites.filter((s) => s.assignedSupervisors.length > 0).length;
  const unassignedSitesCount = sites.filter((s) => s.assignedSupervisors.length === 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/settings/sites"
            className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center cursor-pointer"
            title="العودة لمركز المواقع"
          >
            <ArrowRight className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-600 dark:text-orange-500" />
              <span>إسناد وتوزيع المشرفين الميدانيين</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              متابعة توزيع المشرفين الميدانيين ومديري المشاريع على مواقع العمل وسجلات الرقابة النشطة من واقع قاعدة البيانات.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800/50 px-3.5 py-1.5 rounded-lg text-xs font-semibold">
          <ShieldCheck className="w-4 h-4 text-orange-600 dark:text-orange-500" />
          <span>حوكمة الرقابة الميدانية</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">إجمالي المواقع</span>
            <Building2 className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2 font-mono">{sites.length}</p>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">موقع ميداني مسجل</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">مواقع مغطاة إشرافياً</span>
            <UserCheck className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-2 font-mono">{assignedSitesCount}</p>
          <span className="text-[11px] text-orange-700 dark:text-orange-400">بها مشرف ميداني واحد على الأقل</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">مواقع بحاجة لمشرف</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2 font-mono">{unassignedSitesCount}</p>
          <span className="text-[11px] text-amber-700 dark:text-amber-400">تتطلب تعيين مشرف ميداني</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">إجمالي الكادر الإشرافي</span>
            <Users className="w-4 h-4 text-blue-500 dark:text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2 font-mono">{fieldSupervisors.length}</p>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">مشرف / مدير مشروع متاح</span>
        </div>
      </div>

      {/* Main Content Table or Zero State */}
      {sites.length === 0 ? (
        <ZeroStateCard
          icon={Users}
          title="لا توجد تكليفات مشرفين مسجلة"
          description="لم يتم العثور على أي مواقع عمل أو تكليفات مشرفين ميدانية مسجلة حالياً في قاعدة البيانات."
          actionText="العودة لمركز المواقع"
          actionHref="/admin/settings/sites"
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">سجل التكليفات والإسناد الميداني للمواقع</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">حصر كامل لكافة المشرفين المسندين لكل موقع ونطاق القوى العاملة</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="py-3 px-4">الموقع الميداني / المشروع</th>
                  <th className="py-3 px-4">كود الموقع</th>
                  <th className="py-3 px-4">المشرفون الميدانيون المكلفون</th>
                  <th className="py-3 px-4 text-center">العمالة الميدانية</th>
                  <th className="py-3 px-4 text-center">الحالة التشغيلية</th>
                  <th className="py-3 px-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {sites.map((site) => (
                  <tr key={site.id} className="hover:bg-slate-50/75 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                        <div>
                          <p className="font-bold text-slate-900 dark:text-slate-100">{site.name}</p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            <span>{site.location}</span>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-600 dark:text-slate-400">
                      {site.code}
                    </td>
                    <td className="py-3.5 px-4">
                      {site.assignedSupervisors.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {site.assignedSupervisors.map((sup, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 border border-orange-200/80 dark:border-orange-800/50 px-2.5 py-0.5 rounded-md text-[11px] font-medium"
                            >
                              <UserCheck className="w-3 h-3 text-orange-600 dark:text-orange-500" />
                              {sup}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 px-2.5 py-0.5 rounded-md text-[11px] font-medium">
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                          لا يوجد مشرف مسند
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                      {site.workersCount} عامل
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          site.status === 'ACTIVE'
                            ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {site.status === 'ACTIVE' ? 'نشط ميدانياً' : 'متوقف'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Link
                        href="/admin/settings/sites"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs font-semibold min-h-[44px] min-w-[44px] cursor-pointer"
                        title="إدارة الموقع والمشرفين"
                      >
                        <span>إدارة</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
