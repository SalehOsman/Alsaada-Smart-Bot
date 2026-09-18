'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Database,
  ArrowRight,
  Play,
  Square,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  ShieldAlert,
  SlidersHorizontal,
  Clock,
  CheckCircle2,
  Loader2,
  Globe,
  Laptop,
  Save,
  RotateCcw,
  Lock,
  PlusCircle,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';
import type { DashboardUser } from '../../../../lib/rbac';
import type { StudioStatus } from '../../../../lib/studio-process';

interface PrismaStudioClientProps {
  user: DashboardUser;
}

const LOCAL_STORAGE_REMOTE_URL_KEY = 'alsaada_prisma_studio_remote_url';

export function PrismaStudioClient({ user: _user }: PrismaStudioClientProps) {
  const [status, setStatus] = useState<StudioStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Smart Dual-Mode Resolver states
  const [isLocal, setIsLocal] = useState(true);
  const [currentHostname, setCurrentHostname] = useState('localhost');
  const [customRemoteUrl, setCustomRemoteUrl] = useState('');
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [urlConfigSaved, setUrlConfigSaved] = useState(false);

  // Detect local vs remote browsing on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      setCurrentHostname(window.location.host);
      const local =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname.endsWith('.local') ||
        hostname.endsWith('localtest.me');
      setIsLocal(local);

      const savedUrl = localStorage.getItem(LOCAL_STORAGE_REMOTE_URL_KEY);
      if (savedUrl) {
        setCustomRemoteUrl(savedUrl);
        setCustomUrlInput(savedUrl);
      }
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/studio/status');
      if (res.ok) {
        const data = (await res.json()) as StudioStatus;
        setStatus(data);
      }
    } catch {
      // Offline or network glitch
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    const interval = setInterval(() => {
      void fetchStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Handle lifecycle actions (start, stop, restart, extend)
  const handleLifecycleAction = async (action: 'start' | 'stop' | 'restart' | 'extend') => {
    setActionLoading(action);
    setActionMessage(null);
    try {
      const res = await fetch('/api/admin/studio/lifecycle', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setStatus(data.status);
        const successMessages: Record<string, string> = {
          start: 'تم تشغيل استوديو قاعدة البيانات بنجاح وبدء مؤقت الخمول (15 دقيقة).',
          stop: 'تم إيقاف استوديو قاعدة البيانات وتحرير موارد مجمّع PostgreSQL.',
          restart: 'تمت إعادة تشغيل استوديو قاعدة البيانات بنجاح وتحديث الجلسة.',
          extend: 'تم تمديد الجلسة بنجاح (+15 دقيقة إضافية).',
        };
        setActionMessage({
          type: 'success',
          text: successMessages[action] || 'تم تنفيذ الإجراء بنجاح.',
        });
      } else {
        setActionMessage({
          type: 'error',
          text: data.message || 'فشلت العملية. يرجى مراجعة سجلات الخادم.',
        });
      }
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: `خطأ في الاتصال بالخادم: ${String(err)}`,
      });
    } finally {
      setActionLoading(null);
      void fetchStatus();
    }
  };

  // Save custom remote tunnel URL with protocol auto-normalization
  const handleSaveCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    let trimmed = customUrlInput.trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }
    setCustomUrlInput(trimmed);
    setCustomRemoteUrl(trimmed);
    if (trimmed) {
      localStorage.setItem(LOCAL_STORAGE_REMOTE_URL_KEY, trimmed);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_REMOTE_URL_KEY);
    }
    setUrlConfigSaved(true);
    setTimeout(() => setUrlConfigSaved(false), 3000);
  };

  const handleResetUrl = () => {
    setCustomUrlInput('');
    setCustomRemoteUrl('');
    localStorage.removeItem(LOCAL_STORAGE_REMOTE_URL_KEY);
    setUrlConfigSaved(true);
    setTimeout(() => setUrlConfigSaved(false), 3000);
  };

  // Format countdown MM:SS
  const formatCountdown = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isRunning = status?.isRunning ?? false;
  const port = status?.port ?? 5555;
  const defaultLocalUrl = `http://localhost:${port}`;

  const defaultRemoteUrl = status?.tunnelUrl?.trim() || '';
  // Smart URL calculation: explicit custom URL takes precedence, then server tunnel URL when remote, then local default
  const effectiveLaunchUrl =
    customRemoteUrl.trim() || (isLocal ? defaultLocalUrl : (defaultRemoteUrl || defaultLocalUrl));

  // Real-time 1-second synchronized countdown ticker
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);

  useEffect(() => {
    if (status?.remainingSeconds !== undefined) {
      setCountdownSeconds(status.remainingSeconds);
    }
  }, [status?.remainingSeconds]);

  useEffect(() => {
    if (!isRunning || countdownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          void fetchStatus();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isRunning, countdownSeconds > 0, fetchStatus]);

  return (
    <div className="space-y-6">
      {/* 1. Top Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/settings"
            className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center cursor-pointer"
            title="العودة للإعدادات"
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Database className="w-5 h-5 text-orange-600 dark:text-orange-500" />
              <span>قمرة إطلاق استوديو بريزما السيادية (Prisma Studio Launchpad)</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              إدارة دورة حياة استوديو قاعدة البيانات للسوبر أدمن مع صمام إغلاق الخمول بعد 15 دقيقة، والتمديد التفاعلي،
              والإطلاق في لسان مستقل.
            </p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Real-time Status Badge */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              isRunning
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400 dark:bg-slate-500'
              }`}
            />
            <span>{isRunning ? 'متصل ونشط' : 'متوقف'}</span>
            {isRunning && countdownSeconds > 0 && (
              <span className="flex items-center gap-1 border-r border-emerald-300 dark:border-emerald-700 pr-2 mr-1 font-mono text-emerald-800 dark:text-emerald-200">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatCountdown(countdownSeconds)}</span>
              </span>
            )}
          </div>

          {/* Refresh Status */}
          <button
            onClick={() => void fetchStatus()}
            className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors min-h-[38px] min-w-[38px] inline-flex items-center justify-center cursor-pointer"
            title="تحديث الحالة اللحظية"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-3 animate-fade-in text-xs font-semibold ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          )}
          <p className="flex-1">{actionMessage.text}</p>
          <button
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Main Launchpad Cockpit Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                  isRunning
                    ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`}
                />
                {isRunning ? 'الاستوديو في وضع العمل الفعلي' : 'الاستوديو في وضع الخمول المتوقف'}
              </span>
              <span className="text-xs text-slate-400 font-mono">المنفذ: :{port}</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {isRunning
                ? 'استوديو بريزما جاهز ومتاح للاستخدام في لسان مستقل'
                : 'استوديو قاعدة البيانات متوقف حالياً لحماية مجمّع PostgreSQL'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
              {isRunning
                ? 'يتم تشغيل الاستوديو كخادم ويب كامل المزايا الأصلية (Full SPA) دون قيود الـ Proxy أو حجب Chunks. الجلسة محمية بصمام إغلاق تلقائي بعد 15 دقيقة خمول.'
                : 'لحماية اتصالات قاعدة البيانات والذاكرة، يتم تشغيل الاستوديو عند الطلب فقط وإيقافه تلقائياً عند انتهاء العمل.'}
            </p>
          </div>

          {/* Countdown & Heartbeat Extension Card */}
          {isRunning && (
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 rounded-xl p-4 flex items-center gap-4 shrink-0">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-orange-500" />
                  مؤقت الخمول التلقائي:
                </span>
                <span className="text-2xl font-black font-mono text-slate-900 dark:text-slate-100 block">
                  {formatCountdown(countdownSeconds)}
                </span>
                {countdownSeconds === 0 && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold block">
                    اضغط تمديد لتفعيل مؤقت الـ 15 دقيقة
                  </span>
                )}
              </div>
              <button
                onClick={() => handleLifecycleAction('extend')}
                disabled={actionLoading !== null}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-orange-700 dark:text-orange-300 bg-orange-100/80 dark:bg-orange-950/60 hover:bg-orange-200 dark:hover:bg-orange-900/60 border border-orange-300 dark:border-orange-800 transition-colors min-h-[38px] cursor-pointer disabled:opacity-50"
                title="إعادة ضبط مؤقت الخمول إلى 15 دقيقة كاملة"
              >
                {actionLoading === 'extend' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <PlusCircle className="w-4 h-4" />
                )}
                <span>تمديد الجلسة (+15 دقيقة)</span>
              </button>
            </div>
          )}
        </div>

        {/* Primary Action Buttons Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {isRunning ? (
            <>
              {/* PRIMARY LAUNCH BUTTON (Open in New Tab) */}
              <a
                href={effectiveLaunchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md hover:shadow-lg transition-all min-h-[46px] cursor-pointer group"
              >
                <ExternalLink className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>فتح استوديو بريزما في لسان مستقل ↗</span>
              </a>

              {/* Stop Button */}
              <button
                onClick={() => handleLifecycleAction('stop')}
                disabled={actionLoading !== null}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors min-h-[46px] cursor-pointer disabled:opacity-50"
              >
                {actionLoading === 'stop' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Square className="w-4 h-4 fill-current" />
                )}
                <span>إيقاف الاستوديو</span>
              </button>

              {/* Restart Button */}
              <button
                onClick={() => handleLifecycleAction('restart')}
                disabled={actionLoading !== null}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors min-h-[46px] cursor-pointer disabled:opacity-50"
              >
                {actionLoading === 'restart' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span>إعادة التشغيل</span>
              </button>
            </>
          ) : (
            /* Start Button */
            <button
              onClick={() => handleLifecycleAction('start')}
              disabled={actionLoading !== null}
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 shadow-md hover:shadow-lg transition-all min-h-[46px] cursor-pointer disabled:opacity-50"
            >
              {actionLoading === 'start' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جارٍ إطلاق الاستوديو وفحص المنفذ...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>تشغيل استوديو بريزما الآن</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 3. Smart Dual-Mode URL Resolver Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            {isLocal ? (
              <Laptop className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            ) : (
              <Globe className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            )}
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              المحدد الذكي لبيئة التشغيل (Smart Dual-Mode URL Resolver)
            </h3>
          </div>

          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              isLocal
                ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                : 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
            }`}
          >
            {isLocal ? (
              <>
                <Laptop className="w-3.5 h-3.5" />
                <span>البيئة المكتشفة: تصفح محلي ({currentHostname})</span>
              </>
            ) : (
              <>
                <Globe className="w-3.5 h-3.5" />
                <span>البيئة المكتشفة: وصول عن بُعد ({currentHostname})</span>
              </>
            )}
          </div>
        </div>

        {/* Informational Guidance */}
        {isLocal ? (
          <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-xl p-3.5 text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <p>
              أنت تتصفح الداشبورد محلياً من نفس الخادم أو بيئة التطوير. يتم توجيه زر الإطلاق مباشرة إلى{' '}
              <code className="bg-indigo-100/70 dark:bg-indigo-900/60 px-1 py-0.5 rounded font-mono text-[11px]">
                {defaultLocalUrl}
              </code>
              . هذا هو المسار الآمن الأسرع.
            </p>
          </div>
        ) : (
          <div className="bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 rounded-xl p-3.5 text-xs text-sky-900 dark:text-sky-200 leading-relaxed space-y-2">
            <div className="flex items-start gap-2.5">
              <Globe className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
              <p>
                <strong>تنبيه الوصول عن بُعد:</strong> أنت تتصفح الداشبورد من جهاز خارجي عبر نطاق{' '}
                <code className="bg-sky-100/70 dark:bg-sky-900/60 px-1 py-0.5 rounded font-mono text-[11px]">
                  {currentHostname}
                </code>
                . فتح الرابط المحلي{' '}
                <code className="bg-sky-100/70 dark:bg-sky-900/60 px-1 py-0.5 rounded font-mono text-[11px]">
                  localhost:{port}
                </code>{' '}
                سيبحث عن الاستوديو على جهازك الشخصي وليس السيرفر!
              </p>
            </div>
            <p className="text-[11px] text-sky-800 dark:text-sky-300 pr-6">
              إذا كنت قد أنشأت نفقاً مخصصاً لاستوديو بريزما (مثل نفق Ngrok محمي بمصادقة على المنفذ {port})، يمكنك إدخال
              رابطه أدناه وسيتم حفظه في متصفحك محلياً واستخدامه لزر الإطلاق.
            </p>
          </div>
        )}

        {/* Custom URL Configuration Form */}
        <form onSubmit={handleSaveCustomUrl} className="space-y-3 pt-1">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            رابط نفق استوديو بريزما المخصص (Custom Tunnel URL):
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={customUrlInput}
              onChange={(e) => setCustomUrlInput(e.target.value)}
              placeholder={`مثال: https://prisma-studio.your-domain.ngrok-free.dev أو ${defaultLocalUrl}`}
              className="flex-1 px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 font-mono"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 transition-colors min-h-[38px] cursor-pointer shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              <span>حفظ في المتصفح</span>
            </button>
            {customRemoteUrl && (
              <button
                type="button"
                onClick={handleResetUrl}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors min-h-[38px] cursor-pointer shrink-0"
                title="استعادة الرابط الافتراضي"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>استعادة الافتراضي</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
            <div className="flex items-center gap-1.5 font-mono">
              <span className="font-semibold text-slate-700 dark:text-slate-300">الرابط المعتمد للإطلاق الآن:</span>
              <span className="text-orange-600 dark:text-orange-400 underline">{effectiveLaunchUrl}</span>
            </div>
            {urlConfigSaved && (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                تم الحفظ بنجاح
              </span>
            )}
          </div>
        </form>
      </div>

      {/* 4. Zero-Auth Security Advisory & Forensic Integrity Shield */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Zero-Auth Advisory */}
        <div className="bg-rose-50/80 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800/60 p-4 rounded-xl shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200 font-bold text-xs">
            <Lock className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>⚠️ تحذير الأمان السيبراني الحرج (Zero-Auth Invariant):</span>
          </div>
          <p className="text-xs text-rose-900 dark:text-rose-200 leading-relaxed">
            استوديو بريزما <strong>لا يحتوي على أي نظام مصادقة أو تسجيل دخول داخلي (Zero Native Auth)</strong>. تشغيله
            محلياً على <code className="bg-rose-100/70 dark:bg-rose-900/40 px-1 py-0.5 rounded font-mono">127.0.0.1</code>{' '}
            محمي بطبيعته. يُحظر تماماً كشف منفذ 5555 على نفق عام مفتوح دون تفعيل حماية بكلمة مرور عبر{' '}
            <code className="bg-rose-100/70 dark:bg-rose-900/40 px-1 py-0.5 rounded font-mono">--basic-auth</code> في
            Ngrok لتفادي اختراق قاعدة البيانات.
          </p>
        </div>

        {/* Forensic Integrity Shield */}
        <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 p-4 rounded-xl shadow-2xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-bold text-xs">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>🛡️ درع النزاهة الجنائية وحظر الحذف الفيزيائي:</span>
            </div>
            <Link
              href="/admin/settings/studio"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 dark:text-amber-100 underline hover:text-amber-700"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>استوديو التصحيح المعتمد</span>
            </Link>
          </div>
          <ul className="list-disc list-inside space-y-1 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
            <li>
              <strong>حظر تعديل الحقول المشفرة:</strong> لا تعدل حقول AES-256 (مثل{' '}
              <code className="bg-amber-100/70 dark:bg-amber-900/40 px-1 py-0.5 rounded font-mono text-[11px]">
                nationalIdEncrypted
              </code>
              ) يدوياً أبداً لتجنب تلف التشفير.
            </li>
            <li>
              <strong>حظر الحذف الصلب (Hard Delete):</strong> يُمنع حذف قيود الأستاذ العام (FinancialLedger) فيزيائياً
              حفاظاً على سلامة المصفوفة المحاسبية.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
