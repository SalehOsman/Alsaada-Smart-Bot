'use client';

import React, { useState, useMemo } from 'react';
import {
  Award,
  Search,
  Filter,
  FileSpreadsheet,
  Building2,
  Info,
  Users,
} from 'lucide-react';
import ExcelJS from 'exceljs';
import type { WorkerEvaluationItem, WorkforceEvaluationsData } from '@/lib/data-fetchers';
import { useDashboardPreferences } from '@/components/providers/dashboard-preferences-provider';
import { ZeroStateCard } from '@/components/ui/zero-state-card';
import { EvaluationDetailsModal } from './evaluation-details-modal';
import { EvaluationKpiCards } from './evaluation-kpi-cards';

interface EvaluationsClientProps {
  initialEvaluations: WorkerEvaluationItem[];
  initialStats: WorkforceEvaluationsData['stats'];
  sites: { id: string; name: string }[];
  userRole: string;
}

export function WorkforceEvaluationsClient({
  initialEvaluations,
  initialStats,
  sites,
}: EvaluationsClientProps) {
  const { formatNumber, formatDate } = useDashboardPreferences();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSite, setSelectedSite] = useState('ALL');
  const [selectedTier, setSelectedTier] = useState('ALL');
  const [selectedWorker, setSelectedWorker] = useState<WorkerEvaluationItem | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const filteredEvaluations = initialEvaluations.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.workerCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.jobTitle.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSite = selectedSite === 'ALL' || item.siteId === selectedSite || item.siteName === selectedSite;
    const matchesTier = selectedTier === 'ALL' || item.tier === selectedTier;

    return matchesSearch && matchesSite && matchesTier;
  });

  const activeStats: WorkforceEvaluationsData['stats'] = useMemo(() => {
    if (selectedSite === 'ALL' && selectedTier === 'ALL' && !searchTerm.trim()) {
      return initialStats;
    }
    const total = filteredEvaluations.length;
    const committed = filteredEvaluations.filter((e) => e.tier === 'COMMITTED').length;
    const moderate = filteredEvaluations.filter((e) => e.tier === 'MODERATE').length;
    const underReview = filteredEvaluations.filter((e) => e.tier === 'UNDER_REVIEW').length;
    const probation = filteredEvaluations.filter((e) => e.tier === 'PROBATION').length;
    const avg =
      total > 0
        ? Math.round(filteredEvaluations.reduce((acc, curr) => acc + curr.totalScore, 0) / total)
        : 0;
    return {
      totalEvaluated: total,
      committedCount: committed,
      moderateCount: moderate,
      underReviewCount: underReview,
      probationCount: probation,
      averageScore: avg,
    };
  }, [filteredEvaluations, selectedSite, selectedTier, searchTerm, initialStats]);

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'السعادة سمارت بوت';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('مؤشر التزام العمال', {
        views: [{ rightToLeft: true, state: 'frozen', xSplit: 0, ySplit: 4 }],
      });

      const columns = [
        { header: 'م', key: 'seq', width: 6 },
        { header: 'كود العامل', key: 'code', width: 16 },
        { header: 'اسم الشهرة', key: 'nickname', width: 18 },
        { header: 'الاسم الكامل', key: 'fullName', width: 28 },
        { header: 'الموقع الميداني', key: 'site', width: 22 },
        { header: 'المسمى الوظيفي', key: 'jobTitle', width: 22 },
        { header: 'انضباط الدوام (40)', key: 'leave', width: 16 },
        { header: 'السجل التأديبي (30)', key: 'disc', width: 16 },
        { header: 'مهمات الوقاية (15)', key: 'ppe', width: 16 },
        { header: 'الانضباط المالي (15)', key: 'fin', width: 16 },
        { header: 'المجموع الكلي (100)', key: 'score', width: 18 },
        { header: 'مستوى الالتزام', key: 'tier', width: 18 },
        { header: 'إرشادات وملاحظات التحسين', key: 'guidance', width: 45 },
      ];

      sheet.mergeCells(1, 1, 1, columns.length);
      const title = sheet.getCell(1, 1);
      title.value = 'شركة السعادة للمقاولات والتعدين — كشف مؤشر التزام وموثوقية العمال';
      title.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
      title.alignment = { vertical: 'middle', horizontal: 'center' };
      sheet.getRow(1).height = 34;

      sheet.mergeCells(2, 1, 2, columns.length);
      const meta = sheet.getCell(2, 1);
      meta.value = `📅 تاريخ التصدير: ${formatDate(new Date())}   |   👥 إجمالي العمال المشمولين: ${formatNumber(filteredEvaluations.length)} عامل`;
      meta.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF2C3E50' }, bold: true };
      meta.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAECEE' } };
      meta.alignment = { vertical: 'middle', horizontal: 'center' };
      sheet.getRow(2).height = 22;

      sheet.getRow(3).height = 8;

      columns.forEach((col, idx) => {
        const cell = sheet.getCell(4, idx + 1);
        cell.value = col.header;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5597' } };
        cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        sheet.getColumn(idx + 1).width = col.width;
      });
      sheet.getRow(4).height = 26;

      filteredEvaluations.forEach((item, idx) => {
        const row = sheet.getRow(idx + 5);
        row.values = [
          idx + 1,
          item.workerCode,
          item.nickname,
          item.name,
          item.siteName,
          item.jobTitle,
          item.leaveShiftScore,
          item.disciplinaryScore,
          item.ppeScore,
          item.financialScore,
          item.totalScore,
          `${item.tierBadge} ${item.tierArabic}`,
          item.recoveryGuidance.replace(/\n/g, ' | '),
        ];
        row.height = 22;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `تقييم_والتزام_العمال_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const getTierColor = (tier: WorkerEvaluationItem['tier']) => {
    switch (tier) {
      case 'COMMITTED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60';
      case 'MODERATE':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60';
      case 'UNDER_REVIEW':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60';
      case 'PROBATION':
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1">
            <span>شؤون العاملين</span>
            <span>❭</span>
            <span className="text-slate-900 dark:text-slate-200 font-medium">⭐ مؤشر التزام وموثوقية العمال</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Award className="h-7 w-7 text-amber-500" />
            منظومة مؤشر التزام وموثوقية العمال (NEW-80)
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            متابعة دقيقة وموضوعية لانضباط العمالة الميدانية وفق السجلات التشغيلية الحقيقية (آخر 90 يوماً متدحرجة).
          </p>
        </div>

        <button
          onClick={handleExportExcel}
          disabled={isExporting || filteredEvaluations.length === 0}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition shadow-sm disabled:opacity-50 cursor-pointer min-h-[44px]"
        >
          <FileSpreadsheet className="h-4 w-4" />
          {isExporting ? 'جاري التصدير...' : 'تصدير إكسيل RTL'}
        </button>
      </div>

      {/* KPI Cards */}
      <EvaluationKpiCards stats={activeStats} />

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="بحث بالاسم أو الكود أو المسمى..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-3 pr-9 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-orange-500 focus:border-orange-500 min-h-[44px]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <Building2 className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-orange-500 focus:border-orange-500 min-h-[44px] cursor-pointer"
            >
              <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">كافة المواقع</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <Filter className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-orange-500 focus:border-orange-500 min-h-[44px] cursor-pointer"
            >
              <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">كافة المستويات</option>
              <option value="COMMITTED" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">🟢 ملتزم (80-100)</option>
              <option value="MODERATE" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">🟡 متوسط (60-79)</option>
              <option value="UNDER_REVIEW" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">🔴 قيد المتابعة (&lt;60)</option>
              <option value="PROBATION" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">⚪ حديث تعيين / تجربة</option>
            </select>
          </div>
        </div>
      </div>

      {/* Data Table */}
      {filteredEvaluations.length === 0 ? (
        <ZeroStateCard
          icon={Users}
          title="لا توجد سجلات تقييم مطابقة"
          description="لم يتم العثور على أي عمال مطابقين لمعايير البحث أو التصفية الحالية."
          onResetFilter={() => {
            setSearchTerm('');
            setSelectedSite('ALL');
            setSelectedTier('ALL');
          }}
        />
      ) : (
        <>
          {/* Responsive View 1: Mobile Cards (< 768px) */}
          <div className="block md:hidden space-y-3">
            {filteredEvaluations.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {item.nickname}
                    </span>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{item.name}</div>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                    #{item.workerCode}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    <span>{item.siteName}</span>
                  </div>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{item.jobTitle}</span>
                </div>

                {/* Sub-scores grid */}
                <div className="grid grid-cols-4 gap-1.5 py-1 text-center text-xs">
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded border border-slate-100 dark:border-slate-800">
                    <span className="block text-[10px] text-slate-500 dark:text-slate-400">دوام</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{formatNumber(item.leaveShiftScore)}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded border border-slate-100 dark:border-slate-800">
                    <span className="block text-[10px] text-slate-500 dark:text-slate-400">تأديبي</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{formatNumber(item.disciplinaryScore)}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded border border-slate-100 dark:border-slate-800">
                    <span className="block text-[10px] text-slate-500 dark:text-slate-400">وقاية</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{formatNumber(item.ppeScore)}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded border border-slate-100 dark:border-slate-800">
                    <span className="block text-[10px] text-slate-500 dark:text-slate-400">مالي</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{formatNumber(item.financialScore)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono">{formatNumber(item.totalScore)}</span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">/ {formatNumber(100)}</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getTierColor(
                        item.tier
                      )}`}
                    >
                      <span>{item.tierBadge}</span>
                      <span>{item.tierArabic}</span>
                    </span>
                  </div>

                  <button
                    onClick={() => setSelectedWorker(item)}
                    className="p-2 rounded-lg text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors min-h-[40px] inline-flex items-center gap-1 text-xs font-medium cursor-pointer border border-orange-200/50 dark:border-orange-800/40"
                  >
                    <Info className="h-3.5 w-3.5" />
                    <span>التفاصيل</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Responsive View 2: Desktop Data Table (>= 768px) */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-right text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4">كود العامل</th>
                    <th className="py-3 px-4">اسم العامل</th>
                    <th className="py-3 px-4">الموقع</th>
                    <th className="py-3 px-4">المسمى الوظيفي</th>
                    <th className="py-3 px-3 text-center">دوام (40)</th>
                    <th className="py-3 px-3 text-center">تأديبي (30)</th>
                    <th className="py-3 px-3 text-center">وقاية (15)</th>
                    <th className="py-3 px-3 text-center">مالي (15)</th>
                    <th className="py-3 px-4 text-center">المجموع (100)</th>
                    <th className="py-3 px-4 text-center">مستوى الالتزام</th>
                    <th className="py-3 px-4 text-center">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredEvaluations.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-slate-100">#{item.workerCode}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{item.nickname}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{item.name}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{item.siteName}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{item.jobTitle}</td>
                      <td className="py-3 px-3 text-center font-medium text-slate-700 dark:text-slate-300">{formatNumber(item.leaveShiftScore)}</td>
                      <td className="py-3 px-3 text-center font-medium text-slate-700 dark:text-slate-300">{formatNumber(item.disciplinaryScore)}</td>
                      <td className="py-3 px-3 text-center font-medium text-slate-700 dark:text-slate-300">{formatNumber(item.ppeScore)}</td>
                      <td className="py-3 px-3 text-center font-medium text-slate-700 dark:text-slate-300">{formatNumber(item.financialScore)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-base font-bold text-slate-900 dark:text-slate-100">{formatNumber(item.totalScore)}</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">/{formatNumber(100)}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${getTierColor(
                            item.tier
                          )}`}
                        >
                          <span>{item.tierBadge}</span>
                          <span>{item.tierArabic}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedWorker(item)}
                          className="text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 text-xs font-medium inline-flex items-center gap-1 min-h-[36px] px-2.5 py-1 rounded-lg bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors cursor-pointer border border-orange-200/50 dark:border-orange-800/40"
                        >
                          <Info className="h-3.5 w-3.5" />
                          التفاصيل
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Details Modal */}
      <EvaluationDetailsModal
        worker={selectedWorker}
        onClose={() => setSelectedWorker(null)}
      />
    </div>
  );
}
