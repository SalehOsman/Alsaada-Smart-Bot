'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Shield, User, Radio, Menu, LogOut, Search } from 'lucide-react';
import type { DashboardUser } from '@/lib/rbac';
import { DEMO_USERS } from '@/lib/users';
import { useSidebar } from './sidebar-context';

interface HeaderProps {
  user: DashboardUser;
  onOpenCommandPalette?: () => void;
}

export function Header({ user, onOpenCommandPalette }: HeaderProps) {
  const router = useRouter();
  const { toggle } = useSidebar();

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedKey = e.target.value;
    document.cookie = `alsaada_admin_role=${selectedKey}; path=/; max-age=86400`;
    router.refresh();
  };

  const handleLogout = () => {
    document.cookie = 'alsaada_admin_role=; path=/; max-age=0';
    document.cookie = 'alsaada_session=; path=/; max-age=0';
    window.location.href = '/api/auth/logout';
  };

  const isSuperAdmin = user.role === 'SUPER_ADMIN' || user.isRealSuperAdmin;

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Start (Right in RTL): Hamburger, Search & Role Switcher */}
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Button (< lg) */}
        <button
          type="button"
          onClick={toggle}
          className="lg:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center border border-slate-200 cursor-pointer transition-colors"
          aria-label="فتح القائمة الجانبية"
        >
          <Menu className="w-5 h-5 text-slate-700" />
        </button>

        {/* Mobile Logo Badge Frame (< lg) */}
        <div className="w-9 h-9 rounded-xl bg-white p-1 shadow-xs border border-slate-300 flex items-center justify-center shrink-0 lg:hidden">
          <Image
            src="/logo.png"
            alt="ALSAADA"
            width={28}
            height={28}
            className="w-full h-full object-contain"
            priority
          />
        </div>

        {/* Global Command Palette Trigger Button (Ctrl + K) */}
        <button
          type="button"
          onClick={() => {
            if (onOpenCommandPalette) {
              onOpenCommandPalette();
            } else if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('open-command-palette'));
            }
          }}
          className="hidden sm:flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors min-h-[38px]"
          title="البحث السريع الشامل (Ctrl + K)"
        >
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <span>بحث سريع...</span>
          <kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-300 text-[10px] font-mono text-slate-600 font-bold">
            Ctrl K
          </kbd>
        </button>

        {/* Role Simulator (Super Admin Only) */}
        {isSuperAdmin && (
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            <Shield className="w-4 h-4 text-orange-600 shrink-0" />
            <span className="hidden sm:inline text-xs font-medium text-slate-700">
              المحاكاة واختبار الصلاحيات:
            </span>
            <select
              defaultValue={
                Object.entries(DEMO_USERS).find(([_, u]) => u.role === user.role)?.[0] || 'superadmin'
              }
              onChange={handleRoleChange}
              className="text-xs bg-white border border-slate-300 rounded px-2 py-1 font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-orange-500 cursor-pointer"
            >
              <option value="superadmin">👑 المدير العام (Super Admin)</option>
              <option value="generaladmin">🏢 جينرال أدمن (General Admin)</option>
              <option value="executive">💼 الإدارة العليا (Executive)</option>
              <option value="projectmanager">🏗️ مدير المشروع (Project Manager)</option>
              <option value="siteengineer">👷 مهندس الموقع (Site Engineer)</option>
              <option value="accountant">📊 المحاسب المالي (Accountant)</option>
              <option value="fieldadmin">🛡️ مشرف الموقع (Field Admin)</option>
              <option value="worker">👤 عامل (Worker)</option>
            </select>
          </div>
        )}

        <div className="hidden xl:flex items-center gap-2 text-xs text-slate-500">
          <Radio className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
          <span>
            البوت متصل لحظياً (<span className="text-orange-600 font-medium">&lt; 15ms</span>)
          </span>
        </div>
      </div>

      {/* End (Left in RTL): Site Badge, User Meta & Logout */}
      <div className="flex items-center gap-3 sm:gap-4">
        {user.assignedSiteName && (
          <span className="hidden sm:inline-block bg-blue-50 text-blue-700 border border-blue-200 text-xs px-3 py-1 rounded-full font-medium">
            📍 {user.assignedSiteName}
          </span>
        )}

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-left hidden sm:block">
            <p className="text-xs font-bold text-slate-800">{user.name}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{user.role}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-700 font-bold text-xs">
            <User className="w-4 h-4" />
          </div>
        </div>

        {/* Logout Button */}
        <button
          type="button"
          onClick={handleLogout}
          className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer transition-colors"
          title="تسجيل الخروج من المنظومة"
          aria-label="تسجيل الخروج"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
