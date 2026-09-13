import React from 'react';
import Link from 'next/link';
import {
  Settings,
  Building2,
  Briefcase,
  Users,
  ShieldAlert,
  Activity,
  TableProperties,
  Ghost,
  BellRing,
  Building,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';

const SETTINGS_SECTIONS = [
  {
    title: 'المواقع والمشاريع الميدانية',
    desc: 'إدارة مواقع العمل المفتوحة، إسناد المشرفين، وإحصائيات القوى العاملة (Flow 00.2).',
    href: '/admin/settings/sites',
    icon: Building2,
    badge: '4 مواقع',
  },
  {
    title: 'مصفوفة الوظائف والأجور',
    desc: 'إدارة المسميات المهنية، شرائح الرواتب واليوميات، وتحديد المخصصات (Flow 00.3).',
    href: '/admin/settings/jobs',
    icon: Briefcase,
    badge: '18 مهنة',
  },
  {
    title: 'المستخدمين والصلاحيات (RBAC)',
    desc: 'إدارة رتب المشرفين والإداريين، الترقية، وتفويض الصلاحيات (Flow 00.12).',
    href: '/admin/settings/users',
    icon: Users,
    badge: '5 أدوار',
  },
  {
    title: 'استوديو تصحيح البيانات (Doc 09)',
    desc: 'واجهة تعديل وتصحيح الحركات المحاسبية كالإكسيل مع الحذف الناعم (Web Studio).',
    href: '/admin/settings/studio',
    icon: TableProperties,
    badge: 'سوبر أدمن',
  },
  {
    title: 'خزينة التدقيق الجنائي وسجل الأخطاء',
    desc: 'تتبع كافة عمليات التعديل والشطب وسجلات الأخطاء البرمجية (Flow 00.7).',
    href: '/admin/settings/audit-vault',
    icon: ShieldAlert,
    badge: 'رقابة مشفرة',
  },
  {
    title: 'مرصد الأداء اللحظي (APM)',
    desc: 'قياس سرعة استجابة البوت وقاعدة البيانات وطوابير المزامنة (Flow 00.8).',
    href: '/admin/settings/telemetry',
    icon: Activity,
    badge: '< 15ms',
  },
  {
    title: 'محاكي وضع الشبح (Ghost Mode)',
    desc: 'محاكاة البوت والواجهات برتب مختلفة دون التأثير على البيانات الحقيقية (Flow 00.6).',
    href: '/admin/settings/ghost-mode',
    icon: Ghost,
    badge: 'اختبار حي',
  },
  {
    title: 'سياسات الإشعارات ومجموعات تليجرام',
    desc: 'توجيه الإشعارات التلقائية للتوبيكات المخصصة بحسب نوع المعاملة (Flow 00.10 & 00.11).',
    href: '/admin/settings/notifications',
    icon: BellRing,
    badge: 'توجيه آلي',
  },
];

export default function SettingsHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-orange-600" />
          <span>مركز إعدادات وحوكمة المنظومة (Super Admin Suite)</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          إدارة البنية المؤسسية، الصلاحيات، الرقابة الجنائية، وأداء النظام لكافة التدفقات الـ 12 المعتمدة.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {SETTINGS_SECTIONS.map((sec) => {
          const Icon = sec.icon;
          return (
            <Link
              key={sec.href}
              href={sec.href}
              className="group bg-white p-6 rounded-xl border border-slate-200 hover:border-orange-500 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-semibold text-orange-800 bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-200/60">
                    {sec.badge}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-orange-700 transition-colors">
                  {sec.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  {sec.desc}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-orange-600">
                <span>فتح القسم والتحكم</span>
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-[-2px] transition-transform" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
