'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Wallet,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Building2,
  User,
  Phone,
  Calendar,
  DollarSign,
  Search,
  Filter,
  ArrowRight,
  Receipt,
  MessageSquareShare,
} from 'lucide-react';
import type { TreasuryDashboardData, CustodyMonitorItem } from '@/lib/data-fetchers';
import { ZeroStateCard } from '@/components/ui/zero-state-card';

interface TreasuryClientProps {
  initialData: TreasuryDashboardData;
  userRole: string;
}

export function TreasuryClient({ initialData, userRole }: TreasuryClientProps) {
  const [custodies] = useState<CustodyMonitorItem[]>(initialData.custodies);
  const [filterHealth, setFilterHealth] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filtered = custodies.filter((c) => {
    const matchesHealth = filterHealth === 'ALL' || c.liquidityHealth === filterHealth;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      c.custodyNumber.toLowerCase().includes(q) ||
      c.siteName.toLowerCase().includes(q) ||
      c.siteCode.toLowerCase().includes(q) ||
      c.custodianName.toLowerCase().includes(q) ||
      c.purpose.toLowerCase().includes(q);

    return matchesHealth && matchesSearch;
  });

  const counts = {
    all: custodies.length,
    healthy: custodies.filter((c) => c.liquidityHealth === 'HEALTHY').length,
    warning: custodies.filter((c) => c.liquidityHealth === 'WARNING').length,
    critical: custodies.filter((c) => c.liquidityHealth === 'CRITICAL').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              الخزائن ومرصد السيولة والعهد الميدانية
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              مراقبة لحظية لأرصدة العهد المفتوحة في المشاريع ومؤشرات كفاية التدفق النقدي وصمامات الأمان
            </p>
          </div>
        </div>

        <Link
          href="/admin/settings/sites"
          className="inline-flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-700 font-semibold min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors"
        >
          <span>المواقع والمشاريع</span>
          <ArrowRight className="w-4 h-4 rotate-180" />
        </Link>
      </div>

      {/* Critical Liquidity Warning Banner (If Any) */}
      {initialData.criticalCustodiesCount > 0 && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-center gap-3 text-rose-800">
          <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 animate-bounce" />
          <div>
            <h4 className="font-bold text-sm">
              تنبيه سيادي عاجل: توجد ({initialData.criticalCustodiesCount}) عهدة ميدانية في مرحلة حرجة (&lt; 10% سيولة)!
            </h4>
            <p className="text-xs text-rose-700 mt-0.5">
              يرجى تغذية العهد الميدانية فورياً لمنع تعطل مصاريف التشغيل والسلف الطارئة في المواقع.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">إجمالي العهد النشطة</span>
            <Wallet className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {initialData.totalActiveCustodies}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">عهدة ميدانية تحت الإشراف</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">رأس مال العهد</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {initialData.totalInitialCapital.toLocaleString()} ج.م
          </p>
          <p className="text-[11px] text-slate-400 mt-1">إجمالي المبالغ المنصرفة</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">السيولة المتبقية الحالية</span>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-black text-green-700 mt-2 font-mono">
            {initialData.totalRemainingLiquidity.toLocaleString()} ج.م
          </p>
          <p className="text-[11px] text-slate-400 mt-1">كاش فعلي متاح بالمواقع</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">المصروفات المسواة</span>
            <TrendingDown className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-700 mt-2 font-mono">
            {initialData.totalLiquidatedExpenses.toLocaleString()} ج.م
          </p>
          <p className="text-[11px] text-slate-400 mt-1">فواتير وسندات معتمدة</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        {/* Health Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'ALL', label: `كافة العهد (${counts.all})` },
            { id: 'HEALTHY', label: `آمنة > 25% (${counts.healthy})` },
            { id: 'WARNING', label: `تحذيرية 10-25% (${counts.warning})` },
            { id: 'CRITICAL', label: `حرجة < 10% (${counts.critical})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterHealth(tab.id)}
              className={`text-xs px-3 py-2 rounded-lg font-bold transition-colors whitespace-nowrap min-h-[44px] cursor-pointer ${
                filterHealth === tab.id
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="بحث برقم العهدة أو الموقع أو المسؤول..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pr-9 pl-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-orange-500 min-h-[44px]"
          />
        </div>
      </div>

      {/* Custodies Cards / Table */}
      {filtered.length === 0 ? (
        <ZeroStateCard
          title="لا توجد سجلات عهد مطابقة"
          description="لم يتم العثور على أي عهد مالية تطابق معايير التصفية والبحث الحالية."
          icon={Wallet}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((c) => {
            const isCritical = c.liquidityHealth === 'CRITICAL';
            const isWarning = c.liquidityHealth === 'WARNING';
            const whatsappUrl = `https://wa.me/2${c.custodianPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
              `مرحباً بك يا أ/ ${c.custodianName}\n` +
              `بخصوص العهدة الميدانية رقم (${c.custodyNumber}) لموقع ${c.siteName}\n` +
              `الرصيد المتبقي الحالي: ${c.currentBalance.toLocaleString()} ج.م من أصل ${c.initialAmount.toLocaleString()} ج.م (${c.percentageRemaining}%)\n` +
              `يرجى مراجعة وتصفية الفواتير والمصروفات لتغذية العهدة فورياً.`
            )}`;

            return (
              <div
                key={c.id}
                className={`bg-white rounded-xl border p-5 shadow-2xs space-y-4 transition-all ${
                  isCritical
                    ? 'border-rose-300 ring-1 ring-rose-200'
                    : isWarning
                    ? 'border-amber-300'
                    : 'border-slate-200'
                }`}
              >
                {/* Top Badge & Number */}
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                    {c.custodyNumber}
                  </span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                      isCritical
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : isWarning
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-green-50 text-green-700 border-green-200'
                    }`}
                  >
                    {isCritical ? '⚠️ حرجة للغاية' : isWarning ? '⚡ منخفضة' : '✅ آمنة ومستقرة'}
                  </span>
                </div>

                {/* Site & Custodian Info */}
                <div>
                  <div className="flex items-center gap-1.5 text-slate-800 font-bold text-sm">
                    <Building2 className="w-4 h-4 text-orange-600 shrink-0" />
                    <span>{c.siteName}</span>
                    <span className="text-xs font-mono text-slate-400">({c.siteCode})</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>المسؤول: {c.custodianName}</span>
                  </div>
                </div>

                {/* Balance & Progress Bar */}
                <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">السيولة المتبقية:</span>
                    <span className="font-mono font-black text-slate-900 text-sm">
                      {c.currentBalance.toLocaleString()} ج.م
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>من أصل {c.initialAmount.toLocaleString()} ج.م</span>
                    <span className="font-mono font-bold">{c.percentageRemaining}%</span>
                  </div>

                  {/* Visual Gauge Bar */}
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isCritical
                          ? 'bg-rose-500'
                          : isWarning
                          ? 'bg-amber-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, c.percentageRemaining))}%` }}
                    />
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                  <div>
                    <span className="text-slate-400 block">المصروفات المسواة:</span>
                    <span className="font-mono font-bold text-amber-700">
                      {c.totalExpenses.toLocaleString()} ج.م
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">السلف المصروفة:</span>
                    <span className="font-mono font-bold text-blue-700">
                      {c.totalAdvancesDisbursed.toLocaleString()} ج.م
                    </span>
                  </div>
                </div>

                {/* Recent Expense Items Preview */}
                {c.recentExpenses.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      آخر سندات صرف مسجلة:
                    </span>
                    <div className="space-y-1">
                      {c.recentExpenses.slice(0, 2).map((exp) => (
                        <div
                          key={exp.id}
                          className="flex items-center justify-between text-[11px] text-slate-600 bg-white p-1.5 rounded border border-slate-100"
                        >
                          <span className="truncate max-w-[150px]">{exp.description}</span>
                          <span className="font-mono font-bold text-slate-800">
                            {exp.amount} ج.م
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Bar */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400 font-mono">
                    تاريخ الصرف: {c.disbursedAt}
                  </span>

                  {c.custodianPhone && c.custodianPhone !== 'غير مسجل' && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-green-700 hover:text-green-800 bg-green-50 hover:bg-green-100 px-3 py-2 rounded-lg font-bold transition-colors min-h-[44px] min-w-[44px] justify-center"
                    >
                      <MessageSquareShare className="w-3.5 h-3.5" />
                      <span>مراسلة المسؤول</span>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
