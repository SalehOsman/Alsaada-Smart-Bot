'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Wallet,
  Tractor,
  PackageCheck,
  Settings,
  Building2,
  Building,
  Briefcase,
  UserCheck,
  ShieldAlert,
  Activity,
  TableProperties,
  Ghost,
  BellRing,
  UserPlus,
  FileSpreadsheet,
  CheckSquare,
  Search,
  X,
  ChevronDown,
  Pin,
  PinOff,
  Banknote,
  CalendarClock,
  BadgePercent,
  Receipt,
  CalendarOff,
  Database,
} from 'lucide-react';
import type { DashboardUser, NavItem, NavChildItem, NavSubSection } from '@/lib/rbac';
import { filterNavItemsForUser } from '@/lib/rbac';
import { cn } from '@/lib/utils';
import { useSidebar } from './sidebar-context';

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  BarChart3,
  Users,
  Wallet,
  Tractor,
  PackageCheck,
  Settings,
  Building2,
  Building,
  Briefcase,
  UserCheck,
  ShieldAlert,
  Activity,
  TableProperties,
  Ghost,
  BellRing,
  UserPlus,
  FileSpreadsheet,
  CheckSquare,
  Banknote,
  CalendarClock,
  BadgePercent,
  Receipt,
  CalendarOff,
  Database,
};

// Color capsules for Workforce sub-sections matching prototype
const SUB_SECTION_STYLES: Record<string, { capsule: string; iconColor: string; defaultBadge?: string }> = {
  'السلف والمسحوبات وحسابات العمال': {
    capsule: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    iconColor: 'text-emerald-400',
    defaultBadge: 'المرحلة 2',
  },
  'الإجازات والدوام والتواجد الميداني': {
    capsule: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
    iconColor: 'text-cyan-400',
    defaultBadge: 'المرحلة 2',
  },
  'شؤون العاملين والتعيينات': {
    capsule: 'bg-orange-500/20 border-orange-500/40 text-orange-400',
    iconColor: 'text-orange-400',
    defaultBadge: 'مكتمل 100%',
  },
  'الرواتب والأجور والمستحقات': {
    capsule: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    iconColor: 'text-amber-400',
    defaultBadge: 'إدارة عليا',
  },
  'الشؤون الإدارية والوثائق والمخيم': {
    capsule: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
    iconColor: 'text-purple-400',
    defaultBadge: 'المرحلة 2',
  },
};

interface SidebarProps {
  user: DashboardUser;
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const { isOpen: isMobileOpen, close: closeMobile } = useSidebar();

  const navItems = useMemo(() => filterNavItemsForUser(user.role), [user.role]);

  // Helper: check if a group has child items or sub-sections
  const hasSubNav = (group: NavItem): boolean =>
    Boolean((group.children && group.children.length > 0) || (group.subSections && group.subSections.length > 0));

  // Helper: check if any child of a group is currently active
  const isChildActive = (group: NavItem): boolean =>
    Boolean(
      group.children?.some(
        (sub) =>
          pathname === sub.href ||
          (sub.href !== '/admin' && pathname.startsWith(sub.href + '/'))
      )
    );

  // Helper: check if a group is active
  const isGroupActive = (group: NavItem): boolean => {
    if (group.href === '/admin') return pathname === '/admin';
    return pathname === group.href || isChildActive(group);
  };

  // Find currently active sector matching route
  const getActiveSectorHref = (): string => {
    const match = navItems.find((g) => isGroupActive(g));
    return match?.href || '/admin';
  };

  // Dual-Rail States
  const [selectedRailHref, setSelectedRailHref] = useState<string>(() => getActiveSectorHref());
  const [isPinned, setIsPinned] = useState<boolean>(false);
  const [isFlyoutOpen, setIsFlyoutOpen] = useState<boolean>(() => {
    const currentGroup = navItems.find((g) => g.href === getActiveSectorHref());
    return Boolean(currentGroup && hasSubNav(currentGroup));
  });

