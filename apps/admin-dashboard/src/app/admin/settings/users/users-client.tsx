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
} from 'lucide-react';
import type { UserManagementItem, WorkerDelegationItem } from '@/lib/data-fetchers';
import { ZeroStateCard } from '@/components/ui/zero-state-card';

interface UsersClientProps {
  initialUsers: UserManagementItem[];
  initialDelegations: WorkerDelegationItem[];
  currentUserRole: string;
  canManageDelegations: boolean;
}

type SettingsTab = 'users' | 'delegations' | 'legacy_review';

export function UsersClient({
  initialUsers,
  initialDelegations,
  currentUserRole,
  canManageDelegations,
}: UsersClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const filteredUsers = initialUsers.filter(
    (u) =>
      (u.name && u.name.includes(searchTerm)) ||
      u.telegramId.includes(searchTerm) ||
      u.role.includes(searchTerm) ||
      u.assignedSite.includes(searchTerm)
  );
  const filtered = filteredUsers;

  const legacyAwaitingUsers = initialUsers.filter(
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
    } catch (err: any) {
      setActionError(err.message || 'حدث خطأ أثناء معالجة الطلب');
    } finally {
      setActionLoading(null);
    }
  };

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
              <Users className="w-5 h-5 text-orange-600" />
              <span>إدارة وتفويض المستخدمين ومصفوفة الصلاحيات (Flow 00.12)</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              إدارة حسابات الأدوار السبعة المعتمدة، تفويضات العامل المشرف، وسجل المراجعة الجنائية.
            </p>
          </div>
        </div>
      </div>

      {/* Action Alerts */}
      {actionError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 text-orange-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-orange-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4 pt-2 gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors min-h-[44px] ${
            activeTab === 'users'
              ? 'border-orange-600 text-orange-600 bg-orange-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>حسابات المستخدمين ({initialUsers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('delegations')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors min-h-[44px] ${
            activeTab === 'delegations'
              ? 'border-orange-600 text-orange-600 bg-orange-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>تفويضات العامل المشرف ({initialDelegations.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('legacy_review')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors min-h-[44px] ${
            activeTab === 'legacy_review'
              ? 'border-orange-600 text-orange-600 bg-orange-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>مراجعة الحسابات المعلقة ({legacyAwaitingUsers.length})</span>
        </button>
      </div>

      {/* Search Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
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
            className="w-full pr-9 pl-4 py-2.5 min-h-[44px] text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* Tab 1: Users Table */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
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
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-3 px-4">اسم المستخدم</th>
                    <th className="py-3 px-4">معرف التليجرام</th>
                    <th className="py-3 px-4">رتبة الصلاحية (RBAC)</th>
                    <th className="py-3 px-4">الموقع المسند</th>
                    <th className="py-3 px-4">الحالة التشغيلية</th>
                    <th className="py-3 px-4">آخر نشاط</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-slate-900">{u.name || 'بدون اسم'}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{u.telegramId}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{u.assignedSite}</td>
                      <td className="py-3.5 px-4">
                        {u.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 text-orange-600 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>نشط</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-400 font-semibold">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>معطل / مراجع</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">{u.lastActive}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Delegations Table */}
      {activeTab === 'delegations' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
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
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
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
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredDelegations.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 bg-orange-50 text-orange-800 px-2 py-0.5 rounded inline-block">
                          {d.workerNickname}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          #{d.workerCode} - {d.workerName}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-medium">{d.siteName}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800 bg-slate-50 px-2 py-1 rounded border border-slate-200 inline-block mt-2">
                        {d.permissionKey}
                      </td>
                      <td className="py-3.5 px-4">
                        {d.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full font-bold text-[11px]">
                            <CheckCircle2 className="w-3 h-3 text-orange-600" />
                            <span>ساري (ACTIVE)</span>
                          </span>
                        ) : d.status === 'PENDING' ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-bold text-[11px]">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>قيد الاعتماد (PENDING)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full font-bold text-[11px]">
                            <XCircle className="w-3 h-3 text-slate-500" />
                            <span>ملغي (REVOKED)</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">{d.startsAt}</td>
                      <td className="py-3.5 px-4 text-slate-600 text-xs max-w-xs truncate">{d.reason || '-'}</td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {d.status === 'PENDING' && canManageDelegations && (
                            <>
                              <button
                                type="button"
                                disabled={actionLoading === d.id}
                                onClick={() => handleDelegationAction(d.id, 'APPROVE')}
                                className="px-2.5 py-1.5 bg-orange-600 text-white rounded text-[11px] font-bold hover:bg-orange-700 transition-colors min-h-[36px]"
                              >
                                اعتماد
                              </button>
                              <button
                                type="button"
                                disabled={actionLoading === d.id}
                                onClick={() => handleDelegationAction(d.id, 'REJECT')}
                                className="px-2.5 py-1.5 bg-slate-200 text-slate-700 rounded text-[11px] font-semibold hover:bg-slate-300 transition-colors min-h-[36px]"
                              >
                                رفض
                              </button>
                            </>
                          )}
                          {d.status === 'ACTIVE' && (
                            <button
                              type="button"
                              disabled={actionLoading === d.id}
                              onClick={() => handleDelegationAction(d.id, 'REVOKE')}
                              className="px-2.5 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[11px] font-bold hover:bg-rose-100 transition-colors min-h-[36px]"
                            >
                              سحب التفويض
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Legacy Accounts Review */}
      {activeTab === 'legacy_review' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs space-y-4 p-4">
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
            <h3 className="font-bold flex items-center gap-1.5 text-sm mb-1">
              <Shield className="w-4 h-4 text-amber-700" />
              <span>سجل الحسابات المهاجرة والمعلقة للمراجعة السيادية (Migration Gate)</span>
            </h3>
            <p>
              كافة الحسابات التي حملت أدواراً ملغاة سابقة (مثل محاسب، مدير مشروع، مهندس موقع) تم تجميدها وتحويلها إلى دور ضيف (GUEST) مع تعطيل الدخول التلقائي، لحين مراجعتها وإعادة تعيين دورها المعتمد من قبل مدير عام المنظومة حصراً.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-3 px-4">اسم الحساب</th>
                  <th className="py-3 px-4">معرف التليجرام</th>
                  <th className="py-3 px-4">الحالة الحالية</th>
                  <th className="py-3 px-4">الموقع المسند</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {legacyAwaitingUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-slate-900">{u.name || 'بدون اسم'}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">{u.telegramId}</td>
                    <td className="py-3.5 px-4">
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono text-[11px]">
                        {u.role} (معلق)
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{u.assignedSite}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
