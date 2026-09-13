import React from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Zap,
  Radio,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Turtle,
  Server,
} from 'lucide-react';
import { getApmTelemetryData } from '@/lib/data-fetchers';

export default async function TelemetryPage() {
  const telemetry = await getApmTelemetryData();

  return (
    <div className="space-y-6">
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
              <Activity className="w-5 h-5 text-orange-600" />
              <span>لوحة مؤشرات الأداء والسرعة اللحظية (APM Dashboard)</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              متابعة حية لسرعة استجابة المحرك والعمليات التفاعلية للبوت الميداني خلال آخر 24 ساعة من واقع قاعدة البيانات.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-orange-50 text-orange-800 border border-orange-200 px-3.5 py-1.5 rounded-lg text-xs font-semibold">
          <Radio className="w-4 h-4 text-orange-600 animate-pulse" />
          <span>المرصد نشط (Live Telemetry Stream)</span>
        </div>
      </div>

      {/* Metric Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>إجمالي العمليات المسجلة</span>
            <Server className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{telemetry.totalOps}</span>
            <span className="text-xs text-slate-500 font-semibold">حركة تفاعلية</span>
          </div>
          <p className="text-[11px] text-slate-400">تحديثات تليجرام ومعالجات الرسائل</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>متوسط سرعة استجابة البوت</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{telemetry.avgLatencyMs} ms</span>
            <span className="text-xs font-bold text-amber-600">
              {telemetry.avgLatencyMs < 15 ? 'مثالي (< 15ms)' : telemetry.avgLatencyMs < 250 ? 'مقبول ومستقر' : 'يحتاج تحسين'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">المعيار الذهبي المعتمد: أقل من 15ms</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>العمليات المقبولة والمستقرة</span>
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {telemetry.fastOpsPct + telemetry.acceptableOpsPct}%
            </span>
            <span className="text-xs text-green-600 font-semibold">استجابة سريعة</span>
          </div>
          <p className="text-[11px] text-slate-400">أقل من 250ms زمن معالجة</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>العمليات البطيئة المرصودة</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{telemetry.slowOpsPct}%</span>
            <span className="text-xs text-rose-600 font-semibold">&gt; 250ms</span>
          </div>
          <p className="text-[11px] text-slate-400">تتضمن أوامر البدء والمحاكاة الثقيلة</p>
        </div>
      </div>

      {/* Latency Distribution Breakdown */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <span>🎯 توزيع سرعة الاستجابة (Latency Distribution):</span>
        </h3>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-green-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                <span>فائق السرعة (&lt; 50ms):</span>
              </span>
              <span className="font-bold text-slate-800 font-mono">{telemetry.fastOpsPct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-green-500 h-2.5 rounded-full transition-all"
                style={{ width: `${telemetry.fastOpsPct}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-amber-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                <span>مقبول ومستقر (50ms - 250ms):</span>
              </span>
              <span className="font-bold text-slate-800 font-mono">{telemetry.acceptableOpsPct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-amber-500 h-2.5 rounded-full transition-all"
                style={{ width: `${telemetry.acceptableOpsPct}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-rose-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                <span>بطيء ويحتاج تحسين (&gt; 250ms):</span>
              </span>
              <span className="font-bold text-slate-800 font-mono">{telemetry.slowOpsPct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-rose-500 h-2.5 rounded-full transition-all"
                style={{ width: `${telemetry.slowOpsPct}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* 5 Slowest Operations Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs space-y-3 p-5">
        <div className="flex items-center gap-2">
          <Turtle className="w-5 h-5 text-amber-600" />
          <h3 className="text-sm font-bold text-slate-900">
            أبطأ 5 عمليات تم رصدها في المنظومة (Slowest Recorded Operations):
          </h3>
        </div>

        <div className="overflow-x-auto pt-2">
          <table className="w-full min-w-[650px] text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">الأمر أو الزر المنفذ (Trigger)</th>
                <th className="py-2.5 px-3">زمن الاستجابة</th>
                <th className="py-2.5 px-3">معرف المستخدم</th>
                <th className="py-2.5 px-3">التوقيت الميداني</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {telemetry.slowestOps.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    لم يتم تسجيل أي عمليات بطيئة في سجلات الـ APM.
                  </td>
                </tr>
              ) : (
                telemetry.slowestOps.map((op, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-500">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                      {op.action}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        {op.timeMs} ms
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">
                      {op.actorTelegramId || 'ميداني'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                      {new Date(op.timestamp).toLocaleString('ar-EG')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
