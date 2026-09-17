'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Home,
  Copy,
  Check,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Arabic Segment Mappings for Breadcrumbs
const BREADCRUMB_LABELS: Record<string, string> = {
  admin: 'لوحة التحكم',
  analytics: 'مركز التحليلات',
  workforce: 'شؤون العاملين',
  directory: 'دليل العاملين',
  new: 'تعيين عامل جديد',
  edit: 'تعديل البيانات',
  clearances: 'مخالصات إنهاء الخدمة',
  export: 'تصدير كشوفات العمال',
  evaluations: 'تقييمات العمال',
  transfers: 'حركات النقل الميداني',
  disciplinary: 'الجزاءات والتحقيقات',
  housing: 'سكن ومخيمات العمال',
  medical: 'التأمين والرعاية الطبية',
  approvals: 'مركز الموافقات',
  treasury: 'اعتمادات الخزينة',
  operations: 'العمليات الميدانية',
  equipment: 'المعدات والمحروقات',
  logistics: 'اللوجستيات والإمداد',
  canteen: 'الكانتين ومهمات الوقاية',
  settings: 'الإعدادات والحوكمة',
  sites: 'المواقع والمشاريع',
  jobs: 'الوظائف والأجور',
  users: 'المستخدمين والصلاحيات',
  company: 'ملف المنظومة',
  notifications: 'سياسات الإشعارات',
  studio: 'استوديو تصحيح البيانات',
  'ghost-mode': 'وضع الشبح والمحاكاة',
  telemetry: 'مرصد الأداء والـ APM',
  assignments: 'التكليفات الإدارية',
  preferences: 'تفضيلات الداشبورد',
  'audit-vault': 'سجل التدقيق الأمني',
  delegations: 'التفويضات الإدارية',
  sessions: 'الجلسات النشطة',
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  // If on the root hub /admin, display minimal breadcrumbs
  const segments = pathname.split('/').filter(Boolean);

  const handleCopyLink = async () => {
    try {
      if (typeof window !== 'undefined') {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Clipboard write fallback
    }
  };

  // Build breadcrumb crumbs
  let cumulativeHref = '';
  const crumbs = segments.map((seg, idx) => {
    cumulativeHref += `/${seg}`;
    const isLast = idx === segments.length - 1;
    const label = BREADCRUMB_LABELS[seg] || decodeURIComponent(seg);

    return {
      href: cumulativeHref,
      label,
      isLast,
    };
  });

  return (
    <div className="bg-slate-100/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800/80 px-4 sm:px-6 lg:px-8 py-2 text-xs flex items-center justify-between transition-colors no-print">
      {/* Left (Right in RTL): Back button & Breadcrumb Links */}
      <div className="flex items-center gap-2 overflow-x-auto py-0.5 custom-scrollbar">
        {crumbs.length > 1 && (
          <button
            type="button"
            onClick={() => router.back()}
            className="p-1 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer min-h-[28px] shrink-0"
            title="رجوع خطوة للخلف"
            aria-label="رجوع خطوة للخلف"
          >
            <ArrowRight className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span className="hidden sm:inline text-[11px]">رجوع</span>
          </button>
        )}

        {crumbs.length > 1 && (
          <span className="text-slate-300 dark:text-slate-700 select-none">|</span>
        )}

        <nav aria-label="مسار التصفح" className="flex items-center gap-1.5 shrink-0">
          <Link
            href="/admin"
            className="p-1 rounded text-slate-500 dark:text-slate-400 hover:text-orange-500 dark:hover:text-orange-400 flex items-center gap-1 transition-colors"
            title="الرئيسية"
          >
            <Home className="w-3.5 h-3.5" />
          </Link>

          {crumbs.map((crumb) => {
            if (crumb.href === '/admin') return null; // Already represented by Home icon

            return (
              <React.Fragment key={crumb.href}>
                <ChevronLeft className="w-3 h-3 text-slate-400 dark:text-slate-600 shrink-0 select-none" />
                {crumb.isLast ? (
                  <span
                    className="font-semibold text-slate-900 dark:text-slate-100 px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-800/60 truncate max-w-[200px]"
                    aria-current="page"
                  >
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="text-slate-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors truncate max-w-[150px]"
                  >
                    {crumb.label}
                  </Link>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Right (Left in RTL): Click-to-Copy URL Button */}
      <button
        type="button"
        onClick={handleCopyLink}
        className={cn(
          'p-1.5 rounded-md text-xs border transition-all flex items-center gap-1.5 cursor-pointer shrink-0 min-h-[28px]',
          copied
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
        )}
        title="نسخ الرابط المباشر لهذه الصفحة"
        aria-label="نسخ الرابط المباشر"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[11px] font-medium">تم النسخ</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline text-[11px]">نسخ الرابط</span>
          </>
        )}
      </button>
    </div>
  );
}
