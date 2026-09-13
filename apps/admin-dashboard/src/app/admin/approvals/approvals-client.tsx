'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  CheckSquare,
  Clock,
  CheckCircle2,
  XCircle,
  Building2,
  DollarSign,
  Calendar,
  AlertCircle,
  FileCheck,
  Search,
  Filter,
  ArrowRight,
  Send,
  Loader2,
} from 'lucide-react';
import type { ApprovalsSummary, ApprovalItem } from '@/lib/data-fetchers';
import { ZeroStateCard } from '@/components/ui/zero-state-card';

interface ApprovalsClientProps {
  initialData: ApprovalsSummary;
  userRole: string;
}

export function ApprovalsClient({ initialData, userRole }: ApprovalsClientProps) {
  const canApprove = ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(userRole);
  const [items, setItems] = useState<ApprovalItem[]>(initialData.items);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filter items
  const filtered = items.filter((item) => {
    const matchesType = filterType === 'ALL' || item.type === filterType;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      item.workerName.toLowerCase().includes(query) ||
      (item.workerNickname && item.workerNickname.toLowerCase().includes(query)) ||
      (item.workerCode && item.workerCode.toLowerCase().includes(query)) ||
      item.ticketNumber.toLowerCase().includes(query) ||
      item.siteName.toLowerCase().includes(query);

    return matchesType && matchesSearch;
  });

  const counts = {
    all: items.length,
    clearance: items.filter((i) => i.type === 'CLEARANCE').length,
    advance: items.filter((i) => i.type === 'ADVANCE').length,
    leave: items.filter((i) => i.type === 'LEAVE').length,
    general: items.filter((i) => !['CLEARANCE', 'ADVANCE', 'LEAVE'].includes(i.type)).length,
  };

  const handleDecision = async (item: ApprovalItem, decision: 'APPROVED' | 'REJECTED') => {
    const actionText = decision === 'APPROVED' ? 'اعتماد' : 'رفض';
    let notes: string | undefined = undefined;

    if (decision === 'REJECTED') {
      const promptNotes = window.prompt(`يرجى كتابة سبب رفض الطلب (${item.ticketNumber}):`, '');
      if (promptNotes === null) return; // User cancelled
      notes = promptNotes.trim();
    } else {
      const confirmAction = window.confirm(`هل أنت متأكد من ${actionText} الطلب (${item.ticketNumber})؟`);
      if (!confirmAction) return;
    }

    setProcessingId(item.id);
    setFeedback(null);

    try {
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.entityId || item.id,
          type: item.type,
          decision,
          notes,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        setFeedback({
          type: 'success',
          message: `تم ${actionText} الطلب (${item.ticketNumber}) بنجاح وتسجيله في سجل التدقيق.`,
        });
      } else {
        setFeedback({
          type: 'error',
          message: data.error || `فشل ${actionText} الطلب. يرجى المحاولة لاحقاً.`,
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'حدث خطأ في الشبكة أثناء إرسال القرار.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 shrink-0">
            <CheckSquare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              مركز الاعتمادات والقرارات الفورية
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              منصة مركزية للإدارة العليا لاعتماد طلبات الإجازات، السلف، المخالصات، وتعديلات العمال بضغطة زر
            </p>
          </div>
        </div>

        <Link
          href="/admin/workforce/directory"
          className="inline-flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-700 font-semibold min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors"
        >
          <span>دليل العاملين</span>
          <ArrowRight className="w-4 h-4 rotate-180" />
        </Link>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs underline hover:no-underline cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">إجمالي المعلق</span>
            <Clock className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono">{counts.all}</p>
          <p className="text-[11px] text-slate-400 mt-1">طلبات بانتظار القرار السيادي</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">مخالصات الخدمة</span>
            <FileCheck className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-700 mt-2 font-mono">{counts.clearance}</p>
          <p className="text-[11px] text-slate-400 mt-1">تصفية مستحقات وإنهاء</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">السلف النقدية</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-700 mt-2 font-mono">{counts.advance}</p>
          <p className="text-[11px] text-slate-400 mt-1">تجاوزات وسلف ميدانية</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">الإجازات الميدانية</span>
            <Calendar className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-blue-700 mt-2 font-mono">{counts.leave}</p>
          <p className="text-[11px] text-slate-400 mt-1">نزول وعودة مواقع</p>
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'ALL', label: `الكل (${counts.all})` },
            { id: 'CLEARANCE', label: `مخالصات (${counts.clearance})` },
            { id: 'ADVANCE', label: `سلف نقدية (${counts.advance})` },
            { id: 'LEAVE', label: `إجازات (${counts.leave})` },
            { id: 'GENERAL', label: `إداري (${counts.general})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              className={`text-xs px-3 py-2 rounded-lg font-bold transition-colors whitespace-nowrap min-h-[44px] cursor-pointer ${
                filterType === tab.id
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Box */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="بحث بالعامل أو الموقع أو الكود..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pr-9 pl-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-orange-500 min-h-[44px]"
          />
        </div>
      </div>

      {/* List / Table of Pending Approvals */}
      {filtered.length === 0 ? (
        <ZeroStateCard
          title="لا توجد طلبات معلقة تتطلب الاعتماد"
          description="جميع المعاملات والطلبات الميدانية معتمدة ومحدثة في قاعدة البيانات."
          icon={CheckCircle2}
        />
      ) : (
        <>
          {/* Mobile View: Cards */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filtered.map((item) => {
              const isProcessing = processingId === item.id;

              return (
                <div
                  key={item.id}
                  className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      {item.ticketNumber}
                    </span>
                    <span className="text-[11px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                      {item.typeLabel}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-base">
                        {item.workerNickname || item.workerName}
                      </span>
                      {item.workerCode && (
                        <span className="text-xs font-mono text-slate-400">
                          (#{item.workerCode})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{item.description}</p>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{item.siteName}</span>
                    </div>
                    {item.amount !== undefined && item.amount > 0 && (
                      <span className="font-bold text-orange-700 font-mono text-sm">
                        {item.amount} ج.م
                      </span>
                    )}
                  </div>

                  <div className="pt-2">
                    {canApprove ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleDecision(item, 'APPROVED')}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-xs font-bold transition-colors min-h-[44px] flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          <span>اعتماد ✅</span>
                        </button>

                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleDecision(item, 'REJECTED')}
                          className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 py-2.5 rounded-lg text-xs font-bold transition-colors min-h-[44px] flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>رفض ❌</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs text-slate-500 font-medium">
                        قيد المراجعة الإدارية العليا
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop View: Full Responsive Table */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-3.5 px-4">رقم السند/الطلب</th>
                    <th className="py-3.5 px-4">نوع المعاملة</th>
                    <th className="py-3.5 px-4">العامل والموقع</th>
                    <th className="py-3.5 px-4">البيان والتفاصيل</th>
                    <th className="py-3.5 px-4">القيمة المالية</th>
                    <th className="py-3.5 px-4">تاريخ الطلب</th>
                    <th className="py-3.5 px-4 text-center">القرار التنفيذي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filtered.map((item) => {
                    const isProcessing = processingId === item.id;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {item.ticketNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-orange-800 bg-orange-50 px-2 py-0.5 rounded border border-orange-200/60">
                            {item.typeLabel}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">
                            {item.workerNickname || item.workerName}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            <span>{item.siteName}</span>
                            {item.workerCode && (
                              <span className="font-mono text-slate-400">
                                (#{item.workerCode})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 max-w-[280px]">
                          <p className="truncate" title={item.description}>
                            {item.description}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {item.amount !== undefined && item.amount > 0 ? (
                            <span className="text-orange-700">{item.amount} ج.م</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                          {item.requestedAt}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {canApprove ? (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleDecision(item, 'APPROVED')}
                                title="اعتماد المعاملة"
                                className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-xs transition-colors min-h-[44px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                {isProcessing ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                )}
                                <span>اعتماد ✅</span>
                              </button>

                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleDecision(item, 'REJECTED')}
                                title="رفض المعاملة"
                                className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition-colors min-h-[44px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>رفض ❌</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-500 font-mono text-[11px] bg-slate-100 px-2.5 py-1 rounded">
                              قيد المراجعة الإدارية
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
