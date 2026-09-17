'use client';

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Zap,
  Radio,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Server,
  Cpu,
  Globe,
  HelpCircle,
  Play,
  Pause,
  Download,
  Search,
  RefreshCw,
  Layers,
  Wifi,
  ShieldCheck,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import type {
  ApmTelemetryViewModel,
  ApmAggregatedAction,
  ApmOperationItem,
} from '@/lib/data-fetchers';
import { formatDateTime, formatNumber } from '@/lib/formatters';

interface PingResult {
  internalMs: number;
  telegramWanMs: number;
  socketWarm: boolean;
  status: string;
  timestamp: string;
}

interface TelemetryClientProps {
  initialData: ApmTelemetryViewModel;
  userPreferences?: {
    numberFormat?: 'western' | 'eastern';
    timezone?: string;
  };
}

export default function TelemetryClient({
  initialData,
  userPreferences,
}: TelemetryClientProps) {
  const [data, setData] = useState<ApmTelemetryViewModel>(initialData);
  const [isPending, startTransition] = useTransition();

  // Control state
  const [isPaused, setIsPaused] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [timeRange, setTimeRange] = useState<'all' | '24h' | '7d' | '1h'>('24h');
  const [viewMode, setViewMode] = useState<'aggregated' | 'raw'>('aggregated');
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<'ALL' | 'GREEN_FAST' | 'YELLOW_ACCEPTABLE' | 'RED_SLOW'>('ALL');
  const [page, setPage] = useState(1);

  // Modals state
  const [isPingModalOpen, setIsPingModalOpen] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<PingResult | null>(null);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const numFormat = userPreferences?.numberFormat || 'western';
  const tz = userPreferences?.timezone || 'Africa/Cairo';

  // 1. Fetch fresh telemetry data
  const fetchTelemetry = useCallback(
    async (
      paramsOverride?:
        | boolean
        | {
            range?: 'all' | '24h' | '7d' | '1h';
            pageNum?: number;
            tier?: typeof tierFilter;
            search?: string;
            force?: boolean;
          }
    ) => {
      try {
        const isBool = typeof paramsOverride === 'boolean';
        const overrides = isBool ? undefined : paramsOverride;
        const activeRange = overrides?.range ?? timeRange;
        const activePage = overrides?.pageNum ?? page;
        const activeTier = overrides?.tier ?? tierFilter;
        const activeSearch = overrides?.search ?? searchQuery;
        const force = isBool ? paramsOverride : (overrides?.force ?? false);

        const lastTs = data.latestOps.length > 0 ? data.latestOps[0].timestamp : undefined;
        const params = new URLSearchParams({
          timeRange: activeRange,
          page: String(activePage),
          pageSize: '20',
          tier: activeTier,
          search: activeSearch,
        });

        if (force) {
          params.set('forceRefresh', 'true');
        } else if (lastTs && !activeSearch && activeTier === 'ALL' && activePage === 1) {
          params.set('lastTimestamp', lastTs);
        }

        const res = await fetch(`/api/telemetry?${params.toString()}`, {
          cache: 'no-store',
        });

        if (!res.ok) {
          setIsReconnecting(true);
          return;
        }
        const json = await res.json();

        setIsReconnecting(false);
        if (json.unchanged) {
          // No new DB logs in current window — reset countdown
          setCountdown(5);
          return;
        }

        if (json.data) {
          startTransition(() => {
            setData(json.data);
            setCountdown(5);
          });
        }
      } catch (err) {
        setIsReconnecting(true);
        if (process.env.NODE_ENV === 'development') {
          console.warn('[APM Telemetry] Network fetch retry scheduled:', err);
        }
      }
    },
    [data.latestOps, timeRange, page, tierFilter, searchQuery]
  );

  // 2. Tab visibility-aware live polling engine (5s)
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    const tick = () => {
      if (document.hidden || isPaused) return;

      setCountdown((prev) => {
        if (prev <= 1) {
          setTimeout(() => {
            void fetchTelemetry({ force: false });
          }, 0);
          return 5;
        }
        return prev - 1;
      });
    };

    timer = setInterval(tick, 1000);

    const handleVisibilityChange = () => {
      if (!document.hidden && !isPaused) {
        fetchTelemetry({ force: true });
        setCountdown(5);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPaused, fetchTelemetry]);

  // 3. Immediate interactive handlers & debounced search
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchTelemetry({ search: searchQuery, pageNum: 1, force: true });
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const handleTierChange = (tier: typeof tierFilter) => {
    setTierFilter(tier);
    setPage(1);
    fetchTelemetry({ tier, pageNum: 1, force: true });
  };

  const handleTimeRangeChange = (range: typeof timeRange) => {
    setTimeRange(range);
    setPage(1);
    fetchTelemetry({ range, pageNum: 1, force: true });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchTelemetry({ pageNum: newPage, force: true });
  };

  // 4. Ping Test Handler
  const handleRunPingTest = async () => {
    setIsPingModalOpen(true);
    setIsPinging(true);
    try {
      const res = await fetch('/api/telemetry/ping', {
        method: 'POST',
        cache: 'no-store',
      });
      if (res.ok) {
        const json = (await res.json()) as PingResult;
        setPingResult(json);
      }
    } catch (err) {
      console.error('Ping test failed:', err);
    } finally {
      setIsPinging(false);
    }
  };

  // 5. CSV Export Handler
  const handleExportCsv = async () => {
    let csvContent = '';
    if (viewMode === 'aggregated') {
      const headers = [
        '#',
        'الإجراء واسم الزر',
        'كود التليجرام البرمجي',
        'إجمالي التكرارات',
        'وسيط المعالجة الداخلية P50 (ms)',
        'وسيط عبور الشبكة P50 (ms)',
        'ذيل تأخير السيرفر P95 (ms)',
        'ذيل تأخير الشبكة P95 (ms)',
        'العمليات البطيئة',
        'نسبة التأخير (%)',
        'تقييم الحالة',
      ];
      const rows = filteredAggregated.map((item, idx) => [
        idx + 1,
        `"${item.humanAction.replace(/"/g, '""')}"`,
        `"${item.action.replace(/"/g, '""')}"`,
        item.count,
        item.p50InternalMs,
        item.p50NetworkMs,
        item.p95InternalMs,
        item.p95NetworkMs,
        item.slowCount,
        `${item.slowPct}%`,
        item.status === 'OPTIMAL' ? 'فائق' : item.status === 'ACCEPTABLE' ? 'مستقر' : 'بطيء',
      ]);
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    } else {
      const headers = [
        '#',
        'الإجراء واسم الزر',
        'كود التليجرام البرمجي',
        'المعالجة الداخلية الصافية (ms)',
        'عبور شبكة تليجرام (ms)',
        'الزمن الإجمالي (ms)',
        'مستوى الأداء',
        'معرف المستخدم',
        'التوقيت الميداني',
      ];

      let exportItems = filteredRawOps;
      if (data.pagination && data.pagination.totalCount > filteredRawOps.length) {
        try {
          const exportParams = new URLSearchParams({
            timeRange,
            page: '1',
            pageSize: '1000',
            tier: tierFilter,
            search: searchQuery,
          });
          const res = await fetch(`/api/telemetry?${exportParams.toString()}`);
          if (res.ok) {
            const json = await res.json();
            if (json.data?.rawOps) {
              exportItems = json.data.rawOps;
            }
          }
        } catch {
          // Fallback to currently filtered raw ops
        }
      }

      const rows = exportItems.map((item, idx) => [
        idx + 1,
        `"${item.humanAction.replace(/"/g, '""')}"`,
        `"${item.action.replace(/"/g, '""')}"`,
        item.internalTimeMs ?? 0,
        item.networkTimeMs ?? 0,
        item.timeMs,
        item.performanceTier || '-',
        item.actorTelegramId || 'ميداني',
        `"${item.timestamp}"`,
      ]);
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    }

    // Prepend UTF-8 BOM (\uFEFF) so Excel opens Arabic correctly
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `alsaada_telemetry_${viewMode}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Client-side filtering for immediate feedback
  const filteredAggregated = data.aggregatedActions.filter((a) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!a.humanAction.toLowerCase().includes(q) && !a.action.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (tierFilter === 'GREEN_FAST' && a.status !== 'OPTIMAL') return false;
    if (tierFilter === 'YELLOW_ACCEPTABLE' && a.status !== 'ACCEPTABLE') return false;
    if (tierFilter === 'RED_SLOW' && a.status !== 'DEGRADED') return false;
    return true;
  });

  const filteredRawOps = data.rawOps.filter((r) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!r.humanAction.toLowerCase().includes(q) && !r.action.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (tierFilter !== 'ALL' && r.performanceTier !== tierFilter) {
      return false;
    }
    return true;
  });

  const reliabilityPct = Math.max(0, 100 - data.slowOpsPct);

  return (
    <div className="space-y-6">
      {/* 1. Header with Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/settings"
            className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
            title="العودة لإعدادات النظام"
          >
            <ArrowRight className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <span>لوحة مؤشرات الأداء والسرعة اللحظية (APM Dashboard)</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              قمرة قيادة استخباراتية تفصل المعالجة الداخلية للمخدم عن عبور شبكة تليجرام الدولية إلى أوروبا.
            </p>
          </div>
        </div>

        {/* Header Action Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Live indicator & Countdown */}
          <div
            className={`flex items-center gap-2 border px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              isReconnecting
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
            }`}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isReconnecting ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
              ></span>
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isReconnecting ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
              ></span>
            </span>
            <span>{isReconnecting ? 'جاري إعادة الاتصال...' : 'المرصد نشط'}</span>
            <span
              className={`font-mono text-[11px] border-r pr-2 mr-1 ${
                isReconnecting
                  ? 'text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700'
                  : 'text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700'
              }`}
            >
              {isPaused ? 'متوقف' : `تحديث: ${countdown}ث`}
            </span>
          </div>

          {/* Pause / Resume Button */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors min-h-[38px]"
            title={isPaused ? 'استئناف التحديث التلقائي' : 'إيقاف التحديث التلقائي مؤقتاً'}
          >
            {isPaused ? (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">استئناف</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="hidden sm:inline">إيقاف</span>
              </>
            )}
          </button>

          {/* Manual Refresh Button */}
          <button
            onClick={() => fetchTelemetry(true)}
            disabled={isPending}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors min-h-[38px]"
            title="تحديث قسري فوري"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin text-orange-500' : ''}`} />
          </button>

          {/* Keep-Alive Status Badge */}
          <div
            className="hidden lg:flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 px-3 py-1.5 rounded-lg text-xs font-medium cursor-help"
            title="مقابس HTTP Keep-Alive متصلة دائماً بخوادم تليجرام في أوروبا لتفادي إعادة التفاوض على TLS Handshake"
          >
            <Wifi className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Keep-Alive: نشط</span>
          </div>

          {/* Run Live Ping Test Button */}
          <button
            onClick={handleRunPingTest}
            className="px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors min-h-[38px]"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>اختبار سرعة حي (Ping)</span>
          </button>

          {/* Help / Guide Modal Button */}
          <button
            onClick={() => setIsHelpModalOpen(true)}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-700 transition-colors min-h-[38px] min-w-[38px] inline-flex items-center justify-center"
            title="دليل ومعايير قياس الأداء"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Top Outlier Radar Micro-Bar */}
      {(data.topFrequentAction || data.topDelayedNetworkAction) && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-slate-200 p-3 rounded-xl border border-slate-700 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-orange-500/20 text-orange-400 border border-orange-500/30">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
            </span>
            <span className="font-bold text-white">رادار الاستخبارات اللحظي (Outliers Radar):</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            {data.topFrequentAction && (
              <div
                onClick={() => {
                  setSearchQuery(data.topFrequentAction!.action);
                  setViewMode('aggregated');
                  const el = document.getElementById('operations-table-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center gap-1.5 cursor-pointer hover:opacity-85 transition-opacity"
                title="تصفية الجدول بحسب هذا الزر"
              >
                <span className="text-emerald-400 font-semibold">🏆 الأكثر طلباً:</span>
                <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  {data.topFrequentAction.humanAction}
                </span>
                <span className="text-slate-400 font-mono">
                  ({formatNumber(data.topFrequentAction.count, { numberFormat: numFormat })} نقرة — P50:{' '}
                  {formatNumber(data.topFrequentAction.latencyMs, { numberFormat: numFormat })}ms)
                </span>
              </div>
            )}

            {data.topDelayedNetworkAction && (
              <div
                onClick={() => {
                  setSearchQuery(data.topDelayedNetworkAction!.action);
                  setViewMode('aggregated');
                  const el = document.getElementById('operations-table-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center gap-1.5 border-t md:border-t-0 md:border-r border-slate-700 pt-2 md:pt-0 md:pr-4 cursor-pointer hover:opacity-85 transition-opacity"
                title="تصفية الجدول بحسب هذا الزر المتأخر شبكياً"
              >
                <span className="text-amber-400 font-semibold">⚠️ أعلى تأخير شبكي:</span>
                <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  {data.topDelayedNetworkAction.humanAction}
                </span>
                <span className="text-slate-400 font-mono">
                  (P95: {formatNumber(data.topDelayedNetworkAction.latencyMs, { numberFormat: numFormat })}ms — تأخير دولي)
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Four Actionable Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Ops & RPM */}
        <div
          onClick={() => {
            handleTierChange('ALL');
            const el = document.getElementById('operations-table-section');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3 cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 transition-all group"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>إجمالي الحركات ومعدل التدفق</span>
            <Server className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
                {formatNumber(data.totalOps, { numberFormat: numFormat })}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">حركة</span>
            </div>
            <div className="text-left font-mono">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                {data.rpm} RPM
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
            <span>تحديثات تليجرام والردود التفاعلية</span>
            <span className="text-blue-500 group-hover:underline text-[10px]">عرض الكل &darr;</span>
          </p>
        </div>

        {/* Card 2: Internal Server Speed (P50/P95) */}
        <div
          onClick={() => {
            handleTierChange('GREEN_FAST');
            const el = document.getElementById('operations-table-section');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3 cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-600 transition-all group"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>كفاءة السيرفر وقاعدة البيانات</span>
            <Cpu className="w-4 h-4 text-emerald-500 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs text-slate-400 font-bold">P50:</span>
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {formatNumber(data.p50InternalLatencyMs, { numberFormat: numFormat })} ms
              </span>
            </div>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900">
              المعيار الذهبي 🟢
            </span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
            <span>ذيل التأخير P95: {formatNumber(data.p95InternalLatencyMs, { numberFormat: numFormat })} ms</span>
            <span className="text-emerald-500 group-hover:underline text-[10px]">تصفية الفائق &darr;</span>
          </p>
        </div>

        {/* Card 3: Telegram WAN Transit (P50/P95) */}
        <div
          onClick={() => {
            handleTierChange('YELLOW_ACCEPTABLE');
            const el = document.getElementById('operations-table-section');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3 cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 transition-all group"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>عبور شبكة تليجرام الدولية (أوروبا)</span>
            <Globe className="w-4 h-4 text-blue-500 dark:text-blue-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs text-slate-400 font-bold">P50:</span>
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
                {formatNumber(data.p50NetworkLatencyMs, { numberFormat: numFormat })} ms
              </span>
            </div>
            <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">
              مستقر 🌐
            </span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
            <span>ذيل التأخير P95: {formatNumber(data.p95NetworkLatencyMs, { numberFormat: numFormat })} ms</span>
            <span className="text-blue-500 group-hover:underline text-[10px]">تصفية المستقر &darr;</span>
          </p>
        </div>

        {/* Card 4: Operation Reliability & Cache Hit */}
        <div
          onClick={() => {
            handleTierChange('RED_SLOW');
            const el = document.getElementById('operations-table-section');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3 cursor-pointer hover:border-purple-400 dark:hover:border-purple-600 transition-all group"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>معدل الموثوقية وخلو العمليات</span>
            <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
                {formatNumber(reliabilityPct, { numberFormat: numFormat })}%
              </span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">موثوق</span>
            </div>
            <span className="text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-900">
              كاش: {formatNumber(data.cacheHitRatio, { numberFormat: numFormat })}%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
            <span>تسريع الذاكرة L1 RAM / Redis</span>
            <span className="text-purple-500 group-hover:underline text-[10px]">تصفية المتأخر &darr;</span>
          </p>
        </div>
      </div>

      {/* 4. Time Window Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs text-xs">
        <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
          <Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          <span>النافذة الزمنية للتحليل:</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: '1h', label: 'آخر ساعة' },
            { id: '24h', label: 'آخر 24 ساعة' },
            { id: '7d', label: 'آخر 7 أيام' },
            { id: 'all', label: 'كامل السجل التراكمي' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => handleTimeRangeChange(t.id as typeof timeRange)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                timeRange === t.id
                  ? 'bg-orange-600 text-white shadow-xs font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Dual Latency Timeline Sparkline (SVG) */}
      {data.timelinePoints.length > 0 && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                المخطط الزمني النبضي للسرعة (Dual Latency Timeline Sparkline):
              </h3>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                <span>المعالجة الداخلية للسيرفر (ms)</span>
              </span>
              <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                <span>عبور شبكة تليجرام الدولية (ms)</span>
              </span>
            </div>
          </div>

          {/* SVG Sparkline Graph */}
          <div className="w-full overflow-x-auto pt-2">
            <div className="min-w-[600px] h-32 relative">
              <svg className="w-full h-full" viewBox="0 0 600 120" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="intGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid horizontal lines */}
                <line x1="0" y1="30" x2="600" y2="30" stroke="#94a3b8" strokeOpacity="0.15" strokeDasharray="3 3" />
                <line x1="0" y1="60" x2="600" y2="60" stroke="#94a3b8" strokeOpacity="0.15" strokeDasharray="3 3" />
                <line x1="0" y1="90" x2="600" y2="90" stroke="#94a3b8" strokeOpacity="0.15" strokeDasharray="3 3" />

                {(() => {
                  const pts = data.timelinePoints;
                  const maxNet = Math.max(500, ...pts.map((p) => p.networkMs));
                  const maxInt = Math.max(30, ...pts.map((p) => p.internalMs));

                  const netCoords = pts.map((p, i) => {
                    const x = (i / Math.max(1, pts.length - 1)) * 580 + 10;
                    const y = 110 - (Math.min(maxNet, p.networkMs) / maxNet) * 90;
                    return { x, y, p };
                  });

                  const intCoords = pts.map((p, i) => {
                    const x = (i / Math.max(1, pts.length - 1)) * 580 + 10;
                    const y = 110 - (Math.min(maxInt, p.internalMs) / maxInt) * 35;
                    return { x, y, p };
                  });

                  const netPath = netCoords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
                  const netArea = `${netPath} L ${netCoords[netCoords.length - 1].x} 115 L ${netCoords[0].x} 115 Z`;

                  const intPath = intCoords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
                  const intArea = `${intPath} L ${intCoords[intCoords.length - 1].x} 115 L ${intCoords[0].x} 115 Z`;

                  return (
                    <>
                      <path d={netArea} fill="url(#netGrad)" />
                      <path d={netPath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />

                      <path d={intArea} fill="url(#intGrad)" />
                      <path d={intPath} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />

                      {/* Points */}
                      {netCoords.map((c, i) => (
                        <circle
                          key={`net-${i}`}
                          cx={c.x}
                          cy={c.y}
                          r="3"
                          fill="#3b82f6"
                          className="hover:r-5 cursor-pointer transition-all"
                        >
                          <title>{`${c.p.action} — شبكة: ${c.p.networkMs}ms | توقيت: ${c.p.timestamp.substring(11, 19)}`}</title>
                        </circle>
                      ))}

                      {intCoords.map((c, i) => (
                        <circle
                          key={`int-${i}`}
                          cx={c.x}
                          cy={c.y}
                          r="3"
                          fill="#10b981"
                          className="hover:r-5 cursor-pointer transition-all"
                        >
                          <title>{`${c.p.action} — داخلي: ${c.p.internalMs}ms | توقيت: ${c.p.timestamp.substring(11, 19)}`}</title>
                        </circle>
                      ))}
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* 6. Dual-Panel Speed Evaluation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Panel A: Internal Server Engine */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  كفاءة السيرفر الداخلي وقواعد البيانات
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  زمن معالجة الخادم الصافي وقواعد بيانات PostgreSQL وكاش L1 RAM
                </p>
              </div>
            </div>
            <div className="text-left font-mono">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                P50: {formatNumber(data.p50InternalLatencyMs, { numberFormat: numFormat })}ms
              </span>
              <span className="text-[11px] text-slate-400 block">
                P95: {formatNumber(data.p95InternalLatencyMs, { numberFormat: numFormat })}ms
              </span>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            {/* Fast <=15ms */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>فائق السرعة (المعيار الذهبي) (&le; 15ms)</span>
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                  {formatNumber(data.fastInternalOpsPct, { numberFormat: numFormat })}%
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{ width: `${data.fastInternalOpsPct}%` }}
                ></div>
              </div>
            </div>

            {/* Acceptable 15-50ms */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>مقبول ومستقر (15ms - 50ms)</span>
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                  {formatNumber(data.acceptableInternalOpsPct, { numberFormat: numFormat })}%
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-amber-500 h-2 rounded-full transition-all"
                  style={{ width: `${data.acceptableInternalOpsPct}%` }}
                ></div>
              </div>
            </div>

            {/* Slow >50ms */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>معالجة مركبة أو ثقيلة (&gt; 50ms)</span>
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                  {formatNumber(data.slowInternalOpsPct, { numberFormat: numFormat })}%
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-rose-500 h-2 rounded-full transition-all"
                  style={{ width: `${data.slowInternalOpsPct}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Panel B: Telegram WAN Network */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  عبور شبكة تليجرام الدولية والإنترنت الميداني
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  انتقال الإشارات الضوئية العابرة للحدود إلى مراكز بيانات تليجرام في أوروبا
                </p>
              </div>
            </div>
            <div className="text-left font-mono">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                P50: {formatNumber(data.p50NetworkLatencyMs, { numberFormat: numFormat })}ms
              </span>
              <span className="text-[11px] text-slate-400 block">
                P95: {formatNumber(data.p95NetworkLatencyMs, { numberFormat: numFormat })}ms
              </span>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            {/* Fast <=300ms */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span>استجابة شبكية سريعة (&le; 300ms)</span>
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                  {formatNumber(data.fastNetworkOpsPct, { numberFormat: numFormat })}%
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${data.fastNetworkOpsPct}%` }}
                ></div>
              </div>
            </div>

            {/* Normal 300-800ms */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                  <span>عبور طبيعي مستقر (300ms - 800ms)</span>
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                  {formatNumber(data.normalNetworkOpsPct, { numberFormat: numFormat })}%
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-slate-400 h-2 rounded-full transition-all"
                  style={{ width: `${data.normalNetworkOpsPct}%` }}
                ></div>
              </div>
            </div>

            {/* Slow >800ms */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>تأخير ميداني أو ضغط شبكي (&gt; 800ms)</span>
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                  {formatNumber(data.slowNetworkOpsPct, { numberFormat: numFormat })}%
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-rose-500 h-2 rounded-full transition-all"
                  style={{ width: `${data.slowNetworkOpsPct}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 7. Smart Operations Table with Mode Switcher */}
      <div
        id="operations-table-section"
        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs space-y-4 p-5"
      >
        {/* Switcher & Actions Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('aggregated')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'aggregated'
                  ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>الملخص التحليلي (حسب الزر)</span>
            </button>

            <button
              onClick={() => setViewMode('raw')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'raw'
                  ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>السجل اللحظي المتدفق (Raw Stream)</span>
            </button>
          </div>

          {/* Search, Filter Pills & CSV Export */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="بحث في أسماء الأزرار والأكواد..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pr-9 pl-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Performance Tier Pills */}
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-0.5 rounded-lg text-xs">
              {[
                { id: 'ALL', label: 'الكل' },
                { id: 'GREEN_FAST', label: 'فائق' },
                { id: 'YELLOW_ACCEPTABLE', label: 'مستقر' },
                { id: 'RED_SLOW', label: 'بطيء' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => handleTierChange(pill.id as typeof tierFilter)}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                    tierFilter === pill.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* CSV Export Button */}
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="تصدير السجل المصفى إلى ملف CSV متوافق مع إكسيل"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير CSV</span>
            </button>
          </div>
        </div>

        {/* Mode A: Aggregated Table */}
        {viewMode === 'aggregated' && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">الإجراء البشري (اسم الزر في البوت)</th>
                  <th className="py-2.5 px-3">كود التليجرام البرمجي</th>
                  <th className="py-2.5 px-3">إجمالي التكرار</th>
                  <th className="py-2.5 px-3">وسيط الداخلي (P50)</th>
                  <th className="py-2.5 px-3">وسيط الشبكة (P50)</th>
                  <th className="py-2.5 px-3">ذيل التأخير الأقصى (P95)</th>
                  <th className="py-2.5 px-3">نسبة التأخير</th>
                  <th className="py-2.5 px-3">تقييم الكفاءة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredAggregated.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 dark:text-slate-500">
                      لا توجد عمليات مجمعة مطابقة لمعايير البحث الحالية.
                    </td>
                  </tr>
                ) : (
                  filteredAggregated.map((op, idx) => {
                    const badgeClass =
                      op.status === 'OPTIMAL'
                        ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/60'
                        : op.status === 'ACCEPTABLE'
                          ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/60'
                          : 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800/60';
                    const badgeLabel =
                      op.status === 'OPTIMAL' ? '⚡ فائق' : op.status === 'ACCEPTABLE' ? '⏱️ مستقر' : '🐢 بطيء';

                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">
                          {op.humanAction}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 max-w-[200px] truncate inline-block">
                            {op.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                          {formatNumber(op.count, { numberFormat: numFormat })}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                          {formatNumber(op.p50InternalMs, { numberFormat: numFormat })} ms
                        </td>
                        <td className="py-2.5 px-3 font-mono text-blue-600 dark:text-blue-400 font-semibold">
                          {formatNumber(op.p50NetworkMs, { numberFormat: numFormat })} ms
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                          داخلي: {formatNumber(op.p95InternalMs, { numberFormat: numFormat })}ms | شبكة:{' '}
                          {formatNumber(op.p95NetworkMs, { numberFormat: numFormat })}ms
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">
                          {op.slowPct > 0 ? (
                            <span className="text-rose-600 dark:text-rose-400 font-bold">{op.slowPct}%</span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400">0%</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded border text-[11px] ${badgeClass}`}
                          >
                            {badgeLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Mode B: Raw Live Stream Table */}
        {viewMode === 'raw' && (
          <div className="overflow-x-auto space-y-3">
            <table className="w-full min-w-[850px] text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">الإجراء البشري</th>
                  <th className="py-2.5 px-3">كود التليجرام البرمجي</th>
                  <th className="py-2.5 px-3">المعالجة الداخلية الصافية</th>
                  <th className="py-2.5 px-3">عبور شبكة تليجرام الدولية</th>
                  <th className="py-2.5 px-3">الزمن الإجمالي والمستوى</th>
                  <th className="py-2.5 px-3">معرف المستخدم</th>
                  <th className="py-2.5 px-3">التوقيت الميداني</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredRawOps.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 dark:text-slate-500">
                      لا توجد سجلات لحظية متدفقة حالياً.
                    </td>
                  </tr>
                ) : (
                  filteredRawOps.map((op, idx) => {
                    const isFast =
                      op.performanceTier === 'GREEN_FAST' ||
                      (op.internalTimeMs !== null ? op.internalTimeMs <= 15 : op.timeMs <= 50);
                    const isAcceptable =
                      op.performanceTier === 'YELLOW_ACCEPTABLE' ||
                      (op.internalTimeMs !== null
                        ? op.internalTimeMs > 15 && op.internalTimeMs <= 50
                        : op.timeMs > 50 && op.timeMs <= 250);
                    const badgeClass = isFast
                      ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/60'
                      : isAcceptable
                        ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/60'
                        : 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800/60';
                    const badgeLabel = isFast ? '⚡ فائق' : isAcceptable ? '⏱️ مستقر' : '🐢 بطيء';

                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">
                          {op.humanAction}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 max-w-[200px] truncate inline-block">
                            {op.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatNumber(op.internalTimeMs ?? 0, { numberFormat: numFormat })} ms
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-blue-600 dark:text-blue-400">
                          {formatNumber(op.networkTimeMs ?? 0, { numberFormat: numFormat })} ms
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded border text-[11px] ${badgeClass}`}
                          >
                            <span>{formatNumber(op.timeMs, { numberFormat: numFormat })} ms</span>
                            <span>({badgeLabel})</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">
                          {op.actorTelegramId || 'ميداني'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                          {formatDateTime(op.timestamp, { numberFormat: numFormat, timezone: tz })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {data.pagination && data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 text-xs">
                <span className="text-slate-500">
                  صفحة {data.pagination.page} من {data.pagination.totalPages} (إجمالي{' '}
                  {formatNumber(data.pagination.totalCount, { numberFormat: numFormat })} حركة)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePageChange(Math.max(1, page - 1))}
                    disabled={data.pagination.page <= 1}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handlePageChange(Math.min(data.pagination?.totalPages || 1, page + 1))}
                    disabled={data.pagination.page >= (data.pagination?.totalPages || 1)}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 8. Live Ping Modal */}
      {isPingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  نتائج اختبار الاستجابة اللحظي (Live Ping Test)
                </h3>
              </div>
              <button
                onClick={() => setIsPingModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isPinging ? (
              <div className="py-8 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-orange-600 animate-spin mx-auto" />
                <p className="text-xs text-slate-500 font-semibold">
                  جارٍ قياس زمن استجابة السيرفر الداخلي والاتصال بخوادم تليجرام في أوروبا...
                </p>
              </div>
            ) : pingResult ? (
              <div className="space-y-3">
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-3 rounded-lg flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    حالة الاتصال والخدمة:
                  </span>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 font-mono">
                    {pingResult.status === 'HEALTHY' ? '🟢 متصل ومستقر (Healthy)' : '⚠️ خدمة متأثرة'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
                    <span className="text-slate-400 text-[11px] block">استعلام قاعدة البيانات:</span>
                    <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {pingResult.internalMs} ms
                    </span>
                    <span className="text-[10px] text-slate-500 block">SELECT 1</span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
                    <span className="text-slate-400 text-[11px] block">شبكة تليجرام (أوروبا):</span>
                    <span className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400">
                      {pingResult.telegramWanMs} ms
                    </span>
                    <span className="text-[10px] text-slate-500 block">Telegram getMe RTT</span>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] space-y-1 text-slate-600 dark:text-slate-300">
                  <div className="flex items-center justify-between">
                    <span>حالة مقابس الاتصال الساخنة:</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">
                      {pingResult.socketWarm ? 'Warm Socket (نشط)' : 'TLS Handshake Required'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 text-[10px]">
                    <span>توقيت القياس:</span>
                    <span className="font-mono">
                      {formatDateTime(pingResult.timestamp, { numberFormat: numFormat, timezone: tz })}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={handleRunPingTest}
                disabled={isPinging}
                className="px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-colors"
              >
                إعادة الفحص الآن
              </button>
              <button
                onClick={() => setIsPingModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Help & Standards Modal */}
      {isHelpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  دليل معايير قياس الأداء وتفكيك الأزمنة (APM Standards Guide)
                </h3>
              </div>
              <button
                onClick={() => setIsHelpModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-emerald-500" />
                  <span>المعيار الذهبي للسيرفر الداخلي (&le; 15ms):</span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  يقيس زمن استجابة كود المنظومة ومحرك قواعد البيانات، باستثناء زمن الإنترنت. جميع الأزرار المصممة تحقق سرعة بين 2ms إلى 14ms بفضل كاش الذاكرة L1 RAM وفهارس المعرفات المباشرة.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-blue-500" />
                  <span>فيزياء شبكة تليجرام الدولية (300ms - 800ms):</span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  خوادم تليجرام موجودة في هولندا وألمانيا. انتقال الإشارة الضوئية العابرة للحدود من مصر إلى أوروبا يستغرق ذهاباً وإياباً 70-95ms. وكل ضغطة زر تتطلب دورتين شبكيتين على الأقل (answerCallbackQuery و editMessageText)، ما يجعل زمن الشبكة الطبيعي 250ms - 500ms.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Wifi className="w-4 h-4 text-purple-500" />
                  <span>مقابس Keep-Alive ومؤقت التسخين الدوري:</span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  يحافظ النظام على اتصال TCP/TLS مفتوح ومسخن دائماً مع خوادم تليجرام عبر pacer خفيف، لتجنب إعادة المصافحة المشفرة التي تستهلك ثانية كاملة عند ركود الاتصال.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-amber-500" />
                  <span>لماذا نعتمد P50 و P95 بدلاً من المتوسط الحسابي؟</span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  لأن عملية واحدة تستغرق 18 ثانية (مثل رفع مستند وفحص الذكاء الاصطناعي السحابي) ترفع المتوسط الحسابي لـ 100 حركة بشكل مضلل، بينما يعبر P50 (الوسيط) عن تجربة 50% من المستخدمين، ويعبر P95 عن ذيل التأخير للحالات الثقيلة.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsHelpModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-colors"
              >
                فهمت ذلك
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
