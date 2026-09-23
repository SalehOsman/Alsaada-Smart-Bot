'use client';

import React, { useState } from 'react';
import {
  FileCheck2,
  CheckCircle2,
  Building2,
  DollarSign,
  Printer,
  ShieldAlert,
} from 'lucide-react';
import type { ClearanceItem, DecisionItem } from '@/lib/data-fetchers';
import { ZeroStateCard } from '@/components/ui/zero-state-card';

interface ClearancesClientProps {
  initialClearances: ClearanceItem[];
  initialDecisions: DecisionItem[];
}

export function ClearancesClient({ initialClearances, initialDecisions }: ClearancesClientProps) {
  const [activeTab, setActiveTab] = useState<'CLEARANCES' | 'DECISIONS' | 'CALCULATOR'>('CLEARANCES');
  const [clearances] = useState(initialClearances);
  const [decisions, setDecisions] = useState(initialDecisions);

  // Settlement Calculator State
  const [calcWorker, setCalcWorker] = useState('');
  const [calcWorkedDays, setCalcWorkedDays] = useState(0);
  const [calcDailyWage, setCalcDailyWage] = useState(0);
  const [calcAdvances, setCalcAdvances] = useState(0);
  const [calcPenalties, setCalcPenalties] = useState(0);
  const [calcPpeDeduction, setCalcPpeDeduction] = useState(0);
  const [payoutOption, setPayoutOption] = useState<'IMMEDIATE' | 'WITH_PAYROLL'>('IMMEDIATE');

  const earnedSalary = calcWorkedDays * calcDailyWage;
  const totalDeductions = calcAdvances + calcPenalties + calcPpeDeduction;
  const netSettlement = earnedSalary - totalDeductions;

  const handleApproveDecision = (id: string) => {
    setDecisions((prev) => prev.filter((d) => d.id !== id));
  };

  const handleRejectDecision = (id: string) => {
    setDecisions((prev) => prev.filter((d) => d.id !== id));
  };

  const generateWhatsAppUrl = () => {
    const text = encodeURIComponent(
      `*سند مخالصة وتصفية مستحقات نهائي — السعادة سمارت بوت*\n` +
      `-----------------------------------------\n` +
      `العامل: ${calcWorker || 'غير محدد'}\n` +
      `أيام العمل الفعلية: ${calcWorkedDays} يوم\n` +
      `إجمالي الأجر المستحق: ${earnedSalary.toLocaleString()} ج.م\n` +
      `إجمالي الاستقطاعات (سلف وعهد): ${totalDeductions.toLocaleString()} ج.م\n` +
      `-----------------------------------------\n` +
      `*صافي المستحق النهائي: ${netSettlement.toLocaleString()} ج.م*\n` +
      `خطة الصرف: ${payoutOption === 'IMMEDIATE' ? 'صرف فوري من عهدة الموقع' : 'مع مسير الرواتب القادم'}\n` +
      `رقم السند: #CLR-2026-LIVE`
    );
    return `https://wa.me/?text=${text}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-orange-600 dark:text-orange-500" />
            <span>مركز مخالصات إنهاء الخدمة وتصفية المستحقات (Flow 01.8)</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            إدارة طلبات إخلاء الطرف الميدانية وصندوق القرارات الإدارية والبت المالي المباشر وفق بيانات المنظومة الحقيقية.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold gap-1">
          <button
            onClick={() => setActiveTab('CLEARANCES')}
            className={`px-4 py-2 rounded-lg transition-colors min-h-[44px] inline-flex items-center justify-center cursor-pointer ${
              activeTab === 'CLEARANCES'
                ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            المخالصات المعلقة ({clearances.length})
          </button>
          <button
            onClick={() => setActiveTab('DECISIONS')}
            className={`px-4 py-2 rounded-lg transition-colors min-h-[44px] inline-flex items-center justify-center cursor-pointer ${
              activeTab === 'DECISIONS'
                ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            صندوق القرارات ({decisions.length})
          </button>
          <button
            onClick={() => setActiveTab('CALCULATOR')}
            className={`px-4 py-2 rounded-lg transition-colors min-h-[44px] inline-flex items-center justify-center cursor-pointer ${
              activeTab === 'CALCULATOR'
                ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            حاسبة المخالصة والسند
          </button>
        </div>
      </div>

      {/* TAB 1: PENDING CLEARANCES */}
      {activeTab === 'CLEARANCES' && (
        <div className="space-y-4">
          {clearances.length === 0 ? (
            <ZeroStateCard
              icon={FileCheck2}
              title="لا توجد طلبات مخالصة معلقة"
              description="كافة طلبات إخلاء الطرف الميدانية تم البت فيها وتسويتها بالكامل وفق قواعد الحوكمة."
            />
          ) : (
            <>
              {/* Responsive View 1: Mobile Cards (< 768px) */}
              <div className="block md:hidden space-y-3">
                {clearances.map((c) => (
                  <div key={c.id} className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                          {c.voucherId}
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{c.workerName}</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">كود العامل: {c.workerCode}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <Building2 className="w-3.5 h-3.5" />
                        <span>{c.siteName}</span>
                        <span>•</span>
                        <span>التاريخ: {c.date}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                        <span className="text-slate-400 dark:text-slate-500 block mb-1">مدة الخدمة</span>
                        <strong className="text-slate-900 dark:text-slate-100 text-sm font-mono">{c.workedDays} يوم</strong>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                        <span className="text-slate-400 dark:text-slate-500 block mb-1">صافي المخالصة</span>
                        <strong className="text-orange-700 dark:text-orange-400 text-sm font-mono">
                          {c.netSettlementAmount.toLocaleString()} ج.م
                        </strong>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                        <span className="text-slate-400 dark:text-slate-500 block mb-1">الحالة الحالية</span>
                        <strong className="text-slate-700 dark:text-slate-300 text-sm">{c.status}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Responsive View 2: Desktop Table (>= 768px) */}
              <div className="hidden md:block bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] text-right text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold">
                      <tr>
                        <th className="py-3 px-4">رقم السند</th>
                        <th className="py-3 px-4">اسم العامل والكود</th>
                        <th className="py-3 px-4">الموقع والمشروع</th>
                        <th className="py-3 px-4">مدة الخدمة</th>
                        <th className="py-3 px-4">تاريخ السند</th>
                        <th className="py-3 px-4">صافي المخالصة</th>
                        <th className="py-3 px-4">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                      {clearances.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">{c.voucherId}</td>
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-slate-900 dark:text-slate-100">{c.workerName}</p>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">{c.workerCode}</p>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">{c.siteName}</td>
                          <td className="py-3.5 px-4 font-mono font-semibold text-slate-800 dark:text-slate-200">{c.workedDays} يوم</td>
                          <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">{c.date}</td>
                          <td className="py-3.5 px-4 font-mono font-bold text-orange-700 dark:text-orange-400">
                            {c.netSettlementAmount.toLocaleString()} ج.م
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-2.5 py-1 rounded-md border border-orange-200/60 dark:border-orange-800/50">
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: PENDING DECISIONS */}
      {activeTab === 'DECISIONS' && (
        <div className="space-y-4">
          {decisions.length === 0 ? (
            <ZeroStateCard
              icon={CheckCircle2}
              title="صندوق القرارات الإدارية خالٍ"
              description="لا توجد قرارات تأديبية أو مكافآت معلقة تنتظر اعتماد السوبر أدمن حالياً."
            />
          ) : (
            <>
              {/* Responsive View 1: Mobile Cards (< 768px) */}
              <div className="block md:hidden space-y-3">
                {decisions.map((d) => (
                  <div key={d.id} className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-md border ${
                            d.type === 'BONUS'
                              ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800/50'
                              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/50'
                          }`}
                        >
                          {d.type === 'BONUS' ? 'مكافأة مقترحة' : 'جزاء / خصم'}
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{d.workerName}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">كود: {d.workerCode}</p>
                        </div>
                      </div>
                      <span className="text-xs text-slate-400 dark:text-slate-500">{d.date}</span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-100 dark:border-slate-800 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">القيمة المقررة: {d.amountOrDays}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400">السبب: {d.reason}</p>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => handleRejectDecision(d.id)}
                        className="min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center justify-center cursor-pointer"
                      >
                        استبعاد / رفض
                      </button>
                      <button
                        onClick={() => handleApproveDecision(d.id)}
                        className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 transition-colors shadow-2xs inline-flex items-center justify-center cursor-pointer"
                      >
                        اعتماد القرار فورياً
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Responsive View 2: Desktop Table (>= 768px) */}
              <div className="hidden md:block bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] text-right text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold">
                      <tr>
                        <th className="py-3 px-4">نوع القرار</th>
                        <th className="py-3 px-4">العامل المستهدف</th>
                        <th className="py-3 px-4">القيمة المقررة</th>
                        <th className="py-3 px-4">السبب والمبرر</th>
                        <th className="py-3 px-4">التاريخ</th>
                        <th className="py-3 px-4 text-center">الإجراءات والاعتماد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                      {decisions.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-3.5 px-4">
                            <span
                              className={`text-xs font-bold px-2.5 py-1 rounded-md border ${
                                d.type === 'BONUS'
                                  ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800/50'
                                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/50'
                              }`}
                            >
                              {d.type === 'BONUS' ? 'مكافأة مقترحة' : 'جزاء / خصم'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-slate-900 dark:text-slate-100">{d.workerName}</p>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">{d.workerCode}</p>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">{d.amountOrDays}</td>
                          <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">{d.reason}</td>
                          <td className="py-3.5 px-4 text-slate-400 dark:text-slate-500 font-mono text-[11px]">{d.date}</td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleRejectDecision(d.id)}
                                className="min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center justify-center cursor-pointer"
                              >
                                استبعاد / رفض
                              </button>
                              <button
                                onClick={() => handleApproveDecision(d.id)}
                                className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 transition-colors shadow-2xs inline-flex items-center justify-center cursor-pointer"
                              >
                                اعتماد القرار فورياً
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: SETTLEMENT CALCULATOR */}
      {activeTab === 'CALCULATOR' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-orange-600 dark:text-orange-500" />
              <span>محاكاة وتصفية الحساب الميداني (حاسبة المخالصة)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">العامل المستهدف:</label>
                <input
                  type="text"
                  placeholder="أدخل اسم أو كود العامل (مثال: أحمد محمود)"
                  value={calcWorker}
                  onChange={(e) => setCalcWorker(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg p-2.5 min-h-[44px] font-medium focus:outline-hidden focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">أيام العمل الميدانية:</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={calcWorkedDays === 0 ? '' : calcWorkedDays}
                  onChange={(e) => setCalcWorkedDays(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg p-2.5 min-h-[44px] font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">أجر اليومية المعتمد (ج.م):</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={calcDailyWage === 0 ? '' : calcDailyWage}
                  onChange={(e) => setCalcDailyWage(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2.5 min-h-[44px] font-mono font-bold text-orange-700 dark:text-orange-400 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">إجمالي السلف والأقساط المستحقة (ج.م):</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={calcAdvances === 0 ? '' : calcAdvances}
                  onChange={(e) => setCalcAdvances(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2.5 min-h-[44px] font-mono font-bold text-rose-600 dark:text-rose-400 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">الجزاءات المعتمدة (ج.م):</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={calcPenalties === 0 ? '' : calcPenalties}
                  onChange={(e) => setCalcPenalties(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg p-2.5 min-h-[44px] font-mono focus:outline-hidden focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">استقطاعات تلفيات العهد / PPE (ج.م):</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={calcPpeDeduction === 0 ? '' : calcPpeDeduction}
                  onChange={(e) => setCalcPpeDeduction(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg p-2.5 min-h-[44px] font-mono focus:outline-hidden focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-2">خطة الصرف المالي:</label>
              <div className="flex flex-wrap gap-4 text-slate-700 dark:text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
                  <input
                    type="radio"
                    name="payout"
                    checked={payoutOption === 'IMMEDIATE'}
                    onChange={() => setPayoutOption('IMMEDIATE')}
                    className="accent-orange-600 w-4 h-4"
                  />
                  <span>صرف فوري وإقفال المعاملة</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
                  <input
                    type="radio"
                    name="payout"
                    checked={payoutOption === 'WITH_PAYROLL'}
                    onChange={() => setPayoutOption('WITH_PAYROLL')}
                    className="accent-orange-600 w-4 h-4"
                  />
                  <span>ترحيل للمسير المجدول</span>
                </label>
              </div>
            </div>
          </div>

          {/* Result Card */}
          <div className="bg-slate-900 text-white p-6 rounded-xl border border-slate-800 shadow-sm space-y-4 text-xs">
            <h4 className="font-bold text-sm text-white pb-2 border-b border-slate-800 flex items-center gap-2">
              <Printer className="w-4 h-4 text-orange-400" />
              <span>خلاصة السند المالي النهائي</span>
            </h4>

            <div className="space-y-2">
              <div className="flex justify-between text-slate-300">
                <span>إجمالي الأجر المستحق:</span>
                <span className="font-mono font-bold text-white">{earnedSalary.toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>إجمالي الاستقطاعات:</span>
                <span className="font-mono font-bold text-rose-400">-{totalDeductions.toLocaleString()} ج.م</span>
              </div>
              <div className="pt-3 border-t border-slate-800 flex justify-between items-baseline">
                <span className="font-bold text-sm text-white">صافي المستحق:</span>
                <span className={`font-mono text-xl font-bold ${netSettlement >= 0 ? 'text-orange-400' : 'text-rose-400'}`}>
                  {netSettlement.toLocaleString()} ج.م
                </span>
              </div>
            </div>

            {netSettlement < 0 && (
              <div className="bg-rose-950/60 p-3 rounded-lg border border-rose-800/60 text-rose-300 text-[11px] space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-rose-400">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>تنبيه مديونية سالبة</span>
                </div>
                <p>العامل مدين للمنظومة بالمبلغ المتبقي، ويخضع لقرار الإسقاط أو الإدراج بالقائمة المحظورة.</p>
              </div>
            )}

            {!calcWorker.trim() && (
              <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/60 text-slate-400 text-[11px] text-center">
                <span>يرجى إدخال اسم أو كود العامل وأيام العمل لتوليد السند المالي واعتماده.</span>
              </div>
            )}

            <div className="pt-2">
              <a
                href={calcWorker.trim() ? generateWhatsAppUrl() : undefined}
                target="_blank"
                rel="noreferrer"
                aria-disabled={!calcWorker.trim()}
                className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-colors text-xs min-h-[44px] ${
                  calcWorker.trim()
                    ? 'bg-orange-600 hover:bg-orange-700 text-white cursor-pointer'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed pointer-events-none border border-slate-700/50'
                }`}
              >
                <span>📲 إرسال السند للعامل عبر واتساب</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
