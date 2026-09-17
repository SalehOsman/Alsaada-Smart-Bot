import React from 'react';
import Link from 'next/link';
import {
  Tractor,
  ArrowRight,
  Building2,
  Fuel,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  Pickaxe,
  Wrench,
} from 'lucide-react';
import { requireDashboardUser } from '@/lib/auth';
import { hasAccess } from '@/lib/rbac';
import { prisma } from '@alsaada/database';
import { ZeroStateCard } from '@/components/ui/zero-state-card';
import { formatNumber, getServerPreferences } from '@/lib/formatters';

export const dynamic = 'force-dynamic';

export default async function OperationsHubPage() {
  const [user, { numberFormat }] = await Promise.all([
    requireDashboardUser(),
    getServerPreferences(),
  ]);


  const canAccess = ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'].includes(user.role);

  if (!canAccess) {
    return (
      <div className="p-6">
        <ZeroStateCard
          title="غير مصرح بالدخول"
          description="شاشة تشغيل المواقع والإنتاج مخصصة حصراً لمهندسي المواقع، مديري المشاريع والإدارة العامة."
          icon={ShieldAlert}
        />
      </div>
    );
  }

  const isFieldRole = user.role === 'FIELD_ADMIN' && !!user.assignedSiteId;

  // Safe live database aggregation
  let sitesList: Array<{
    id: string;
    code: string;
    name: string;
    status: string;
    workersCount: number;
    equipmentsCount: number;
  }> = [];

  let totalEquipments = 0;
  let operationalEquipments = 0;
  let maintenanceEquipments = 0;
  let brokenDownEquipments = 0;
  let totalFuelStockLiters = 0;
  let fuelTanksCount = 0;
  let totalExtractionTons = 0;

  try {
    const siteWhere = isFieldRole ? { id: user.assignedSiteId! } : {};
    const equipmentWhere = isFieldRole ? { siteId: user.assignedSiteId! } : {};

    const [sites, equipments, tanks, slips] = await Promise.all([
      prisma.site.findMany({
        where: siteWhere,
        include: {
          workers: { where: { isDeleted: false, status: 'ACTIVE' }, select: { id: true } },
          equipments: { select: { id: true } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.equipment.findMany({
        where: equipmentWhere,
        select: {
          id: true,
          technicalStatus: true,
        },
      }),
      prisma.fuelTank.findMany({
        where: siteWhere,
        select: {
          id: true,
          currentStockLiters: true,
        },
      }),
      prisma.phosphateProductionSlip.aggregate({
        where: siteWhere,
        _sum: { netWeightTons: true },
        _count: true,
      }),
    ]);

    sitesList = sites.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      status: s.status,
      workersCount: s.workers.length,
      equipmentsCount: s.equipments.length,
    }));

    totalEquipments = equipments.length;
    for (const eq of equipments) {
      if (eq.technicalStatus === 'OPERATIONAL') operationalEquipments++;
      else if (eq.technicalStatus === 'NEEDS_MAINTENANCE') maintenanceEquipments++;
      else if (eq.technicalStatus === 'BROKEN_DOWN_STOPPED') brokenDownEquipments++;
      else operationalEquipments++;
    }

    fuelTanksCount = tanks.length;
    for (const t of tanks) {
      totalFuelStockLiters += Number(t.currentStockLiters || 0);
    }

    totalExtractionTons = Number(slips._sum.netWeightTons || 0);
  } catch (err) {
    console.error('Error fetching operations data:', err);
  }

  const OPERATIONS_SECTIONS = [
    {
      title: 'المعدات والمحروقات الميدانية',
      desc: 'سجل الآليات الثقيلة، الشاحنات، المولدات، وصهاريج المحروقات مع تتبع ساعات العمل والصيانة.',
      href: '/admin/operations/equipment',
      icon: Tractor,
      badge: `${totalEquipments} معدة مسجلة`,
    },
    {
      title: 'المواقع والمشاريع الميدانية',
      desc: 'إدارة مواقع العمل المفتوحة، إسناد المشرفين، وإحصائيات القوى العاملة (Flow 00.2).',
      href: '/admin/settings/sites',
      icon: Building2,
      badge: `${sitesList.length} موقع مفتوح`,
    },
    {
      title: 'دليل العاملين في المواقع',
      desc: 'سجل العمالة النشطة موزعة على المواقع مع الرتب ومتابعة اسم الشهرة المعتمد (Flow 01.1).',
      href: '/admin/workforce/directory',
      icon: Users,
      badge: 'إدارة القوى',
    },
    {
      title: 'الخزائن ومرصد السيولة الميدانية',
      desc: 'مراقبة العهد النقدية لمصروفات التشغيل الطارئة وصيانة المعدات وشراء المحروقات.',
      href: '/admin/finance/treasury',
      icon: Clock,
      badge: 'كفاية نقدية',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumbs & Header */}
      <div className="space-y-2">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/admin" className="hover:text-orange-600 transition-colors">
            الرئيسية
          </Link>
          <span>/</span>
          <span className="text-slate-800 dark:text-slate-200 font-semibold">🚜 تشغيل المواقع والإنتاج</span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center shrink-0"
              aria-label="الرجوع للرئيسية"
            >
              <ArrowRight className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Tractor className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                <span>مركز تشغيل المواقع والإنتاج الميداني (Operations Hub)</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                متابعة أداء المواقع، حركة المعدات الثقيلة، صهاريج السولار، وإنتاجية التعدين الميدانية
              </p>
            </div>
          </div>

          <Link
            href="/admin/operations/equipment"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 transition-colors shadow-2xs min-h-[44px] min-w-[44px]"
          >
            <span>سجل المعدات والمحروقات</span>
            <ArrowRight className="w-4 h-4 rotate-180" />
          </Link>
        </div>
      </div>

      {/* Equipment Maintenance Warning Banner */}
      {(brokenDownEquipments > 0 || maintenanceEquipments > 0) && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 p-4 rounded-xl flex items-center gap-3 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <h4 className="font-bold text-sm">
              تنبيه الصيانة والتشغيل: توجد ({formatNumber(brokenDownEquipments, { numberFormat })}) معدة معطلة و ({formatNumber(maintenanceEquipments, { numberFormat })}) معدة بحاجة لصيانة دورية!
            </h4>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              يرجى التنسيق مع الورش الميدانية لتنفيذ الصيانة الوقائية وصرف قطع الغيار لضمان عدم توقف الإنتاج.
            </p>
          </div>
        </div>
      )}

      {/* Operations KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>جاهزية المعدات</span>
            <Tractor className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="mt-2 text-lg sm:text-2xl font-black text-slate-900 dark:text-slate-100">
            {formatNumber(operationalEquipments, { numberFormat })}{' '}
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              من {formatNumber(totalEquipments, { numberFormat })} معدة
            </span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">معدات وآليات قيد العمل</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>مواقع التشغيل</span>
            <Building2 className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </div>
          <div className="mt-2 text-lg sm:text-2xl font-black text-slate-900 dark:text-slate-100">
            {formatNumber(sitesList.length, { numberFormat })}{' '}
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">موقع</span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">مشاريع تعدين ومواقع نشطة</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>مخزون السولار</span>
            <Fuel className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </div>
          <div className="mt-2 text-lg sm:text-2xl font-black text-slate-900 dark:text-slate-100">
            {formatNumber(totalFuelStockLiters, { numberFormat })}{' '}
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">لتر</span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            موزع على ({formatNumber(fuelTanksCount, { numberFormat })}) صهريج ميداني
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>إجمالي الإنتاج المستخرج</span>
            <Pickaxe className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </div>
          <div className="mt-2 text-lg sm:text-2xl font-black text-slate-900 dark:text-slate-100">
            {formatNumber(totalExtractionTons, { numberFormat })}{' '}
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">طن</span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">خام الفوسفات المستخرج والمشحون</p>
        </div>
      </div>

      {/* Domain Hub Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {OPERATIONS_SECTIONS.map((sec) => {
          const Icon = sec.icon;
          return (
            <Link
              key={sec.href}
              href={sec.href}
              className="group bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-orange-500 dark:hover:border-orange-500 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-200/50 dark:border-orange-900/50 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                    {sec.badge}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                  {sec.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  {sec.desc}
                </p>
              </div>

              <div className="flex items-center text-xs font-semibold text-orange-600 dark:text-orange-400 gap-1 pt-2 border-t border-slate-100 dark:border-slate-800 min-h-[44px]">
                <span>الدخول للقسم</span>
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform rotate-180" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Sites Status Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <span>حالة المواقع الميدانية والجاهزية التشغيلية (Site Readiness)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              نظرة عامة على المواقع وتوزيع القوى العاملة والمعدات المرتبطة
            </p>
          </div>
          <Link
            href="/admin/settings/sites"
            className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
          >
            إدارة المواقع &larr;
          </Link>
        </div>

        {sitesList.length === 0 ? (
          <ZeroStateCard
            icon={Building2}
            title="لا توجد مواقع مسجلة"
            description="لم يتم العثور على أي مواقع تشغيلية في قاعدة البيانات حالياً."
            actionText="إدارة المواقع"
            actionHref="/admin/settings/sites"
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-right text-xs min-w-[700px]">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                <tr>
                  <th className="px-4 py-3">كود الموقع</th>
                  <th className="px-4 py-3">اسم الموقع</th>
                  <th className="px-4 py-3">القوى العاملة</th>
                  <th className="px-4 py-3">المعدات المسندة</th>
                  <th className="px-4 py-3">الحالة التشغيلية</th>
                  <th className="px-4 py-3 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sitesList.map((site) => (
                  <tr key={site.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-orange-600 dark:text-orange-400">
                      {site.code}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">
                      {site.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {formatNumber(site.workersCount, { numberFormat })} عامل
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {formatNumber(site.equipmentsCount, { numberFormat })} معدة
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50 px-2 py-0.5 rounded-full border border-orange-200 dark:border-orange-900/60">
                        <CheckCircle2 className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                        <span>{site.status === 'ACTIVE' ? 'نشط ميدانياً' : 'متوقف'}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-left">
                      <Link
                        href={`/admin/operations/equipment?siteId=${site.id}`}
                        className="text-xs text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 font-semibold min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-2"
                      >
                        معدات الموقع &larr;
                      </Link>
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
