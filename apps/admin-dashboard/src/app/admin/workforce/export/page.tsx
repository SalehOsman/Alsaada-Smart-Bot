'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet,
  Download,
  Building2,
  Filter,
  CheckCircle2,
  ArrowRight,
  FileText,
} from 'lucide-react';

export default function WorkforceExportPage() {
  const [site, setSite] = useState('ALL');
  const [status, setStatus] = useState('ACTIVE');
  const [format, setFormat] = useState<'XLSX' | 'PDF'>('XLSX');
  const [isExporting, setIsExporting] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleExport = () => {
    setIsExporting(true);
    setDownloadSuccess(false);

    const exportUrl = format === 'XLSX'
      ? `/api/export/excel?site=${site}&status=${status}`
      : `/api/export/pdf?site=${site}&status=${status}`;

    window.open(exportUrl, '_blank');
    setTimeout(() => {
      setIsExporting(false);
      setDownloadSuccess(true);
    }, 800);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/workforce/directory"
          className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
        >
          <ArrowRight className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-orange-600 dark:text-orange-500" />
            <span>تصدير كشوفات وسجلات القوى العاملة (Flow 01.4)</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            توليد كشوفات إكسيل منسقة رسمياً مطابقة لمعايير شيتات جوجل ومسيرات العمل الميدانية.
          </p>
        </div>
      </div>

      {/* Export Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-6">
        {downloadSuccess && (
          <div className="bg-orange-50 dark:bg-orange-950/40 border border-orange-300 dark:border-orange-800 text-orange-800 dark:text-orange-300 p-4 rounded-xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0" />
            <div>
              <p className="text-sm font-bold">تم تجهيز وتنزيل الملف بنجاح!</p>
              <p className="text-xs text-orange-700 dark:text-orange-400">الملف متطابق مع أعمدة الشيت المعتمدة ومحدث لحظياً.</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">نطاق الموقع الميداني</label>
            <select
              value={site}
              onChange={(e) => setSite(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-orange-500 min-h-[44px]"
            >
              <option value="ALL">كافة المواقع والمشاريع (تصدير مجمع)</option>
              <option value="مشروع العاصمة الإدارية">مشروع العاصمة الإدارية</option>
              <option value="مشروع توشكى الخير">مشروع توشكى الخير</option>
              <option value="مشروع الفرافرة للاستصلاح">مشروع الفرافرة للاستصلاح</option>
              <option value="مشروع مصنع العاشر">مشروع مصنع العاشر</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">الحالة التشغيلية للعمال المستهدفين</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-orange-500 min-h-[44px]"
            >
              <option value="ACTIVE">العمال على رأس العمل فقط (نشطون)</option>
              <option value="ALL">جميع الحالات (نشط + إجازات + موقوف + منهي خدمته)</option>
              <option value="TERMINATED">سجل العمال المنهى خدمتهم فقط</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">صيغة الملف المطلوبة</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat('XLSX')}
                className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all min-h-[44px] cursor-pointer ${
                  format === 'XLSX'
                    ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-orange-600 dark:text-orange-500" />
                <span>ملف إكسيل منسق (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('PDF')}
                className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all min-h-[44px] cursor-pointer ${
                  format === 'PDF'
                    ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <FileText className="w-4 h-4 text-orange-600 dark:text-orange-500" />
                <span>مستند طباعة رسمي (.pdf)</span>
              </button>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="w-full py-2.5 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition-colors shadow-2xs flex items-center justify-center gap-2 disabled:opacity-50 min-h-[44px] cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'جاري تجهيز وتصدير الكشف...' : 'تصدير وتنزيل الكشف المعتمد'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
