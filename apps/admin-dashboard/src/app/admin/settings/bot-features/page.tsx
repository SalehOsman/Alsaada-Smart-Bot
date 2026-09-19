'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Settings,
  Shield,
  Search,
  Filter,
  ArrowUpDown,
  RotateCcw,
  Camera,
  Layers,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  SlidersHorizontal,
  ChevronRight,
  FolderOpen,
  FolderClosed,
} from 'lucide-react';
import type { BotMenuNodeDTO, BotNodeStatus, DisabledBehavior } from '@alsaada/core-components';
import { BotNodeCard } from './components/bot-node-card';
import { InteractivePhoneMockup } from './components/interactive-phone-mockup';
import { NodeEditModal } from './components/node-edit-modal';

interface PageStats {
  totalNodes: number;
  activeNodes: number;
  disabledNodes: number;
  maintenanceNodes: number;
}

const DOMAIN_RAILS = [
  { id: 'ALL', label: 'كافة الموديولات (All)', icon: '🌐' },
  { id: 'mod:hr', label: 'الموارد البشرية', icon: '👥' },
  { id: 'mod:finance', label: 'المالية والخزينة', icon: '💰' },
  { id: 'mod:operations', label: 'التشغيل والمواقع', icon: '🚜' },
  { id: 'mod:logistics', label: 'المشتريات والمخازن', icon: '📦' },
  { id: 'mod:governance', label: 'الحوكمة السيادية', icon: '⚙️' },
];

