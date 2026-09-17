'use client';

import React from 'react';
import {
  Award,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';
import type { WorkforceEvaluationsData } from '@/lib/data-fetchers';
import { useDashboardPreferences } from '@/components/providers/dashboard-preferences-provider';

interface EvaluationKpiCardsProps {
  stats: WorkforceEvaluationsData['stats'];
}

export function EvaluationKpiCards({ stats }: EvaluationKpiCardsProps) {
  const { formatNumber } = useDashboardPreferences();

  const pctCommitted =
    stats.totalEvaluated > 0
      ? `${formatNumber(Math.round((stats.committedCount / stats.totalEvaluated) * 100))}%`
      : `${formatNumber(0)}%`;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
          <span className="text-xs font-medium">إجمالي المقيمين</span>
          <TrendingUp className="h-4 w-4 text-blue-500 dark:text-blue-400" />
        </div>
        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
          {formatNumber(stats.totalEvaluated)}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">عامل على رأس العمل</p>
      </div>

      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
          <span className="text-xs font-medium">ملتزمون (80-100)</span>
          <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
        </div>
        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
          {formatNumber(stats.committedCount)}
        </div>
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
          {pctCommitted} من الإجمالي
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
          <span className="text-xs font-medium">متوسط الالتزام (60-79)</span>
          <HelpCircle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
        </div>
        <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono">
          {formatNumber(stats.moderateCount)}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">أداء مقبول ومستقر</p>
      </div>

      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
          <span className="text-xs font-medium">قيد المتابعة (&lt;60)</span>
          <AlertTriangle className="h-4 w-4 text-rose-500 dark:text-rose-400" />
        </div>
        <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 font-mono">
          {formatNumber(stats.underReviewCount)}
        </div>
        <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">يتطلب تدخل إداري</p>
      </div>

      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs col-span-2 md:col-span-1">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
          <span className="text-xs font-medium">متوسط التقييم العام</span>
          <Award className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
        </div>
        <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 font-mono flex items-baseline gap-1">
          <span>{formatNumber(stats.averageScore)}</span>
          <span className="text-xs font-normal text-slate-400 dark:text-slate-500">/ {formatNumber(100)}</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">المعدل التشغيلي العام</p>
      </div>
    </div>
  );
}
