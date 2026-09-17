'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  Radio,
  Menu,
  LogOut,
  Search,
  Sun,
  Moon,
  Sliders,
  Clock,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  X,
} from 'lucide-react';
import type { DashboardUser } from '@/lib/rbac';
import { useSidebar } from './sidebar-context';
import { useDashboardPreferences } from '@/components/providers/dashboard-preferences-provider';

interface HeaderProps {
  user: DashboardUser;
  onOpenCommandPalette?: () => void;
}

export function Header({ user, onOpenCommandPalette }: HeaderProps) {
  const router = useRouter();
  const { toggle } = useSidebar();
  const {
    resolvedTheme,
    setTheme,
    formatTime,
    currentTimezoneInfo,
    playNotificationSound,
  } = useDashboardPreferences();

  // Live operational clock with seconds and hydration immunity
  const [mounted, setMounted] = useState(false);
  const [clockTime, setClockTime] = useState<string>('');

  // Notification Bell Dropdown state
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notifRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setMounted(true);
    setClockTime(formatTime(new Date(), true));
    const timer = setInterval(() => {
      setClockTime(formatTime(new Date(), true));
    }, 1000);
    return () => clearInterval(timer);
  }, [formatTime]);

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const handleLogout = () => {
    document.cookie = 'alsaada_session=; path=/; max-age=0';
    window.location.href = '/api/auth/logout';
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs transition-colors">
      {/* Start (Right in RTL): Hamburger, Search & Role Switcher */}
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Button (< lg) */}
        <button
          type="button"
          onClick={toggle}
          className="lg:hidden p-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
          aria-label="فتح القائمة الجانبية"
        >
          <Menu className="w-5 h-5 text-slate-700 dark:text-slate-300" />
        </button>

        {/* Mobile Logo Badge Frame (< lg) */}
        <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 p-1 shadow-xs border border-slate-300 dark:border-slate-700 flex items-center justify-center shrink-0 lg:hidden">
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
          className="hidden sm:flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors min-h-[38px]"
          title="البحث السريع الشامل (Ctrl + K)"
        >
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <span>بحث سريع...</span>
          <kbd className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-[10px] font-mono text-slate-600 dark:text-slate-300 font-bold">
            Ctrl K
          </kbd>
        </button>

        {/* Live Operational Clock */}
        <div
          className="hidden md:flex items-center gap-2 bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-200"
          title={`المنطقة الزمنية المعتمدة: ${currentTimezoneInfo.name}`}
        >
          <span className="text-sm select-none">{currentTimezoneInfo.flag}</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {currentTimezoneInfo.city}
          </span>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <Clock className="w-3.5 h-3.5 text-orange-500" />
          <span className="font-bold tracking-wider select-all text-orange-600 dark:text-orange-400">
            {mounted ? (clockTime || formatTime(new Date(), true)) : '--:--:--'}
          </span>
        </div>

        <div className="hidden xl:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span>
            البوت متصل لحظياً (<span className="text-orange-600 dark:text-orange-400 font-medium">&lt; 15ms</span>)
          </span>
        </div>
      </div>

      {/* End (Left in RTL): Site Badge, Notifications, Theme Toggle, Preferences, User Meta & Logout */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {user.assignedSiteName && (
          <span className="hidden sm:inline-block bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs px-3 py-1 rounded-full font-medium">
            📍 {user.assignedSiteName}
          </span>
        )}

        {/* Live Notification Bell with Dropdown & Audio Chime */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => {
              if (!isNotificationsOpen) {
                playNotificationSound();
              }
              setIsNotificationsOpen((prev) => !prev);
            }}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer transition-colors relative"
            title="الإشعارات والتنبيهات الميدانية الحية"
            aria-label="الإشعارات الميدانية"
            aria-expanded={isNotificationsOpen}
          >
            <Bell className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            {/* Live pulsing badge */}
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
            </span>
          </button>

          {/* Notifications Dropdown Panel */}
          {isNotificationsOpen && (
            <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden text-right">
              <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/50">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                    التنبيهات والعمليات العاجلة
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30">
                    3 جديدة
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNotificationsOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  aria-label="إغلاق"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto custom-scrollbar">
                <div className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                    <Banknote className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">طلب سلفة نقدية عاجلة (1,500 ج.م)</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">موقع الساحل الشمالي — بانتظار الاعتماد</p>
                    <span className="text-[9px] text-orange-500 font-medium">منذ 5 دقائق</span>
                  </div>
                </div>

                <div className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">اكتمال تعيين عامل جديد بنجاح</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">شؤون العاملين — تم حفظ الرقم القومي والملف</p>
                    <span className="text-[9px] text-slate-400 font-medium">منذ 12 دقيقة</span>
                  </div>
                </div>

                <div className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">تحذير سيولة: رصيد عهدة المحور منخفض</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">المتبقي أقل من 10% من سقف العهدة</p>
                    <span className="text-[9px] text-rose-500 font-medium">منذ 25 دقيقة</span>
                  </div>
                </div>
              </div>

              <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 text-center">
                <Link
                  href="/admin/approvals"
                  onClick={() => setIsNotificationsOpen(false)}
                  className="text-[11px] text-orange-600 dark:text-orange-400 hover:underline font-semibold"
                >
                  عرض كافة الموافقات والإشعارات ←
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Quick Theme Toggle (Light / Dark) with Smooth 90-degree Morph Transition */}
        <button
          type="button"
          onClick={toggleTheme}
          className="group p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer transition-all duration-300"
          title={mounted && resolvedTheme === 'dark' ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
          aria-label="تبديل الوضع الليلي والنهاري"
        >
          {mounted && resolvedTheme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 transform group-hover:rotate-45 group-active:rotate-90" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600 dark:text-slate-300 transition-transform duration-300 transform group-hover:rotate-45 group-active:rotate-90" />
          )}
        </button>

        {/* Quick Preferences Shortcut */}
        <Link
          href="/admin/settings/preferences"
          className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer transition-colors"
          title="تفضيلات الداشبورد والمظهر والتوقيت"
          aria-label="تفضيلات الداشبورد"
        >
          <Sliders className="w-4 h-4" />
        </Link>

        <div className="flex items-center gap-2 sm:gap-3 mr-1">
          <div className="text-left hidden sm:block">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{user.name}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">{user.role}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold text-xs">
            <User className="w-4 h-4" />
          </div>
        </div>

        {/* Logout Button */}
        <button
          type="button"
          onClick={handleLogout}
          className="p-2 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900 min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer transition-colors"
          title="تسجيل الخروج من المنظومة"
          aria-label="تسجيل الخروج"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

