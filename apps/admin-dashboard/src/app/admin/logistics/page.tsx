import React from 'react';
import Link from 'next/link';
import {
  PackageCheck,
  ArrowRight,
  ShieldAlert,
  ShoppingBag,
  Truck,
  HardHat,
  Receipt,
  AlertTriangle,
  Building2,
  Phone,
  ArrowUpRight,
  CheckCircle2,
  Boxes,
} from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { hasAccess } from '@/lib/rbac';
import { prisma } from '@alsaada/database';
import { ZeroStateCard } from '@/components/ui/zero-state-card';

export const dynamic = 'force-dynamic';

export default async function LogisticsHubPage() {
  const user = await getCurrentUser();

  const canAccess = ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'].includes(user.role);

  if (!canAccess) {
    return (
      <div className="p-6">
        <ZeroStateCard
          title="غير مصرح بالدخول"
          description="شاشة إدارة التعيينات والمخازن والكانتين مخصصة للإداريين الميدانيين والإدارة المالية."
          icon={ShieldAlert}
        />
      </div>
    );
  }

  const isFieldRole = user.role === 'FIELD_ADMIN' && !!user.assignedSiteId;
  const siteWhere = isFieldRole ? { siteId: user.assignedSiteId! } : {};

  // Safe live database queries
  let canteenItemsCount = 0;
  let lowStockCanteenCount = 0;
  let totalCanteenStockValue = 0;

  let suppliersCount = 0;
  let totalInvoicesRemaining = 0;
  let ppeAssetsCount = 0;

  let topSuppliers: Array<{
    id: string;
    code: string;
    name: string;
    category: string;
    currentBalance: number;
    status: string;
  }> = [];

  try {
    const [canteenItems, suppliers, invoiceAgg, ppeCount] = await Promise.all([
      prisma.canteenItem.findMany({
        where: siteWhere,
        select: {
          id: true,
          currentStock: true,
          reorderThreshold: true,
          costPrice: true,
        },
      }),
      prisma.supplier.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { currentBalance: 'desc' },
        take: 5,
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          currentBalance: true,
          status: true,
        },
      }),
      prisma.supplierInvoice.aggregate({
        _sum: { remainingBalance: true },
        _count: true,
      }),
      prisma.pPEAsset.count(),
    ]);

    canteenItemsCount = canteenItems.length;
    for (const item of canteenItems) {
      const stock = Number(item.currentStock || 0);
      const threshold = Number(item.reorderThreshold || 0);
      const cost = Number(item.costPrice || 0);
      totalCanteenStockValue += stock * cost;
      if (stock <= threshold) {
        lowStockCanteenCount++;
      }
    }

    suppliersCount = await prisma.supplier.count();
    totalInvoicesRemaining = Number(invoiceAgg._sum.remainingBalance || 0);
    ppeAssetsCount = ppeCount;

    topSuppliers = suppliers.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      category: s.category,
      currentBalance: Number(s.currentBalance || 0),
      status: s.status,
    }));
  } catch (err) {
    console.error('Error fetching logistics data:', err);
  }

  const LOGISTICS_SECTIONS = [
    {
      title: 'مبيعات ومسحوبات الكانتين ومهمات الوقاية',
      desc: 'سجل أصناف الكانتين، السجائر، المشتريات العينية، مهمات السلامة PPE ومقاصة التكاليف (Flow 02.1 & 02.2).',
      href: '/admin/logistics/canteen',
      icon: ShoppingBag,
      badge: `${canteenItemsCount} صنف مسجل`,
    },
    {
      title: 'المعدات والمحروقات الميدانية',
      desc: 'متابعة صهاريج الوقود والسولار الميداني ومعدلات استهلاك الآليات الثقيلة (Flow 03.1).',
      href: '/admin/operations/equipment',
      icon: Truck,
      badge: 'إمداد الوقود',
    },
    {
      title: 'الخزائن ومرصد السيولة للمشتريات',
      desc: 'مراقبة العهد النقدية لمشتريات التعيينات ومصاريف الإعاشة الميدانية للعمال (Flow 02.4).',
      href: '/admin/finance/treasury',
      icon: Receipt,
      badge: 'العهد النقدية',
    },
    {
      title: 'دليل العاملين والمستفيدين',
      desc: 'حساب مسحوبات العمال العينية واستقطاعات الكانتين ومهمات الوقاية المخصومة من الراتب.',
      href: '/admin/workforce/directory',
      icon: HardHat,
      badge: `${ppeAssetsCount} مهمة وقاية`,
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
          <span className="text-slate-800 font-semibold">⛽ التعيينات والمخازن والكانتين</span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center shrink-0"
              aria-label="الرجوع للرئيسية"
            >
              <ArrowRight className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
                <PackageCheck className="w-6 h-6 text-orange-600" />
                <span>مركز التعيينات والمخازن والكانتين (Logistics Hub)</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                إدارة مخازن الكانتين الميدانية، مشتريات الإعاشة، مهمات السلامة PPE، وحسابات الموردين
              </p>
            </div>
          </div>

          <Link
            href="/admin/logistics/canteen"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 transition-colors shadow-2xs min-h-[44px] min-w-[44px]"
          >
            <span>إدارة الكانتين والمهمات</span>
            <ArrowRight className="w-4 h-4 rotate-180" />
          </Link>
        </div>
      </div>

      {/* Low Stock Warning */}
      {lowStockCanteenCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-3 text-amber-900">
          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
          <div>
            <h4 className="font-bold text-sm">
              تنبيه المخزون الميداني: توجد ({lowStockCanteenCount}) أصناف في الكانتين بلغت حد إعادة الطلب!
            </h4>
            <p className="text-xs text-amber-700 mt-0.5">
              يرجى تغذية المخزون الميداني لتفادي نفاد السلع الأساسية ومستلزمات المعيشة للعمال في الموقع.
            </p>
          </div>
        </div>
      )}

      {/* Logistics KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>أصناف الكانتين</span>
            <ShoppingBag className="w-4 h-4 text-orange-600" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-slate-900">{canteenItemsCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">سلع ومسحوبات عينية</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>قيمة المخزون المقدرة</span>
            <Boxes className="w-4 h-4 text-slate-600" />
          </div>
          <div className="mt-2 text-lg sm:text-2xl font-black text-slate-900">
            {totalCanteenStockValue.toLocaleString('ar-EG')} <span className="text-xs font-medium text-slate-500">ج.م</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">بسعر التكلفة الميدانية</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>الموردون المعتمدون</span>
            <Truck className="w-4 h-4 text-slate-600" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-slate-900">{suppliersCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">ورش وقطع غيار وإعاشة</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>مهمات الوقاية المسلمة</span>
            <HardHat className="w-4 h-4 text-slate-600" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-slate-900">{ppeAssetsCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">خوذ وأحذية وسترات عهدة</p>
        </div>
      </div>

      {/* Domain Hub Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {LOGISTICS_SECTIONS.map((sec) => {
          const Icon = sec.icon;
          return (
            <Link
              key={sec.href}
              href={sec.href}
              className="group bg-white p-6 rounded-xl border border-slate-200 hover:border-orange-500 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-200/50 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                    {sec.badge}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-orange-600 transition-colors">
                  {sec.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  {sec.desc}
                </p>
              </div>

              <div className="flex items-center text-xs font-semibold text-orange-600 gap-1 pt-2 border-t border-slate-100 min-h-[44px]">
                <span>الدخول للقسم</span>
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform rotate-180" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Top Suppliers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-orange-600" />
              <span>الموردون المعتمدون وأرصدة المستحقات (Suppliers Ledger)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              متابعة أرصدة موردي الإعاشة، قطع الغيار، وورش الصيانة الميدانية
            </p>
          </div>
          <Link
            href="/admin/finance"
            className="text-xs font-semibold text-orange-600 hover:text-orange-700 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
          >
            المركز المالي &larr;
          </Link>
        </div>

        {topSuppliers.length === 0 ? (
          <ZeroStateCard
            icon={Truck}
            title="لا يوجد موردون مسجلون"
            description="لم يتم العثور على أي موردين معتمدين مسجلين في قاعدة البيانات حتى الآن."
            actionText="العودة للرئيسية"
            actionHref="/admin"
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-right text-xs min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-3">كود المورد</th>
                  <th className="px-4 py-3">اسم المورد والنشاط</th>
                  <th className="px-4 py-3">تصنيف التوريد</th>
                  <th className="px-4 py-3">الرصيد المستحق</th>
                  <th className="px-4 py-3">الحالة التعاقدية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topSuppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-orange-600">
                      {s.code}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {s.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {s.category === 'FOOD_CATERING'
                        ? 'إعاشة وأغذية'
                        : s.category === 'SPARE_PARTS'
                        ? 'قطع غيار'
                        : s.category === 'FUEL_OILS'
                        ? 'محروقات وزيوت'
                        : s.category === 'WORKSHOPS_MACHINING'
                        ? 'ورش وخراطة'
                        : s.category}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {s.currentBalance.toLocaleString('ar-EG')} ج.م
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>نشط معتمد</span>
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
