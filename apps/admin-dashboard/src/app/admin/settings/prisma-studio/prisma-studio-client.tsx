'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Database,
  ArrowRight,
  Play,
  Square,
  RefreshCw,
  ExternalLink,
  Maximize2,
  Minimize2,
  AlertTriangle,
  ShieldAlert,
  SlidersHorizontal,
  Clock,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import type { DashboardUser } from '../../../../lib/rbac';
import type { StudioStatus } from '../../../../lib/studio-process';

interface PrismaStudioClientProps {
  user: DashboardUser;
}

export function PrismaStudioClient({ user: _user }: PrismaStudioClientProps) {
  const [status, setStatus] = useState<StudioStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(Date.now());
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Handle Start / Stop action
  const handleLifecycleAction = async (action: 'start' | 'stop' | 'restart') => {
    setActionLoading(true);
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
        setIframeKey(Date.now());
        setActionMessage({
          type: 'success',
          text:
            action === 'start'
              ? 'تم تشغيل استوديو قاعدة البيانات بنجاح وبدء مؤقت الخمول (15 دقيقة).'
              : action === 'stop'
              ? 'تم إيقاف استوديو قاعدة البيانات وتحرير موارد مجمّع Postgres.'
              : 'تمت إعادة تشغيل استوديو قاعدة البيانات بنجاح.',
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
      setActionLoading(false);
      void fetchStatus();
    }
  };

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (containerRef.current?.requestFullscreen) {
        void containerRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        void document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Format remaining seconds MM:SS
  const formatCountdown = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isRunning = status?.isRunning ?? false;
  const remainingSeconds = status?.remainingSeconds ?? 0;

  return (
    <div className="space-y-6" ref={containerRef}>
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
              <span>استوديو قاعدة البيانات (Prisma Studio Cockpit)</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              قمرة تحكم استوديو قاعدة البيانات الحصرية للسوبر أدمن مع صمام إغلاق الخمول الآلي بعد 15 دقيقة وعزل الـ DMZ.
            </p>
          </div>
        </div>

        {/* Status Indicators & Control Buttons */}
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
            {isRunning && remainingSeconds > 0 && (
              <span className="flex items-center gap-1 border-r border-emerald-300 dark:border-emerald-700 pr-2 mr-1 font-mono text-emerald-800 dark:text-emerald-200">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatCountdown(remainingSeconds)}</span>
              </span>
            )}
          </div>

          {/* Quick Start / Stop Button */}
          {isRunning ? (
            <button
              onClick={() => handleLifecycleAction('stop')}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors min-h-[38px] cursor-pointer disabled:opacity-50"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4 fill-current" />}
              <span>إيقاف الاستوديو</span>
            </button>
          ) : (
            <button
              onClick={() => handleLifecycleAction('start')}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-700 shadow-xs transition-colors min-h-[38px] cursor-pointer disabled:opacity-50"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              <span>تشغيل الاستوديو</span>
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors min-h-[38px] min-w-[38px] inline-flex items-center justify-center cursor-pointer"
            title={isFullscreen ? 'تصغير الشاشة' : 'تكبير ملء الشاشة'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Open in Dedicated Tab */}
          <a
            href="/api/admin/studio/proxy/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors min-h-[38px] min-w-[38px] inline-flex items-center justify-center cursor-pointer"
            title="فتح في نافذة مستقلة عبر البروكسي الداخلي"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          {/* Reload Iframe */}
          <button
            onClick={() => {
              setIframeKey(Date.now());
              void fetchStatus();
            }}
            className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors min-h-[38px] min-w-[38px] inline-flex items-center justify-center cursor-pointer"
            title="تحديث الإطار"
          >
            <RefreshCw className="w-4 h-4" />
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

      {/* 2. Forensic Integrity Shield & Hard Delete Prevention Banner */}
      <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 p-4 rounded-xl shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              <span className="font-bold block text-sm mb-0.5 text-amber-950 dark:text-amber-100">
                🛡️ درع النزاهة الجنائية وحظر الحذف الفيزيائي (Forensic Safety Shield):
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-amber-800 dark:text-amber-300">
                <li>
                  <strong>حظر تعديل الحقول المشفرة:</strong> لا تقم بتعديل الحقول المشفرة بـ AES-256-GCM (مثل{' '}
                  <code className="bg-amber-100/70 dark:bg-amber-900/40 px-1 py-0.5 rounded font-mono text-[11px]">
                    nationalIdEncrypted
                  </code>{' '}
                  أو{' '}
                  <code className="bg-amber-100/70 dark:bg-amber-900/40 px-1 py-0.5 rounded font-mono text-[11px]">
                    phoneEncrypted
                  </code>
                  ) يدوياً؛ التعديل المباشر سيكسر فك التشفير.
                </li>
                <li>
                  <strong>حظر الحذف الصلب (Hard Delete):</strong> يُحظر تماماً الحذف الفيزيائي لسجلات القيود المالية
                  (FinancialLedger) والعمال لمنع انهيار مصفوفة الحذف الناعم والنزاهة المحاسبية.
                </li>
              </ul>
            </div>
          </div>

          <Link
            href="/admin/settings/studio"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-amber-900 dark:text-amber-100 bg-amber-200/70 dark:bg-amber-800/50 hover:bg-amber-300 dark:hover:bg-amber-700 border border-amber-300 dark:border-amber-700 transition-colors shrink-0 min-h-[38px] cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 text-amber-700 dark:text-amber-300" />
            <span>استوديو تصحيح البيانات المعتمد</span>
          </Link>
        </div>
      </div>

      {/* 3. Embedded Prisma Studio Frame or Zero-State Launcher */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="h-[650px] flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
            <p className="text-xs font-semibold">جارٍ استطلاع حالة استوديو قاعدة البيانات...</p>
          </div>
        ) : isRunning ? (
          <div className={`relative w-full ${isFullscreen ? 'h-screen' : 'h-[800px]'}`}>
            <iframe
              key={iframeKey}
              src="/api/admin/studio/proxy/"
              title="Prisma Studio Cockpit"
              className="w-full h-full border-0"
              allow="clipboard-read; clipboard-write"
            />
          </div>
        ) : (
          /* Zero-State Launcher Card */
          <div className="py-20 px-6 flex flex-col items-center justify-center text-center max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-orange-100 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800/80 flex items-center justify-center text-orange-600 dark:text-orange-400 mb-4 shadow-sm">
              <Database className="w-8 h-8" />
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
              استوديو قاعدة البيانات في وضع الاستعداد المتوقف
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
              لحماية موارد الخادم ومنع استنزاف اتصالات مجمّع PostgreSQL، يتم إيقاف الاستوديو تلقائياً عند عدم الاستخدام.
              يمكنك تشغيله الآن بضغطة زر لبدء جلسة آمنة ومراقبة.
            </p>

            <button
              onClick={() => handleLifecycleAction('start')}
              disabled={actionLoading}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 shadow-md hover:shadow-lg transition-all min-h-[44px] cursor-pointer disabled:opacity-50"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جارٍ تشغيل الاستوديو...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>تشغيل قمرة استوديو قاعدة البيانات</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
