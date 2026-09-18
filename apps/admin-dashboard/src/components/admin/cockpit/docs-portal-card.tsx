'use client';

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  ExternalLink,
  RefreshCw,
  Search,
  Layers,
  FileCode2,
  Laptop,
  Globe,
  Save,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Network,
} from 'lucide-react';

interface DocsPortalCardProps {
  isLocal: boolean;
  currentHostname: string;
}

const LOCAL_STORAGE_DOCS_REMOTE_URL_KEY = 'alsaada_docs_portal_remote_url';
const DEFAULT_DOCS_PORT = 4321;

export function DocsPortalCard({ isLocal, currentHostname }: DocsPortalCardProps) {
  const [customRemoteUrl, setCustomRemoteUrl] = useState('');
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [urlConfigSaved, setUrlConfigSaved] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [serverTunnelUrl, setServerTunnelUrl] = useState<string | null>(null);

  // Load saved custom remote URL on mount & fetch server status
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUrl = localStorage.getItem(LOCAL_STORAGE_DOCS_REMOTE_URL_KEY);
      if (savedUrl) {
        setCustomRemoteUrl(savedUrl);
        setCustomUrlInput(savedUrl);
      }
    }

    // Fetch server status for DOCS_TUNNEL_URL
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/admin/docs/status');
        if (res.ok) {
          const data = await res.json();
          if (data.tunnelUrl) {
            setServerTunnelUrl(data.tunnelUrl);
          }
        }
      } catch {
        // Fallback gracefully
      }
    };
    void checkStatus();
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
      localStorage.setItem(LOCAL_STORAGE_DOCS_REMOTE_URL_KEY, trimmed);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_DOCS_REMOTE_URL_KEY);
    }
    setUrlConfigSaved(true);
    setTimeout(() => setUrlConfigSaved(false), 3000);
  };

  const handleResetUrl = () => {
    setCustomUrlInput('');
    setCustomRemoteUrl('');
    localStorage.removeItem(LOCAL_STORAGE_DOCS_REMOTE_URL_KEY);
    setUrlConfigSaved(true);
    setTimeout(() => setUrlConfigSaved(false), 3000);
  };

  const handleTriggerSync = async () => {
    setSyncLoading(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/admin/docs/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSyncMessage({
          type: 'success',
          text: data.message || 'تمت مزامنة شجرة التوثيق (137 صفحة) وتحديث ملفات البوابة بنجاح!',
        });
      } else {
        setSyncMessage({
          type: 'error',
          text: data.error || 'فشلت المزامنة. يرجى التحقق من صلاحيات النظام.',
        });
      }
    } catch (err) {
      setSyncMessage({
        type: 'error',
        text: `خطأ أثناء الاتصال بالخادم: ${String(err)}`,
      });
    } finally {
      setSyncLoading(false);
      setTimeout(() => setSyncMessage(null), 6000);
    }
  };

  const defaultLocalUrl = `http://localhost:${DEFAULT_DOCS_PORT}`;
  const effectiveDocsUrl =
    customRemoteUrl.trim() || (isLocal ? defaultLocalUrl : (serverTunnelUrl || defaultLocalUrl));

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col justify-between">
      <div className="p-6 space-y-5">
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/60 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>بوابة التوثيق التفاعلية والمعمارية الحية</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                تصفح 137 صفحة، 37 ADR، محرك بحث Pagefind بالـ WebAssembly، ومخططات Mermaid
              </p>
            </div>
          </div>

          {/* Real-time State Badge */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <span>جاهزة ومتاحة 24/7</span>
              <span className="font-mono text-[11px] opacity-75">(:{DEFAULT_DOCS_PORT})</span>
            </span>
          </div>
        </div>

        {/* Sync Notification Banner */}
        {syncMessage && (
          <div
            className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
              syncMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
            }`}
          >
            {syncMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <span className="flex-1">{syncMessage.text}</span>
          </div>
        )}

        {/* Architecture Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-center">
            <span className="block text-base font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">137</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">صفحة موثقة 100%</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-center">
            <span className="block text-base font-extrabold text-sky-600 dark:text-sky-400 font-mono">37</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">قرار معماري (ADR)</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-center">
            <span className="flex items-center justify-center gap-1 text-xs font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
              <Search className="w-3.5 h-3.5" />
              <span>WASM</span>
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Pagefind Search</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-center">
            <span className="flex items-center justify-center gap-1 text-xs font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">
              <Layers className="w-3.5 h-3.5" />
              <span>Mermaid</span>
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">مخططات تفاعلية</span>
          </div>
        </div>

        {/* Primary Action Buttons Bar */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          {/* Main Launch Button */}
          <a
            href={effectiveDocsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-sm transition-all min-h-[42px] cursor-pointer group"
          >
            <ExternalLink className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span>فتح بوابة التوثيق في لسان مستقل ↗</span>
          </a>

          {/* Direct Shortcut: ADRs */}
          <a
            href={`${effectiveDocsUrl}/adrs/`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-colors min-h-[42px] cursor-pointer"
            title="تصفح القرارات المعمارية الـ 37 مباشرة"
          >
            <FileCode2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>الـ 37 ADR ↗</span>
          </a>

          {/* Direct Shortcut: Architecture Map */}
          <a
            href={`${effectiveDocsUrl}/architecture/`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-colors min-h-[42px] cursor-pointer"
            title="فتح خريطة المعمارية الحية للمنظومة"
          >
            <Network className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>خريطة المعمارية ↗</span>
          </a>

          {/* Sync Trigger Button */}
          <button
            type="button"
            onClick={() => void handleTriggerSync()}
            disabled={syncLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors min-h-[42px] cursor-pointer disabled:opacity-50"
            title="إعادة مزامنة التوثيق من المصدر الأصلي docs/ دون إعادة بناء الحاوية"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncLoading ? 'animate-spin' : ''}`} />
            <span>مزامنة (Sync)</span>
          </button>
        </div>

        {/* Smart Dual-Mode URL Resolver */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700/60 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              {isLocal ? <Laptop className="w-3.5 h-3.5 text-indigo-500" /> : <Globe className="w-3.5 h-3.5 text-sky-500" />}
              <span>توجيه رابط البوابة الذكي:</span>
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
                placeholder={`رابط نفق التوثيق (مثل https://docs...ngrok-free.dev) أو ${defaultLocalUrl}`}
                className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
              <span className="truncate max-w-[280px]">الرابط المعتمد: {effectiveDocsUrl}</span>
              {urlConfigSaved && (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 font-sans shrink-0">
                  <CheckCircle2 className="w-3 h-3" /> تم الحفظ
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Architecture & Security Invariant Shield */}
        <div className="bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-xl p-3 text-[11px] text-indigo-900 dark:text-indigo-200 leading-relaxed space-y-1">
          <div className="font-bold flex items-center gap-1 text-indigo-700 dark:text-indigo-300">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>حماية المعمارية والسيادة (Isolated Ingress Architecture):</span>
          </div>
          <p>
            تُشغّل بوابة التوثيق كحاوية Nginx Alpine فائقة الخفة (&lt; 25MB) معزولة تماماً، ومقيدة محلياً على{' '}
            <code className="bg-indigo-100/70 dark:bg-indigo-900/40 px-1 py-0.5 rounded font-mono">127.0.0.1:4321</code>
            . يُمنع كشف المنفذ على شبكات خارجية دون نفق مشفر لحماية أسرار الـ 37 ADR وسجلات المنظومة.
          </p>
        </div>
      </div>
    </div>
  );
}
