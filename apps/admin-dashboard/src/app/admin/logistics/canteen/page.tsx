import React from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  ArrowRight,
  ShieldAlert,
  HardHat,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Boxes,
  DollarSign,
  Cigarette,
  Coffee,
  Sparkles,
} from 'lucide-react';
import { requireDashboardUser } from '@/lib/auth';
import { hasAccess } from '@/lib/rbac';
import { prisma } from '@alsaada/database';
import { ZeroStateCard } from '@/components/ui/zero-state-card';

export const dynamic = 'force-dynamic';

export default async function CanteenOverviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string; siteId?: string }>;
}) {
  const user = await requireDashboardUser();


  const canAccess = ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'].includes(user.role);

  if (!canAccess) {
    return (
      <div className="p-6">
        <ZeroStateCard
          title="غير مصرح بالدخول"
          description="شاشة مخزون الكانتين ومهمات الوقاية مخصصة للمسؤولين الميدانيين والمحاسبين."
          icon={ShieldAlert}
        />
      </div>
    );
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const isFieldRole = user.role === 'FIELD_ADMIN' && !!user.assignedSiteId;
  const siteFilter = isFieldRole ? user.assignedSiteId! : resolvedParams.siteId;

  let items: Array<{
    id: string;
    code: string;
    name: string;
    category: string;
    siteName: string;
    costPrice: number;
    sellingPrice: number;
    currentStock: number;
    reorderThreshold: number;
    isActive: boolean;
    isLowStock: boolean;
  }> = [];

  let sitesList: Array<{ id: string; name: string }> = [];

  try {
    const whereClause: Record<string, unknown> = {};
    if (siteFilter) {
      whereClause.siteId = siteFilter;
    }
    if (resolvedParams.category) {
      whereClause.category = resolvedParams.category;
    }

    const [dbItems, dbSites] = await Promise.all([
      prisma.canteenItem.findMany({
        where: whereClause,
        include: { site: true },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      }),
      prisma.site.findMany({
        where: isFieldRole ? { id: user.assignedSiteId! } : {},
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    sitesList = dbSites;

    items = dbItems.map((it) => {
      const stock = Number(it.currentStock || 0);
      const threshold = Number(it.reorderThreshold || 0);
      return {
        id: it.id,
        code: it.code,
        name: it.name,
        category: it.category,
        siteName: it.site?.name || 'غير محدد',
        costPrice: Number(it.costPrice || 0),
        sellingPrice: Number(it.sellingPrice || 0),
        currentStock: stock,
        reorderThreshold: threshold,
        isActive: it.isActive,
        isLowStock: stock <= threshold,
      };
    });
  } catch (err) {
    console.error('Error fetching canteen items:', err);
  }

  const counts = {
    total: items.length,
    cigarettes: items.filter((i) => i.category === 'CIGARETTES').length,
    foodAndSnacks: items.filter((i) => i.category === 'SNACKS_AND_FOOD' || i.category === 'BEVERAGES').length,
    lowStock: items.filter((i) => i.isLowStock).length,
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'CIGARETTES':
        return 'سجائر وتبغ';
      case 'SNACKS_AND_FOOD':
        return 'أغذية وسناكس';
      case 'BEVERAGES':
        return 'مشروبات ومياه';
      case 'PERSONAL_CARE':
        return 'عناية ومهمات شخصية';
      default:
        return cat;
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header */}
      <div className="space-y-2">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Link href="/admin" className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
            الرئيسية
          </Link>
          <span>/</span>
          <Link href="/admin/logistics" className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
            ⛽ التعيينات والمخازن والكانتين
          </Link>
          <span>/</span>
          <span className="text-slate-800 dark:text-slate-200 font-semibold">مبيعات ومسحوبات الكانتين ومهمات الوقاية</span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/logistics"
              className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center shrink-0"
              aria-label="الرجوع لقسم التعيينات والمخازن"
            >
              <ArrowRight className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ShoppingBag className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                <span>مخزون الكانتين ومسحوبات العمال العينية (Canteen Inventory)</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                متابعة أرصدة السلع الاستهلاكية، مسحوبات السجائر، ومقاصة تخفيض التكاليف الميدانية
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Low Stock Warning */}
      {counts.lowStock > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-4 rounded-xl flex items-center gap-3 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
          <div>
            <h4 className="font-bold text-sm">
              تنبيه حرج في المخزون: توجد ({counts.lowStock}) أصناف أوشكت على النفاد في الكانتين!
            </h4>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              يرجى تحرير أمر شراء وتوريد عبر العهدة الميدانية لإعادة ملء المخزون قبل نفاذ السلع الأساسية.
            </p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>إجمالي السلع المسجلة</span>
            <Boxes className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">{counts.total}</div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">صنف بمخازن الكانتين</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>أصناف السجائر والتبغ</span>
            <Cigarette className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">{counts.cigarettes}</div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">مقاصة عينية مباشرة</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>الأغذية والمشروبات</span>
            <Coffee className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">{counts.foodAndSnacks}</div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">وجبات خفيفة ومستلزمات</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>أصناف أوشكت على النفاد</span>
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">{counts.lowStock}</div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">تتطلب إعادة طلب فورية</p>
        </div>
      </div>

      {/* Category Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-2">التصنيف:</span>
        <Link
          href={`/admin/logistics/canteen${siteFilter ? `?siteId=${siteFilter}` : ''}`}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[44px] inline-flex items-center justify-center ${
            !resolvedParams.category
              ? 'bg-orange-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          الكل ({items.length})
        </Link>
        <Link
          href={`/admin/logistics/canteen?category=CIGARETTES${siteFilter ? `&siteId=${siteFilter}` : ''}`}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[44px] inline-flex items-center justify-center ${
            resolvedParams.category === 'CIGARETTES'
              ? 'bg-orange-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          سجائر وتبغ
        </Link>
        <Link
          href={`/admin/logistics/canteen?category=SNACKS_AND_FOOD${siteFilter ? `&siteId=${siteFilter}` : ''}`}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[44px] inline-flex items-center justify-center ${
            resolvedParams.category === 'SNACKS_AND_FOOD'
              ? 'bg-orange-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          أغذية وسناكس
        </Link>
        <Link
          href={`/admin/logistics/canteen?category=BEVERAGES${siteFilter ? `&siteId=${siteFilter}` : ''}`}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[44px] inline-flex items-center justify-center ${
            resolvedParams.category === 'BEVERAGES'
              ? 'bg-orange-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          مشروبات
        </Link>
      </div>

      {/* Inventory Table / Empty State */}
      {items.length === 0 ? (
        <ZeroStateCard
          icon={ShoppingBag}
          title="لا توجد أصناف مسجلة"
          description="لم يتم العثور على أي سلع في مخزون الكانتين مطابقة للمحددات الحالية."
          actionText="عرض كافة الأصناف"
          actionHref="/admin/logistics/canteen"
        />
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs min-w-[800px]">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold">
                  <tr>
                    <th className="px-4 py-3">كود الصنف</th>
                    <th className="px-4 py-3">اسم السلعة</th>
                    <th className="px-4 py-3">التصنيف</th>
                    <th className="px-4 py-3">الموقع الميداني</th>
                    <th className="px-4 py-3">سعر التكلفة</th>
                    <th className="px-4 py-3">سعر الصرف (البيع)</th>
                    <th className="px-4 py-3">الرصيد الحالي</th>
                    <th className="px-4 py-3">حالة المخزون</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((it) => (
                    <tr key={it.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-orange-600 dark:text-orange-400">
                        {it.code}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">
                        {it.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {getCategoryLabel(it.category)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                          <span>{it.siteName}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                        {it.costPrice.toLocaleString('ar-EG')} ج.م
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">
                        {it.sellingPrice.toLocaleString('ar-EG')} ج.م
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {it.currentStock.toLocaleString('ar-EG')}
                      </td>
                      <td className="px-4 py-3">
                        {it.isLowStock ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 dark:text-amber-400 dark:bg-amber-950/40 dark:border-amber-800">
                            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            <span>مخزون حرج (&le; {it.reorderThreshold})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>كافٍ</span>
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
            {items.map((it) => (
              <div
                key={it.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded border border-orange-200/50 dark:border-orange-800/50">
                      {it.code}
                    </span>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-1">{it.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{getCategoryLabel(it.category)}</p>
                  </div>
                  {it.isLowStock ? (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 dark:text-amber-400 dark:bg-amber-950/40 dark:border-amber-800">
                      حرج
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800">
                      كافٍ
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg">
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[10px]">الموقع:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{it.siteName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[10px]">الرصيد المتاح:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                      {it.currentStock.toLocaleString('ar-EG')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[10px]">سعر التكلفة:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{it.costPrice} ج.م</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[10px]">سعر الصرف:</span>
                    <span className="font-bold text-orange-600 dark:text-orange-400">{it.sellingPrice} ج.م</span>
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
