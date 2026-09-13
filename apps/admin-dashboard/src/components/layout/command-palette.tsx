'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  LayoutDashboard,
  Users,
  UserPlus,
  DoorOpen,
  CheckSquare,
  Wallet,
  Building2,
  Briefcase,
  Shield,
  FileText,
  Activity,
  Sliders,
  Bell,
  Ghost,
  ArrowRight,
  Sparkles,
  X,
} from 'lucide-react';

interface PaletteItem {
  id: string;
  title: string;
  category: 'شاشات المنظومة' | 'إجراءات سريعة';
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const COMMAND_ITEMS: PaletteItem[] = [
  {
    id: 'dashboard',
    title: 'نظرة عامة والمؤشرات الإدارية',
    category: 'شاشات المنظومة',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    id: 'workforce-directory',
    title: 'دليل وسجل العاملين (360°)',
    category: 'شاشات المنظومة',
    href: '/admin/workforce/directory',
    icon: Users,
  },
  {
    id: 'workforce-new',
    title: 'تسجيل وتعيين عامل جديد',
    category: 'إجراءات سريعة',
    href: '/admin/workforce/new',
    icon: UserPlus,
    badge: 'إجراء سريع',
  },
  {
    id: 'workforce-clearances',
    title: 'مخالصات إنهاء الخدمة وتصفية المستحقات',
    category: 'شاشات المنظومة',
    href: '/admin/workforce/clearances',
    icon: DoorOpen,
  },
  {
    id: 'approvals',
    title: 'مركز الاعتمادات والقرارات الفورية',
    category: 'شاشات المنظومة',
    href: '/admin/approvals',
    icon: CheckSquare,
    badge: 'معتمد',
  },
  {
    id: 'treasury',
    title: 'الخزائن ومرصد السيولة والعهد الميدانية',
    category: 'شاشات المنظومة',
    href: '/admin/finance/treasury',
    icon: Wallet,
    badge: 'مالية',
  },
  {
    id: 'settings-sites',
    title: 'المواقع والمشاريع الميدانية',
    category: 'شاشات المنظومة',
    href: '/admin/settings/sites',
    icon: Building2,
  },
  {
    id: 'settings-jobs',
    title: 'الهيكل الوظيفي ومصفوفة المهن والأجور',
    category: 'شاشات المنظومة',
    href: '/admin/settings/jobs',
    icon: Briefcase,
  },
  {
    id: 'settings-users',
    title: 'المستخدمين والصلاحيات وتفويض المشرفين',
    category: 'شاشات المنظومة',
    href: '/admin/settings/users',
    icon: Shield,
  },
  {
    id: 'settings-company',
    title: 'ملف المنظومة المؤسسي والسجل التجاري',
    category: 'شاشات المنظومة',
    href: '/admin/settings/company',
    icon: FileText,
  },
  {
    id: 'settings-audit',
    title: 'خزينة التدقيق الجنائي وسجلات الحذف المشفرة',
    category: 'شاشات المنظومة',
    href: '/admin/settings/audit-vault',
    icon: Shield,
  },
  {
    id: 'settings-telemetry',
    title: 'مرصد الأداء اللحظي والـ APM',
    category: 'شاشات المنظومة',
    href: '/admin/settings/telemetry',
    icon: Activity,
  },
  {
    id: 'settings-studio',
    title: 'استوديو تصحيح وتعديل البيانات (Doc 09 Studio)',
    category: 'شاشات المنظومة',
    href: '/admin/settings/studio',
    icon: Sliders,
  },
  {
    id: 'settings-notifications',
    title: 'سياسات الإشعارات والتوبيكات',
    category: 'شاشات المنظومة',
    href: '/admin/settings/notifications',
    icon: Bell,
  },
  {
    id: 'settings-ghost',
    title: 'محاكي وضع الشبح واختبار الصلاحيات',
    category: 'شاشات المنظومة',
    href: '/admin/settings/ghost-mode',
    icon: Ghost,
  },
];

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener: Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleCustomOpen = () => {
      setIsOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-command-palette', handleCustomOpen);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-command-palette', handleCustomOpen);
    };
  }, []);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Filter items
  const filteredItems = COMMAND_ITEMS.filter((item) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  // Handle keyboard navigation within results
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        navigate(filteredItems[selectedIndex].href);
      }
    }
  };

  const navigate = (href: string) => {
    setIsOpen(false);
    router.push(href);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={() => setIsOpen(false)}
      />

      {/* Floating Modal Window */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[80vh] animate-in fade-in-0 zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200 gap-3">
          <Search className="w-5 h-5 text-orange-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="ابحث عن شاشة، إجراء، أو أمر سريع... (مثال: عمال، سلف، عهد)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block bg-slate-100 px-2 py-0.5 rounded text-[10px] font-mono text-slate-500 border border-slate-200">
            ESC للإغلاق
          </kbd>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-2 divide-y divide-slate-100 flex-1">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              <Sparkles className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              <span>لم يتم العثور على أي نتائج مطابقة لـ &quot;{query}&quot;</span>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.href)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-right transition-colors cursor-pointer ${
                    isSelected ? 'bg-orange-50 text-orange-950' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-orange-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{item.title}</span>
                        {item.badge && (
                          <span className="text-[10px] bg-orange-100 text-orange-800 px-1.5 py-0.2 rounded font-bold">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        {item.category} • {item.href}
                      </span>
                    </div>
                  </div>

                  <ArrowRight
                    className={`w-4 h-4 rotate-180 transition-transform ${
                      isSelected ? 'text-orange-600 -translate-x-1' : 'text-slate-300'
                    }`}
                  />
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="bg-slate-50 px-4 py-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span>التنقل بالأسهم:</span>
            <kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[10px]">
              ↑
            </kbd>
            <kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[10px]">
              ↓
            </kbd>
            <span className="mr-2">للاختيار:</span>
            <kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[10px]">
              Enter
            </kbd>
          </div>
          <span className="font-medium text-orange-600">Al-Saada Smart Command</span>
        </div>
      </div>
    </div>
  );
}
