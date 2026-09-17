'use client';

import React from 'react';
import Link from 'next/link';

export interface ZeroStateCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  actionText?: string;
  actionHref?: string;
  onResetFilter?: () => void;
  className?: string;
}

export function ZeroStateCard({
  icon: Icon,
  title,
  description,
  actionText,
  actionHref,
  onResetFilter,
  className = '',
}: ZeroStateCardProps) {
  return (
    <div
      data-testid="zero-state-card"
      className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-2xs transition-all ${className}`}
    >
      {/* Brand Safety Orange Icon Badge */}
      <div
        data-testid="zero-state-icon-badge"
        className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-200/60 dark:border-orange-900/60 shadow-xs"
      >
        <Icon className="w-7 h-7" aria-hidden="true" />
      </div>

      {/* Title & Description */}
      <div className="max-w-md space-y-1.5 px-2">
        <h3
          data-testid="zero-state-title"
          className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100"
        >
          {title}
        </h3>
        <p
          data-testid="zero-state-description"
          className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed"
        >
          {description}
        </p>
      </div>

      {/* Action Buttons */}
      {(onResetFilter || (actionText && actionHref)) && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {onResetFilter && (
            <button
              type="button"
              data-testid="zero-state-reset-btn"
              onClick={onResetFilter}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer border border-slate-200/60 dark:border-slate-700"
            >
              إعادة ضبط خيارات البحث
            </button>
          )}
          {actionText && actionHref && (
            <Link
              href={actionHref}
              data-testid="zero-state-action-link"
              className="min-h-[44px] px-4 py-2 rounded-lg bg-orange-600 text-white text-xs sm:text-sm font-semibold hover:bg-orange-700 transition-colors shadow-2xs flex items-center justify-center gap-2"
            >
              <span>{actionText}</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default ZeroStateCard;
