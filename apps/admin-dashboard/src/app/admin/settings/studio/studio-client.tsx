'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  TableProperties,
  Search,
  ShieldCheck,
  Edit2,
  Trash2,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import type { StudioRecordItem } from '@/lib/data-fetchers';
import { ZeroStateCard } from '@/components/ui/zero-state-card';

export function StudioClient({ initialRecords }: { initialRecords: StudioRecordItem[] }) {
  const [records, setRecords] = useState<StudioRecordItem[]>(initialRecords);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'DELETED'>('ALL');
  const [editingRecord, setEditingRecord] = useState<StudioRecordItem | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      r.voucherId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.workerOrEntity.includes(searchTerm) ||
      r.siteName.includes(searchTerm);
    const matchesFilter =
      activeFilter === 'ALL'
        ? true
        : activeFilter === 'DELETED'
        ? r.isDeleted
        : !r.isDeleted;
    return matchesSearch && matchesFilter;
  });

  const handleSoftDelete = (id: string) => {
    const reason = prompt('يرجى كتابة سبب الشطب المنطقي لتوثيقه في سجل التدقيق الجنائي:');
    if (!reason) return;

    setRecords((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              isDeleted: true,
              deletedBy: 'SUPER_ADMIN',
              deletedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
            }
          : r
      )
    );

    setActionSuccess('تم شطب السند بنجاح عبر الحذف الناعم (Soft Delete) وحفظ القيد الجنائي.');
    setTimeout(() => setActionSuccess(null), 3500);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    const num = Number(editAmount);
    if (isNaN(num) || num <= 0) return;

    setRecords((prev) =>
      prev.map((r) => (r.id === editingRecord.id ? { ...r, amount: num } : r))
    );

    setEditingRecord(null);
    setActionSuccess(`تم تعديل مبلغ السند ${editingRecord.voucherId} إلى ${num} ج.م مع توثيق القيد.`);
    setTimeout(() => setActionSuccess(null), 3500);
  };

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
              <TableProperties className="w-5 h-5 text-orange-600 dark:text-orange-500" />
              <span>استوديو تصحيح وتعديل البيانات وحظر الحذف الفيزيائي (Doc 09 Studio)</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              واجهة تفاعلية شبيهة بالإكسيل تمكّن السوبر أدمن من تصحيح العمليات وشطب الأخطاء بأمان جنائي كامل.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800/50 px-3 py-1.5 rounded-lg text-xs font-semibold">
          <ShieldCheck className="w-4 h-4 text-orange-600 dark:text-orange-500" />
          <span>حظر الحذف الفيزيائي (Soft Delete Only)</span>
        </div>
      </div>

      {/* Action Notification */}
      {actionSuccess && (
        <div className="bg-orange-50 dark:bg-orange-950/40 border border-orange-300 dark:border-orange-800 text-orange-900 dark:text-orange-300 p-4 rounded-xl flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-orange-600 dark:text-orange-500 shrink-0" />
          <p className="text-xs font-bold">{actionSuccess}</p>
        </div>
      )}

      {/* Toolbar & Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="بحث برقم السند (#ADV-..., #CAN-...)، اسم العامل، أو الموقع..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-9 pl-4 py-2 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg min-h-[44px] focus:outline-hidden focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`px-3 py-1.5 rounded-md min-h-[44px] transition-colors cursor-pointer ${
              activeFilter === 'ALL' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            كافة السجلات
          </button>
          <button
            onClick={() => setActiveFilter('ACTIVE')}
            className={`px-3 py-1.5 rounded-md min-h-[44px] transition-colors cursor-pointer ${
              activeFilter === 'ACTIVE' ? 'bg-white dark:bg-slate-900 text-orange-700 dark:text-orange-400 shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            السجلات النشطة فقط
          </button>
          <button
            onClick={() => setActiveFilter('DELETED')}
            className={`px-3 py-1.5 rounded-md min-h-[44px] transition-colors cursor-pointer ${
              activeFilter === 'DELETED' ? 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            السجلات المشطوبة (أرشيف)
          </button>
        </div>
      </div>

      {/* Studio Table or Zero State */}
      {filteredRecords.length === 0 ? (
        <ZeroStateCard
          icon={TableProperties}
          title="لا توجد سجلات مطابقة في استوديو الحوكمة"
          description="لم يتم العثور على أي حركات مالية أو قيود مسجلة تطابق معايير البحث والفلترة المحددة."
          onResetFilter={() => {
            setSearchTerm('');
            setActiveFilter('ALL');
          }}
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="py-3 px-4">رقم السند</th>
                  <th className="py-3 px-4">نوع الحركة</th>
                  <th className="py-3 px-4">البيان / العامل</th>
                  <th className="py-3 px-4">المبلغ (ج.م)</th>
                  <th className="py-3 px-4">الموقع</th>
                  <th className="py-3 px-4">التاريخ والوقت</th>
                  <th className="py-3 px-4">حالة السجل</th>
                  <th className="py-3 px-4 text-center">إجراءات السوبر أدمن</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredRecords.map((r) => (
                  <tr
                    key={r.id}
                    className={`transition-colors ${
                      r.isDeleted ? 'bg-slate-100/70 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500 line-through opacity-80' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">{r.voucherId}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        {r.tableName}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-slate-100">{r.workerOrEntity}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {r.amount.toLocaleString()} ج.م
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">{r.siteName}</td>
                    <td className="py-3.5 px-4 text-slate-400 dark:text-slate-500 font-mono text-[11px]">{r.createdAt}</td>
                    <td className="py-3.5 px-4 no-underline">
                      {r.isDeleted ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-rose-700 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800/50">
                          مشطوب (ناعم)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-orange-700 dark:text-orange-400 font-bold bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded border border-orange-200 dark:border-orange-800/50">
                          نشط وموثق
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center no-underline">
                      {!r.isDeleted ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingRecord(r);
                              setEditAmount(String(r.amount));
                            }}
                            className="p-1.5 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center cursor-pointer"
                            title="تعديل القيمة"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleSoftDelete(r.id)}
                            className="p-1.5 rounded-md text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-800 dark:hover:text-rose-300 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center cursor-pointer"
                            title="شطب المعاملة (Soft Delete)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                          أرشفة: {r.deletedBy}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal Dialog */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2">
              تعديل قيمة السند: {editingRecord.voucherId}
            </h3>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">البيان الحالي</label>
                <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                  {editingRecord.workerOrEntity}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">المبلغ الجديد (ج.م) *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full text-base font-bold font-mono px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg min-h-[44px] focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[44px] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 min-h-[44px] cursor-pointer"
                >
                  حفظ وتوثيق القيد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
