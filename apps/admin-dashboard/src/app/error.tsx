'use client';

import React, { useEffect } from 'react';
import { deriveIncidentCode } from '@alsaada/telemetry';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import Link from 'next/link';

/**
 * Route Error Boundary (Next.js App Router SSOT)
 * Catches route-level rendering and data-fetching exceptions within admin pages.
 * Displays a styled Arabic alert with an incident code derived from @alsaada/telemetry
 * and an actionable reset retry button.
 * Compliance: Plan 19 Section 1.3 & Milestone 2 Scope
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log route errors for observability
    console.error('[Admin Dashboard Route Error]', error);
  }, [error]);

  const traceSource =
    error?.digest ||
    (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : error?.message || 'ROUTE00000');
  const incidentCode = deriveIncidentCode(traceSource);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-600 dark:text-orange-500">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            عطل غير متوقع في لوحة التحكم
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            تعذر إتمام طلبك الحالي بسبب خطأ تشغيلي غير متوقع. تم رصد الواقعة وحفظ تفاصيلها لفرق الدعم الفني.
          </p>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">رمز البلاغ المرجعي الموحد</span>
          <div
            className="text-lg font-mono font-bold text-orange-600 dark:text-orange-400 tracking-wider select-all"
            data-testid="incident-code"
          >
            {incidentCode}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-orange-600/25 cursor-pointer"
            data-testid="retry-button"
          >
            <RotateCcw className="w-4 h-4" />
            إعادة المحاولة
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-colors border border-slate-200 dark:border-slate-700"
          >
            <Home className="w-4 h-4" />
            الرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
