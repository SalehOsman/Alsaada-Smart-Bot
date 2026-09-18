'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Building2,
  Radio,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Edit2,
  Hash,
  ArrowRight,
  ShieldCheck,
  Send,
  Users,
  Activity,
  Layers,
  HelpCircle,
  X,
} from 'lucide-react';

interface TelegramGroupsClientProps {
  currentUserRole: string;
}

interface SiteTelegramItem {
  id: string;
  name: string;
  code: string;
  telegramGroupId: string | null;
  telegramTopicId: number | null;
  supervisorCount: number;
  supervisors: Array<{ id: string; name: string; role: string }>;
}

interface EnforcementTaskItem {
  id: string;
  siteId: string;
  telegramId: string;
  chatId: string;
  topicId: number | null;
  taskType: string;
  status: string;
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface CentralTopic {
  key: string;
  title: string;
  topicId: string | number;
}

interface CentralHqData {
  groupId: string;
  topics: CentralTopic[];
}

export function TelegramGroupsClient({ currentUserRole }: TelegramGroupsClientProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [centralHq, setCentralHq] = useState<CentralHqData | null>(null);
  const [sites, setSites] = useState<SiteTelegramItem[]>([]);
  const [recentTasks, setRecentTasks] = useState<EnforcementTaskItem[]>([]);

  // Modal State
  const [editingSite, setEditingSite] = useState<SiteTelegramItem | null>(null);
  const [editGroupId, setEditGroupId] = useState('');
  const [editTopicId, setEditTopicId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [pingingSiteId, setPingingSiteId] = useState<string | null>(null);

  const canEdit = ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(currentUserRole);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/settings/telegram-groups');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل جلب إعدادات مجموعات تليجرام');

      setCentralHq(data.centralHq || null);
      setSites(data.sites || []);
      setRecentTasks(data.recentTasks || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openEditModal = (site: SiteTelegramItem) => {
    setEditingSite(site);
    setEditGroupId(site.telegramGroupId || '');
    setEditTopicId(site.telegramTopicId !== null ? site.telegramTopicId.toString() : '');
  };

  const closeEditModal = () => {
    setEditingSite(null);
    setEditGroupId('');
    setEditTopicId('');
  };

  const handleSaveSiteLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSite) return;

    try {
      setIsSaving(true);
      setError(null);
      const res = await fetch('/api/settings/telegram-groups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: editingSite.id,
          telegramGroupId: editGroupId.trim() || null,
          telegramTopicId: editTopicId.trim() ? Number(editTopicId) : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تحديث ربط الجروب');

      setSuccessMsg(data.message || 'تم تحديث الربط بنجاح');
      setTimeout(() => setSuccessMsg(null), 3500);

      // Update local state
      setSites((prev) =>
        prev.map((s) =>
          s.id === editingSite.id
            ? {
                ...s,
                telegramGroupId: editGroupId.trim() || null,
                telegramTopicId: editTopicId.trim() ? Number(editTopicId) : null,
              }
            : s
        )
      );
      closeEditModal();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePing = async (siteId: string) => {
    setPingingSiteId(siteId);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/settings/telegram-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, action: 'PING' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل فحص الاتصال');

      setSuccessMsg(data.message || 'تم فحص الاتصال بنجاح');
      setTimeout(() => setSuccessMsg(null), 3500);
      fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل الاتصال بمجموعة تليجرام');
    } finally {
      setPingingSiteId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
          جاري تحميل بيانات مجموعات وتوبيكات تليجرام والربط الميداني...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/settings"
              className="text-xs text-slate-500 hover:text-orange-600 flex items-center gap-1 transition-colors"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>مركز الإعدادات</span>
            </Link>
            <span className="text-slate-400">/</span>
            <span className="text-xs font-semibold text-orange-600">مجموعات وتوبيكات تليجرام</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mt-1">
            <MessageSquare className="w-5 h-5 text-orange-600" />
            <span>جناح إدارة وتوجيه مجموعات تليجرام (Telegram Groups & Topics Hub)</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            ربط ومراقبة المجموعات السيادية للمقر الرئيسي وتوبيكات المشاريع الميدانية وطابور فرض السياسات اللحظي.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>تحديث البيانات</span>
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Central HQ Supergroup & Topics Card */}
      {centralHq && (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-6 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-orange-600/20 text-orange-400 rounded-xl border border-orange-500/30">
                <Radio className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold">جروب الإدارة العليا السيادي (Central HQ Supergroup)</h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                    متصل ونشط
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  معرف الجروب الرئيسي: <span className="font-mono text-orange-300 font-semibold">{centralHq.groupId}</span>
                </p>
              </div>
            </div>
            <div className="text-xs text-slate-300">
              <span>توجيه آلي مفعل للمنتديات (Forum Topics Supported)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            {centralHq.topics.map((t) => (
              <div
                key={t.key}
                className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 space-y-1 hover:border-orange-500/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">{t.title}</span>
                  <Hash className="w-3.5 h-3.5 text-orange-400" />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>معرف التوبيك:</span>
                  <span className="font-mono text-orange-300 font-bold">{t.topicId}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sites Telegram Matrix Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-orange-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              مصفوفة ربط المواقع الميدانية بجروبات وتوبيكات تليجرام
            </h3>
          </div>
          <span className="text-xs text-slate-500">إجمالي {sites.length} مواقع معتمدة</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3.5">الموقع الميداني</th>
                <th className="p-3.5">معرف جروب تليجرام (Group ID)</th>
                <th className="p-3.5">معرف التوبيك (Topic ID)</th>
                <th className="p-3.5">المشرفين المعتمدين</th>
                <th className="p-3.5">حالة الربط</th>
                <th className="p-3.5 text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sites.map((site) => {
                const isBound = Boolean(site.telegramGroupId);
                const isPinging = pingingSiteId === site.id;

                return (
                  <tr key={site.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 dark:text-white">{site.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">كود: {site.code}</div>
                    </td>
                    <td className="p-3.5 font-mono">
                      {site.telegramGroupId ? (
                        <span className="text-slate-800 dark:text-slate-200 font-semibold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                          {site.telegramGroupId}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">غير مربوط بجروب</span>
                      )}
                    </td>
                    <td className="p-3.5 font-mono">
                      {site.telegramTopicId !== null ? (
                        <span className="text-orange-600 dark:text-orange-400 font-bold bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded">
                          #{site.telegramTopicId}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {site.supervisorCount} مشرفين
                        </span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      {isBound ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>مربوط ومعتمد</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-medium">
                          <AlertTriangle className="w-3 h-3" />
                          <span>غير مهيأ</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-left">
                      <div className="inline-flex items-center gap-2">
                        {isBound && (
                          <button
                            type="button"
                            disabled={isPinging}
                            onClick={() => handlePing(site.id)}
                            className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1 text-[11px]"
                            title="فحص اتصال البوت بهذا الجروب"
                          >
                            <Activity className={`w-3 h-3 ${isPinging ? 'animate-spin text-orange-500' : ''}`} />
                            <span>فحص الاتصال</span>
                          </button>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openEditModal(site)}
                            className="px-2.5 py-1 rounded bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 hover:bg-orange-100 transition-colors flex items-center gap-1 text-[11px] font-semibold"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>تعديل الربط</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Outbox Enforcement Queue Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-orange-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              طابور مهام إنفاذ تليجرام الميداني (Telegram Enforcement Tasks Queue)
            </h3>
          </div>
          <span className="text-xs text-slate-500">آخر {recentTasks.length} مهام معالجة</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3">نوع الإجراء</th>
                <th className="p-3">معرف المستخدم</th>
                <th className="p-3">معرف الجروب</th>
                <th className="p-3">الحالة</th>
                <th className="p-3">إعادة المحاولة</th>
                <th className="p-3">تاريخ المعالجة</th>
                <th className="p-3">ملاحظات / أخطاء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
              {recentTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400 font-sans">
                    لا توجد مهام معلقة في طابور إنفاذ تليجرام حالياً
                  </td>
                </tr>
              ) : (
                recentTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-bold font-sans">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] ${
                          task.taskType === 'KICK_MEMBER'
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                            : task.taskType === 'BAN_MEMBER'
                            ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                            : 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                        }`}
                      >
                        {task.taskType}
                      </span>
                    </td>
                    <td className="p-3">{task.telegramId}</td>
                    <td className="p-3">{task.chatId}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-sans ${
                          task.status === 'COMPLETED'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                            : task.status === 'FAILED'
                            ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {task.status}
                      </span>
                    </td>
                    <td className="p-3 font-sans">{task.retryCount}</td>
                    <td className="p-3 text-slate-400 font-sans">
                      {task.completedAt ? task.completedAt.substring(0, 16).replace('T', ' ') : task.createdAt.substring(0, 16).replace('T', ' ')}
                    </td>
                    <td className="p-3 text-slate-500 font-sans truncate max-w-xs">
                      {task.lastError || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Binding Modal */}
      {editingSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-orange-600" />
                <span>تعديل ربط مجموعة تليجرام لموقع {editingSite.name}</span>
              </h4>
              <button
                onClick={closeEditModal}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSiteLink} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  معرف مجموعة تليجرام (Telegram Group ID)
                </label>
                <input
                  type="text"
                  value={editGroupId}
                  onChange={(e) => setEditGroupId(e.target.value)}
                  placeholder="-100xxxxxxxxxx"
                  dir="ltr"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  ملاحظة: يبدأ معرف السوبر جروب دائماً بـ -100 (مثلاً: -1002450410741)
                </p>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  معرف التوبيك (Topic Thread ID) — اختياري
                </label>
                <input
                  type="number"
                  value={editTopicId}
                  onChange={(e) => setEditTopicId(e.target.value)}
                  placeholder="مثال: 12"
                  dir="ltr"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  يُترك فارغاً إذا كان الموقع يملك مجموعة مستقلة وليس خيطاً (Topic) داخل سوبر جروب مركزي.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>حفظ الربط</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
