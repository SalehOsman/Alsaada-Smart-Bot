'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  Search,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Key,
  Shield,
  UserCheck,
  Clock,
  XCircle,
  Building2,
  FileCheck2,
  SlidersHorizontal,
  MessageSquare,
  Lock,
  Unlock,
  Palmtree,
  Briefcase,
  ArrowLeftRight,
  Ban,
  X,
  RefreshCw,
} from 'lucide-react';
import type { UserManagementItem, WorkerDelegationItem } from '@/lib/data-fetchers';
import { ZeroStateCard } from '@/components/ui/zero-state-card';

interface SiteItem {
  id: string;
  name: string;
  code: string;
}

interface UsersClientProps {
  initialUsers: UserManagementItem[];
  initialDelegations: WorkerDelegationItem[];
  availableSites?: SiteItem[];
  currentUserRole: string;
  canManageDelegations: boolean;
}

type SettingsTab = 'users' | 'delegations' | 'legacy_review';

export function UsersClient({
  initialUsers,
  initialDelegations,
  availableSites = [],
  currentUserRole,
  canManageDelegations,
}: UsersClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [usersList, setUsersList] = useState<UserManagementItem[]>(initialUsers);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Lifecycle Modal State
  const [lifecycleUser, setLifecycleUser] = useState<UserManagementItem | null>(null);
  const [selectedActionType, setSelectedActionType] = useState<'LEAVE_START' | 'LEAVE_RETURN' | 'SITE_TRANSFER' | 'TERMINATION'>('LEAVE_START');
  const [targetSiteId, setTargetSiteId] = useState<string>('');
  const [lifecycleNotes, setLifecycleNotes] = useState<string>('');
  const [isSubmittingLifecycle, setIsSubmittingLifecycle] = useState(false);

  const canEdit = ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(currentUserRole);

  const filteredUsers = usersList.filter(
    (u) =>
      (u.name && u.name.includes(searchTerm)) ||
      u.telegramId.includes(searchTerm) ||
      u.role.includes(searchTerm) ||
      u.assignedSite.includes(searchTerm)
  );
  const filtered = filteredUsers;

  const legacyAwaitingUsers = usersList.filter(
    (u) => u.status === 'REVOKED' || u.role === 'GUEST'
  );

  const filteredDelegations = initialDelegations.filter(
    (d) =>
      d.workerName.includes(searchTerm) ||
      d.workerNickname.includes(searchTerm) ||
      d.workerCode.includes(searchTerm) ||
      d.siteName.includes(searchTerm) ||
      d.permissionKey.includes(searchTerm)
  );

  const handleDelegationAction = async (delegationId: string, action: 'APPROVE' | 'REJECT' | 'REVOKE') => {
    setActionLoading(delegationId);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/delegations/${delegationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'فشل تحديث حالة التفويض');
      }

      setActionSuccess(
        action === 'APPROVE'
          ? 'تم اعتماد التفويض وترقية العامل المشرف بنجاح!'
          : action === 'REVOKE'
          ? 'تم سحب التفويض وإعادة ضبط رتبة العامل بنجاح!'
          : 'تم رفض طلب التفويض'
      );
      router.refresh();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'حدث خطأ أثناء معالجة الطلب');
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle supervisor leave policy switches
  const handleTogglePolicy = async (
    userId: string,
    field: 'freezeBotAccessOnLeave' | 'ejectTelegramOnLeave',
    currentValue: boolean
  ) => {
    if (!canEdit) return;
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch('/api/supervisors/policies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supervisorId: userId,
          [field]: !currentValue,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تحديث سياسة المشرف');

      // Update local state
      setUsersList((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, [field]: !currentValue } : u))
      );
      setActionSuccess(data.message || 'تم تحديث سياسة المشرف بنجاح');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'فشل تحديث السياسة');
    }
  };

  // Open lifecycle modal
  const openLifecycleModal = (user: UserManagementItem) => {
    setLifecycleUser(user);
    setSelectedActionType(user.isOnLeave ? 'LEAVE_RETURN' : 'LEAVE_START');
    setTargetSiteId(availableSites[0]?.id || '');
    setLifecycleNotes('');
  };

  const closeLifecycleModal = () => {
    setLifecycleUser(null);
    setLifecycleNotes('');
  };

  // Submit supervisor lifecycle action
  const handleLifecycleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lifecycleUser) return;

    try {
      setIsSubmittingLifecycle(true);
      setActionError(null);
      setActionSuccess(null);

      const res = await fetch('/api/supervisors/lifecycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supervisorId: lifecycleUser.id,
          actionType: selectedActionType,
          targetSiteId: selectedActionType === 'SITE_TRANSFER' ? targetSiteId : undefined,
          notes: lifecycleNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تنفيذ إجراء دورة الحياة');

      setActionSuccess(data.message || 'تم تنفيذ الإجراء بنجاح');
      setTimeout(() => setActionSuccess(null), 4000);

      // Optimistically update local users
      setUsersList((prev) =>
        prev.map((u) => {
          if (u.id === lifecycleUser.id) {
            if (selectedActionType === 'LEAVE_START') {
              return { ...u, isOnLeave: true, status: u.freezeBotAccessOnLeave ? 'REVOKED' : u.status };
            }
            if (selectedActionType === 'LEAVE_RETURN') {
              return { ...u, isOnLeave: false, status: 'ACTIVE' };
            }
            if (selectedActionType === 'TERMINATION') {
              return { ...u, status: 'REVOKED', assignedSite: 'تم إنهاء الخدمة' };
            }
            if (selectedActionType === 'SITE_TRANSFER') {
              const newSite = availableSites.find((s) => s.id === targetSiteId);
              return { ...u, assignedSite: newSite?.name || u.assignedSite };
            }
          }
          return u;
        })
      );

      closeLifecycleModal();
      router.refresh();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'فشل تنفيذ الإجراء');
    } finally {
      setIsSubmittingLifecycle(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/settings"
            className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-600 dark:text-orange-500" />
              <span>إدارة وتفويض المستخدمين ومصفوفة الصلاحيات (Flow 00.12)</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              إدارة رتب المشرفين، سياسات الإجازات القابلة للتخصيص، وتفويضات العمال.
            </p>
          </div>
        </div>

        {/* Quick Links to Matrix and Telegram Groups Suite */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/settings/matrix"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-orange-500 hover:text-orange-600 dark:hover:text-orange-400 transition-colors shadow-xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-orange-600" />
            <span>مصفوفة الصلاحيات (RBAC)</span>
          </Link>

          <Link
            href="/admin/settings/telegram-groups"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-orange-500 hover:text-orange-600 dark:hover:text-orange-400 transition-colors shadow-xs"
          >
            <MessageSquare className="w-3.5 h-3.5 text-orange-600" />
            <span>مجموعات تليجرام</span>
          </Link>
        </div>
      </div>

      {/* Action Alerts */}
      {actionError && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-xl px-4 pt-2 gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors min-h-[44px] cursor-pointer ${
            activeTab === 'users'
              ? 'border-orange-600 dark:border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-50/50 dark:bg-orange-950/40'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>حسابات المستخدمين ({usersList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('delegations')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors min-h-[44px] cursor-pointer ${
            activeTab === 'delegations'
              ? 'border-orange-600 dark:border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-50/50 dark:bg-orange-950/40'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>تفويضات العامل المشرف ({initialDelegations.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('legacy_review')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors min-h-[44px] cursor-pointer ${
            activeTab === 'legacy_review'
              ? 'border-orange-600 dark:border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-50/50 dark:bg-orange-950/40'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>مراجعة الحسابات المعلقة ({legacyAwaitingUsers.length})</span>
        </button>
      </div>

      {/* Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={
              activeTab === 'users'
                ? 'بحث بالاسم، معرف التليجرام، أو الرتبة الصلاحية...'
                : activeTab === 'delegations'
                ? 'بحث باسم العامل، اسم الشهرة، الكود، الموقع، أو الصلاحية المفوضة...'
                : 'بحث بالحسابات المعلقة...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-9 pl-4 py-2.5 min-h-[44px] text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* Tab 1: Users Table */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
          {filtered.length === 0 ? (
            <ZeroStateCard
              icon={Users}
              title="لا يوجد مستخدمون مطابقون لمعايير البحث"
              description="لم يتم العثور على أي حسابات مستخدمين تطابق الكلمات المحددة."
              onResetFilter={() => setSearchTerm('')}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold">
                  <tr>
                    <th className="py-3 px-4">اسم المستخدم</th>
                    <th className="py-3 px-4">معرف التليجرام</th>
                    <th className="py-3 px-4">رتبة الصلاحية</th>
                    <th className="py-3 px-4">الموقع المسند</th>
                    <th className="py-3 px-4">الحالة التشغيلية</th>
                    <th className="py-3 px-4">سياسات الإجازات</th>
                    <th className="py-3 px-4 text-center">إجراءات دورة الحياة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {filteredUsers.map((u) => {
                    const isSupervisor = ['FIELD_ADMIN', 'WORKER_SUPERVISOR'].includes(u.role);

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                          {u.name || 'بدون اسم'}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                          {u.telegramId}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded border border-orange-200 dark:border-orange-800/50">
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">{u.assignedSite}</td>
                        <td className="py-3.5 px-4">
                          {u.status === 'ACTIVE' ? (
                            u.isOnLeave ? (
                              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full font-bold border border-amber-200 dark:border-amber-800/50 text-[11px]">
                                <Palmtree className="w-3.5 h-3.5 text-amber-600" />
                                <span>في إجازة</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full font-bold border border-emerald-200 dark:border-emerald-800/50 text-[11px]">
                                <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                                <span>على رأس العمل</span>
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-500 font-semibold text-[11px]">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>معطل / مراجع</span>
                            </span>
                          )}
                        </td>

                        {/* Leave Policy Switches */}
                        <td className="py-3.5 px-4">
                          {isSupervisor ? (
                            <div className="flex items-center gap-2">
                              {/* Bot Freeze Toggle */}
                              <button
                                type="button"
                                disabled={!canEdit}
                                onClick={() => handleTogglePolicy(u.id, 'freezeBotAccessOnLeave', u.freezeBotAccessOnLeave)}
                                className={`px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors ${
                                  u.freezeBotAccessOnLeave
                                    ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800'
                                }`}
                                title="تجميد صلاحيات البوت أثناء الإجازة"
                              >
                                {u.freezeBotAccessOnLeave ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                                <span>حظر البوت</span>
                              </button>

                              {/* Telegram Kick Toggle */}
                              <button
                                type="button"
                                disabled={!canEdit}
                                onClick={() => handleTogglePolicy(u.id, 'ejectTelegramOnLeave', u.ejectTelegramOnLeave)}
                                className={`px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors ${
                                  u.ejectTelegramOnLeave
                                    ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800'
                                }`}
                                title="طرد/حجب من جروب التليجرام أثناء الإجازة"
                              >
                                <Ban className="w-2.5 h-2.5" />
                                <span>طرد الجروب</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>

                        {/* Lifecycle Action Button */}
                        <td className="py-3.5 px-4 text-center">
                          {isSupervisor && canEdit ? (
                            <button
                              type="button"
                              onClick={() => openLifecycleModal(u)}
                              className="px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-950/40 dark:hover:text-orange-400 transition-colors border border-slate-200 dark:border-slate-700"
                            >
                              إجراءات دورة الحياة
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Delegations Table */}
      {activeTab === 'delegations' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
          {filteredDelegations.length === 0 ? (
            <ZeroStateCard
              icon={UserCheck}
              title="لا توجد تفويضات مسجلة حالياً"
              description="لم يتم تقديم أو اعتماد أي تفويضات تشغيلية لعامل مشرف في هذا النطاق."
              onResetFilter={() => setSearchTerm('')}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold">
                  <tr>
                    <th className="py-3 px-4">العامل المشرف</th>
                    <th className="py-3 px-4">الموقع</th>
                    <th className="py-3 px-4">الصلاحية المفوضة</th>
                    <th className="py-3 px-4">الحالة</th>
                    <th className="py-3 px-4">تاريخ البدء</th>
                    <th className="py-3 px-4">السبب</th>
                    <th className="py-3 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {filteredDelegations.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100 bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 px-2 py-0.5 rounded inline-block border border-orange-200/60 dark:border-orange-800/50">
                          {d.workerNickname}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          #{d.workerCode} - {d.workerName}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-medium">{d.siteName}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 inline-block mt-2">
                        {d.permissionKey}
                      </td>
                      <td className="py-3.5 px-4">
                        {d.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/50 px-2 py-0.5 rounded-full font-bold text-[11px]">
                            <CheckCircle2 className="w-3 h-3 text-orange-600 dark:text-orange-500" />
                            <span>ساري (ACTIVE)</span>
                          </span>
                        ) : d.status === 'PENDING' ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 px-2 py-0.5 rounded-full font-bold text-[11px]">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>معلق (PENDING)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full font-medium text-[11px]">
                            <XCircle className="w-3 h-3 text-slate-400" />
                            <span>ملغي (REVOKED)</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">{d.startsAt}</td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 text-xs">{d.reason || '-'}</td>
                      <td className="py-3.5 px-4 text-center">
                        {canManageDelegations && d.status === 'ACTIVE' && (
                          <button
                            type="button"
                            disabled={actionLoading === d.id}
                            onClick={() => handleDelegationAction(d.id, 'REVOKE')}
                            className="text-xs bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
                          >
                            {actionLoading === d.id ? 'جاري السحب...' : 'سحب الصلاحية'}
                          </button>
                        )}
                        {canManageDelegations && d.status === 'PENDING' && (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              disabled={actionLoading === d.id}
                              onClick={() => handleDelegationAction(d.id, 'APPROVE')}
                              className="text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
                            >
                              اعتماد
                            </button>
                            <button
                              type="button"
                              disabled={actionLoading === d.id}
                              onClick={() => handleDelegationAction(d.id, 'REJECT')}
                              className="text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
                            >
                              رفض
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Legacy Review Table */}
      {activeTab === 'legacy_review' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
          {legacyAwaitingUsers.length === 0 ? (
            <ZeroStateCard
              icon={FileCheck2}
              title="لا توجد حسابات معلقة للمراجعة"
              description="كافة الحسابات الميدانية معتمدة ومطابقة لبروتوكول الأمان المؤسسي."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold">
                  <tr>
                    <th className="py-3 px-4">اسم المستخدم</th>
                    <th className="py-3 px-4">معرف التليجرام</th>
                    <th className="py-3 px-4">الرتبة</th>
                    <th className="py-3 px-4">الموقع</th>
                    <th className="py-3 px-4">حالة الحساب</th>
                    <th className="py-3 px-4 text-center">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {legacyAwaitingUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-slate-100">{u.name}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400">{u.telegramId}</td>
                      <td className="py-3.5 px-4 font-mono">{u.role}</td>
                      <td className="py-3.5 px-4">{u.assignedSite}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-[11px]">
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Link
                          href={`/admin/settings/users`}
                          className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                        >
                          مراجعة
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Supervisor Lifecycle Action Modal */}
      {lifecycleUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  إجراءات دورة حياة المشرف: {lifecycleUser.name}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                  الموقع الحالي: {lifecycleUser.assignedSite} | الحالة: {lifecycleUser.isOnLeave ? 'في إجازة' : 'على رأس العمل'}
                </p>
              </div>
              <button
                onClick={closeLifecycleModal}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLifecycleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-2">
                  اختر الإجراء المطلوب تنفيذه:
                </label>
                <div className="space-y-2">
                  {/* Leave Start / Return */}
                  {!lifecycleUser.isOnLeave ? (
                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="actionType"
                        value="LEAVE_START"
                        checked={selectedActionType === 'LEAVE_START'}
                        onChange={() => setSelectedActionType('LEAVE_START')}
                        className="text-orange-600"
                      />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Palmtree className="w-3.5 h-3.5 text-amber-500" />
                          <span>تسجيل بدء إجازة للمشرف</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          يطبق سياسات حجب البوت ({lifecycleUser.freezeBotAccessOnLeave ? 'مفعل' : 'معطل'}) وحجب التليجرام ({lifecycleUser.ejectTelegramOnLeave ? 'مفعل' : 'معطل'}).
                        </div>
                      </div>
                    </label>
                  ) : (
                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="actionType"
                        value="LEAVE_RETURN"
                        checked={selectedActionType === 'LEAVE_RETURN'}
                        onChange={() => setSelectedActionType('LEAVE_RETURN')}
                        className="text-orange-600"
                      />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-emerald-500" />
                          <span>استئناف العمل والعودة من الإجازة</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          إعادة تفعيل صلاحيات البوت فورياً وإرسال رابط دخول جروب الموقع.
                        </div>
                      </div>
                    </label>
                  )}

                  {/* Site Transfer */}
                  <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="actionType"
                      value="SITE_TRANSFER"
                      checked={selectedActionType === 'SITE_TRANSFER'}
                      onChange={() => setSelectedActionType('SITE_TRANSFER')}
                      className="text-orange-600"
                    />
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <ArrowLeftRight className="w-3.5 h-3.5 text-blue-500" />
                        <span>نقل المشرف إلى موقع آخر</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        طرد من جروب الموقع القديم وتوليد رابط دعوة لمجموعة الموقع الجديد.
                      </div>
                    </div>
                  </label>

                  {/* Termination */}
                  <label className="flex items-center gap-2 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-50 cursor-pointer">
                    <input
                      type="radio"
                      name="actionType"
                      value="TERMINATION"
                      checked={selectedActionType === 'TERMINATION'}
                      onChange={() => setSelectedActionType('TERMINATION')}
                      className="text-rose-600"
                    />
                    <div>
                      <div className="font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                        <Ban className="w-3.5 h-3.5 text-rose-600" />
                        <span>إنهاء الخدمة والحظر الدائم</span>
                      </div>
                      <div className="text-[11px] text-rose-500">
                        حظر من البوت، طرد نهائي من المجموعات، وسحب كافة الصلاحيات.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Target Site Dropdown for Transfer */}
              {selectedActionType === 'SITE_TRANSFER' && (
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    الموقع الميداني الجديد:
                  </label>
                  <select
                    value={targetSiteId}
                    onChange={(e) => setTargetSiteId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  >
                    {availableSites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  ملاحظات أو مبررات القرار:
                </label>
                <textarea
                  rows={2}
                  value={lifecycleNotes}
                  onChange={(e) => setLifecycleNotes(e.target.value)}
                  placeholder="ملاحظات توثيقية ستسجل في سجل التدقيق الجنائي..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeLifecycleModal}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingLifecycle}
                  className={`px-4 py-2 rounded-lg text-white font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
                    selectedActionType === 'TERMINATION'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-orange-600 hover:bg-orange-700'
                  }`}
                >
                  {isSubmittingLifecycle && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>تأكيد الإجراء</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
