import React from 'react';
import Link from 'next/link';
import {
  Wallet,
  ArrowRight,
  TrendingDown,
  Building2,
  Receipt,
  FileSpreadsheet,
  ShieldAlert,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { requireDashboardUser } from '@/lib/auth';
import { hasAccess } from '@/lib/rbac';
import { prisma } from '@alsaada/database';
import { ZeroStateCard } from '@/components/ui/zero-state-card';

export const dynamic = 'force-dynamic';

export default async function FinanceHubPage() {
  const user = await requireDashboardUser();


  const canAccess = ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(user.role);

  if (!canAccess) {
    return (
      <div className="p-6">
        <ZeroStateCard
          title="غير مصرح بالدخول"
          description="شاشة الإدارة المالية والخزينة مخصصة حصراً للإدارة العليا والمحاسبين الماليين."
          icon={ShieldAlert}
        />
      </div>
    );
  }

  // Safe data aggregation from live database
  let totalCustodies = 0;
  let activeCustodiesCount = 0;
  let totalRemainingLiquidity = 0;
  let totalLiquidatedExpenses = 0;
  let criticalCount = 0;
  let totalInvoicesRemaining = 0;
  let invoicesCount = 0;
  let recentLedgers: Array<{
    id: string;
    voucherNumber: string;
    transactionType: string;
    amount: number;
    createdAt: Date;
  }> = [];

  try {
    const custodies = await prisma.financialCustody.findMany({
      select: {
        id: true,
        status: true,
        initialAmount: true,
        currentBalance: true,
        totalLiquidatedExpenses: true,
      },
    });

    totalCustodies = custodies.length;
    for (const c of custodies) {
      if (c.status === 'ACTIVE') {
        activeCustodiesCount++;
      }
      const initial = Number(c.initialAmount || 0);
      const remaining = Number(c.currentBalance || 0);
      totalRemainingLiquidity += remaining;
      totalLiquidatedExpenses += Number(c.totalLiquidatedExpenses || 0);

      const percentage = initial > 0 ? (remaining / initial) * 100 : 0;
      if (c.status === 'ACTIVE' && (percentage <= 10 || remaining <= 2000)) {
        criticalCount++;
      }
    }

    const invoiceAgg = await prisma.supplierInvoice.aggregate({
      _sum: { remainingBalance: true },
      _count: true,
    });
    totalInvoicesRemaining = Number(invoiceAgg._sum.remainingBalance || 0);
    invoicesCount = invoiceAgg._count;

    const ledgers = await prisma.financialLedger.findMany({
      orderBy: { hashTimestamp: 'desc' },
      take: 5,
      select: {
        id: true,
        voucherNumber: true,
        transactionType: true,
        amount: true,
        createdAt: true,
      },
    });
    recentLedgers = ledgers.map((l) => ({
      id: l.id,
      voucherNumber: l.voucherNumber,
      transactionType: l.transactionType,
      amount: Number(l.amount || 0),
      createdAt: l.createdAt,
    }));
  } catch (err) {
    console.error('Error fetching finance hub data:', err);
  }

  const FINANCE_SECTIONS = [
    {
      title: 'الخزائن ومرصد السيولة والعهد',
      desc: 'مراقبة لحظية لأرصدة العهد المفتوحة في المشاريع ومؤشرات كفاية التدفق النقدي وصمامات الأمان.',
      href: '/admin/finance/treasury',
      icon: Wallet,
      badge: `${activeCustodiesCount} عهدة نشطة`,
    },
    {
      title: 'مخالصات إنهاء الخدمة المالية',
      desc: 'إجراءات تصفية الحسابات والقرارات المعلقة وصرف المستحقات مع مسيرات الرواتب (Flow 01.8).',
      href: '/admin/workforce/clearances',
      icon: Receipt,
      badge: 'اعتماد سيادي',
    },
    {
      title: 'خزينة التدقيق الجنائي المالي',
      desc: 'سجل السلسلة التراكمية المشفرة SHA-256 لكافة القيود المحاسبية وحركات الصرف (Flow 00.7).',
      href: '/admin/settings/audit-vault',
      icon: ShieldAlert,
      badge: 'تشفير جنائي',
    },
    {
      title: 'استوديو تصحيح الحركات المالية',
      desc: 'استعراض الحركات المالية مع إمكانية التعديل والشطب الناعم ومتابعة أثرها على الميزانية.',
      href: '/admin/settings/studio',
      icon: FileSpreadsheet,
      badge: 'صلاحية سوبر',
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
          <span className="text-slate-800 font-semibold">💰 المالية والخزينة</span>
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
                <Wallet className="w-6 h-6 text-orange-600" />
                <span>المركز المالي وإدارة الخزينة (Finance Hub)</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                المرصد المركزي لإدارة الخزائن النقدية، أرصدة العهد الميدانية، ومطابقة النزاهة المالية المشفرة
              </p>
            </div>
          </div>

          <Link
            href="/admin/finance/treasury"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 transition-colors shadow-2xs min-h-[44px] min-w-[44px]"
          >
            <span>مرصد السيولة والعهد</span>
            <ArrowRight className="w-4 h-4 rotate-180" />
          </Link>
        </div>
      </div>

      {/* Critical Warning if any */}
      {criticalCount > 0 && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-center gap-3 text-rose-800">
          <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 animate-bounce" />
          <div>
            <h4 className="font-bold text-sm">
              تنبيه سيادي عاجل: توجد ({criticalCount}) عهدة ميدانية في مرحلة حرجة (&lt; 10% سيولة)!
            </h4>
            <p className="text-xs text-rose-700 mt-0.5">
              يرجى فتح مرصد السيولة والعهد لتغذية العهد الميدانية فوراً لضمان استمرارية التشغيل الميداني.
            </p>
          </div>
        </div>
      )}

      {/* Financial KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>السيولة المتاحة بالعهد</span>
            <Wallet className="w-4 h-4 text-orange-600" />
          </div>
          <div className="mt-2 text-lg sm:text-2xl font-black text-slate-900">
            {totalRemainingLiquidity.toLocaleString('ar-EG')} <span className="text-xs font-medium text-slate-500">ج.م</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">الرصيد الفعلي الحالي بالعهد</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>العهد الميدانية النشطة</span>
            <Building2 className="w-4 h-4 text-slate-600" />
          </div>
          <div className="mt-2 text-lg sm:text-2xl font-black text-slate-900">
            {activeCustodiesCount} <span className="text-xs font-medium text-slate-500">من {totalCustodies}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">عهد قيد التشغيل الميداني</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>المصاريف المصفاة</span>
            <TrendingDown className="w-4 h-4 text-slate-600" />
          </div>
          <div className="mt-2 text-lg sm:text-2xl font-black text-slate-900">
            {totalLiquidatedExpenses.toLocaleString('ar-EG')} <span className="text-xs font-medium text-slate-500">ج.م</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">إجمالي المنصرف المعتمد</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>مستحقات الموردين</span>
            <Receipt className="w-4 h-4 text-slate-600" />
          </div>
          <div className="mt-2 text-lg sm:text-2xl font-black text-slate-900">
            {totalInvoicesRemaining.toLocaleString('ar-EG')} <span className="text-xs font-medium text-slate-500">ج.م</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">إجمالي ({invoicesCount}) فاتورة مسجلة</p>
        </div>
      </div>

      {/* Domain Hub Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {FINANCE_SECTIONS.map((sec) => {
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

      {/* Recent Financial Movements */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-600" />
              <span>أحدث الحركات المحاسبية المسجلة (Recent Ledger Records)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              آخر الحركات المالية الموثقة بالسلسلة التراكمية المشفرة
            </p>
          </div>
          <Link
            href="/admin/settings/audit-vault"
            className="text-xs font-semibold text-orange-600 hover:text-orange-700 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
          >
            سجل التدقيق الكامل &larr;
          </Link>
        </div>

        {recentLedgers.length === 0 ? (
          <ZeroStateCard
            icon={Wallet}
            title="لا توجد حركات مالية مسجلة"
            description="لم يتم العثور على أي قيود محاسبية أو حركات مالية في الخزينة بعد."
            actionText="عرض مرصد السيولة والعهد"
            actionHref="/admin/finance/treasury"
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-right text-xs min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-3">رقم السند المالي</th>
                  <th className="px-4 py-3">نوع الحركة</th>
                  <th className="px-4 py-3">المبلغ</th>
                  <th className="px-4 py-3">التوقيت</th>
                  <th className="px-4 py-3">الحالة الرقابية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentLedgers.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      {l.voucherNumber}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {l.transactionType}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {l.amount.toLocaleString('ar-EG')} ج.م
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(l.createdAt).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                        <CheckCircle2 className="w-3 h-3 text-orange-600" />
                        <span>موثق بالهاش</span>
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
