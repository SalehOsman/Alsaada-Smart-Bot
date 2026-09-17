'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Filter, RotateCcw, Building2 } from 'lucide-react';
import type { ModuleAnalyticsMeta } from '@/lib/analytics-registry';
import type { SiteHubItem } from '@/lib/data-fetchers';

interface AnalyticsFilterBarProps {
  availableModules: ModuleAnalyticsMeta[];
  selectedModuleKey: string;
  selectedSiteId: string;
  selectedPeriod: string;
  selectedFeatureKey: string;
  sites: SiteHubItem[];
  isFieldAdmin: boolean;
  assignedSiteName?: string;
}

export function AnalyticsFilterBar({
  availableModules,
  selectedModuleKey,
  selectedSiteId,
  selectedPeriod,
  selectedFeatureKey,
  sites,
  isFieldAdmin,
  assignedSiteName,
}: AnalyticsFilterBarProps) {
  const router = useRouter();

  const currentModule = availableModules.find((m) => m.moduleKey === selectedModuleKey) || availableModules[0];
  const features = currentModule?.features || [];

  const handleModuleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextModKey = e.target.value;
    const targetMod = availableModules.find((m) => m.moduleKey === nextModKey);
    const nextFeature = targetMod?.features[0]?.key || '';
    router.push(
      `/admin/analytics?module=${nextModKey}&siteId=${selectedSiteId}&period=${selectedPeriod}&feature=${nextFeature}`
    );
  };

  const handleSiteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.push(
      `/admin/analytics?module=${selectedModuleKey}&siteId=${e.target.value}&period=${selectedPeriod}&feature=${selectedFeatureKey}`
    );
  };

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.push(
      `/admin/analytics?module=${selectedModuleKey}&siteId=${selectedSiteId}&period=${e.target.value}&feature=${selectedFeatureKey}`
    );
  };

  const handleFeatureChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.push(
      `/admin/analytics?module=${selectedModuleKey}&siteId=${selectedSiteId}&period=${selectedPeriod}&feature=${e.target.value}`
    );
  };

  const handleReset = () => {
    router.push('/admin/analytics');
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100">
          <Filter className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>محددات التحليل والتصفية المباشرة</span>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="استعادة الإعدادات الافتراضية"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>إعادة تعيين</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {/* 1. Module Selector */}
        <div>
          <label htmlFor="analytics-module-select" className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
            الموديول البرمجي
          </label>
          <select
            id="analytics-module-select"
            value={selectedModuleKey}
            onChange={handleModuleChange}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer"
          >
            {availableModules.map((m) => (
              <option key={m.moduleKey} value={m.moduleKey}>
                {m.nameAr}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Site Selector */}
        <div>
          <label htmlFor="analytics-site-select" className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
            الموقع الميداني
          </label>
          {isFieldAdmin ? (
            <div className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate">{assignedSiteName || 'موقعك المسند'}</span>
            </div>
          ) : (
            <select
              id="analytics-site-select"
              value={selectedSiteId}
              onChange={handleSiteChange}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer"
            >
              <option value="ALL">كافة المواقع والمشاريع المركزية</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 3. Period Selector */}
        <div>
          <label htmlFor="analytics-period-select" className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
            الفترة الزمنية
          </label>
          <select
            id="analytics-period-select"
            value={selectedPeriod}
            onChange={handlePeriodChange}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer"
          >
            <option value="today">اليوم الحالي</option>
            <option value="week">آخر 7 أيام (هذا الأسبوع)</option>
            <option value="month">آخر 30 يوماً (هذا الشهر)</option>
            <option value="all">كافة الفترات (سجل شامل)</option>
          </select>
        </div>

        {/* 4. Feature / Flow Selector */}
        <div>
          <label htmlFor="analytics-feature-select" className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
            الوظيفة / التدفق
          </label>
          <select
            id="analytics-feature-select"
            value={selectedFeatureKey}
            onChange={handleFeatureChange}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer"
          >
            <option value="">كافة وظائف الموديول</option>
            {features.map((f) => (
              <option key={f.key} value={f.key}>
                {f.flowCode ? `[${f.flowCode}] ` : ''}{f.nameAr}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
