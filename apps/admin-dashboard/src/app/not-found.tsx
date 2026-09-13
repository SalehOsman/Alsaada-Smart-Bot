import React from 'react';
import Link from 'next/link';
import { FileQuestion, Home } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'الصفحة غير موجودة (404) — لوحة التحكم المؤسسية',
  description: 'المسار المطلوب غير موجود في لوحة التحكم الإدارية',
};

/**
 * Global 404 Page (Next.js App Router SSOT)
 * Standard Arabic 404 Not Found page with return to home navigation.
 * Compliance: Plan 19 Section 1.3 & Milestone 2 Scope
 */
export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-600 dark:text-orange-500">
          <FileQuestion className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <div className="text-4xl font-extrabold text-orange-600 dark:text-orange-500 font-mono tracking-wider">
            404
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            الصفحة المطلوبة غير موجودة
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            عذراً، لم نتمكن من العثور على المسار المطلوب. ربما تم نقله أو حذفه أو أن الرابط غير صحيح.
          </p>
        </div>

        <div className="flex justify-center pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-orange-600/25"
            data-testid="return-home-button"
          >
            <Home className="w-4 h-4" />
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
