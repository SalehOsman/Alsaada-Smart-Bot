'use client';

import React from 'react';
import {
  Shield,
  Edit3,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Lock,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { BotMenuNodeDTO, BotNodeStatus } from '@alsaada/core-components';

interface BotNodeCardProps {
  node: BotMenuNodeDTO;
  level?: number;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
  onEdit: () => void;
  onToggleStatus: (nextStatus: BotNodeStatus) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  isReorderMode?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  childrenCount?: number;
}

export function BotNodeCard({
  node,
  level = 0,
  isSelected = false,
  onSelect,
  onEdit,
  onToggleStatus,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  isReorderMode = false,
  isExpanded = false,
  onToggleExpand,
  childrenCount = 0,
}: BotNodeCardProps) {
  const isProtected = !!node.isProtected;
  const hasChildren = childrenCount > 0;

  const statusColors: Record<BotNodeStatus, { bg: string; text: string; border: string; label: string }> = {
    ACTIVE: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
      label: 'نشط',
    },
    MAINTENANCE: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      border: 'border-amber-500/30',
      label: 'صيانة',
    },
    DISABLED: {
      bg: 'bg-rose-500/10',
      text: 'text-rose-400',
      border: 'border-rose-500/30',
      label: 'موقوف',
    },
    ARCHIVED: {
      bg: 'bg-slate-500/10',
      text: 'text-slate-400',
      border: 'border-slate-500/30',
      label: 'مؤرشف',
    },
  };

  const currentStatus = statusColors[node.status] || statusColors.ACTIVE;

  const indentStyle = {
    marginRight: `${level * 20}px`,
  };

  return (
    <div
      style={indentStyle}
      className={`group relative flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-150 ${
        isSelected
          ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/5'
          : 'bg-slate-900/80 hover:bg-slate-900 border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Left / Right Indicators & Details */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Bulk Selection Checkbox */}
        {onSelect && (
          <input
            type="checkbox"
            checked={isSelected}
            disabled={isProtected}
            onChange={(e) => onSelect(e.target.checked)}
            className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-amber-500 disabled:opacity-30 cursor-pointer"
          />
        )}

        {/* Quick Shift Arrows (Reorder Mode) */}
        {isReorderMode && (
          <div className="flex flex-col gap-0.5 shrink-0">
            <button
              onClick={onMoveUp}
              disabled={!canMoveUp}
              title="تحريك لأعلى"
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-20 text-slate-300 disabled:cursor-not-allowed"
            >
              <ArrowUp className="w-3 h-3" />
            </button>
            <button
              onClick={onMoveDown}
              disabled={!canMoveDown}
              title="تحريك لأسفل"
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-20 text-slate-300 disabled:cursor-not-allowed"
            >
              <ArrowDown className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Expand/Collapse Chevron if has children */}
        {hasChildren ? (
          <button
            onClick={onToggleExpand}
            className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        ) : (
          <div className="w-6 shrink-0" />
        )}

        {/* Icon & Title */}
        <span className="text-xl shrink-0">{node.icon || '🔹'}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-white text-sm truncate">{node.title}</h4>
            {isProtected && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 shrink-0">
                <Shield className="w-3 h-3" />
                سيادية محصنة
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] font-mono text-slate-500">{node.code}</span>
            {hasChildren && (
              <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                {childrenCount} عنصر
              </span>
            )}
            {node.status !== 'ACTIVE' && (
              <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                {node.disabledBehavior === 'HIDE' ? (
                  <>
                    <EyeOff className="w-3 h-3 text-slate-400" /> مخفي تماماً
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3 text-amber-400" /> قفل مع تنبيه
                  </>
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right Action Controls */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Status Badge */}
        <span
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 ${currentStatus.bg} ${currentStatus.text} ${currentStatus.border}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {currentStatus.label}
        </span>

        {/* Status Quick Switch Button */}
        {!isProtected ? (
          <button
            onClick={() =>
              onToggleStatus(node.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE')
            }
            title={node.status === 'ACTIVE' ? 'إيقاف الوظيفة' : 'تفعيل الوظيفة'}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
              node.status === 'ACTIVE'
                ? 'bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border-slate-700 hover:border-rose-500/30'
                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border-emerald-500/40'
            }`}
          >
            {node.status === 'ACTIVE' ? 'إيقاف' : 'تشغيل'}
          </button>
        ) : (
          <div
            title="وظيفة سيادية محصنة غير قابلة للتعطيل"
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-950 border border-slate-800 text-slate-600 cursor-not-allowed"
          >
            محصن 🛡️
          </div>
        )}

        {/* Edit Button */}
        <button
          onClick={onEdit}
          title="تعديل الخصائص والتنبيهات"
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
        >
          <Edit3 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
