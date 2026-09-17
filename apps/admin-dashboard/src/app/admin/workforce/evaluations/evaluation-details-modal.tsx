'use client';

import React, { useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import type { WorkerEvaluationItem } from '@/lib/data-fetchers';
import { useDashboardPreferences } from '@/components/providers/dashboard-preferences-provider';

interface EvaluationDetailsModalProps {
  worker: WorkerEvaluationItem | null;
  onClose: () => void;
}

export function EvaluationDetailsModal({ worker, onClose }: EvaluationDetailsModalProps) {
  const { formatNumber } = useDashboardPreferences();

  useEffect(() => {
    if (!worker) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [worker, onClose]);

  if (!worker) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 transition-opacity"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-right transition-all"
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>{worker.tierBadge}</span>
            <span>تفاصيل تقييم: {worker.nickname}</span>
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 font-bold p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80 p-3 rounded-lg">
            <span className="text-slate-500 dark:text-slate-400">الكود والوظيفة:</span>
            <span className="font-medium text-slate-900 dark:text-slate-100 font-mono">#{worker.workerCode} — {worker.jobTitle}</span>
          </div>
          <div className="flex justify-between bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80 p-3 rounded-lg">
            <span className="text-slate-500 dark:text-slate-400">الموقع الميداني:</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">{worker.siteName}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-lg text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400">انضباط الدوام</div>
              <div className="text-base font-bold text-blue-700 dark:text-blue-300 font-mono">
                {formatNumber(worker.leaveShiftScore)} / {formatNumber(40)}
              </div>
            </div>
            <div className="p-2.5 bg-purple-50/50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 rounded-lg text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400">السجل التأديبي</div>
              <div className="text-base font-bold text-purple-700 dark:text-purple-300 font-mono">
                {formatNumber(worker.disciplinaryScore)} / {formatNumber(30)}
              </div>
            </div>
            <div className="p-2.5 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 rounded-lg text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400">مهمات السلامة</div>
              <div className="text-base font-bold text-amber-700 dark:text-amber-300 font-mono">
                {formatNumber(worker.ppeScore)} / {formatNumber(15)}
              </div>
            </div>
            <div className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 rounded-lg text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400">الجدارة المالية</div>
              <div className="text-base font-bold text-emerald-700 dark:text-emerald-300 font-mono">
                {formatNumber(worker.financialScore)} / {formatNumber(15)}
              </div>
            </div>
          </div>

          <div className="p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl space-y-1">
            <div className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4" />
              إرشادات التعافي والتحسين الموصى بها:
            </div>
            <p className="text-xs text-amber-900 dark:text-amber-200 whitespace-pre-line leading-relaxed">
              {worker.recoveryGuidance}
            </p>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition cursor-pointer min-h-[40px]"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
