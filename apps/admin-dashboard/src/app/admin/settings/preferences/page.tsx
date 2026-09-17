'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sliders,
  Sun,
  Moon,
  Monitor,
  Clock,
  Calendar,
  DollarSign,
  Volume2,
  VolumeX,
  RefreshCw,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Globe,
  Bell,
  Check,
  Table,
  Hash,
} from 'lucide-react';
import {
  useDashboardPreferences,
  SUPPORTED_TIMEZONES,
  type ThemeMode,
  type TableDensity,
  type TimeFormat,
  type DateFormat,
  type WeekStart,
  type NumberFormatMode,
  type CurrencyCode,
} from '@/components/providers/dashboard-preferences-provider';

export default function PreferencesPage() {
  const {
    preferences,
    resolvedTheme,
    isSaving,
    lastSaved,
    updatePreferences,
    setTheme,
    resetPreferences,
    formatTime,
    formatDate,
    formatDateTime,
    formatNumber,
    formatCurrency,
    playNotificationSound,
    currentTimezoneInfo,
  } = useDashboardPreferences();

  // Live preview clock
  const [previewTime, setPreviewTime] = useState<string>('');

  useEffect(() => {
    setPreviewTime(formatTime(new Date(), true));
    const timer = setInterval(() => {
      setPreviewTime(formatTime(new Date(), true));
    }, 1000);
    return () => clearInterval(timer);
  }, [formatTime]);

  const [testSoundPlayed, setTestSoundPlayed] = useState<boolean>(false);

  const handleTestSound = () => {
    playNotificationSound();
    setTestSoundPlayed(true);
    setTimeout(() => setTestSoundPlayed(false), 1500);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            <Link
              href="/admin/settings"
              className="hover:text-orange-600 dark:hover:text-orange-400 flex items-center gap-1 transition-colors"
            >
              <span>مركز الإعدادات والحوكمة</span>
              <ArrowRight className="w-3 h-3 rotate-180" />
            </Link>
            <span>/</span>
            <span className="text-slate-800 dark:text-slate-200 font-medium">تفضيلات الداشبورد</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 border border-orange-200/60 dark:border-orange-900/60 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <span>تفضيلات الداشبورد والمظهر والتوقيت</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            تخصيص بيئة العرض، المنطقة الزمنية التشغيلية، تنسيق الأرقام، وتنبيهات التدفقات الحية.
          </p>
        </div>

        {/* Live Autosave Status Badge */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-1.5 rounded-xl shadow-xs self-start sm:self-auto">
          {isSaving ? (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>جاري الحفظ...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>تم الحفظ تلقائياً</span>
              {lastSaved && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  ({lastSaved.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })})
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ========================================================= */}
        {/* CARD 1: Appearance & Display Theme                        */}
        {/* ========================================================= */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Sun className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  المظهر والسمة البصرية (Theme)
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  التحكم في سمة الألوان ومستويات التباين وكثافة الجداول
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {resolvedTheme === 'dark' ? '🌙 وضع ليلي' : '☀️ وضع نهاري'}
            </span>
          </div>

          {/* Theme Selector Radio Group */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              نمط السمة البصرية
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'light', label: 'نهاري', icon: Sun, desc: 'أبيض ناصع' },
                { id: 'dark', label: 'ليلي', icon: Moon, desc: 'داكن مريح' },
                { id: 'system', label: 'تلقائي', icon: Monitor, desc: 'بحسب النظام' },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = preferences.theme === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTheme(item.id as ThemeMode)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Icon className="w-5 h-5 mb-1.5" />
                    <span className="text-xs font-bold">{item.label}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {item.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table Density */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              كثافة صفوف الجداول
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'comfortable', label: 'مريح (Comfortable)', desc: 'مسافات واسعة ومريحة للأعين' },
                { id: 'compact', label: 'مدمج (Compact)', desc: 'عرض أكبر عدد من البيانات' },
              ].map((density) => {
                const isSelected = preferences.tableDensity === density.id;
                return (
                  <button
                    key={density.id}
                    type="button"
                    onClick={() => updatePreferences({ tableDensity: density.id as TableDensity })}
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{density.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-orange-500" />}
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                      {density.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Preview Box */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-orange-500" />
              معاينة حية للمظهر والجدول المصغر
            </span>
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-3 py-2 bg-slate-50/70 dark:bg-slate-800/70 font-semibold text-[11px]">
                <span>اسم العامل</span>
                <span>الموقع</span>
                <span>الحالة</span>
              </div>
              <div
                className={`flex items-center justify-between px-3 ${
                  preferences.tableDensity === 'compact' ? 'py-1.5' : 'py-3'
                } border-b border-slate-100 dark:border-slate-800/50`}
              >
                <span className="font-medium">أحمد السيد مصطفى</span>
                <span className="text-slate-500 dark:text-slate-400">موقع فوسفات أبو طرطور</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  نشط
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CARD 2: Timezone, Clock & Calendar                        */}
        {/* ========================================================= */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  التوقيت والمنطقة الزمنية (Timezone)
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  ساعة المنظومة، المناطق الجغرافية، وصيغ التواريخ والأوقات
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-900/50">
              {currentTimezoneInfo.flag} {currentTimezoneInfo.city}
            </span>
          </div>

          {/* Timezone Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              المنطقة الزمنية التشغيلية (Timezone)
            </label>
            <div className="space-y-2">
              {SUPPORTED_TIMEZONES.map((tz) => {
                const isSelected = preferences.timezone === tz.id;
                return (
                  <button
                    key={tz.id}
                    type="button"
                    onClick={() => updatePreferences({ timezone: tz.id })}
                    className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{tz.flag}</span>
                      <div className="text-right">
                        <p className="text-xs font-bold">{tz.name}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                          {tz.id} ({tz.offsetLabel})
                        </p>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-orange-500" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Format & Date Format Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                صيغة الوقت (Clock Format)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: '12h', label: '12 ساعة (ص/م)' },
                  { id: '24h', label: '24 ساعة (عسكري)' },
                ].map((tf) => {
                  const isSelected = preferences.timeFormat === tf.id;
                  return (
                    <button
                      key={tf.id}
                      type="button"
                      onClick={() => updatePreferences({ timeFormat: tf.id as TimeFormat })}
                      className={`py-2 px-2.5 rounded-lg border text-center text-xs font-medium cursor-pointer transition-all ${
                        isSelected
                          ? 'border-orange-500 bg-orange-500 text-white font-bold'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {tf.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                تنسيق التاريخ (Date Format)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                  { id: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
                ].map((df) => {
                  const isSelected = preferences.dateFormat === df.id;
                  return (
                    <button
                      key={df.id}
                      type="button"
                      onClick={() => updatePreferences({ dateFormat: df.id as DateFormat })}
                      className={`py-2 px-2.5 rounded-lg border text-center text-xs font-medium cursor-pointer transition-all ${
                        isSelected
                          ? 'border-orange-500 bg-orange-500 text-white font-bold'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {df.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Week Start Day */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              بداية أسبوع العمل المؤسسي
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'saturday', label: 'السبت (مصر والشرق)' },
                { id: 'sunday', label: 'الأحد (الخليج)' },
                { id: 'monday', label: 'الإثنين (دولي)' },
              ].map((ws) => {
                const isSelected = preferences.weekStart === ws.id;
                return (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => updatePreferences({ weekStart: ws.id as WeekStart })}
                    className={`py-2 px-2 rounded-lg border text-center text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50/60 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 font-bold'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {ws.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Preview of Clock */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                الساعة التشغيلية اللحظية للمنطقة المختارة:
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                {formatDate(new Date())}
              </p>
            </div>
            <div className="text-left">
              <span className="text-base sm:text-lg font-mono font-bold text-orange-600 dark:text-orange-400">
                {previewTime || formatTime(new Date(), true)}
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CARD 3: Regional Locale, Numbers & Currency               */}
        {/* ========================================================= */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  الأرقام والعملة الإقليمية (Locale)
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  نمط الأرقام، العملة الحسابية، والفواصل العشرية
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-900/50">
              {preferences.numberFormat === 'eastern' ? '١٢٣ مشرقية' : '123 لاتينية'}
            </span>
          </div>

          {/* Number Style */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              نمط الأرقام (Numeral System)
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'western', label: 'أرقام لاتينية (123)', desc: 'المعيار المالي المعتمد في المنظومة' },
                { id: 'eastern', label: 'أرقام مشرقية (١٢٣)', desc: 'أرقام عربية مشرقية تقليدية' },
              ].map((nf) => {
                const isSelected = preferences.numberFormat === nf.id;
                return (
                  <button
                    key={nf.id}
                    type="button"
                    onClick={() => updatePreferences({ numberFormat: nf.id as NumberFormatMode })}
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{nf.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-orange-500" />}
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                      {nf.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Currency Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              العملة الحسابية الرئيسية
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { code: 'EGP', symbol: 'ج.م', name: 'الجنيه المصري' },
                { code: 'SAR', symbol: 'ر.س', name: 'الريال السعودي' },
                { code: 'USD', symbol: '$', name: 'الدولار الأمريكي' },
              ].map((curr) => {
                const isSelected = preferences.currencyCode === curr.code;
                return (
                  <button
                    key={curr.code}
                    type="button"
                    onClick={() =>
                      updatePreferences({
                        currencyCode: curr.code as CurrencyCode,
                        currencySymbol: curr.symbol,
                      })
                    }
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50/60 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 font-bold shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className="text-sm block font-bold">{curr.symbol}</span>
                    <span className="text-[11px] block text-slate-700 dark:text-slate-300 font-medium">
                      {curr.name}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">({curr.code})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Decimal Places */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              المنازل العشرية (Decimal Precision)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 0, label: 'بدون كسور (1,500)' },
                { value: 2, label: 'منزلتان (1,500.00)' },
                { value: 3, label: '3 منازل (1,500.000)' },
              ].map((dp) => {
                const isSelected = preferences.decimalPlaces === dp.value;
                return (
                  <button
                    key={dp.value}
                    type="button"
                    onClick={() => updatePreferences({ decimalPlaces: dp.value })}
                    className={`py-2 px-2 rounded-lg border text-center text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'border-orange-500 bg-orange-500 text-white font-bold'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {dp.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accounting Live Preview */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              معاينة المحاسبة والمالية الحية
            </span>
            <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-300">سلفة نقدية منصرفة للعامل:</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                {formatCurrency(1850.75)}
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CARD 4: Data Telemetry & Live Sound Alerts                */}
        {/* ========================================================= */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  سلوك البيانات والتنبيهات (Telemetry & Alerts)
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  تحديث المؤشرات التلقائي، حجم صفحات الجداول، ونغمات الإشعارات
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/50 dark:border-rose-900/50">
              {preferences.soundNotifications ? '🔔 صوت مفعل' : '🔕 صوت صامت'}
            </span>
          </div>

          {/* Auto-Refresh Interval */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              معدل التحديث التلقائي للمؤشرات المباشرة
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: 0, label: 'يدوي فقط' },
                { value: 15, label: '15 ثانية' },
                { value: 30, label: '30 ثانية' },
                { value: 60, label: 'دقيقة' },
              ].map((rf) => {
                const isSelected = preferences.refreshInterval === rf.value;
                return (
                  <button
                    key={rf.value}
                    type="button"
                    onClick={() => updatePreferences({ refreshInterval: rf.value })}
                    className={`py-2 px-2 rounded-lg border text-center text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'border-orange-500 bg-orange-500 text-white font-bold'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {rf.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table Rows Per Page */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              عدد الصفوف الافتراضي في صفحات الجداول
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[10, 25, 50, 100].map((rows) => {
                const isSelected = preferences.tableRowsPerPage === rows;
                return (
                  <button
                    key={rows}
                    type="button"
                    onClick={() => updatePreferences({ tableRowsPerPage: rows })}
                    className={`py-2 px-2 rounded-lg border text-center text-xs font-mono font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'border-orange-500 bg-orange-500 text-white font-bold'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {rows} صف
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sound Alert Toggle with Test Chime */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {preferences.soundNotifications ? (
                  <Volume2 className="w-4 h-4 text-orange-500" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-400" />
                )}
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    التنبيهات الصوتية لطلبات الاعتماد
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    تشغيل نغمة هادئة فورية عند وصول طلب اعتماد أو قرار مالي
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  updatePreferences({ soundNotifications: !preferences.soundNotifications })
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                  preferences.soundNotifications ? 'bg-orange-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
                role="switch"
                aria-checked={preferences.soundNotifications}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    preferences.soundNotifications ? '-translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {preferences.soundNotifications && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  اختبار نغمة التنبيه عبر مكبر الصوت:
                </span>
                <button
                  type="button"
                  onClick={handleTestSound}
                  className="px-3 py-1.5 rounded-lg bg-orange-100 dark:bg-orange-950/60 hover:bg-orange-200 dark:hover:bg-orange-900/60 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-800 text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{testSoundPlayed ? 'تم تشغيل النغمة 🎵' : 'تجربة الصوت الآن 🔔'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* BOTTOM ACTION BAR                                         */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              الحفظ التلقائي الفوري والتهيئة
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              كافة التغييرات تُطبق لحظياً وتُخزن في المتصفح وتتزامن مع حسابك المؤسسي.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={resetPreferences}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>استعادة الإعدادات الافتراضية للمنظومة</span>
        </button>
      </div>
    </div>
  );
}
