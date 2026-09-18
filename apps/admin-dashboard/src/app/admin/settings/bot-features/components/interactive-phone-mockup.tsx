'use client';

import React, { useState } from 'react';
import type { BotMenuNodeDTO } from '@alsaada/core-components';
import { Smartphone, RefreshCw, AlertCircle, Shield, ChevronLeft } from 'lucide-react';

interface InteractivePhoneMockupProps {
  nodes: BotMenuNodeDTO[];
  currentRole: string;
  onRoleChange: (role: string) => void;
}

const ROLES = [
  { id: 'SUPER_ADMIN', label: 'مدير عام' },
  { id: 'FIELD_ADMIN', label: 'مشرف ميداني' },
  { id: 'WORKER', label: 'عامل' },
  { id: 'GUEST', label: 'زائر' },
];

function isNodeVisibleForRole(node: BotMenuNodeDTO, role?: string): boolean {
  if (role && node.allowedRoles && node.allowedRoles.length > 0) {
    if (!node.allowedRoles.includes(role) && role !== 'SUPER_ADMIN') {
      return false;
    }
  }
  if (node.isProtected) return true;
  if (node.status === 'ACTIVE') return true;
  return node.disabledBehavior !== 'HIDE';
}

function filterNodesForMockup(nodes: BotMenuNodeDTO[], role?: string): BotMenuNodeDTO[] {
  return nodes
    .filter((n) => isNodeVisibleForRole(n, role))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function formatMockupButtonTitle(node: BotMenuNodeDTO): string {
  const icon = node.icon ? `${node.icon} ` : '';
  let title = `${icon}${node.title}`.trim();
  if (!node.isProtected && node.status !== 'ACTIVE') {
    if (node.disabledBehavior === 'LOCK_WITH_ALERT') {
      title = `🔒 ${title}`;
    }
  }
  return title;
}

function checkMockupFeatureAccess(
  node: BotMenuNodeDTO | null | undefined,
  role?: string
): { allowed: boolean; maintenanceMessage?: string } {
  if (!node) {
    return { allowed: false, maintenanceMessage: 'العنصر المطلوب غير موجود في سجل النظام.' };
  }
  if (node.isProtected) {
    return { allowed: true };
  }
  if (role && node.allowedRoles && node.allowedRoles.length > 0) {
    if (!node.allowedRoles.includes(role) && role !== 'SUPER_ADMIN') {
      return { allowed: false, maintenanceMessage: 'ليس لديك الصلاحية الكافية للوصول إلى هذا الإجراء.' };
    }
  }
  if (node.status === 'ACTIVE') {
    return { allowed: true };
  }
  return {
    allowed: false,
    maintenanceMessage:
      node.maintenanceMessage ||
      (node.status === 'MAINTENANCE'
        ? 'هذه الوظيفة تحت الصيانة الدورية المجدولة حالياً وسيتم إعادتها للعمل قريباً.'
        : 'هذه الوظيفة موقوفة مؤقتاً بتوجيه من إدارة النظام.'),
  };
}

const WORKER_FALLBACK_ITEMS: BotMenuNodeDTO[] = [
  { id: 'w1', code: 'worker:profile', parentId: null, type: 'FLOW' as any, title: 'ملفي وبياناتي الشخصية', icon: '👤', callbackData: 'menu:worker_sub:profile', status: 'ACTIVE' as any, disabledBehavior: 'LOCK_WITH_ALERT' as any, maintenanceMessage: null, sortOrder: 1, isProtected: false, allowedRoles: ['WORKER'] },
  { id: 'w2', code: 'worker:finance', parentId: null, type: 'FLOW' as any, title: 'المستحقات والماليات', icon: '💰', callbackData: 'menu:worker_sub:finance', status: 'ACTIVE' as any, disabledBehavior: 'LOCK_WITH_ALERT' as any, maintenanceMessage: null, sortOrder: 2, isProtected: false, allowedRoles: ['WORKER'] },
  { id: 'w3', code: 'worker:attendance', parentId: null, type: 'FLOW' as any, title: 'الدوام والحضور والإجازات', icon: '⏱️', callbackData: 'menu:worker_sub:attendance', status: 'ACTIVE' as any, disabledBehavior: 'LOCK_WITH_ALERT' as any, maintenanceMessage: null, sortOrder: 3, isProtected: false, allowedRoles: ['WORKER'] },
  { id: 'w4', code: 'worker:custody', parentId: null, type: 'FLOW' as any, title: 'العهد ومهمات الوقاية', icon: '🦺', callbackData: 'menu:worker_sub:custody', status: 'ACTIVE' as any, disabledBehavior: 'LOCK_WITH_ALERT' as any, maintenanceMessage: null, sortOrder: 4, isProtected: false, allowedRoles: ['WORKER'] },
  { id: 'w5', code: 'worker:statement', parentId: null, type: 'FLOW' as any, title: 'كشف حسابي ومسحوباتي', icon: '📊', callbackData: 'menu:worker:statement', status: 'ACTIVE' as any, disabledBehavior: 'LOCK_WITH_ALERT' as any, maintenanceMessage: null, sortOrder: 5, isProtected: false, allowedRoles: ['WORKER'] },
  { id: 'w6', code: 'worker:payslip', parentId: null, type: 'FLOW' as any, title: 'مفردات قسيمة الراتب', icon: '🧾', callbackData: 'menu:worker:payslip', status: 'ACTIVE' as any, disabledBehavior: 'LOCK_WITH_ALERT' as any, maintenanceMessage: null, sortOrder: 6, isProtected: false, allowedRoles: ['WORKER'] },
];

const GUEST_FALLBACK_ITEMS: BotMenuNodeDTO[] = [
  { id: 'g1', code: 'guest:link', parentId: null, type: 'FLOW' as any, title: 'طلب ربط وتفعيل حسابي كعامل', icon: '🔐', callbackData: 'action:worker_link', status: 'ACTIVE' as any, disabledBehavior: 'LOCK_WITH_ALERT' as any, maintenanceMessage: null, sortOrder: 1, isProtected: false, allowedRoles: ['GUEST'] },
  { id: 'g2', code: 'guest:support', parentId: null, type: 'FLOW' as any, title: 'الاستفسار والدعم الفني', icon: '💬', callbackData: 'menu:support', status: 'ACTIVE' as any, disabledBehavior: 'LOCK_WITH_ALERT' as any, maintenanceMessage: null, sortOrder: 2, isProtected: false, allowedRoles: ['GUEST'] },
  { id: 'g3', code: 'guest:about', parentId: null, type: 'FLOW' as any, title: 'معلومات عن الشركة وفروعنا', icon: '🏢', callbackData: 'menu:about', status: 'ACTIVE' as any, disabledBehavior: 'LOCK_WITH_ALERT' as any, maintenanceMessage: null, sortOrder: 3, isProtected: false, allowedRoles: ['GUEST'] },
];

export function InteractivePhoneMockup({
  nodes,
  currentRole,
  onRoleChange,
}: InteractivePhoneMockupProps) {
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [modalAlertText, setModalAlertText] = useState<string | null>(null);

  // Active navigation trail
  const currentNode = currentParentId ? nodes.find((n) => n.id === currentParentId) : null;

  // Filter items at current depth
  const currentItems = nodes.filter((n) => {
    if (currentParentId === null) {
      return n.type === 'MODULE';
    }
    return n.parentId === currentParentId;
  });

  const rawVisibleItems = filterNodesForMockup(currentItems, currentRole);
  const visibleItems =
    rawVisibleItems.length === 0 && currentParentId === null
      ? currentRole === 'WORKER'
        ? WORKER_FALLBACK_ITEMS
        : currentRole === 'GUEST'
        ? GUEST_FALLBACK_ITEMS
        : []
      : rawVisibleItems;

  const handleButtonClick = (node: BotMenuNodeDTO) => {
    const check = checkMockupFeatureAccess(node, currentRole);
    if (!check.allowed) {
      // Simulate Telegram show_alert: true Modal Alert
      setModalAlertText(check.maintenanceMessage || 'عذراً، هذه الوظيفة موقوفة مؤقتاً.');
      return;
    }

    // If node has children, navigate into them
    const children = nodes.filter((n) => n.parentId === node.id);
    if (children.length > 0) {
      setCurrentParentId(node.id);
    }
  };

  const handleBack = () => {
    if (currentNode?.parentId) {
      setCurrentParentId(currentNode.parentId);
    } else {
      setCurrentParentId(null);
    }
  };

  return (
    <div className="flex flex-col items-center select-none">
      {/* Role Switcher */}
      <div className="w-full max-w-sm mb-4">
        <div className="text-xs text-slate-400 font-semibold mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-amber-400" />
            محاكي تليجرام التفاعلي الحي (Context-Aware Live Mockup)
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          {ROLES.map((r) => (
            <button
              key={r.id}
              onClick={() => onRoleChange(r.id)}
              className={`py-1.5 text-xs font-semibold rounded-lg transition ${
                currentRole === r.id
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Phone Mockup Frame */}
      <div className="relative w-[340px] h-[640px] bg-slate-950 border-[6px] border-slate-800 rounded-[44px] shadow-2xl overflow-hidden flex flex-col">
        {/* Hardware Notch / Island */}
        <div className="absolute top-2 inset-x-0 mx-auto w-32 h-5 bg-slate-900 rounded-full z-30 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-700/50 mr-3" />
          <div className="w-2 h-2 rounded-full bg-slate-800/80" />
        </div>

        {/* Telegram Top Status Bar */}
        <div className="pt-8 px-6 pb-2 bg-slate-900/90 backdrop-blur border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400 z-20">
          <span>12:00</span>
          <div className="flex items-center gap-1.5 font-sans">
            <span>5G</span>
            <span>100%</span>
          </div>
        </div>

        {/* Telegram Bot Chat Header */}
        <div className="px-4 py-2.5 bg-slate-900/80 backdrop-blur border-b border-slate-800/60 flex items-center gap-3 z-20">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-bold text-sm shadow-md">
            ⚡
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-white truncate">شركة السعادة سمارت بوت</h4>
            <p className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              متصل الآن (Real-time Live)
            </p>
          </div>
          {currentParentId && (
            <button
              onClick={handleBack}
              className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs flex items-center gap-0.5"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              رجوع
            </button>
          )}
        </div>

        {/* Telegram Chat Area */}
        <div className="flex-1 p-3 overflow-y-auto space-y-3 flex flex-col justify-end">
          {/* Welcome Message Bubble */}
          <div className="max-w-[92%] bg-slate-800/90 text-white p-3 rounded-2xl rounded-bl-sm border border-slate-700/50 text-xs shadow-md space-y-1.5 self-start">
            <div className="flex items-center gap-1 text-amber-400 font-semibold">
              <span>👋 مرحباً بك في المنظومة</span>
              {currentNode && <span>- {currentNode.title}</span>}
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              {currentNode
                ? `تصفح إجراءات وقوائم: ${currentNode.title}`
                : `واجهة ${ROLES.find((r) => r.id === currentRole)?.label}. اختر من القوائم أدناه:`}
            </p>
            <span className="text-[9px] text-slate-500 block text-left">12:00 م</span>
          </div>

          {/* Interactive Keyboard Buttons */}
          <div className="w-full space-y-1.5 pt-1">
            {visibleItems.length === 0 ? (
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-slate-500 text-xs">
                لا توجد أزرار مفعلة لهذه الرتبة
              </div>
            ) : (
              visibleItems.map((item) => {
                const isLocked = item.status !== 'ACTIVE' && !item.isProtected;
                const buttonText = formatMockupButtonTitle(item);

                return (
                  <button
                    key={item.id}
                    onClick={() => handleButtonClick(item)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-between transition active:scale-[0.98] border shadow-sm ${
                      isLocked
                        ? 'bg-slate-900/90 border-slate-800 text-slate-400 hover:border-amber-500/40'
                        : item.isProtected
                        ? 'bg-slate-800/90 border-amber-500/30 text-amber-300 hover:bg-slate-700'
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700/60 text-white'
                    }`}
                  >
                    <span className="truncate">{buttonText}</span>
                    {item.isProtected && <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                  </button>
                );
              })
            )}

            {currentParentId && (
              <button
                onClick={handleBack}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-800 text-center transition"
              >
                🔙 العودة للقائمة السابقة
              </button>
            )}
          </div>
        </div>

        {/* Telegram Modal Alert Simulation (Popup) */}
        {modalAlertText && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-6 z-40 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-full bg-slate-900 border border-amber-500/40 rounded-2xl p-4 shadow-2xl text-center space-y-3">
              <div className="w-10 h-10 mx-auto rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-white mb-1">تنبيه من المنظومة (Modal Alert)</h5>
                <p className="text-[11px] text-slate-300 leading-relaxed">{modalAlertText}</p>
              </div>
              <button
                onClick={() => setModalAlertText(null)}
                className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold transition"
              >
                حسناً
              </button>
            </div>
          </div>
        )}

        {/* Home Bottom Bar */}
        <div className="h-6 bg-slate-950 flex items-center justify-center pb-1">
          <div className="w-28 h-1 bg-slate-700 rounded-full" />
        </div>
      </div>
    </div>
  );
}
