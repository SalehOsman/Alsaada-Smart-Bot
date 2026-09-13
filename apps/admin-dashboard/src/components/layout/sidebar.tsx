'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Settings,
  Building2,
  Briefcase,
  UserCheck,
  ShieldAlert,
  Activity,
  TableProperties,
  Ghost,
  BellRing,
  UserPlus,
  FileSpreadsheet,
  ChevronDown,
  X,
  Wallet,
  Tractor,
  PackageCheck,
  CheckSquare,
} from 'lucide-react';
import type { DashboardUser, NavItem } from '@/lib/rbac';
import { filterNavItemsForUser } from '@/lib/rbac';
import { cn } from '@/lib/utils';
import { useSidebar } from './sidebar-context';

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  Users,
  Settings,
  Building2,
  Briefcase,
  UserCheck,
  ShieldAlert,
  Activity,
  TableProperties,
  Ghost,
  BellRing,
  UserPlus,
  FileSpreadsheet,
  Wallet,
  Tractor,
  PackageCheck,
  CheckSquare,
};

interface SidebarProps {
  user: DashboardUser;
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const { isOpen, close } = useSidebar();
  const navItems = filterNavItemsForUser(user.role);

  // Helper to check if any child is currently active
  const isChildActive = (group: NavItem): boolean =>
    Boolean(
      group.children?.some(
        (sub) =>
          pathname === sub.href ||
          (sub.href !== '/admin' && pathname.startsWith(sub.href + '/'))
      )
    );

  // Accordion open/collapsed state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navItems.forEach((group) => {
      if (group.children && (pathname === group.href || isChildActive(group))) {
        initial[group.href] = true;
      }
    });
    return initial;
  });

  // Auto-expand section matching current active route
  useEffect(() => {
    navItems.forEach((group) => {
      if (group.children && (pathname === group.href || isChildActive(group))) {
        setOpenSections((prev) => ({ ...prev, [group.href]: true }));
      }
    });
  }, [pathname]);

  const toggleSection = (group: NavItem) => {
    const currentlyOpen = openSections[group.href] ?? isChildActive(group);
    setOpenSections((prev) => ({
      ...prev,
      [group.href]: !currentlyOpen,
    }));
  };

  const isSectionExpanded = (group: NavItem): boolean =>
    openSections[group.href] ?? isChildActive(group);

  const renderNavList = (onLinkClick?: () => void) => (
    <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-3">
      {navItems.map((group) => {
        const Icon = ICON_MAP[group.iconName] || Settings;
        const hasChildren = Boolean(group.children && group.children.length > 0);
        const isExpanded = isSectionExpanded(group);

        const hasActiveChild = isChildActive(group);

        // Fix root /admin matching bug: /admin only matches strictly when pathname === '/admin'
        const isGroupActive =
          group.href === '/admin'
            ? pathname === '/admin'
            : pathname === group.href || hasActiveChild;

        if (hasChildren) {
          return (
            <div key={group.href} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleSection(group)}
                aria-expanded={isExpanded}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-right cursor-pointer select-none',
                  isGroupActive
                    ? 'bg-orange-600/15 text-orange-400 border border-orange-500/20'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-right">{group.title}</span>
                <ChevronDown
                  className={cn(
                    'w-3.5 h-3.5 transition-transform duration-200 shrink-0',
                    isExpanded ? 'rotate-180 text-orange-400' : 'opacity-60'
                  )}
                />
              </button>

              <div
                className={cn(
                  'pr-7 space-y-1 overflow-hidden transition-all duration-300 ease-in-out',
                  isExpanded ? 'max-h-96 opacity-100 pt-1' : 'max-h-0 opacity-0'
                )}
              >
                {group.children?.map((sub) => {
                  const isSubActive =
                    pathname === sub.href ||
                    (sub.href !== '/admin' && pathname.startsWith(sub.href + '/'));

                  return (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      onClick={onLinkClick}
                      className={cn(
                        'block px-3 py-2 rounded-md text-xs transition-colors',
                        isSubActive
                          ? 'text-orange-400 font-semibold bg-orange-500/10'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      )}
                    >
                      {sub.title}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        }

        return (
          <div key={group.href} className="space-y-1">
            <Link
              href={group.href}
              onClick={onLinkClick}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isGroupActive
                  ? 'bg-orange-600/15 text-orange-400 border border-orange-500/20'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-right">{group.title}</span>
            </Link>
          </div>
        );
      })}
    </nav>
  );

  const renderUserProfile = () => (
    <div className="p-4 border-t border-slate-800 bg-slate-950/40 shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-orange-600/30 text-orange-400 border border-orange-500/40 flex items-center justify-center font-bold text-xs shrink-0">
          {user.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">{user.name}</p>
          <p className="text-[10px] text-orange-400 truncate">
            {user.assignedSiteName || user.role}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Dark Backdrop Overlay for Mobile Drawer (< lg) */}
      <div
        className={cn(
          'fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={close}
        aria-hidden="true"
      />

      {/* Mobile Slide-Out Drawer (< lg) */}
      <aside
        className={cn(
          'fixed inset-y-0 right-0 w-72 bg-slate-900 text-slate-100 flex flex-col h-full border-l border-slate-800 z-50 lg:hidden shadow-2xl transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        aria-label="القائمة الجانبية للموبايل"
      >
        {/* Mobile Header with Logo and Close Button */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white p-1 shadow-xs border border-slate-700/50 flex items-center justify-center shrink-0">
              <Image
                src="/logo.png"
                alt="ALSAADA CONSTRUCTION"
                width={34}
                height={34}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <div>
              <h1 className="font-bold text-sm text-white tracking-wide">السعادة سمارت بوت</h1>
              <p className="text-[11px] text-slate-400">لوحة الإدارة والرقابة المؤسسية</p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            aria-label="إغلاق القائمة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Nav List */}
        {renderNavList(close)}

        {/* User Footer Profile */}
        {renderUserProfile()}
      </aside>

      {/* Desktop Sticky Sidebar (lg+) */}
      <aside
        className="hidden lg:flex w-72 bg-slate-900 text-slate-100 flex-col h-screen border-l border-slate-800 shrink-0 sticky top-0"
        aria-label="القائمة الجانبية الرئيسية"
      >
        {/* Desktop Brand Header */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-white p-1 shadow-xs border border-slate-700/50 flex items-center justify-center shrink-0">
            <Image
              src="/logo.png"
              alt="ALSAADA CONSTRUCTION"
              width={34}
              height={34}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          <div>
            <h1 className="font-bold text-sm text-white tracking-wide">السعادة سمارت بوت</h1>
            <p className="text-[11px] text-slate-400">لوحة الإدارة والرقابة المؤسسية</p>
          </div>
        </div>

        {/* Desktop Nav List */}
        {renderNavList()}

        {/* User Footer Profile */}
        {renderUserProfile()}
      </aside>
    </>
  );
}
