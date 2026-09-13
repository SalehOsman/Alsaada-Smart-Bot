'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Ghost, ArrowRight, Shield, CheckCircle2, AlertCircle } from 'lucide-react';

export default function GhostModePage() {
  const [ghostRole, setGhostRole] = useState('FIELD_ADMIN');
  const [isEnabled, setIsEnabled] = useState(false);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/settings"
          className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
        >
          <ArrowRight className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Ghost className="w-5 h-5 text-orange-600" />
            <span>محاكي وضع الشبح واختبار الواجهات (Flow 00.6)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            تمكين السوبر أدمن من تقمص أي رتبة وفحص رؤية الواجهات وحجب الأزرار دون المساس بالصلاحيات الفعلية.
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-5">
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <p className="text-sm font-bold text-slate-900">تفعيل وضع الشبح اللحظي</p>
            <p className="text-xs text-slate-500 mt-0.5">تبديل واجهات البوت ولوحة التحكم للرتبة المختارة فوراً</p>
          </div>
          <button
            onClick={() => setIsEnabled(!isEnabled)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center cursor-pointer ${
              isEnabled
                ? 'bg-orange-600 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            {isEnabled ? '🟢 الشبح مفعل' : '⚪ الشبح معطل'}
          </button>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">الرتبة المراد محاكاتها</label>
          <select
            value={ghostRole}
            onChange={(e) => setGhostRole(e.target.value)}
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 font-semibold min-h-[44px]"
          >
            <option value="GENERAL_ADMIN">👑 المدير العام التشغيلي (General Admin)</option>
            <option value="FIELD_ADMIN">🛡️ مشرف الموقع الميداني (Field Admin)</option>
            <option value="WORKER_SUPERVISOR">👷 العامل المشرف (Worker Supervisor)</option>
            <option value="WORKER">👤 العامل الميداني (Worker Portal)</option>
            <option value="SUPPLIER">🚚 المورد والخدمات (Supplier Portal)</option>
            <option value="GUEST">🚪 ضيف المنظومة (Guest)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
