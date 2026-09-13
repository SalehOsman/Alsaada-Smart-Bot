import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'انتهت الجلسة — لوحة التحكم المؤسسية',
  description: 'انتهت جلسة الوصول للوحة التحكم المؤسسية أو تم إنهاؤها من قبل الإدارة',
};

interface SessionExpiredPageProps {
  searchParams?: Promise<{
    traceId?: string;
  }>;
}

export default async function SessionExpiredPage({ searchParams }: SessionExpiredPageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const traceId = resolvedParams?.traceId;
  const botUsername = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || process.env.TELEGRAM_BOT_USERNAME || 'Al_Saada_smart_bot').replace(/^@/, '');
  const botUrl = `https://t.me/${botUsername}?start=dashboard_access`;

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans text-right" dir="rtl">
      <div className="max-w-md w-full bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-6 backdrop-blur-sm">
        <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-3">
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            انتهت جلسة الوصول للوحة التحكم
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            انتهت صلاحية جلسة وصولك الحالية أو تم إنهاؤها من قبل الإدارة أو عبر البوت.
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            للحصول على تصريح دخول جديد، يرجى التوجه لمحادثة البوت والضغط على زر <b>«🖥️ فتح لوحة التحكم»</b>.
          </p>
        </div>

        {traceId && (
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-400 font-mono text-center">
            <span className="text-slate-500 ml-2">Trace ID:</span>
            <span>{traceId}</span>
          </div>
        )}

        <div className="pt-2">
          <a
            href={botUrl}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all duration-200 shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50"
            data-testid="return-bot-button"
          >
            <span>العودة للبوت لطلب تصريح دخول</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        <div className="text-[11px] text-slate-500 border-t border-slate-700/50 pt-4">
          منظومة السعادة سمارت بوت — إدارة الموارد والعمليات التشغيلية
        </div>
      </div>
    </div>
  );
}
