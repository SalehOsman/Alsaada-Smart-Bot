import React from 'react';
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';

export default function SettingsLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="جاري تحميل إعدادات المنظومة...">
      {/* Header */}
      <div className="space-y-2 pb-2 border-b border-slate-200 dark:border-slate-800">
        <Skeleton className="h-7 w-52 rounded-lg" />
        <Skeleton className="h-4 w-96 rounded-md" />
      </div>

      {/* Settings Module Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 9 }).map((_, idx) => (
          <div
            key={idx}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
            <Skeleton className="h-5 w-40 rounded-md" />
            <Skeleton className="h-3 w-full rounded-md" />
            <Skeleton className="h-3 w-3/4 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
