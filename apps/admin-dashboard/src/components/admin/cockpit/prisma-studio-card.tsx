'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Database,
  Play,
  Square,
  RefreshCw,
  ExternalLink,
  Clock,
  Laptop,
  Globe,
  Save,
  RotateCcw,
  Lock,
  PlusCircle,
  ShieldCheck,
  ShieldAlert,
  SlidersHorizontal,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import type { StudioStatus } from '../../../lib/studio-process';

interface PrismaStudioCardProps {
  status: StudioStatus | null;
  loading: boolean;
  actionLoading: string | null;
  onLifecycleAction: (action: 'start' | 'stop' | 'restart' | 'extend') => Promise<void>;
  isLocal: boolean;
  currentHostname: string;
}

const LOCAL_STORAGE_STUDIO_REMOTE_URL_KEY = 'alsaada_prisma_studio_remote_url';

export function PrismaStudioCard({
  status,
  loading: _loading,
  actionLoading,
  onLifecycleAction,
  isLocal,
  currentHostname,
}: PrismaStudioCardProps) {
  const [customRemoteUrl, setCustomRemoteUrl] = useState('');
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [urlConfigSaved, setUrlConfigSaved] = useState(false);

  // Load custom URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUrl = localStorage.getItem(LOCAL_STORAGE_STUDIO_REMOTE_URL_KEY);
      if (savedUrl) {
        setCustomRemoteUrl(savedUrl);
        setCustomUrlInput(savedUrl);
      }
    }
  }, []);

  const handleSaveCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    let trimmed = customUrlInput.trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }
    setCustomUrlInput(trimmed);
    setCustomRemoteUrl(trimmed);
    if (trimmed) {
      localStorage.setItem(LOCAL_STORAGE_STUDIO_REMOTE_URL_KEY, trimmed);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_STUDIO_REMOTE_URL_KEY);
    }
    setUrlConfigSaved(true);
    setTimeout(() => setUrlConfigSaved(false), 3000);
  };

  const handleResetUrl = () => {
    setCustomUrlInput('');
    setCustomRemoteUrl('');
    localStorage.removeItem(LOCAL_STORAGE_STUDIO_REMOTE_URL_KEY);
    setUrlConfigSaved(true);
    setTimeout(() => setUrlConfigSaved(false), 3000);
  };

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

  // Real-time 1-second countdown ticker
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);

  useEffect(() => {
    if (status?.remainingSeconds !== undefined) {
      setCountdownSeconds(status.remainingSeconds);
    }
  }, [status?.remainingSeconds]);

  useEffect(() => {
    if (!isRunning || countdownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCountdownSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isRunning, countdownSeconds]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col justify-between">
      <div className="p-6 space-y-5">
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-900/60 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>استوديو قاعدة البيانات (Prisma Studio)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                إدارة السجلات والجداول وصمام الخمول التلقائي (15 دقيقة)
              </p>
            </div>
          </div>

          {/* Real-time State Badge */}
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                isRunning
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400 dark:bg-slate-500'
                }`}
              />
              <span>{isRunning ? 'الاستوديو نشط' : 'متوقف لحماية الذاكرة'}</span>
              <span className="font-mono text-[11px] opacity-75">(:{port})</span>
            </span>
          </div>
        </div>

        {/* Status Description & Countdown */}
        <div className="space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {isRunning
              ? 'يتم تشغيل الاستوديو كخادم ويب كامل المزايا الأصلية (Full SPA) دون قيود الـ Proxy. الجلسة محمية بصمام إغلاق تلقائي بعد 15 دقيقة خمول لتحرير اتصالات PostgreSQL.'
              : 'لحماية اتصالات قاعدة البيانات وموارد الذاكرة، يتم تشغيل الاستوديو عند الطلب فقط وإيقافه تلقائياً عند انتهاء العمل.'}
          </p>

          {/* Countdown & Heartbeat Extension Card */}
          {isRunning && (
            <div className="bg-orange-50/60 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/60 rounded-xl p-3.5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-[11px] font-semibold text-orange-900 dark:text-orange-200 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                  مؤقت الخمول المتبقي:
                </span>
                <span className="text-xl font-black font-mono text-orange-950 dark:text-orange-100">
                  {formatCountdown(countdownSeconds)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void onLifecycleAction('extend')}
                disabled={actionLoading !== null}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-orange-800 dark:text-orange-200 bg-orange-200/70 dark:bg-orange-900/60 hover:bg-orange-300 dark:hover:bg-orange-800 transition-colors cursor-pointer disabled:opacity-50"
                title="إعادة ضبط مؤقت الخمول إلى 15 دقيقة كاملة"
              >
                {actionLoading === 'extend' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <PlusCircle className="w-3.5 h-3.5" />
                )}
                <span>تمديد (+15د)</span>
              </button>
            </div>
          )}
        </div>

        {/* Primary Action Buttons Bar */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          {isRunning ? (
            <>
              {/* PRIMARY LAUNCH BUTTON (Open in New Tab) */}
              <a
                href={effectiveLaunchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-sm transition-all min-h-[42px] cursor-pointer group"
              >
                <ExternalLink className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>فتح الاستوديو في لسان مستقل ↗</span>
              </a>

              {/* Stop Button */}
              <button
                type="button"
                onClick={() => void onLifecycleAction('stop')}
                disabled={actionLoading !== null}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 hover:bg-red-100 transition-colors min-h-[42px] cursor-pointer disabled:opacity-50"
                title="إيقاف الاستوديو وتحرير الموارد"
              >
                {actionLoading === 'stop' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Square className="w-3.5 h-3.5 fill-current" />
                )}
                <span>إيقاف</span>
              </button>

              {/* Restart Button */}
              <button
                type="button"
                onClick={() => void onLifecycleAction('restart')}
                disabled={actionLoading !== null}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-colors min-h-[42px] cursor-pointer disabled:opacity-50"
                title="إعادة التشغيل وتحديث الاتصال"
              >
                {actionLoading === 'restart' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>إعادة تشغيل</span>
              </button>
            </>
          ) : (
            /* Start Button */
            <button
              type="button"
              onClick={() => void onLifecycleAction('start')}
              disabled={actionLoading !== null}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 shadow-sm transition-all min-h-[42px] cursor-pointer disabled:opacity-50"
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

        {/* Smart Dual-Mode URL Resolver */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700/60 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              {isLocal ? <Laptop className="w-3.5 h-3.5 text-indigo-500" /> : <Globe className="w-3.5 h-3.5 text-sky-500" />}
              <span>توجيه الرابط الذكي:</span>
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                isLocal
                  ? 'bg-indigo-100/70 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                  : 'bg-sky-100/70 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
              }`}
            >
              {isLocal ? `محلي (${currentHostname})` : `عن بُعد (${currentHostname})`}
            </span>
          </div>

          <form onSubmit={handleSaveCustomUrl} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={customUrlInput}
                onChange={(e) => setCustomUrlInput(e.target.value)}
                placeholder={`رابط النفق المخصص (مثل https://...ngrok-free.dev) أو ${defaultLocalUrl}`}
                className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 transition-colors cursor-pointer shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                <span>حفظ</span>
              </button>
              {customRemoteUrl && (
                <button
                  type="button"
                  onClick={handleResetUrl}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-slate-200 dark:bg-slate-700 transition-colors cursor-pointer shrink-0"
                  title="استعادة الافتراضي"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span className="truncate max-w-[280px]">الرابط المعتمد: {effectiveLaunchUrl}</span>
              {urlConfigSaved && (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 font-sans shrink-0">
                  <CheckCircle2 className="w-3 h-3" /> تم الحفظ
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Security & Forensic Safeguards Note */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl p-3 text-[11px] text-rose-900 dark:text-rose-200 leading-relaxed space-y-1">
            <div className="font-bold flex items-center gap-1 text-rose-700 dark:text-rose-300">
              <Lock className="w-3.5 h-3.5" />
              <span>تحذير الأمان (Zero-Auth):</span>
            </div>
            <p>
              استوديو بريزما لا يملك نظام مصادقة داخلي. تشغيله على 127.0.0.1 محمي محلياً. عند استخدام نفق خارجي يجب تفعيل المصادقة الأساسية.
            </p>
          </div>

          <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-3 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed space-y-1">
            <div className="font-bold flex items-center justify-between text-amber-700 dark:text-amber-300">
              <span className="flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>النزاهة الجنائية:</span>
              </span>
              <Link href="/admin/settings/studio" className="underline hover:text-amber-800 text-[10px]">
                استوديو التصحيح
              </Link>
            </div>
            <p>
              يُحظر التعديل اليدوي لحقول AES-256 المشفرة أو حذف قيود الأستاذ العام فيزيائياً لضمان سلامة التدقيق المحاسبي.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
