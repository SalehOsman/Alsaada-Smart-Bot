import React from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  ArrowRight,
  Hash,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
  Terminal,
} from 'lucide-react';
import { getCrashVaultErrors, getAuditVaultData } from '@/lib/data-fetchers';
import { ZeroStateCard } from '@/components/ui/zero-state-card';

export default async function AuditVaultPage() {
  const [errors, audits] = await Promise.all([
    getCrashVaultErrors(),
    getAuditVaultData(),
  ]);

  const activeErrorsCount = errors.filter((e) => !e.isResolved).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/settings"
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
          >
            <ArrowRight className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-orange-600" />
              <span>خزينة الرقابة الجنائية وسجل الأعطال المركزية (Crash & Audit Vault)</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              متابعة مباشرة وحية لكافة الأعطال المسجلة بالبوت وسلسلة الهاش التراكمي غير القابلة للتلاعب.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 text-white px-3.5 py-2 rounded-xl text-xs font-mono border border-slate-800 min-h-[44px]">
          <Hash className="w-4 h-4 text-orange-400" />
          <span>SHA-256 Forensic Audit SSOT</span>
        </div>
      </div>

      {/* Section 1: Crash Vault (سجل مراقبة الأعطال والأخطاء المركزية) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <h2 className="text-base font-bold text-slate-900">
              سجل مراقبة الأعطال والأخطاء المركزية (Crash Vault)
            </h2>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            {activeErrorsCount} أعطال نشطة بانتظار الحل
          </span>
        </div>

        {errors.length === 0 ? (
          <ZeroStateCard
            icon={CheckCircle2}
            title="لا توجد أعطال مسجلة"
            description="لم يتم رصد أي أعطال برمجية مسجلة في المنظومة (خزينة الأعطال نظيفة بنسبة 100%)."
          />
        ) : (
          <>
            {/* Mobile Cards (< md) */}
            <div className="block md:hidden space-y-3">
              {errors.map((err) => (
                <div
                  key={err.id}
                  className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                        {err.errorReference}
                      </span>
                      {err.occurrenceCount > 1 && (
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          ({err.occurrenceCount}x تكرار)
                        </span>
                      )}
                      <span className="font-mono text-xs text-slate-600 font-semibold bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                        {err.actionTrigger || 'نظام عام'}
                      </span>
                    </div>

                    <div>
                      {err.isResolved ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-orange-600" />
                          <span>تم الحل والاعتماد</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <Clock className="w-3.5 h-3.5 text-rose-600" />
                          <span>عطل نشط بانتظار المعالجة</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 font-mono text-xs text-slate-700 overflow-x-auto">
                    <pre className="whitespace-pre-wrap leading-relaxed text-[11px] text-slate-800">
                      {err.errorMessage}
                    </pre>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>آخر ظهور: {new Date(err.lastSeenAt).toLocaleString('ar-EG')}</span>
                    <span>المصدر: {err.sourceLocation || 'المعالج العام'}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (>= md) */}
            <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-right text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="py-3 px-4">كود العطل</th>
                      <th className="py-3 px-4">السياق والمشغل</th>
                      <th className="py-3 px-4">تفاصيل الخطأ المسجل</th>
                      <th className="py-3 px-4 text-center">التكرار</th>
                      <th className="py-3 px-4">الحالة</th>
                      <th className="py-3 px-4">آخر ظهور</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {errors.map((err) => (
                      <tr key={err.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-rose-600">{err.errorReference}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">{err.actionTrigger || 'نظام عام'}</td>
                        <td className="py-3 px-4 max-w-md">
                          <p className="font-mono text-[11px] text-slate-800 truncate" title={err.errorMessage}>
                            {err.errorMessage}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {err.occurrenceCount}x
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {err.isResolved ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-orange-600" />
                              <span>تم الحل</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              <Clock className="w-3.5 h-3.5 text-rose-600" />
                              <span>نشط</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                          {new Date(err.lastSeenAt).toLocaleString('ar-EG')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Section 2: Audit Logs Ledger */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <h2 className="text-base font-bold text-slate-900">
          سجل الرقابة وحركات التعديل الجنائية (Audit Incident Trail)
        </h2>

        {audits.length === 0 ? (
          <ZeroStateCard
            icon={Hash}
            title="لا توجد سجلات تدقيق جنائية"
            description="لم يتم تسجيل أي حركات تعديل مشبوهة أو تعديلات على البيانات (السجل الجنائي متطابق وسليم 100%)."
          />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-3 px-4">رقم السجل</th>
                    <th className="py-3 px-4">الجدول والهدف</th>
                    <th className="py-3 px-4">نوع الإجراء</th>
                    <th className="py-3 px-4">الفاعل</th>
                    <th className="py-3 px-4">سبب التعديل الموثق</th>
                    <th className="py-3 px-4">التوقيت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {audits.map((aud) => (
                    <tr key={aud.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{aud.recordHash}</td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-semibold text-slate-800">{aud.tableName}</span>
                        <span className="text-slate-400 text-[10px] block">{aud.recordId}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200/60">
                          {aud.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">{aud.performedBy}</td>
                      <td className="py-3 px-4 text-slate-700">{aud.reason}</td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{aud.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