  // Load persisted pin state from localStorage after mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('alsaada_sidebar_pinned');
      if (saved !== null) {
        const pinned = saved === 'true';
        setIsPinned(pinned);
        if (pinned) {
          setIsFlyoutOpen(true);
        }
      }
    } catch {}
  }, []);

  // Toggle pinning mode with persistence
  const togglePinMode = () => {
    setIsPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('alsaada_sidebar_pinned', String(next));
      } catch {}
      if (next) {
        setIsFlyoutOpen(true);
      }
      return next;
    });
  };

  // Search filter query inside flyout / mobile
  const [flyoutSearchQuery, setFlyoutSearchQuery] = useState<string>('');
  const [mobileSearchQuery, setMobileSearchQuery] = useState<string>('');

  // Mobile accordion state
  const [mobileOpenSections, setMobileOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navItems.forEach((group) => {
      if (hasSubNav(group) && isGroupActive(group)) {
        initial[group.href] = true;
      }
    });
    return initial;
  });

  // Mobile sub-section open state
  const [mobileOpenSubSections, setMobileOpenSubSections] = useState<Record<string, boolean>>({
    'شؤون العاملين والتعيينات': true,
  });

  // Synchronize rail selection on pathname route changes (preserves flyout state without forcing re-open if closed)
  useEffect(() => {
    const activeHref = getActiveSectorHref();
    setSelectedRailHref(activeHref);
  }, [pathname, navItems]);

  // Handle Keyboard Shortcuts: Ctrl+B (toggle pin mode) & Escape (close floating flyout + focus restoration)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + B or Cmd + B: toggle pin mode
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        togglePinMode();
        return;
      }

      // Escape: close floating flyout and restore focus to rail button
      if (e.key === 'Escape' && !isPinned && isFlyoutOpen) {
        setIsFlyoutOpen(false);
        const safeId = `rail-btn-${selectedRailHref.replace(/[^a-zA-Z0-9]/g, '-')}`;
        const activeBtn = document.getElementById(safeId);
        activeBtn?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPinned, isFlyoutOpen, selectedRailHref]);

  // Current selected sector group for Desktop Flyout
  const selectedSector = useMemo(() => {
    return navItems.find((g) => g.href === selectedRailHref) || navItems[0];
  }, [navItems, selectedRailHref]);

  // Handle Rail icon click
  const handleRailClick = (item: NavItem) => {
    if (!hasSubNav(item)) {
      // Direct link (e.g. /admin overview or /admin/analytics)
      setSelectedRailHref(item.href);
      if (!isPinned) {
        setIsFlyoutOpen(false);
      }
      return;
    }

    // Item has sub-navigation: clicking same item toggles flyout whether pinned or floating
    if (selectedRailHref === item.href) {
      setIsFlyoutOpen((prev) => {
        const next = !prev;
        if (next) {
          setFlyoutSearchQuery('');
        }
        return next;
      });
    } else {
      setSelectedRailHref(item.href);
      setIsFlyoutOpen(true);
      setFlyoutSearchQuery('');
    }
  };

  // Filtered sub-sections for the flyout panel
  const filteredSubSections = useMemo(() => {
    if (!selectedSector?.subSections) return [];
    const q = flyoutSearchQuery.trim().toLowerCase();
    if (!q) return selectedSector.subSections;

    return selectedSector.subSections.filter((sub) => {
      if (sub.title.toLowerCase().includes(q)) return true;
      const childLinks = selectedSector.children?.filter((c) => c.subSection === sub.title) || [];
      return childLinks.some((c) => c.title.toLowerCase().includes(q));
    });
  }, [selectedSector, flyoutSearchQuery]);

  // Filtered direct children for sectors without subSections
  const filteredDirectChildren = useMemo(() => {
    if (!selectedSector?.children || selectedSector.subSections?.length) return [];
    const q = flyoutSearchQuery.trim().toLowerCase();
    if (!q) return selectedSector.children;

    return selectedSector.children.filter((c) => c.title.toLowerCase().includes(q));
  }, [selectedSector, flyoutSearchQuery]);

  // Mobile filtered items
  const mobileFilteredItems = useMemo(() => {
    const q = mobileSearchQuery.trim().toLowerCase();
    if (!q) return navItems;

    return navItems.filter((group) => {
      if (group.title.toLowerCase().includes(q)) return true;
      if (group.subSections?.some((sub) => sub.title.toLowerCase().includes(q))) return true;
      if (group.children?.some((child) => child.title.toLowerCase().includes(q) || child.subSection?.toLowerCase().includes(q))) {
        return true;
      }
      return false;
    });
  }, [navItems, mobileSearchQuery]);

  // Clean title helper (strips leading emojis for clean presentation)
  const cleanTitle = (rawTitle: string): string => {
    return rawTitle.replace(/^[\p{Emoji}\p{Extended_Pictographic}\uFE0F\s]+/u, '').trim();
  };

  return (
    <>
      {/* =========================================================================
          1️⃣ MOBILE & TABLET DRAWER (< lg)
          Touch-optimized with 44px+ hit targets, instant search, and full accessibility
          ========================================================================= */}
      {/* Mobile Backdrop Overlay */}
      <div
        className={cn(
          'fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300',
          isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={closeMobile}
        aria-hidden="true"
      />

      {/* Mobile Slide-Out Drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 right-0 w-80 max-w-[85vw] bg-slate-900 text-slate-100 flex flex-col h-full border-l border-slate-800 z-50 lg:hidden shadow-2xl transition-transform duration-300 ease-in-out',
          isMobileOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        aria-label="القائمة الجانبية للموبايل"
      >
        {/* Mobile Header with Brand & Close Button */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white p-1 shadow-xs border border-slate-700/50 flex items-center justify-center shrink-0">
              <Image
                src="/logo.png"
                alt="ALSAADA"
                width={32}
                height={32}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <div>
              <h1 className="font-bold text-sm text-white tracking-wide">السعادة سمارت بوت</h1>
              <p className="text-[10px] text-slate-400">لوحة الإدارة والرقابة المؤسسية</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeMobile}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            aria-label="إغلاق القائمة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Search Input */}
        <div className="p-3 border-b border-slate-800/80 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="بحث في الأقسام والصفحات..."
              value={mobileSearchQuery}
              onChange={(e) => setMobileSearchQuery(e.target.value)}
              className="w-full text-xs pr-8 pl-8 py-2.5 bg-slate-950/60 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 min-h-[44px]"
            />
            {mobileSearchQuery && (
              <button
                type="button"
                onClick={() => setMobileSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                aria-label="مسح البحث"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation List */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {mobileFilteredItems.map((group) => {
            const Icon = ICON_MAP[group.iconName] || Settings;
            const hasChildren = hasSubNav(group);
            const isGroupCurrentlyActive = isGroupActive(group);
            const isExpanded = mobileSearchQuery.trim()
              ? true
              : (mobileOpenSections[group.href] ?? isGroupCurrentlyActive);

            if (hasChildren) {
              return (
                <div key={group.href} className="space-y-1">
                  <button
                    type="button"
                    onClick={() =>
                      setMobileOpenSections((prev) => ({
                        ...prev,
                        [group.href]: !isExpanded,
                      }))
                    }
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-semibold transition-all text-right cursor-pointer min-h-[44px]',
                      isGroupCurrentlyActive
                        ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white border border-transparent'
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0 text-orange-400" />
                    <span className="flex-1 text-right">{cleanTitle(group.title)}</span>
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 transition-transform duration-200 shrink-0 text-slate-400',
                        isExpanded && 'rotate-180 text-orange-400'
                      )}
                    />
                  </button>

                  {isExpanded && (
                    <div className="pr-3 space-y-2 pt-1 border-r border-slate-800 mr-2">
                      {group.subSections?.length ? (
                        group.subSections.map((subSec) => {
                          const SubIcon = subSec.iconName ? ICON_MAP[subSec.iconName] || Users : Users;
                          const childLinks =
                            group.children?.filter((c) => c.subSection === subSec.title) || [];
                          const hasSubChildren = childLinks.length > 0;
                          const subHasActiveChild = childLinks.some(
                            (c) =>
                              pathname === c.href ||
                              (c.href !== '/admin' && pathname.startsWith(c.href + '/'))
                          );
                          const isSubExpanded = mobileSearchQuery.trim()
                            ? true
                            : (mobileOpenSubSections[subSec.title] ?? subHasActiveChild);

                          return (
                            <div key={subSec.title} className="space-y-1">
                              <button
                                type="button"
                                onClick={() =>
                                  hasSubChildren &&
                                  setMobileOpenSubSections((prev) => ({
                                    ...prev,
                                    [subSec.title]: !isSubExpanded,
                                  }))
                                }
                                className={cn(
                                  'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-right min-h-[44px]',
                                  subHasActiveChild
                                    ? 'bg-slate-800/80 text-orange-300 font-semibold'
                                    : hasSubChildren
                                    ? 'text-slate-300 hover:bg-slate-800/40'
                                    : 'text-slate-500 opacity-60 cursor-default'
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <SubIcon className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{subSec.title}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {subSec.badge && (
                                    <span
                                      className={cn(
                                        'text-[9px] px-1.5 py-0.5 rounded font-normal',
                                        subSec.badge === 'إدارة عليا'
                                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                          : 'bg-slate-800 text-slate-400 border border-slate-700/50'
                                      )}
                                    >
                                      {subSec.badge}
                                    </span>
                                  )}
                                  {hasSubChildren && (
                                    <ChevronDown
                                      className={cn(
                                        'w-3.5 h-3.5 transition-transform duration-200 text-slate-400',
                                        isSubExpanded && 'rotate-180 text-orange-400'
                                      )}
                                    />
                                  )}
                                </div>
                              </button>

                              {hasSubChildren && isSubExpanded && (
                                <div className="pr-4 space-y-1 pt-1 border-r-2 border-orange-500/40 mr-2">
                                  {childLinks.map((child) => {
                                    const isChildPageActive =
                                      pathname === child.href ||
                                      (child.href !== '/admin' && pathname.startsWith(child.href + '/'));

                                    return (
                                      <Link
                                        key={child.href}
                                        href={child.href}
                                        onClick={closeMobile}
                                        className={cn(
                                          'flex items-center justify-between px-2.5 py-2 rounded-md text-xs transition-colors min-h-[44px]',
                                          isChildPageActive
                                            ? 'bg-orange-500/20 text-orange-300 font-bold border border-orange-500/30'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                                        )}
                                      >
                                        <span>{child.title}</span>
                                        {isChildPageActive && (
                                          <span className="text-[9px] bg-orange-500 text-white px-1.5 py-0.5 rounded font-bold">
                                            الحالي
                                          </span>
                                        )}
                                      </Link>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        group.children?.map((child) => {
                          const isChildPageActive =
                            pathname === child.href ||
                            (child.href !== '/admin' && pathname.startsWith(child.href + '/'));

                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={closeMobile}
                              className={cn(
                                'flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition-colors min-h-[44px]',
                                isChildPageActive
                                  ? 'bg-orange-500/20 text-orange-300 font-bold border border-orange-500/30'
                                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                              )}
                            >
                              <span>{child.title}</span>
                              {isChildPageActive && (
                                <span className="text-[9px] bg-orange-500 text-white px-1.5 py-0.5 rounded font-bold">
                                  الحالي
                                </span>
                              )}
                            </Link>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div key={group.href}>
                <Link
                  href={group.href}
                  onClick={closeMobile}
                  className={cn(
                    'flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-semibold transition-all min-h-[44px]',
                    isGroupCurrentlyActive
                      ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white border border-transparent'
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0 text-orange-400" />
                  <span className="flex-1 text-right">{cleanTitle(group.title)}</span>
                </Link>
              </div>
            );
          })}
        </nav>

        {/* Mobile User Profile Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-600 to-orange-500 text-white font-bold flex items-center justify-center text-sm shadow-md ring-2 ring-slate-800 shrink-0">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{user.name}</p>
              <p className="text-[10px] text-orange-400 truncate">
                {user.assignedSiteName || user.role}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* =========================================================================
          2️⃣ DESKTOP DUAL-RAIL NAVIGATION (lg+)
          - Primary Icon Rail (w-[70px]) with tooltips and active glow indicator
          - Floating / Pinned Secondary Flyout Panel (w-80 / 320px) with custom scrollbar
          ========================================================================= */}
      <aside
        className={cn(
          'hidden lg:flex relative shrink-0 h-screen select-none',
          !isPinned && isFlyoutOpen ? 'z-50' : 'z-30'
        )}
        aria-label="التنقل المؤسسي المزدوج"
      >
        
        {/* PRIMARY ICON RAIL (70px) */}
        <div
          className="w-[70px] bg-slate-950 border-l border-slate-800/80 flex flex-col items-center py-4 z-40 shrink-0 justify-between h-screen"
          aria-label="شريط التنقل الأيقوني"
        >
          {/* Top Brand Logo */}
          <div className="flex flex-col items-center gap-4 w-full">
            <Link
              href="/admin"
              className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 p-1.5 border border-slate-700/80 shadow-lg flex items-center justify-center cursor-pointer hover:border-orange-500/50 transition-all group"
              title="لوحة الإدارة والرقابة المؤسسية — السعادة سمارت بوت"
            >
              <div className="w-full h-full bg-white rounded-lg flex items-center justify-center p-0.5 shadow-inner group-hover:scale-105 transition-transform overflow-hidden">
                <Image
                  src="/logo.png"
                  alt="ALSAADA"
                  width={28}
                  height={28}
                  className="object-contain"
                  priority
                />
              </div>
            </Link>
            <div className="w-8 h-px bg-slate-800/80" />

            {/* Rail Navigation Icons */}
            <nav className="flex flex-col items-center gap-2.5 w-full px-2">
              {navItems.map((group) => {
                const Icon = ICON_MAP[group.iconName] || Settings;
                const isCurrentActive = isGroupActive(group);
                const isSelected = selectedRailHref === group.href && isFlyoutOpen;
                const titleClean = cleanTitle(group.title);
                const hasChildren = hasSubNav(group);

                const innerRailContent = (
                  <>
                    <Icon className="w-5 h-5 transition-transform group-hover:scale-110" />

                    {/* Active Right Indicator Bar */}
                    {(isSelected || (isCurrentActive && !isFlyoutOpen)) && (
                      <span className="absolute right-0 w-1.5 h-6 bg-orange-500 rounded-l shadow-xs" />
                    )}

                    {/* Live Dot Badge for currently active route */}
                    {isCurrentActive && (
                      <span className="absolute top-2 left-2 w-2 h-2 rounded-full bg-orange-400 ring-2 ring-slate-950" />
                    )}

                    {/* Hover Floating Tooltip */}
                    <div className="absolute right-[calc(100%+10px)] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-slate-900 text-slate-100 text-xs rounded-lg border border-slate-700/80 shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 text-right">
                      <div className="font-semibold">{titleClean}</div>
                      {hasChildren && (
                        <div className="text-[10px] text-slate-400">انقر لفتح الأقسام الفرعية</div>
                      )}
                    </div>
                  </>
                );

                const railItemClasses = cn(
                  'group relative w-12 h-12 rounded-xl flex items-center justify-center transition-all cursor-pointer',
                  isSelected || (isCurrentActive && !isFlyoutOpen)
                    ? 'text-orange-400 bg-orange-500/15 border border-orange-500/30 shadow-lg shadow-orange-500/10'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
                );

                const safeId = `rail-btn-${group.href.replace(/[^a-zA-Z0-9]/g, '-')}`;

                if (!hasChildren) {
                  return (
                    <Link
                      key={group.href}
                      id={safeId}
                      href={group.href}
                      onClick={() => handleRailClick(group)}
                      title={titleClean}
                      aria-label={titleClean}
                      className={railItemClasses}
                    >
                      {innerRailContent}
                    </Link>
                  );
                }

                return (
                  <button
                    key={group.href}
                    id={safeId}
                    type="button"
                    onClick={() => handleRailClick(group)}
                    title={titleClean}
                    aria-label={titleClean}
                    aria-expanded={selectedRailHref === group.href && isFlyoutOpen}
                    aria-controls="flyout-panel"
                    className={railItemClasses}
                  >
                    {innerRailContent}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* User Profile Avatar at Rail Bottom */}
          <div className="flex flex-col items-center gap-2 w-full pt-2 border-t border-slate-800/80">
            <div
              title={`${user.name} (${user.role})`}
              className="relative cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-600 to-orange-500 text-white font-bold flex items-center justify-center text-sm shadow-md ring-2 ring-slate-800 group-hover:ring-orange-500/50 transition-all">
                {user.name.charAt(0)}
              </div>
              {/* Online Status Dot */}
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-slate-950" />

              {/* User Meta Tooltip */}
              <div className="absolute right-[calc(100%+10px)] bottom-0 px-3 py-2 bg-slate-900 text-slate-100 text-xs rounded-xl border border-slate-700/80 shadow-2xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 text-right">
                <p className="font-bold text-white text-xs">{user.name}</p>
                <p className="text-[10px] text-orange-400 font-medium">
                  {user.assignedSiteName || user.role}
                </p>
                <div className="mt-1 pt-1 border-t border-slate-800 flex items-center gap-1 text-[9px] text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>متصل لحظياً &lt; 15ms</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FLOATING BACKDROP (Closes flyout when clicked outside in unpinned floating mode) */}
        {!isPinned && isFlyoutOpen && (
          <div
            className="fixed inset-0 z-30 bg-slate-950/20 backdrop-blur-[1px]"
            onClick={() => setIsFlyoutOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* SECONDARY FLYOUT PANEL (320px - w-80) */}
        {isFlyoutOpen && hasSubNav(selectedSector) && (
          <div
            id="flyout-panel"
            className={cn(
              'w-80 bg-slate-900/95 backdrop-blur-2xl border-l border-slate-800 shadow-2xl flex flex-col z-40 transition-all duration-300 ease-in-out shrink-0 h-screen',
              isPinned ? 'relative' : 'absolute right-[70px] inset-y-0'
            )}
            aria-label="اللوح الفرعي للتنقل"
          >
            {/* Flyout Header */}
            <div className="p-4 border-b border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-950/40">
              <div>
                <span className="text-[10px] font-semibold tracking-wider text-orange-400 uppercase">
                  قطاع المنظومة
                </span>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{cleanTitle(selectedSector.title)}</span>
                </h2>
              </div>

              <div className="flex items-center gap-1">
                {/* Pin / Unpin Toggle Button */}
                <button
                  type="button"
                  onClick={togglePinMode}
                  className={cn(
                    'p-1.5 rounded-lg text-xs transition-colors cursor-pointer',
                    isPinned
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  )}
                  title={isPinned ? 'إلغاء التثبيت (العودة للنمط العائم)' : 'تثبيت اللوح الفرعي بجانب الشريط'}
                  aria-label={isPinned ? 'إلغاء التثبيت' : 'تثبيت اللوح الفرعي'}
                >
                  {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                </button>

                {/* Close Flyout Button */}
                <button
                  type="button"
                  onClick={() => setIsFlyoutOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="إغلاق اللوح"
                  aria-label="إغلاق اللوح"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Flyout Quick Search Filter */}
            <div className="p-3 border-b border-slate-800/50 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="بحث سريع في الأقسام والصفحات..."
                  value={flyoutSearchQuery}
                  onChange={(e) => setFlyoutSearchQuery(e.target.value)}
                  className="w-full text-xs pr-8 pl-8 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/20 transition-all"
                />
                {flyoutSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setFlyoutSearchQuery('')}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs p-0.5 cursor-pointer"
                    aria-label="مسح البحث"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Sub-Departments Content List (Custom Sleek Scrollbar — No Ugly Windows Scrollbar!) */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
              
              {/* RENDER CASE A: Sub-sections tree (e.g. Workforce Domain matching Bot) */}
              {selectedSector.subSections && selectedSector.subSections.length > 0 ? (
                filteredSubSections.map((subSec: NavSubSection) => {
                  const SubIcon = subSec.iconName ? ICON_MAP[subSec.iconName] || Users : Users;
                  const allChildLinks =
                    selectedSector.children?.filter((c) => c.subSection === subSec.title) || [];
                  const q = flyoutSearchQuery.trim().toLowerCase();
                  const childLinks =
                    q && !subSec.title.toLowerCase().includes(q)
                      ? allChildLinks.filter((c) => c.title.toLowerCase().includes(q))
                      : allChildLinks;
                  const hasChildLinks = childLinks.length > 0;
                  const hasActiveChild = childLinks.some(
                    (c) =>
                      pathname === c.href ||
                      (c.href !== '/admin' && pathname.startsWith(c.href + '/'))
                  );
                  const styleCfg = SUB_SECTION_STYLES[subSec.title] || {
                    capsule: 'bg-slate-800/80 border-slate-700/60 text-slate-300',
                    iconColor: 'text-slate-400',
                    defaultBadge: subSec.badge,
                  };

                  if (hasChildLinks) {
                    return (
                      <div
                        key={subSec.title}
                        className="sub-group rounded-xl border border-orange-500/30 bg-orange-500/5 p-2.5 shadow-xs space-y-2"
                      >
                        <div className="flex items-center justify-between cursor-pointer">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={cn(
                                'w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 shadow-inner',
                                styleCfg.capsule
                              )}
                            >
                              <SubIcon className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold text-orange-300 leading-snug">
                              {subSec.title}
                            </span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold shrink-0">
                            {subSec.badge || 'مكتمل 100%'}
                          </span>
                        </div>

                        {/* Child Links Sub-Tree */}
                        <div className="pr-3.5 space-y-1 pt-1 border-r-2 border-orange-500/40 mr-2.5">
                          {childLinks.map((child: NavChildItem) => {
                            const isChildPageActive =
                              pathname === child.href ||
                              (child.href !== '/admin' && pathname.startsWith(child.href + '/'));

                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={() => {
                                  if (!isPinned) {
                                    setIsFlyoutOpen(false);
                                  }
                                }}
                                className={cn(
                                  'flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                                  isChildPageActive
                                    ? 'bg-orange-500/20 text-orange-300 font-bold border border-orange-500/40 shadow-xs'
                                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                                )}
                              >
                                <span className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={cn(
                                      'w-1.5 h-1.5 rounded-full shrink-0',
                                      isChildPageActive ? 'bg-orange-400' : 'bg-slate-600'
                                    )}
                                  />
                                  <span className="leading-snug break-words">{child.title}</span>
                                </span>
                                {isChildPageActive && (
                                  <span className="text-[9px] bg-orange-500 text-white px-1.5 py-0.2 rounded font-bold shrink-0">
                                    الحالي
                                  </span>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  // Upcoming / Muted Phase Sub-Section
                  return (
                    <div
                      key={subSec.title}
                      className="sub-group opacity-60 hover:opacity-100 transition-opacity rounded-xl border border-slate-800/50 bg-slate-950/20 p-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={cn(
                              'w-7 h-7 rounded-lg border flex items-center justify-center shrink-0',
                              styleCfg.capsule
                            )}
                          >
                            <SubIcon className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-semibold text-slate-300 leading-snug">
                            {subSec.title}
                          </span>
                        </div>
                        {/* Sleek Tooltip badge */}
                        <span
                          title="قيد الإعداد في المرحلة القادمة"
                          className={cn(
                            'text-[9px] px-1.5 py-0.5 rounded border shrink-0',
                            subSec.badge === 'إدارة عليا'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 font-semibold'
                              : 'bg-slate-800/80 text-slate-400 border-slate-700/40'
                          )}
                        >
                          {subSec.badge || 'المرحلة 2'}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                /* RENDER CASE B: Standard Children Links (e.g. Settings, Finance, Operations, Logistics) */
                filteredDirectChildren.map((child: NavChildItem) => {
                  const isChildPageActive =
                    pathname === child.href ||
                    (child.href !== '/admin' && pathname.startsWith(child.href + '/'));

                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={() => {
                        if (!isPinned) {
                          setIsFlyoutOpen(false);
                        }
                      }}
                      className={cn(
                        'flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all border',
                        isChildPageActive
                          ? 'bg-orange-500/20 text-orange-300 font-bold border-orange-500/40 shadow-xs'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border-transparent hover:border-slate-800'
                      )}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={cn(
                            'w-2 h-2 rounded-full shrink-0',
                            isChildPageActive ? 'bg-orange-400' : 'bg-slate-600'
                          )}
                        />
                        <span className="leading-snug">{child.title}</span>
                      </span>
                      {isChildPageActive && (
                        <span className="text-[9px] bg-orange-500 text-white px-1.5 py-0.5 rounded font-bold shrink-0">
                          الحالي
                        </span>
                      )}
                    </Link>
                  );
                })
              )}

              {/* Zero State if search query yields no matches */}
              {((selectedSector.subSections && filteredSubSections.length === 0) ||
                (!selectedSector.subSections?.length && filteredDirectChildren.length === 0)) && (
                <div className="py-8 text-center text-xs text-slate-500 space-y-1">
                  <p>لا توجد نتائج مطابقة للبحث</p>
                  <p className="text-[10px] text-slate-600">جرب البحث بكلمة أخرى</p>
                </div>
              )}
            </div>

            {/* Flyout Footer Info */}
            <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 text-[11px] text-slate-400 flex items-center justify-between shrink-0">
              <span>
                {selectedSector.subSections?.length
                  ? `${selectedSector.subSections.length} أقسام فرعية مطابقة للبوت`
                  : `${selectedSector.children?.length || 0} صفحات تشغيلية`}
              </span>
              <span className="text-emerald-400 font-medium">RBAC مفعل</span>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
