import React from 'react';
import Link from 'next/link';
import { ArrowRight, Database, ShieldCheck } from 'lucide-react';
import { requireDashboardUser } from '@/lib/auth';
import { SystemBackupRecoveryService } from '@alsaada/settings';
import { BackupClient } from './backup-client';

const backupService = new SystemBackupRecoveryService();

export const metadata = {
  title: 'النسخ الاحتياطي واستعادة الكوارث | لوحة التحكم',
  description: 'إدارة واستعادة لقطات قاعدة البيانات وكود المشروع والمرفقات واستمرارية الأعمال',
};

export default async function AdminBackupSettingsPage() {
  const user = await requireDashboardUser();

  // Enforce GENERAL_ADMIN or SUPER_ADMIN
  const canAccess = ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(user.role);
  if (!canAccess) {
    return (
      <div className="p-8 text-center bg-rose-50 text-rose-800 rounded-xl border border-rose-200">
        <h2 className="text-lg font-bold">غير مصرح لك بالوصول</h2>
        <p className="text-sm mt-1">تقتصر إدارة النسخ الاحتياطي واستعادة الكوارث حصراً على المشرف العام والسوبر أدمن.</p>
      </div>
    );
  }

  const backups = await backupService.listRecentBackups();
  const stats = await backupService.getBackupStatus();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/settings"
            className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
          >
            <ArrowRight className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Database className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <span>النسخ الاحتياطي الكامل واستعادة الكوارث (Work Plan 99)</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              أرشفة واستعادة شاملة لقواعد البيانات، حزم Git للكود البرمجي، والمرفقات المشفرة مع مزامنة Google Drive.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 text-white px-3.5 py-2 rounded-xl text-xs font-mono border border-slate-800 min-h-[44px]">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>DR Drill Ready &bull; RPO &lt; 24h</span>
        </div>
      </div>

      {/* Main Interactive Client */}
      <BackupClient initialBackups={backups} stats={stats} />
    </div>
  );
}
