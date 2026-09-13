import React from 'react';
import Link from 'next/link';
import {
  Tractor,
  ArrowRight,
  ShieldAlert,
  Fuel,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Building2,
  User,
  Gauge,
} from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { hasAccess } from '@/lib/rbac';
import { prisma } from '@alsaada/database';
import { getWorkerDisplayName } from '@alsaada/core-components';
import { ZeroStateCard } from '@/components/ui/zero-state-card';

export const dynamic = 'force-dynamic';

export default async function EquipmentRegisterPage({
  searchParams,
}: {
  searchParams?: Promise<{ siteId?: string; status?: string }>;
}) {
  const user = await getCurrentUser();

  const canAccess = ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'].includes(user.role);

  if (!canAccess) {
    return (
      <div className="p-6">
        <ZeroStateCard
          title="غير مصرح بالدخول"
          description="سجل المعدات والآليات الثقيلة مخصص للمسؤولين ومهندسي المواقع المعتمدين."
          icon={ShieldAlert}
        />
      </div>
    );
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const isFieldRole = user.role === 'FIELD_ADMIN' && !!user.assignedSiteId;
  const siteFilter = isFieldRole ? user.assignedSiteId! : resolvedParams.siteId;

  let equipments: Array<{
    id: string;
    code: string;
    name: string;
    type: string;
    brand: string | null;
    modelYear: number | null;
    plateNumber: string | null;
    siteName: string;
    operatorName: string;
    meterType: string;
    meterReading: number;
    fuelLevel: number | null;
    status: string;
  }> = [];

  let sitesList: Array<{ id: string; name: string }> = [];

  try {
    const whereClause: Record<string, unknown> = {};
    if (siteFilter) {
      whereClause.siteId = siteFilter;
    }
    if (resolvedParams.status) {
      whereClause.technicalStatus = resolvedParams.status;
    }

    const [dbEquipments, dbSites] = await Promise.all([
      prisma.equipment.findMany({
        where: whereClause,
        include: {
          site: true,
          assignedWorker: true,
        },
        orderBy: { code: 'asc' },
      }),
      prisma.site.findMany({
        where: isFieldRole ? { id: user.assignedSiteId! } : {},
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    sitesList = dbSites;

    equipments = dbEquipments.map((eq) => ({
      id: eq.id,
      code: eq.code,
      name: eq.name,
      type: eq.type,
      brand: eq.brand,
      modelYear: eq.modelYear,
      plateNumber: eq.plateNumber,
      siteName: eq.site?.name || 'غير محدد',
      operatorName: eq.assignedWorker ? getWorkerDisplayName(eq.assignedWorker) : 'غير مسند',
      meterType: eq.meterType === 'HOURS' ? 'ساعة عمل' : 'كم',
      meterReading: Number(eq.currentMeterReading || 0),
      fuelLevel: eq.currentFuelLevelPercentage ? Number(eq.currentFuelLevelPercentage) : null,
      status: eq.technicalStatus,
    }));
  } catch (err) {
    console.error('Error fetching equipment list:', err);
  }

  const counts = {
    total: equipments.length,
    operational: equipments.filter((e) => e.status === 'OPERATIONAL').length,
    maintenance: equipments.filter((e) => e.status === 'NEEDS_MAINTENANCE').length,
    broken: equipments.filter((e) => e.status === 'BROKEN_DOWN_STOPPED').length,
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header */}
      <div className="space-y-2">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/admin" className="hover:text-orange-600 transition-colors">
            الرئيسية
          </Link>
          <span>/</span>
          <Link href="/admin/operations" className="hover:text-orange-600 transition-colors">
            🚜 تشغيل المواقع والإنتاج
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-semibold">المعدات والمحروقات الميدانية</span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/operations"
              className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center shrink-0"
              aria-label="الرجوع لقسم التشغيل"
            >
              <ArrowRight className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
                <Tractor className="w-6 h-6 text-orange-600" />
                <span>سجل المعدات والآليات الثقيلة (Heavy Equipment Register)</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                متابعة الحفارات، اللوادر، صهاريج الوقود، قراءات العدادات وحالات الجاهزية الميدانية
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>إجمالي الأسطول</span>
            <Tractor className="w-4 h-4 text-orange-600" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-slate-900">{counts.total}</div>
          <p className="text-[11px] text-slate-400 mt-1">آلية مسجلة بالنظام</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>جاهزة للعمل</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-slate-900">{counts.operational}</div>
          <p className="text-[11px] text-slate-400 mt-1">حالة تشغيلية ممتازة</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>تحتاج صيانة</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-slate-900">{counts.maintenance}</div>
          <p className="text-[11px] text-slate-400 mt-1">تغيير زيوت / فلاتر</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>معطلة عن العمل</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-slate-900">{counts.broken}</div>
          <p className="text-[11px] text-slate-400 mt-1">تتطلب تدخل ورشة فورية</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <span className="text-xs font-bold text-slate-700">تصفية حسب الموقع:</span>
        <Link
          href="/admin/operations/equipment"
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[44px] inline-flex items-center justify-center ${
            !siteFilter ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          كافة المواقع
        </Link>
        {sitesList.map((site) => (
          <Link
            key={site.id}
            href={`/admin/operations/equipment?siteId=${site.id}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[44px] inline-flex items-center justify-center ${
              siteFilter === site.id
                ? 'bg-orange-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {site.name}
          </Link>
        ))}
      </div>

      {/* Equipment Table / Empty State */}
      {equipments.length === 0 ? (
        <ZeroStateCard
          icon={Tractor}
          title="لا توجد معدات مسجلة"
          description="لم يتم العثور على أي معدات أو آليات ثقيلة مطابقة لمعايير البحث في قاعدة البيانات."
          actionText="عرض كافة المواقع"
          actionHref="/admin/operations/equipment"
        />
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs min-w-[800px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-4 py-3">كود الآلية</th>
                    <th className="px-4 py-3">اسم الآلية والنوع</th>
                    <th className="px-4 py-3">الموقع الميداني</th>
                    <th className="px-4 py-3">السائق / المشغل</th>
                    <th className="px-4 py-3">قراءة العداد</th>
                    <th className="px-4 py-3">مستوى السولار</th>
                    <th className="px-4 py-3">الحالة الفنية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {equipments.map((eq) => (
                    <tr key={eq.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-orange-600">
                        {eq.code}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{eq.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {eq.type} {eq.brand ? `• ${eq.brand}` : ''} {eq.plateNumber ? `• (${eq.plateNumber})` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{eq.siteName}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{eq.operatorName}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {eq.meterReading.toLocaleString('ar-EG')} {eq.meterType}
                      </td>
                      <td className="px-4 py-3">
                        {eq.fuelLevel !== null ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700">
                            <Fuel className="w-3 h-3 text-orange-600" />
                            <span>{eq.fuelLevel}%</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {eq.status === 'OPERATIONAL' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>جاهزة للعمل</span>
                          </span>
                        ) : eq.status === 'NEEDS_MAINTENANCE' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                            <AlertTriangle className="w-3 h-3" />
                            <span>تحتاج صيانة</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                            <XCircle className="w-3 h-3" />
                            <span>معطلة</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card List View */}
          <div className="md:hidden space-y-3">
            {equipments.map((eq) => (
              <div
                key={eq.id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200/50">
                      {eq.code}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm mt-1">{eq.name}</h3>
                    <p className="text-xs text-slate-500">{eq.type} {eq.brand ? `• ${eq.brand}` : ''}</p>
                  </div>
                  {eq.status === 'OPERATIONAL' ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      جاهزة
                    </span>
                  ) : eq.status === 'NEEDS_MAINTENANCE' ? (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      صيانة
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      معطلة
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg">
                  <div>
                    <span className="text-slate-400 block text-[10px]">الموقع:</span>
                    <span className="font-medium text-slate-800">{eq.siteName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">المشغل:</span>
                    <span className="font-medium text-slate-800">{eq.operatorName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">قراءة العداد:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {eq.meterReading.toLocaleString('ar-EG')} {eq.meterType}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">مستوى الوقود:</span>
                    <span className="font-bold text-orange-600">
                      {eq.fuelLevel !== null ? `${eq.fuelLevel}%` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
