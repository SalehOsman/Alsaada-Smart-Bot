'use client';

import React, { useEffect } from 'react';
import { deriveIncidentCode } from '@alsaada/telemetry';

/**
 * Root Layout Error Boundary (Next.js App Router SSOT)
 * Catches uncaught root errors, renders sovereign Arabic UI, and presents
 * a unified telemetry incident code (TRC-XXXXXXXX) derived from Trace ID or digest.
 * Compliance: Plan 19 Section 1.3 & Milestone 2 Scope
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected root layout errors for telemetry
    console.error('[Global Error Boundary]', error);
  }, [error]);

  const traceSource =
    error?.digest ||
    (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : error?.message || 'GLOBAL0000');
  const incidentCode = deriveIncidentCode(traceSource);

  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans antialiased">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-500">
            <svg
              className="w-8 h-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white">
              عطل غير متوقع في النظام
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              حدث خطأ تقني غير متوقع في الهيكل الرئيسي للمنظومة. تم توثيق الواقعة تلقائياً في سجلات التدقيق الجنائي.
            </p>
          </div>

          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
            <span className="text-xs text-slate-400 font-medium">رمز البلاغ المرجعي الموحد</span>
            <div
              className="text-lg font-mono font-bold text-orange-400 tracking-wider select-all"
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
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              إعادة المحاولة
            </button>
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors border border-slate-700"
            >
              الرئيسية
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
