'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Terminal,
  Layers,
  LayoutGrid,
  Database,
  BookOpen,
} from 'lucide-react';
import type { DashboardUser } from '../../../../lib/rbac';
import type { StudioStatus } from '../../../../lib/studio-process';
import { PrismaStudioCard } from '../../../../components/admin/cockpit/prisma-studio-card';
import { DocsPortalCard } from '../../../../components/admin/cockpit/docs-portal-card';

interface DeveloperCockpitClientProps {
  user: DashboardUser;
}

type TabType = 'all' | 'studio' | 'docs';

export function PrismaStudioClient({ user: _user }: DeveloperCockpitClientProps) {
  const [status, setStatus] = useState<StudioStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');

  // Smart Dual-Mode Resolver states
  const [isLocal, setIsLocal] = useState(true);
  const [currentHostname, setCurrentHostname] = useState('localhost');

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

  return (
    <div className="space-y-6">
      {/* 1. Top Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/settings"
            className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center cursor-pointer shadow-2xs"
            title="العودة للإعدادات"
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Terminal className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>مركز أدوات المطور والمعمارية والتوثيق (Developer & Architecture Cockpit)</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              قمرة القيادة السيادية الحصرية للسوبر أدمن للتحكم باستوديو قاعدة البيانات وبوابة التوثيق التفاعلية والمعمارية الحية.
            </p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            <span>البيئة: {isLocal ? 'محلي' : 'عن بُعد'}</span>
          </div>

          <button
            type="button"
            onClick={() => void fetchStatus()}
            className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors min-h-[38px] min-w-[38px] inline-flex items-center justify-center cursor-pointer shadow-2xs"
            title="تحديث الحالة اللحظية للخدمات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Interactive Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-sm border border-slate-200/80 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-900/50'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>عرض موحد (جنباً إلى جنب)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('studio')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'studio'
                ? 'bg-white dark:bg-slate-900 text-orange-700 dark:text-orange-300 shadow-sm border border-slate-200/80 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-900/50'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>استوديو قاعدة البيانات (Prisma)</span>
            <span
              className={`w-2 h-2 rounded-full ${
                status?.isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('docs')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'docs'
                ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-sm border border-slate-200/80 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-900/50'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>بوابة التوثيق والمعمارية</span>
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          </button>
        </div>

        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-3 hidden md:block">
          {activeTab === 'all' && '📊 عرض كامل للخدمتين معاً جنباً إلى جنب'}
          {activeTab === 'studio' && '🗄️ إدارة حصرية لاستوديو قاعدة البيانات ومؤقت الخمول'}
          {activeTab === 'docs' && '📚 تصفح 137 صفحة والقرارات المعمارية الـ 37'}
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
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. Cards View (Responsive Layout based on Active Tab) */}
      {activeTab === 'all' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start animate-fade-in">
          <PrismaStudioCard
            status={status}
            loading={loading}
            actionLoading={actionLoading}
            onLifecycleAction={handleLifecycleAction}
            isLocal={isLocal}
            currentHostname={currentHostname}
          />
          <DocsPortalCard
            isLocal={isLocal}
            currentHostname={currentHostname}
          />
        </div>
      )}

      {activeTab === 'studio' && (
        <div className="max-w-4xl mx-auto animate-fade-in">
          <PrismaStudioCard
            status={status}
            loading={loading}
            actionLoading={actionLoading}
            onLifecycleAction={handleLifecycleAction}
            isLocal={isLocal}
            currentHostname={currentHostname}
          />
        </div>
      )}

      {activeTab === 'docs' && (
        <div className="max-w-4xl mx-auto animate-fade-in">
          <DocsPortalCard
            isLocal={isLocal}
            currentHostname={currentHostname}
          />
        </div>
      )}
    </div>
  );
}

export const DeveloperCockpitClient = PrismaStudioClient;
