'use client';

import React, { useState } from 'react';
import {
  Database,
  ShieldCheck,
  RefreshCw,
  HardDrive,
  Cloud,
  Lock,
  Play,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Clock,
  FileCode,
  Archive,
  Hash,
} from 'lucide-react';

export interface BackupItem {
  backupId: string;
  createdAt: string;
  dbDumpFile?: string | undefined;
  codeBundleFile?: string | undefined;
  totalSizeBytes: number;
  isIntegrityIntact: boolean;
  artifactsCount?: number | undefined;
}

export interface BackupClientProps {
  initialBackups: BackupItem[];
  stats: {
    totalBackups: number;
    latestBackupAt: string | null;
    rpoStatus: string;
    cloudSyncEnabled: boolean;
    encryptionType: string;
    zeroBloatLimitMb: number;
  };
}

export function BackupClient({ initialBackups, stats }: BackupClientProps) {
  const [backups, setBackups] = useState<BackupItem[]>(initialBackups);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Restore Modal State
  const [selectedBackup, setSelectedBackup] = useState<BackupItem | null>(null);
  const [confirmCode, setConfirmCode] = useState('');
  const [coldPassphrase, setColdPassphrase] = useState('');
  const [restoring, setRestoring] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const expectedConfirmCode = `RESTORE-${todayStr}`;

  const refreshList = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/backup');
      const data = await res.json();
      if (data.backups) {
        setBackups(data.backups);
      }
    } catch (err: any) {
      setMessage({ text: `فشل تحديث القائمة: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشلت العملية');

      setMessage({ text: data.message || 'تم إنشاء النسخة الاحتياطية بنجاح!', type: 'success' });
      await refreshList();
    } catch (err: any) {
      setMessage({ text: `خطأ: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleRunDrill = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'drill' }),
      });
      const data = await res.json();
      if (!res.ok || !data.drillResult?.ok) {
        throw new Error(data.error || data.drillResult?.errors?.join(', ') || 'فشل تدريب الكوارث');
      }

      setMessage({
        text: `✅ نجح تدريب الكوارث الآلي بنسبة 100%! زمن RTO: ${data.drillResult.metrics.rtoSeconds} ثانية | حجم حزمة الكود: ${(data.drillResult.metrics.bundleSizeBytes / (1024 * 1024)).toFixed(2)} MB`,
        type: 'success',
      });
      await refreshList();
    } catch (err: any) {
      setMessage({ text: `فشل تدريب الكوارث: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!selectedBackup) return;

    try {
      setRestoring(true);
      setMessage(null);

      const res = await fetch('/api/admin/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backupId: selectedBackup.backupId,
          confirmationCode: confirmCode,
          coldPassphrase: coldPassphrase || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشلت عملية الاستعادة');

      setMessage({
        text: `✅ تمت الاستعادة بنجاح! تم أخذ لقطة أمان مسبقة (${data.safetyBackupId}) واجتياز كافة بوابات التحقق المالي.`,
        type: 'success',
      });
      setSelectedBackup(null);
      setConfirmCode('');
      setColdPassphrase('');
      await refreshList();
    } catch (err: any) {
      setMessage({ text: `فشلت الاستعادة: ${err.message}`, type: 'error' });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Notification */}
      {message && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-xs underline hover:no-underline opacity-80"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Live System Cockpit Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* RPO Status */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-2">
            <span>مؤشر RPO للتعافي</span>
            <Clock className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>RPO &lt; 24h</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {stats.latestBackupAt
              ? `آخر نسخة: ${new Date(stats.latestBackupAt).toLocaleTimeString('ar-EG')}`
              : 'لا توجد لقطات مسجلة بعد'}
          </p>
        </div>

        {/* Physical Host Storage */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-2">
            <span>التخزين المادي المضيف</span>
            <HardDrive className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
            <span>./backups/</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            محمي خارج بيئة دوكر تماماً
          </p>
        </div>

        {/* Encryption Armor */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-2">
            <span>التشفير والمفتاح البارد</span>
            <Lock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
            <span>AES-256-GCM</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            حل معضلة المفتاح (Passphrase Ready)
          </p>
        </div>

        {/* Zero-Bloat Budget */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-2">
            <span>حظر التضخم (Zero-Bloat)</span>
            <ShieldCheck className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
            <span>&lt; 30 MB</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            استبعاد node_modules ومخلفات البناء
          </p>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={handleCreateBackup}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-medium text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 min-h-[44px]"
          >
            <Database className="w-4 h-4" />
            <span>⚡ أخذ نسخة احتياطية فورية الآن</span>
          </button>

          <button
            onClick={handleRunDrill}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs flex items-center gap-2 border border-slate-700 transition-all disabled:opacity-50 min-h-[44px]"
          >
            <Play className="w-4 h-4 text-amber-400" />
            <span>🧪 تشغيل اختبار استعادة الكوارث (DR Drill)</span>
          </button>
        </div>

        <button
          onClick={refreshList}
          disabled={loading}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
          title="تحديث القائمة"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Snapshots Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Archive className="w-4 h-4 text-orange-500" />
            <span>سجل اللقطات الاحتياطية المتاحة ({backups.length})</span>
          </h2>
          <span className="text-xs text-slate-500 font-mono">SHA-256 Verified SSOT</span>
        </div>

        {backups.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
            لا توجد نسخ احتياطية مسجلة بعد. انقر على &quot;أخذ نسخة احتياطية فورية&quot; لبدء الأرشفة الأولى.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="p-3">معرف النسخة (Backup ID)</th>
                  <th className="p-3">تاريخ ووقت الإنشاء</th>
                  <th className="p-3">قاعدة البيانات</th>
                  <th className="p-3">كود المشروع</th>
                  <th className="p-3">الحجم الإجمالي</th>
                  <th className="p-3">سلامة الهاش</th>
                  <th className="p-3 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {backups.map((item) => (
                  <tr key={item.backupId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3 font-mono font-medium text-slate-900 dark:text-slate-100">
                      {item.backupId}
                    </td>
                    <td className="p-3">
                      {new Date(item.createdAt).toLocaleString('ar-EG')}
                    </td>
                    <td className="p-3 font-mono text-slate-500">
                      {item.dbDumpFile || 'db-snapshot.dump.enc'}
                    </td>
                    <td className="p-3 font-mono text-slate-500">
                      {item.codeBundleFile || 'code-bundle.bundle'}
                    </td>
                    <td className="p-3 font-mono">
                      {(item.totalSizeBytes / (1024 * 1024)).toFixed(2)} MB
                    </td>
                    <td className="p-3">
                      {item.isIntegrityIntact ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>سليم ومطابق</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>معدل أو تالف</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => setSelectedBackup(item)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition-colors inline-flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                        <span>استعادة</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Secured Restore Modal */}
      {selectedBackup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold">
                <AlertTriangle className="w-5 h-5" />
                <span>نافذة الاستعادة المحصنة (Disaster Recovery Restore)</span>
              </div>
              <button
                onClick={() => setSelectedBackup(null)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <p className="font-bold">⚠️ تنبيه سيادي حرج:</p>
              <p>
                ستقوم هذه العملية باستعادة لقطة قاعدة البيانات <strong>{selectedBackup.backupId}</strong> وإعادة بناء دفاتر الأستاذ.
                سيتم أخذ <strong>لقطة أمان مسبقة تلقائياً</strong> قبل بدء الاستعادة.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  كود التأكيد الإلزامي لليوم (اكتب: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{expectedConfirmCode}</code>):
                </label>
                <input
                  type="text"
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value.trim())}
                  placeholder={expectedConfirmCode}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  عبارة الطوارئ الباردة (اختياري - في حال فقدان ملف .env):
                </label>
                <input
                  type="password"
                  value={coldPassphrase}
                  onChange={(e) => setColdPassphrase(e.target.value)}
                  placeholder="Master Cold Recovery Passphrase"
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setSelectedBackup(null)}
                disabled={restoring}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                إلغاء
              </button>

              <button
                onClick={handleExecuteRestore}
                disabled={restoring || confirmCode !== expectedConfirmCode}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs flex items-center gap-2 shadow-sm disabled:opacity-40 transition-all"
              >
                {restoring ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري تنفيذ الاستعادة والفحص الجنائي...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>تأكيد الاستعادة الفورية</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
