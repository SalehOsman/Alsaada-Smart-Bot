'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  Filter,
  UserPlus,
  FileSpreadsheet,
  Building2,
  Eye,
  DoorOpen,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  MessageSquareShare,
  Pencil,
} from 'lucide-react';
import type { WorkforceDirectoryItem } from '@/lib/data-fetchers';
import { ZeroStateCard } from '@/components/ui/zero-state-card';

interface DirectoryClientProps {
  initialWorkers: WorkforceDirectoryItem[];
  sites: string[];
  canViewFinances: boolean;
}

export function WorkforceDirectoryClient({
  initialWorkers,
  sites,
  canViewFinances,
}: DirectoryClientProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSite, setSelectedSite] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  const filteredWorkers = initialWorkers.filter((w) => {
    const matchesSearch =
      w.nickname.includes(searchTerm) ||
      w.fullName.includes(searchTerm) ||
      w.code.includes(searchTerm) ||
      w.phone.includes(searchTerm);
    const matchesSite = selectedSite === 'ALL' || w.siteName === selectedSite;
    const matchesStatus = selectedStatus === 'ALL' || w.status === selectedStatus;
    return matchesSearch && matchesSite && matchesStatus;
  });

  const getStatusBadge = (status: WorkforceDirectoryItem['status']) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-900/60">
            <CheckCircle2 className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
            <span>على رأس العمل</span>
          </span>
        );
      case 'ON_LEAVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60">
            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>في إجازة رسمية</span>
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span>موقوف مؤقتاً</span>
          </span>
        );
      case 'TERMINATED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
            <XCircle className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>منهي خدمته (مخالصة)</span>
          </span>
        );
      case 'BLACKLISTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800">
            <XCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            <span>قائمة محظورة</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <span>دليل العاملين وسجلات القوى العاملة الحية</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            بيانات حية مباشرة من قاعدة بيانات النظام مع ظهور اسم الشهرة وفق المعيار الدستوري للمنظومة.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/workforce/export"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs min-h-[44px]"
          >
            <FileSpreadsheet className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            <span>تصدير إكسيل</span>
          </Link>
          <Link
            href="/admin/workforce/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 transition-colors shadow-2xs min-h-[44px]"
          >
            <UserPlus className="w-4 h-4" />
            <span>تعيين عامل جديد</span>
          </Link>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="بحث باسم الشهرة، الاسم الرباعي، كود العامل، أو الهاتف..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-9 pl-4 py-2.5 min-h-[44px] text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 shrink-0">
            <Filter className="w-3.5 h-3.5" />
            <span>تصفية:</span>
          </div>

          <select
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
            className="text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 min-h-[44px] text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-orange-500 flex-1 sm:flex-initial cursor-pointer"
          >
            <option value="ALL">جميع المواقع والمشاريع</option>
            {sites.map((site) => (
              <option key={site} value={site}>
                {site}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 min-h-[44px] text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-orange-500 flex-1 sm:flex-initial cursor-pointer"
          >
            <option value="ALL">جميع الحالات التشغيلية</option>
            <option value="ACTIVE">على رأس العمل</option>
            <option value="ON_LEAVE">في إجازة</option>
            <option value="SUSPENDED">موقوف</option>
            <option value="TERMINATED">منهي خدمته</option>
            <option value="BLACKLISTED">محظور</option>
          </select>
        </div>
      </div>

      {/* Main Content: ZeroStateCard or Responsive Views */}
      {filteredWorkers.length === 0 ? (
        <ZeroStateCard
          icon={Users}
          title="لا توجد سجلات عمال مطابقة"
          description="لم يتم العثور على أي عمال مطابقين لمعايير البحث والفلترة المحددة."
          onResetFilter={() => {
            setSearchTerm('');
            setSelectedSite('ALL');
            setSelectedStatus('ALL');
          }}
        />
      ) : (
        <>
          {/* Responsive View 1: Mobile Cards (< 768px) */}
          <div className="block md:hidden space-y-3">
            {filteredWorkers.map((worker) => {
              const whatsappUrl = `https://wa.me/2${worker.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                `مرحباً بك يا ${worker.nickname} (#${worker.code})\n` +
                `شركة السعادة للمقاولات\n` +
                `الموقع: ${worker.siteName} | المهنة: ${worker.jobTitle}\n` +
                (worker.totalMonthlySalary ? `الراتب الشهري المعتمد: ${worker.totalMonthlySalary} ج.م\n` : '') +
                `الحالة الإدارية: ${worker.status === 'ACTIVE' ? 'نشط على رأس العمل' : worker.status}`
              )}`;

              return (
                <div
                  key={worker.id}
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-slate-100 bg-orange-50 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 px-2.5 py-1 rounded-md border border-orange-200 dark:border-orange-900/60 text-sm">
                      {worker.nickname}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-400">{worker.code}</span>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{worker.fullName}</p>
                    <div className="flex flex-col gap-1 text-[11px] text-slate-600 dark:text-slate-400 mt-1.5 bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-800 font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 dark:text-slate-400 font-sans font-semibold">🪪 الرقم القومي:</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                          {worker.nationalIdFull || worker.nationalIdMasked}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 dark:text-slate-400 font-sans font-semibold">📱 الهاتف:</span>
                        <span>{worker.phone}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{worker.siteName}</span>
                    </div>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{worker.jobTitle}</span>
                  </div>

                  <div className="flex flex-col gap-1 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">الحالة الوظيفية:</span>
                      <div>{getStatusBadge(worker.status)}</div>
                    </div>
                    {canViewFinances && worker.totalMonthlySalary !== undefined && (
                      <div className="bg-orange-50/70 dark:bg-orange-950/40 p-2 rounded-lg border border-orange-200/60 dark:border-orange-900/50 mt-1 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-600 dark:text-slate-400">الراتب الأساسي:</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{worker.basicSalary || 0} ج.م</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-600 dark:text-slate-400">البدلات والإضافي:</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{worker.fixedAllowances || 0} ج.م</span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-orange-200/60 dark:border-orange-900/50">
                          <span className="font-bold text-orange-950 dark:text-orange-200">إجمالي الراتب الشهري:</span>
                          <span className="font-mono font-bold text-orange-700 dark:text-orange-400">{worker.totalMonthlySalary} ج.م / شهر</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {worker.phone && worker.phone !== 'غير مسجل' && worker.phone !== '***' && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/50 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1 text-xs font-semibold"
                        title="إرسال إشعار عبر واتساب"
                      >
                        <MessageSquareShare className="w-4 h-4" />
                        <span>واتساب</span>
                      </a>
                    )}
                    <Link
                      href={'/admin/workforce/directory?view=' + worker.id}
                      className="p-2 rounded-lg text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1 text-xs font-medium"
                    >
                      <Eye className="w-4 h-4" />
                      <span>عرض</span>
                    </Link>
                    <Link
                      href="/admin/workforce/clearances"
                      className="p-2 rounded-lg text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1 text-xs font-medium"
                    >
                      <DoorOpen className="w-4 h-4" />
                      <span>مخالصة</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Responsive View 2: Desktop Data Table (>= 768px) */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                  <tr>
                    <th className="py-3 px-4">كود العامل</th>
                    <th className="py-3 px-4">اسم الشهرة (معتمد)</th>
                    <th className="py-3 px-4">الاسم الرباعي والرقم القومي</th>
                    <th className="py-3 px-4">الموقع والمشروع</th>
                    <th className="py-3 px-4">المهنة والراتب الشهري</th>
                    <th className="py-3 px-4">التيليجرام</th>
                    <th className="py-3 px-4">الحالة</th>
                    <th className="py-3 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {filteredWorkers.map((worker) => {
                    const whatsappUrl = `https://wa.me/2${worker.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                      `مرحباً بك يا ${worker.nickname} (#${worker.code})\n` +
                      `شركة السعادة للمقاولات\n` +
                      `الموقع: ${worker.siteName} | المهنة: ${worker.jobTitle}\n` +
                      (worker.totalMonthlySalary ? `الراتب الشهري المعتمد: ${worker.totalMonthlySalary} ج.م\n` : '') +
                      `الحالة الإدارية: ${worker.status === 'ACTIVE' ? 'نشط على رأس العمل' : worker.status}`
                    )}`;

                    return (
                      <tr key={worker.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">{worker.code}</td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 dark:text-slate-100 bg-orange-50 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 px-2 py-0.5 rounded-md border border-orange-200/60 dark:border-orange-900/60">
                            {worker.nickname}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-medium text-slate-900 dark:text-slate-100">{worker.fullName}</p>
                          <div className="flex items-center gap-1.5 text-[11px] font-mono mt-1">
                            <span className="text-slate-500 dark:text-slate-400 font-sans text-[10px]">🪪 الرقم القومي:</span>
                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-1.5 py-0.5 rounded font-bold">
                              {worker.nationalIdFull || worker.nationalIdMasked}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{worker.siteName}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-medium text-slate-900 dark:text-slate-100">{worker.jobTitle}</p>
                          {canViewFinances && worker.totalMonthlySalary !== undefined && (
                            <div className="mt-1 text-[11px] space-y-0.5">
                              <div className="font-bold text-orange-700 dark:text-orange-400 font-mono">
                                {worker.totalMonthlySalary} ج.م / شهر
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                (أساسي: {worker.basicSalary || 0} + بدلات: {worker.fixedAllowances || 0})
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {worker.telegramStatus === 'LINKED' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-orange-600 dark:text-orange-400 font-medium">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>مرتبط</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                              <span>غير مرتبط</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">{getStatusBadge(worker.status)}</td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            {worker.phone && worker.phone !== 'غير مسجل' && worker.phone !== '***' && (
                              <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="إرسال إشعار عبر واتساب"
                                className="p-2 rounded-md text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/50 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                              >
                                <MessageSquareShare className="w-4 h-4" />
                              </a>
                            )}
                            <Link
                              href={'/admin/workforce/directory?view=' + worker.id}
                              title="عرض البطاقة التفصيلية"
                              className="p-2 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            <Link
                              href={'/admin/workforce/' + worker.id + '/edit'}
                              title="تعديل ملف العامل (Flow 01.2.D)"
                              className="p-2 rounded-md text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/50 hover:text-orange-800 dark:hover:text-orange-300 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                            >
                              <Pencil className="w-4 h-4" />
                            </Link>
                            <Link
                              href="/admin/workforce/clearances"
                              title="إنهاء خدمة ومخالصة"
                              className="p-2 rounded-md text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-700 dark:hover:text-rose-300 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                            >
                              <DoorOpen className="w-4 h-4" />
                            </Link>
                          </div>
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
