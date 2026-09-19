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
  GripVertical,
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
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  childrenCount?: number;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>, node: BotMenuNodeDTO) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>, node: BotMenuNodeDTO) => void;
  onDragLeave?: (e: React.DragEvent<HTMLDivElement>, node: BotMenuNodeDTO) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>, node: BotMenuNodeDTO) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>, node: BotMenuNodeDTO) => void;
  isDropTarget?: boolean;
  isDragging?: boolean;
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
  isExpanded = false,
  onToggleExpand,
  childrenCount = 0,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  isDropTarget = false,
  isDragging = false,
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

  // Level-specific styling
  const levelStyles = [
    // Level 0: MODULE (Sovereign Root)
    'bg-slate-900 border-slate-700/80 shadow-sm p-4 rounded-2xl',
    // Level 1: SECTION
    'bg-slate-900/90 border-slate-800 p-3.5 rounded-xl',
    // Level 2: SUBSECTION
    'bg-slate-900/70 border-slate-800/80 p-3 rounded-xl',
    // Level 3+: FLOW
    'bg-slate-900/50 border-slate-800/60 p-2.5 rounded-lg',
  ];

  const currentLevelStyle = levelStyles[Math.min(level, levelStyles.length - 1)];

  const indentStyle = {
    marginRight: `${level * 22}px`,
  };

  return (
    <div
      style={indentStyle}
      draggable={!isProtected}
      onDragStart={(e) => onDragStart?.(e, node)}
      onDragOver={(e) => onDragOver?.(e, node)}
      onDragLeave={(e) => onDragLeave?.(e, node)}
      onDrop={(e) => onDrop?.(e, node)}
      onDragEnd={(e) => onDragEnd?.(e, node)}
      className={`group relative flex items-center justify-between border transition-all duration-150 select-none ${currentLevelStyle} ${
        isDropTarget
          ? 'border-t-2 !border-t-amber-400 bg-amber-500/10 shadow-lg shadow-amber-500/10'
          : isSelected
          ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/5'
          : 'hover:border-slate-600'
      } ${isDragging ? 'opacity-40 border-dashed border-amber-400' : ''}`}
    >
      {/* Left / Right Indicators & Details */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {/* Drag Handle */}
        {!isProtected ? (
          <div
            className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-amber-400 p-0.5 rounded transition shrink-0"
            title="اسحب لإعادة الترتيب بين الأشقاء التابعين لنفس المستوى"
          >
            <GripVertical className="w-4 h-4" />
          </div>
        ) : (
          <div
            className="text-slate-700 p-0.5 shrink-0 cursor-not-allowed"
            title="عنصر سيادي محصن غير قابل لإعادة الترتيب باليد"
          >
            <GripVertical className="w-4 h-4 opacity-30" />
          </div>
        )}

        {/* Quick Shift Arrows (Always Visible for Sibling Navigation) */}
        <div className="flex flex-col gap-0.5 shrink-0" onMouseDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            draggable={false}
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp?.();
            }}
            disabled={!canMoveUp || isProtected}
            title={isProtected ? 'عنصر سيادي محصن غير قابل للتحريك' : 'تحريك لأعلى بين الأشقاء'}
            className="p-1 rounded bg-slate-800/90 hover:bg-slate-700 disabled:opacity-20 text-slate-300 disabled:cursor-not-allowed transition cursor-pointer"
          >
            <ArrowUp className="w-3 h-3" />
          </button>
          <button
            type="button"
            draggable={false}
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown?.();
            }}
            disabled={!canMoveDown || isProtected}
            title={isProtected ? 'عنصر سيادي محصن غير قابل للتحريك' : 'تحريك لأسفل بين الأشقاء'}
            className="p-1 rounded bg-slate-800/90 hover:bg-slate-700 disabled:opacity-20 text-slate-300 disabled:cursor-not-allowed transition cursor-pointer"
          >
            <ArrowDown className="w-3 h-3" />
          </button>
        </div>

        {/* Bulk Selection Checkbox */}
        {onSelect && (
          <input
            type="checkbox"
            checked={isSelected}
            disabled={isProtected}
            draggable={false}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              onSelect(e.target.checked);
            }}
            className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-amber-500 disabled:opacity-30 cursor-pointer shrink-0"
          />
        )}

        {/* Expand/Collapse Chevron if has children */}
        {hasChildren ? (
          <button
            type="button"
            draggable={false}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand?.();
            }}
            className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer shrink-0"
            title={isExpanded ? 'طي الأقسام والتدفقات' : 'توسيع واستعراض التابع'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4 text-amber-400" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        ) : (
          <div className="w-6 shrink-0" />
        )}

        {/* Tree Level Branch Visual Marker for Nested Items */}
        {level > 0 && (
          <span className="text-slate-600 text-xs font-mono select-none shrink-0">
            {level === 1 ? '├─' : level === 2 ? '│ ├─' : '│ │ └─'}
          </span>
        )}

        {/* Icon & Title */}
        <span className={`${level === 0 ? 'text-2xl' : 'text-xl'} shrink-0`}>
          {node.icon || (level === 0 ? '🏛️' : '🔹')}
        </span>

        <div
          className="min-w-0 cursor-pointer flex-1"
          onClick={() => {
            if (hasChildren) onToggleExpand?.();
          }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <h4
              className={`font-semibold text-white truncate ${
                level === 0 ? 'text-base font-bold' : level === 1 ? 'text-sm font-semibold' : 'text-xs'
              }`}
            >
              {node.title}
            </h4>

            {level === 0 && (
              <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20 shrink-0">
                موديول رئيسي
              </span>
            )}

            {isProtected && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 shrink-0">
                <Shield className="w-3 h-3" />
                سيادية محصنة
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[11px] font-mono text-slate-500">{node.code}</span>
            {hasChildren && (
              <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                {childrenCount} {level === 0 ? 'أقسام' : 'عناصر'}
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
            type="button"
            draggable={false}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToggleStatus(node.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE');
            }}
            title={node.status === 'ACTIVE' ? 'إيقاف الوظيفة' : 'تفعيل الوظيفة'}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border cursor-pointer ${
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
          type="button"
          draggable={false}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          title="تعديل الخصائص والتنبيهات"
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
        >
          <Edit3 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

