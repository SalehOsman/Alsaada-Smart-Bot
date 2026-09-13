'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  Search,
  Plus,
  ArrowRight,
  DollarSign,
  Users,
} from 'lucide-react';
import type { JobMatrixItem } from '@/lib/data-fetchers';
import { ZeroStateCard } from '@/components/ui/zero-state-card';

export function JobsClient({ initialJobs }: { initialJobs: JobMatrixItem[] }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredJobs = initialJobs.filter(
    (j) => j.title.includes(searchTerm) || j.code.includes(searchTerm) || j.category.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/settings"
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
          >
            <ArrowRight className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-orange-600" />
              <span>مصفوفة الوظائف والأجور الميدانية (Flow 00.3)</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              إدارة وتوصيف المسميات المهنية والحدود الاسترشادية للرواتب من واقع قاعدة بيانات المنظومة الحقيقية.
            </p>
          </div>
        </div>

        <button
          onClick={() => alert('إضافة وتعديل الرتب متاح حصراً للسوبر أدمن المعتمد.')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 transition-colors shadow-2xs min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة مسمى مهني جديد</span>
        </button>
      </div>

      {/* Search Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="بحث بالمسمى المهني، الكود، أو الإدارة التابعة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-9 pl-4 py-2.5 min-h-[44px] text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>
      </div>

      {/* Main Content: ZeroStateCard or Responsive Views */}
      {filteredJobs.length === 0 ? (
        <ZeroStateCard
          icon={Briefcase}
          title="لا توجد مسميات مهنية مطابقة"
          description="لم يتم العثور على مسميات وظيفية مطابقة لمعايير البحث."
          onResetFilter={() => setSearchTerm('')}
        />
      ) : (
        <>
          {/* Responsive View 1: Mobile Cards (< 768px) */}
          <div className="block md:hidden space-y-3">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{job.title}</span>
                  <span className="font-mono text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                    {job.code}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>القطاع: {job.category}</span>
                  <span className="flex items-center gap-1 font-semibold text-slate-700">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    {job.workersCount} عامل
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <span className="text-slate-500">الراتب الأساسي المعتمد:</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {job.defaultDailyWage.toLocaleString()} ج.م
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Responsive View 2: Desktop Table (>= 768px) */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-3 px-4">كود المهنة</th>
                    <th className="py-3 px-4">المسمى الوظيفي والمهني</th>
                    <th className="py-3 px-4">القطاع / الإدارة</th>
                    <th className="py-3 px-4">الراتب الأساسي الشهري</th>
                    <th className="py-3 px-4">الأجر الاسترشادي</th>
                    <th className="py-3 px-4 text-center">العمالة المسجلة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-orange-600">{job.code}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{job.title}</td>
                      <td className="py-3 px-4">
                        <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-[11px] font-medium">
                          {job.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                        {job.defaultDailyWage.toLocaleString()} ج.م
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono">
                        {job.minDailyWage.toLocaleString()} ج.م
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800">
                        {job.workersCount} عامل
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
  );
}