export default function BotFeaturesPage() {
  const [nodes, setNodes] = useState<BotMenuNodeDTO[]>([]);
  const [history, setHistory] = useState<BotMenuNodeDTO[][]>([]);
  const [stats, setStats] = useState<PageStats>({ totalNodes: 0, activeNodes: 0, disabledNodes: 0, maintenanceNodes: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters & State
  const [activeRail, setActiveRail] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | BotNodeStatus>('ALL');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Collapsed by default: all levels closed initially
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  // HTML5 Drag and Drop State
  const [draggedNode, setDraggedNode] = useState<BotMenuNodeDTO | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // Modals & Mockup
  const [editingNode, setEditingNode] = useState<BotMenuNodeDTO | null>(null);
  const [mockupRole, setMockupRole] = useState('SUPER_ADMIN');
  const [activeTabMobile, setActiveTabMobile] = useState<'TREE' | 'MOCKUP'>('TREE');

  const fetchFeatures = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/bot-features');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل في جلب البيانات');
      setNodes(data.nodes || []);
      setStats(data.stats || { totalNodes: 0, activeNodes: 0, disabledNodes: 0, maintenanceNodes: 0 });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Push snapshot into undo buffer before reorder or bulk actions
  const recordHistory = () => {
    setHistory((prev) => [...prev.slice(-10), [...nodes]]);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setNodes(previous);
    showNotification('تم التراجع عن الحركة الأخيرة');
  };

  // Expand All / Collapse All handlers
  const handleExpandAll = () => {
    const allParentIds = new Set<string>();
    for (const n of nodes) {
      if (nodes.some((c) => c.parentId === n.id)) {
        allParentIds.add(n.id);
      }
    }
    setExpandedParents(allParentIds);
  };

  const handleCollapseAll = () => {
    setExpandedParents(new Set());
  };

  // Toggle single parent expand/collapse
  const toggleExpand = (nodeId: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  // Smart Search Auto-Expand computation
  const isSearching = searchQuery.trim().length > 0;

  const { matchingNodeIds, searchAncestorIds, searchDescendantIds } = useMemo(() => {
    if (!isSearching) {
      return {
        matchingNodeIds: new Set<string>(),
        searchAncestorIds: new Set<string>(),
        searchDescendantIds: new Set<string>(),
      };
    }
    const q = searchQuery.toLowerCase().trim();
    const matching = new Set<string>();
    const ancestors = new Set<string>();
    const descendants = new Set<string>();

    const idToNode = new Map<string, BotMenuNodeDTO>(nodes.map((n) => [n.id, n]));

    for (const node of nodes) {
      const matchesTitle = node.title.toLowerCase().includes(q);
      const matchesCode = node.code.toLowerCase().includes(q);
      if (matchesTitle || matchesCode) {
        matching.add(node.id);
        // Climb up the ancestor tree
        let currentParentId = node.parentId;
        while (currentParentId && idToNode.has(currentParentId)) {
          ancestors.add(currentParentId);
          currentParentId = idToNode.get(currentParentId)?.parentId || null;
        }
      }
    }

    // Traverse down to include all descendants of matched nodes
    if (matching.size > 0) {
      const queue = Array.from(matching);
      while (queue.length > 0) {
        const parentId = queue.shift()!;
        for (const node of nodes) {
          if (node.parentId === parentId && !descendants.has(node.id)) {
            descendants.add(node.id);
            queue.push(node.id);
          }
        }
      }
    }

    return { matchingNodeIds: matching, searchAncestorIds: ancestors, searchDescendantIds: descendants };
  }, [nodes, searchQuery, isSearching]);

  // The effective expanded set: user-expanded OR auto-expanded because of search
  const effectiveExpandedParents = useMemo(() => {
    if (!isSearching) return expandedParents;
    const combined = new Set(expandedParents);
    for (const id of searchAncestorIds) {
      combined.add(id);
    }
    // Also auto-expand matched nodes that have children so user immediately sees matching contents
    for (const id of matchingNodeIds) {
      if (nodes.some((c) => c.parentId === id)) {
        combined.add(id);
      }
    }
    return combined;
  }, [expandedParents, isSearching, searchAncestorIds, matchingNodeIds, nodes]);

  // Persist reordered siblings to backend with optimistic update and rollback
  const persistSiblingReorder = async (reorderedSiblings: BotMenuNodeDTO[]) => {
    const reorderedItems = reorderedSiblings.map((item, idx) => ({
      id: item.id,
      sortOrder: (idx + 1) * 10,
    }));

    const orderMap = new Map(reorderedItems.map((i) => [i.id, i.sortOrder]));

    const previousNodes = [...nodes];
    const updated = nodes.map((n) => {
      const newOrder = orderMap.get(n.id);
      return newOrder !== undefined ? { ...n, sortOrder: newOrder } : n;
    });

    setNodes(updated);

    try {
      const res = await fetch('/api/admin/bot-features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reorder',
          items: reorderedItems,
        }),
      });
      if (!res.ok) throw new Error('فشل حفظ الترتيب');
      showNotification('✅ تم حفظ الترتيب الجديد وإشعار خادم البوت لحظياً');
    } catch {
      setNodes(previousNodes);
      setError('فشل حفظ الترتيب على الخادم - تمت استعادة الترتيب السابق تلقائياً');
    }
  };

  // Quick Shift Arrows (🔼 / 🔽)
  const handleShift = async (nodeId: string, direction: 'UP' | 'DOWN') => {
    const targetNode = nodes.find((n) => n.id === nodeId);
    if (!targetNode || targetNode.isProtected) return;

    // Find siblings with same parentId
    const siblings = nodes
      .filter((n) => (n.parentId ?? null) === (targetNode.parentId ?? null))
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const index = siblings.findIndex((n) => n.id === nodeId);
    if (index === -1) return;
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;

    // Do not displace or swap with a protected sovereign sibling
    const siblingToSwap = siblings[targetIndex];
    if (siblingToSwap?.isProtected) return;

    recordHistory();

    const reorderedSiblings = [...siblings];
    const [moved] = reorderedSiblings.splice(index, 1);
    if (!moved) return;
    reorderedSiblings.splice(targetIndex, 0, moved);

    await persistSiblingReorder(reorderedSiblings);
  };

  // HTML5 Drag and Drop Handlers (Strictly restricted to siblings with same parentId)
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, node: BotMenuNodeDTO) => {
    if (node.isProtected) return;
    setDraggedNode(node);
    e.dataTransfer.setData('text/plain', node.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, targetNode: BotMenuNodeDTO) => {
    if (!draggedNode || draggedNode.id === targetNode.id) return;
    if (draggedNode.isProtected || targetNode.isProtected) return;
    // CRITICAL GOVERNANCE: Restrict reordering strictly within same parent
    if ((draggedNode.parentId ?? null) !== (targetNode.parentId ?? null)) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropTargetId !== targetNode.id) {
      setDropTargetId(targetNode.id);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>, targetNode: BotMenuNodeDTO) => {
    // If mouse moved to a child element within the same card, do not cancel drop target
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    if (dropTargetId === targetNode.id) {
      setDropTargetId(null);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetNode: BotMenuNodeDTO) => {
    e.preventDefault();
    setDropTargetId(null);
    if (!draggedNode || draggedNode.id === targetNode.id) {
      setDraggedNode(null);
      return;
    }
    if (draggedNode.isProtected || targetNode.isProtected) {
      setDraggedNode(null);
      return;
    }
    // Sibling constraint
    if ((draggedNode.parentId ?? null) !== (targetNode.parentId ?? null)) {
      setDraggedNode(null);
      return;
    }

    const siblings = nodes
      .filter((n) => (n.parentId ?? null) === (targetNode.parentId ?? null))
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const fromIndex = siblings.findIndex((n) => n.id === draggedNode.id);
    const toIndex = siblings.findIndex((n) => n.id === targetNode.id);

    if (fromIndex === -1 || toIndex === -1) {
      setDraggedNode(null);
      return;
    }

    recordHistory();

    const reordered = [...siblings];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    setDraggedNode(null);
    await persistSiblingReorder(reordered);
  };

  const handleDragEnd = () => {
    setDraggedNode(null);
    setDropTargetId(null);
  };

  // Toggle single node status
  const handleToggleStatus = async (node: BotMenuNodeDTO, nextStatus: BotNodeStatus) => {
    try {
      const res = await fetch('/api/admin/bot-features', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: node.id, status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setNodes((prev) =>
        prev.map((n) => (n.id === node.id ? { ...n, status: nextStatus } : n))
      );
      showNotification(`تم تغيير حالة [${node.title}] إلى ${nextStatus}`);
      fetchFeatures();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل تغيير الحالة');
    }
  };

  // Save Modal Edits
  const handleSaveModal = async (updatedData: Partial<BotMenuNodeDTO> & { isCascade?: boolean }) => {
    const res = await fetch('/api/admin/bot-features', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showNotification('تم حفظ بيانات الوظيفة وإشعار خادم البوت لحظياً');
    fetchFeatures();
  };

  // Bulk status update
  const handleBulkStatus = async (status: BotNodeStatus) => {
    if (selectedIds.size === 0) return;
    try {
      const res = await fetch('/api/admin/bot-features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_status',
          ids: Array.from(selectedIds),
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification(`تم تحديث ${data.updatedCount} وظيفة بنجاح`);
      setSelectedIds(new Set());
      fetchFeatures();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل تنفيذ الإجراء المجمع');
    }
  };

  // Create Snapshot
  const handleCreateSnapshot = async () => {
    const title = prompt('أدخل مسمى للقطة التكوين الحالية:', `لقطة قبل التعديل - ${new Date().toLocaleDateString('ar-EG')}`);
    if (!title) return;

    try {
      const res = await fetch('/api/admin/bot-features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_snapshot', title }),
      });
      if (!res.ok) throw new Error('فشل إنشاء اللقطة');
      showNotification('✅ تم أخذ لقطة احتياطية كاملة لكافة القوائم');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل أخذ اللقطة');
    }
  };

  // Filter check for a node and its descendants
  const nodeMatchesFilters = useCallback((node: BotMenuNodeDTO): boolean => {
    if (statusFilter !== 'ALL' && node.status !== statusFilter) {
      const hasMatchingDescendant = (parentId: string): boolean => {
        const children = nodes.filter((c) => c.parentId === parentId);
        return children.some((c) => c.status === statusFilter || hasMatchingDescendant(c.id));
      };
      if (!hasMatchingDescendant(node.id)) return false;
    }

    if (isSearching) {
      if (
        !matchingNodeIds.has(node.id) &&
        !searchAncestorIds.has(node.id) &&
        !searchDescendantIds.has(node.id)
      ) {
        return false;
      }
    }

    return true;
  }, [statusFilter, isSearching, matchingNodeIds, searchAncestorIds, searchDescendantIds, nodes]);

  // Root modules (Top Level - Parity with Bot Home Screen)
  const rootNodes = useMemo(() => {
    let roots = nodes.filter((n) => n.type === 'MODULE' || !n.parentId);
    if (activeRail !== 'ALL') {
      roots = roots.filter((n) => n.code === activeRail || n.id === activeRail);
    }
    return roots.sort((a, b) => a.sortOrder - b.sortOrder);
  }, [nodes, activeRail]);

  // Recursive Tree Node Renderer
  const renderNodeTree = (
    node: BotMenuNodeDTO,
    level = 0,
    siblingIndex = 0,
    siblingCount = 1
  ): React.ReactNode => {
    if (!nodeMatchesFilters(node)) return null;

    const children = nodes
      .filter((c) => c.parentId === node.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const isExpanded = effectiveExpandedParents.has(node.id);
    const hasChildren = children.length > 0;
    const isDropTarget = dropTargetId === node.id;
    const isDragging = draggedNode?.id === node.id;

    return (
      <div key={node.id} className="space-y-2">
        <BotNodeCard
          node={node}
          level={level}
          isSelected={selectedIds.has(node.id)}
          onSelect={(sel) => {
            setSelectedIds((prev) => {
              const next = new Set(prev);
              if (sel) next.add(node.id);
              else next.delete(node.id);
              return next;
            });
          }}
          onEdit={() => setEditingNode(node)}
          onToggleStatus={(st) => handleToggleStatus(node, st)}
          onMoveUp={() => handleShift(node.id, 'UP')}
          onMoveDown={() => handleShift(node.id, 'DOWN')}
          canMoveUp={siblingIndex > 0}
          canMoveDown={siblingIndex < siblingCount - 1}
          isExpanded={isExpanded}
          onToggleExpand={() => toggleExpand(node.id)}
          childrenCount={children.length}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
          isDropTarget={isDropTarget}
          isDragging={isDragging}
        />

        {/* Nested Children (Rendered when expanded) */}
        {isExpanded && hasChildren && (
          <div className="space-y-2 relative">
            {children.map((child, idx) =>
              renderNodeTree(child, level + 1, idx, children.length)
            )}
          </div>
        )}
      </div>
    );
  };

  const renderedRootTree = rootNodes
    .map((root, idx) => renderNodeTree(root, 0, idx, rootNodes.length))
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 lg:p-8 space-y-6">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1.5 font-medium">
            <Link href="/admin" className="hover:text-white transition">الرئيسية</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href="/admin/settings" className="hover:text-white transition">مركز الإعدادات</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-amber-400 font-semibold">مركز التحكم في موديولات وتدفقات البوت</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <span>🎮</span>
              <span>مركز التحكم السيادي في موديولات وتدفقات وقوائم البوت</span>
            </h1>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              NEW-85 • Plan-73
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            شجرة هرمية تفاعلية مطابقة لعرض أزرار البوت مع السحب والإفلات والأسهم والبحث الذكي.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {history.length > 0 && (
            <button
              onClick={handleUndo}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>تراجع ({history.length})</span>
            </button>
          )}

          {/* Expand All / Collapse All Buttons */}
          <button
            onClick={handleExpandAll}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-amber-500/50 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
            title="توسيع كافة المستويات والأقسام"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>توسيع الكل</span>
          </button>

          <button
            onClick={handleCollapseAll}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
            title="طي كافة الأقسام والمستويات"
          >
            <FolderClosed className="w-3.5 h-3.5 text-slate-400" />
            <span>طي الكل</span>
          </button>

          <button
            onClick={handleCreateSnapshot}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-amber-500/50 text-xs font-semibold text-white flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5 text-amber-400" />
            <span>حفظ لقطة تكوين</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Overview Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400">إجمالي الوظائف والقوائم</span>
            <h3 className="text-2xl font-bold text-white mt-0.5">{stats.totalNodes}</h3>
          </div>
          <Layers className="w-8 h-8 text-slate-600" />
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-emerald-400 font-medium">الوظائف النشطة</span>
            <h3 className="text-2xl font-bold text-emerald-400 mt-0.5">{stats.activeNodes}</h3>
          </div>
          <CheckCircle2 className="w-8 h-8 text-emerald-500/30" />
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-amber-400 font-medium">تحت الصيانة</span>
            <h3 className="text-2xl font-bold text-amber-400 mt-0.5">{stats.maintenanceNodes}</h3>
          </div>
          <AlertTriangle className="w-8 h-8 text-amber-500/30" />
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-rose-400 font-medium">الوظائف الموقوفة</span>
            <h3 className="text-2xl font-bold text-rose-400 mt-0.5">{stats.disabledNodes}</h3>
          </div>
          <Shield className="w-8 h-8 text-rose-500/30" />
        </div>
      </div>

      {/* Domain Rails (Contextual Navigation Tabs) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {DOMAIN_RAILS.map((rail) => (
          <button
            key={rail.id}
            onClick={() => setActiveRail(rail.id)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold shrink-0 flex items-center gap-2 transition border cursor-pointer ${
              activeRail === rail.id
                ? 'bg-amber-500/15 border-amber-500/50 text-amber-400 shadow-2xs'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <span>{rail.icon}</span>
            <span>{rail.label}</span>
          </button>
        ))}
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-900/80 border border-slate-800 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="بحث بالاسم أو الكود (مثال: 01.1)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as unknown as BotNodeStatus)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="ALL">كافة الحالات</option>
            <option value="ACTIVE">النشطة فقط</option>
            <option value="MAINTENANCE">تحت الصيانة</option>
            <option value="DISABLED">الموقوفة</option>
          </select>
        </div>
      </div>

      {/* Bulk Operations Toolbar */}
      {selectedIds.size > 0 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-4 animate-in fade-in">
          <span className="text-xs font-semibold text-amber-400">
            تم تحديد {selectedIds.size} عنصر(عناصر)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkStatus('ACTIVE')}
              className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              تشغيل المحدد 🟢
            </button>
            <button
              onClick={() => handleBulkStatus('MAINTENANCE')}
              className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              صيانة المحدد 🟡
            </button>
            <button
              onClick={() => handleBulkStatus('DISABLED')}
              className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              إيقاف المحدد 🔴
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-2.5 py-1 text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Mobile Tab Switcher */}
      <div className="lg:hidden flex items-center gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl">
        <button
          onClick={() => setActiveTabMobile('TREE')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg text-center transition cursor-pointer ${
            activeTabMobile === 'TREE' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
          }`}
        >
          هندسة القوائم والشجرة
        </button>
        <button
          onClick={() => setActiveTabMobile('MOCKUP')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg text-center transition cursor-pointer ${
            activeTabMobile === 'MOCKUP' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
          }`}
        >
          المعاينة التفاعلية الحية
        </button>
      </div>

      {/* Main Content: Split View (60% Tree / 40% Phone Mockup) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 7 Columns: Hierarchical Management Tree */}
        <div className={`lg:col-span-7 space-y-3 ${activeTabMobile === 'MOCKUP' ? 'hidden lg:block' : ''}`}>
          {loading ? (
            <div className="p-12 text-center text-slate-400 space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-400" />
              <p className="text-xs">جاري تحميل سجل وظائف وقوائم البوت...</p>
            </div>
          ) : renderedRootTree.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-slate-900/40 border border-slate-800 rounded-2xl">
              لا توجد عناصر مطابقة لخيارات البحث أو التصفية الحالية
            </div>
          ) : (
            renderedRootTree
          )}
        </div>

        {/* Right 5 Columns: Interactive Telegram Phone Mockup (Sticky) */}
        <div
          className={`lg:col-span-5 lg:sticky lg:top-8 flex justify-center ${
            activeTabMobile === 'TREE' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <InteractivePhoneMockup
            nodes={nodes}
            currentRole={mockupRole}
            onRoleChange={setMockupRole}
          />
        </div>
      </div>

      {/* Edit Modal */}
      <NodeEditModal
        node={editingNode}
        isOpen={Boolean(editingNode)}
        onClose={() => setEditingNode(null)}
        onSave={handleSaveModal}
      />
    </div>
  );
}
