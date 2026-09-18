'use client';

import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { BotMenuNodeDTO, BotNodeStatus, DisabledBehavior } from '@alsaada/core-components';

interface NodeEditModalProps {
  node: BotMenuNodeDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<BotMenuNodeDTO> & { isCascade?: boolean }) => Promise<void>;
}

const PRESET_ALERT_TEMPLATES = [
  {
    title: 'صيانة دورية مجدولة',
    text: '🚧 هذه الوظيفة تخضع لأعمال صيانة دورية مجدولة حالياً لرفع كفاءة الخدمة، وستعود للعمل قريباً.',
  },
  {
    title: 'تدقيق مالي ومطابقة',
    text: '📊 جاري استكمال عمليات المطابقة والتدقيق المالي الدوري، يرجى المحاولة في وقت لاحق.',
  },
  {
    title: 'جرد مستودعي ميداني',
    text: '📦 الخدمة موقوفة مؤقتاً لإجراء عمليات الجرد الفعلي المعتمدة للموقع.',
  },
  {
    title: 'ترقية نظام وتحديث',
    text: '⚡ تجري ترقية المنظومة إلى معايير أمنية جديدة، وسيتم تفعيل التدفق فور انتهاء المزامنة.',
  },
];

const EMOJI_SUGGESTIONS = ['👥', '💰', '🚜', '📦', '⚙️', '👷‍♂️', '🏖️', '🦺', '💵', '📑', '💳', '⏱️', '🛒', '🍽️', '🛡️', '🔍'];

export function NodeEditModal({ node, isOpen, onClose, onSave }: NodeEditModalProps) {
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('');
  const [status, setStatus] = useState<BotNodeStatus>('ACTIVE');
  const [disabledBehavior, setDisabledBehavior] = useState<DisabledBehavior>('LOCK_WITH_ALERT');
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [isCascade, setIsCascade] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (node) {
      setTitle(node.title || '');
      setIcon(node.icon || '');
      setStatus(node.status);
      setDisabledBehavior(node.disabledBehavior);
      setMaintenanceMessage(node.maintenanceMessage || '');
      setIsCascade(false);
      setError(null);
    }
  }, [node]);

  if (!isOpen || !node) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (node.isProtected && status !== 'ACTIVE') {
      setError('لا يمكن إيقاف وظيفة سيادية محصنة.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSave({
        id: node.id,
        title,
        icon,
        status,
        disabledBehavior,
        maintenanceMessage,
        isCascade,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{node.icon || '⚙️'}</span>
            <div>
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                تعديل خصائص الوظيفة
                {node.isProtected && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                    🛡️ سيادية محصنة
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 font-mono">{node.code}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title & Icon */}
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-1">
              <label className="block text-xs font-medium text-slate-300 mb-1">الأيقونة</label>
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-center text-xl text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="col-span-3">
              <label className="block text-xs font-medium text-slate-300 mb-1">المسمى العربي على الزر</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Emoji suggestions */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {EMOJI_SUGGESTIONS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => setIcon(em)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm transition"
              >
                {em}
              </button>
            ))}
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">الحالة التشغيلية</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatus('ACTIVE')}
                className={`py-2 px-3 rounded-xl text-sm font-semibold border flex items-center justify-center gap-2 transition ${
                  status === 'ACTIVE'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                نشط
              </button>
              <button
                type="button"
                disabled={node.isProtected}
                onClick={() => setStatus('MAINTENANCE')}
                className={`py-2 px-3 rounded-xl text-sm font-semibold border flex items-center justify-center gap-2 transition ${
                  status === 'MAINTENANCE'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                    : node.isProtected
                    ? 'opacity-40 cursor-not-allowed bg-slate-950 border-slate-800 text-slate-500'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                صيانة
              </button>
              <button
                type="button"
                disabled={node.isProtected}
                onClick={() => setStatus('DISABLED')}
                className={`py-2 px-3 rounded-xl text-sm font-semibold border flex items-center justify-center gap-2 transition ${
                  status === 'DISABLED'
                    ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                    : node.isProtected
                    ? 'opacity-40 cursor-not-allowed bg-slate-950 border-slate-800 text-slate-500'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                موقوف
              </button>
            </div>
            {node.isProtected && (
              <p className="text-[11px] text-amber-400/80 mt-1">
                🛡️ هذه الوظيفة سيادية محصنة دستورياً، لا يمكن إيقافها لمنع خروج المنظومة عن السيطرة.
              </p>
            )}
          </div>

          {/* Disabled Behavior */}
          {status !== 'ACTIVE' && (
            <div className="space-y-3 p-3 bg-slate-950/60 border border-slate-800 rounded-xl animate-in fade-in">
              <label className="block text-xs font-medium text-slate-300">سلوك الظهور عند الإيقاف</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDisabledBehavior('LOCK_WITH_ALERT')}
                  className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition ${
                    disabledBehavior === 'LOCK_WITH_ALERT'
                      ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  🔒 إبقاء الزر مع رمز قفل وتنبيه
                </button>
                <button
                  type="button"
                  onClick={() => setDisabledBehavior('HIDE')}
                  className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition ${
                    disabledBehavior === 'HIDE'
                      ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  👁️‍🗨️ إخفاء الزر تماماً
                </button>
              </div>

              {/* Maintenance Message */}
              {disabledBehavior === 'LOCK_WITH_ALERT' && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-slate-300">نص التنبيه المنبثق (Modal Alert)</label>
                    <span className="text-[10px] text-slate-400">يظهر عند النقر على الزر الموقوف</span>
                  </div>
                  <textarea
                    rows={3}
                    value={maintenanceMessage}
                    onChange={(e) => setMaintenanceMessage(e.target.value)}
                    placeholder="اكتب رسالة الصيانة التي ستظهر للمستخدم..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />

                  {/* 1-Click Templates */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                      قوالب رسائل معتمدة بضغطة زر واحدة:
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {PRESET_ALERT_TEMPLATES.map((tmpl) => (
                        <button
                          key={tmpl.title}
                          type="button"
                          onClick={() => setMaintenanceMessage(tmpl.text)}
                          className="text-right p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-[11px] text-slate-300 transition"
                        >
                          <span className="font-semibold text-amber-400 block">{tmpl.title}</span>
                          <span className="text-[10px] text-slate-400 truncate block">{tmpl.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cascade Option for Modules/Sections */}
          {(node.type === 'MODULE' || node.type === 'SECTION') && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
              <input
                type="checkbox"
                id="cascade-check"
                checked={isCascade}
                onChange={(e) => setIsCascade(e.target.checked)}
                className="mt-1 rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="cascade-check" className="text-xs text-slate-300 cursor-pointer">
                <span className="font-bold text-amber-400 block mb-0.5">تطبيق متسلسل شامل (Cascading Deep Update)</span>
                تحديث الحالة وسلوك الإيقاف لكافة الأقسام والتدفقات الـ 126 التابعة لهذا الموديول دفعة واحدة.
              </label>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-slate-950 transition shadow-lg shadow-amber-500/20 flex items-center gap-2"
            >
              {loading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
