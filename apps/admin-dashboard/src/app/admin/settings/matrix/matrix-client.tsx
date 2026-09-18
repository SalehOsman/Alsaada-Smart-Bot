'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  SlidersHorizontal,
  Layers,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Users,
  Building2,
  UserCheck,
  ArrowRight,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface MatrixClientProps {
  currentUserRole: string;
  currentUserId: string;
}

interface RoleItem {
  id: string;
  nameAr: string;
}

interface SiteItem {
  id: string;
  name: string;
  code: string;
}

interface UserItem {
  id: string;
  name: string;
  role: string;
  telegramId: string;
}

interface FeatureContract {
  flowCode?: string;
  nameAr: string;
  permissionKey: string;
  module: string;
  delegatable?: boolean;
  allowedRoles: string[];
  allowedActions: string[];
  dataScope?: string;
  sensitiveFields?: string[];
}

interface DbPermission {
  id: string;
  scopeType: string;
  scopeId: string;
  featureKey: string;
  action: string;
  policy: 'ALLOW' | 'DENY';
}

type ScopeCategory = 'ROLE' | 'SITE' | 'USER';

export function MatrixClient({ currentUserRole }: MatrixClientProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [sites, setSites] = useState<SiteItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [catalog, setCatalog] = useState<Record<string, FeatureContract>>({});
  const [permissions, setPermissions] = useState<DbPermission[]>([]);

  // Selection state
  const [scopeCategory, setScopeCategory] = useState<ScopeCategory>('ROLE');
  const [selectedScopeId, setSelectedScopeId] = useState<string>('FIELD_ADMIN');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('ALL');
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [mutatingKey, setMutatingKey] = useState<string | null>(null);

  const canEdit = ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(currentUserRole);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/permissions/matrix');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل جلب مصفوفة الصلاحيات');

      setRoles(data.roles || []);
      setSites(data.sites || []);
      setUsers(data.users || []);
      setCatalog(data.catalog || {});
      setPermissions(data.permissions || []);

      // Default expand all modules
      const mods: Record<string, boolean> = {};
      Object.values(data.catalog as Record<string, FeatureContract>).forEach((f) => {
        mods[f.module] = true;
      });
      setExpandedModules(mods);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update default selected scope when category changes
  const handleCategoryChange = (cat: ScopeCategory) => {
    setScopeCategory(cat);
    if (cat === 'ROLE') {
      setSelectedScopeId(roles[0]?.id || 'FIELD_ADMIN');
    } else if (cat === 'SITE') {
      setSelectedScopeId(sites[0]?.id || '');
    } else if (cat === 'USER') {
      setSelectedScopeId(users[0]?.id || '');
    }
  };

  // Group features by module
  const moduleGroups = useMemo(() => {
    const groups: Record<string, FeatureContract[]> = {};
    Object.values(catalog).forEach((feat) => {
      const mod = feat.module || 'general';
      if (!groups[mod]) groups[mod] = [];

      const matchesSearch =
        feat.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
        feat.permissionKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (feat.flowCode && feat.flowCode.includes(searchQuery));

      const matchesModule = selectedModule === 'ALL' || selectedModule === mod;

      if (matchesSearch && matchesModule) {
        groups[mod].push(feat);
      }
    });
    return groups;
  }, [catalog, searchQuery, selectedModule]);

  // Check effective policy for a feature in currently selected scope
  const getPolicy = (featureKey: string, action = 'view'): 'ALLOW' | 'DENY' | 'DEFAULT' => {
    const match = permissions.find(
      (p) =>
        p.scopeType === scopeCategory &&
        p.scopeId === selectedScopeId &&
        p.featureKey === featureKey &&
        p.action === action
    );
    if (match) return match.policy;

    // Check if role has default allowed
    if (scopeCategory === 'ROLE') {
      const feat = catalog[featureKey];
      if (feat && feat.allowedRoles.includes(selectedScopeId)) {
        return 'DEFAULT';
      }
    }
    return 'DEFAULT';
  };

  const handlePolicyChange = async (
    featureKey: string,
    action: string,
    targetPolicy: 'ALLOW' | 'DENY' | 'RESET'
  ) => {
    if (!canEdit) return;
    const mutateKey = `${featureKey}:${action}`;
    setMutatingKey(mutateKey);
    setSuccessMsg(null);
    setError(null);

    try {
      const res = await fetch('/api/permissions/matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scopeType: scopeCategory,
          scopeId: selectedScopeId,
          featureKey,
          action,
          policy: targetPolicy,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تحديث الصلاحية');

      // Optimistically update local permissions
      setPermissions((prev) => {
        const filtered = prev.filter(
          (p) =>
            !(
              p.scopeType === scopeCategory &&
              p.scopeId === selectedScopeId &&
              p.featureKey === featureKey &&
              p.action === action
            )
        );
        if (targetPolicy === 'RESET') return filtered;
        return [
          ...filtered,
          {
            id: `opt_${Date.now()}`,
            scopeType: scopeCategory,
            scopeId: selectedScopeId,
            featureKey,
            action,
            policy: targetPolicy,
          },
        ];
      });

      setSuccessMsg(data.message || 'تم تحديث مصفوفة الصلاحيات');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل تحديث الصلاحية');
    } finally {
      setMutatingKey(null);
    }
  };

  const toggleModuleAccordion = (mod: string) => {
    setExpandedModules((prev) => ({ ...prev, [mod]: !prev[mod] }));
  };

  const getModuleTitle = (mod: string) => {
    switch (mod) {
      case 'workforce':
        return '👥 شؤون العاملين والموارد البشرية (Workforce)';
      case 'advances':
        return '💰 السلف والمصروفات والعهد (Advances)';
      case 'canteen':
        return '🛒 مبيعات الكانتين والمشتريات (Canteen)';
      case 'housing':
        return '🏕️ الإسكان وسكن العمال والإعاشة (Housing)';
      case 'fuel':
        return '⛽ محروقات ووقود المعدات (Fuel)';
      case 'operations':
        return '🚜 التشغيل والمعدات الميدانية (Operations)';
      case 'settings':
        return '⚙️ الإعدادات المركزية والرقابة (Settings)';
      default:
        return `📂 موديول ${mod}`;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
          جاري تحميل مصفوفة الصلاحيات الشاملة والكتالوج المعياري...
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
            <span className="text-xs font-semibold text-orange-600">مصفوفة الصلاحيات (RBAC Matrix)</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mt-1">
            <SlidersHorizontal className="w-5 h-5 text-orange-600" />
            <span>مصفوفة الصلاحيات الديناميكية الشاملة (Dynamic Permissions Matrix)</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            التحكم الهرمي الثلاثي (السماح / الحظر الصريح / الافتراضي) على مستوى الرتب الوظيفية، المواقع، والمستخدمين.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>تحديث المصفوفة</span>
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Controls & Scope Selector Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Scope Category Switcher */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              نطاق التخصيص (Scope Type)
            </label>
            <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => handleCategoryChange('ROLE')}
                className={`py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                  scopeCategory === 'ROLE'
                    ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>رتبة وظيفية</span>
              </button>
              <button
                type="button"
                onClick={() => handleCategoryChange('SITE')}
                className={`py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                  scopeCategory === 'SITE'
                    ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>موقع ميداني</span>
              </button>
              <button
                type="button"
                onClick={() => handleCategoryChange('USER')}
                className={`py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                  scopeCategory === 'USER'
                    ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>مستخدم محدد</span>
              </button>
            </div>
          </div>

          {/* Scope Target Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {scopeCategory === 'ROLE'
                ? 'اختر الرتبة المستهدفة'
                : scopeCategory === 'SITE'
                ? 'اختر الموقع المستهدف'
                : 'اختر المستخدم المستهدف'}
            </label>
            <select
              value={selectedScopeId}
              onChange={(e) => setSelectedScopeId(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
            >
              {scopeCategory === 'ROLE' &&
                roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nameAr} ({r.id})
                  </option>
                ))}
              {scopeCategory === 'SITE' &&
                sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              {scopeCategory === 'USER' &&
                users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.role} (ID: {u.telegramId})
                  </option>
                ))}
            </select>
          </div>

          {/* Search Feature */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              بحث في الوظائف والصلاحيات
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم الوظيفة أو المعرف..."
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg pr-9 pl-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-slate-700 dark:text-slate-300">دلالات الألوان:</span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span>مسموح صراحة (ALLOW)</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
              <span>محظور صراحة (DENY - أسبقية مطلقة)</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600 inline-block" />
              <span>افتراضي / موروث (DEFAULT)</span>
            </span>
          </div>

          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <Info className="w-3.5 h-3.5" />
            <span>الحظر الصريح (DENY) يلغي أي سماح موروث أو مفوض فورياً.</span>
          </div>
        </div>
      </div>

      {/* Accordion Groups */}
      <div className="space-y-4">
        {Object.keys(moduleGroups).length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-xs text-slate-500">
            لا توجد وظائف مطابقة لمعايير البحث الحالية
          </div>
        ) : (
          Object.entries(moduleGroups).map(([mod, features]) => {
            const isExpanded = expandedModules[mod] !== false;
            return (
              <div
                key={mod}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm transition-all"
              >
                {/* Module Header */}
                <button
                  type="button"
                  onClick={() => toggleModuleAccordion(mod)}
                  className="w-full flex items-center justify-between p-4 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors border-b border-slate-200 dark:border-slate-800"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {getModuleTitle(mod)}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                      {features.length} وظائف
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </button>

                {/* Features Table */}
                {isExpanded && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60 overflow-x-auto">
                    {features.map((feat) => {
                      const currentPolicy = getPolicy(feat.permissionKey, 'view');
                      const isMutating = mutatingKey === `${feat.permissionKey}:view`;
                      const hasSensitive = feat.sensitiveFields && feat.sensitiveFields.length > 0;

                      return (
                        <div
                          key={feat.permissionKey}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          {/* Feature Info */}
                          <div className="space-y-1 max-w-xl">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                {feat.nameAr}
                              </span>
                              {feat.flowCode && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400 font-mono font-medium">
                                  {feat.flowCode}
                                </span>
                              )}
                              {hasSensitive && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400 font-medium flex items-center gap-1">
                                  <Lock className="w-2.5 h-2.5" />
                                  <span>حجب أجور مشفر</span>
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                              {feat.permissionKey}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                              <span>الرتب المصرحة افتراضياً:</span>
                              {feat.allowedRoles.map((r) => (
                                <span
                                  key={r}
                                  className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                >
                                  {r}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Tri-State Action Controls */}
                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                            {/* Allow Button */}
                            <button
                              type="button"
                              disabled={!canEdit || isMutating}
                              onClick={() => handlePolicyChange(feat.permissionKey, 'view', 'ALLOW')}
                              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                                currentPolicy === 'ALLOW'
                                  ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/20'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40'
                              } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>سماح</span>
                            </button>

                            {/* Deny Button */}
                            <button
                              type="button"
                              disabled={!canEdit || isMutating}
                              onClick={() => handlePolicyChange(feat.permissionKey, 'view', 'DENY')}
                              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                                currentPolicy === 'DENY'
                                  ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-500/20'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40'
                              } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>حظر</span>
                            </button>

                            {/* Reset Button */}
                            <button
                              type="button"
                              disabled={!canEdit || isMutating}
                              onClick={() => handlePolicyChange(feat.permissionKey, 'view', 'RESET')}
                              title="استعادة السلوك الافتراضي الموروث"
                              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1 transition-all ${
                                currentPolicy === 'DEFAULT'
                                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                              } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isMutating ? 'animate-spin' : ''}`} />
                              <span>افتراضي</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
