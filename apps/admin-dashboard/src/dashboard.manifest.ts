import type { CanonicalRole } from '@alsaada/rbac';
import type { NavItem, NavSubSection, NavChildItem, UserRole } from './lib/rbac';
import type {
  DashboardFeature as CoreDashboardFeature,
  DashboardSectionManifest as CoreDashboardSectionManifest,
  DashboardSubSection,
} from '@alsaada/core-components';

export type DashboardFeature = CoreDashboardFeature<UserRole>;
export type DashboardSectionManifest = CoreDashboardSectionManifest<UserRole>;
export type { DashboardSubSection };

export const DASHBOARD_SECTIONS_MANIFEST: DashboardSectionManifest[] = [
  {
    title: 'نظرة عامة والمؤشرات',
    href: '/admin',
    iconName: 'LayoutDashboard',
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    features: [],
  },
  {
    title: '📊 مركز الإحصائيات والتحليلات',
    href: '/admin/analytics',
    iconName: 'BarChart3',
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    features: [],
  },
  {
    title: '👥 الموارد البشرية والعمالة',
    href: '/admin/workforce',
    iconName: 'Users',
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    subSections: [
      {
        title: 'السلف والمسحوبات وحسابات العمال',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
        badge: 'قريباً',
        iconName: 'Banknote',
      },
      {
        title: 'الإجازات والدوام والتواجد الميداني',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
        badge: 'قريباً',
        iconName: 'CalendarClock',
      },
      {
        title: 'شؤون العاملين والتعيينات',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
        iconName: 'Users',
      },
      {
        title: 'الرواتب والأجور والمستحقات',
        allowedRoles: ['SUPER_ADMIN'],
        badge: 'إدارة عليا',
        iconName: 'BadgePercent',
      },
      {
        title: 'الشؤون الإدارية والوثائق والمخيم',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
        badge: 'قريباً',
        iconName: 'Building2',
      },
    ],
    features: [
      {
        id: 'workforce/new',
        module: 'workforce',
        title: 'تعيين عامل جديد',
        href: '/admin/workforce/new',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
        subSection: 'شؤون العاملين والتعيينات',
        status: 'Implemented',
      },
      {
        id: 'workforce/directory',
        module: 'workforce',
        title: 'دليل العاملين',
        href: '/admin/workforce/directory',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
        subSection: 'شؤون العاملين والتعيينات',
        status: 'Implemented',
      },
      {
        id: 'workforce/clearances',
        module: 'workforce',
        title: 'مخالصات إنهاء الخدمة',
        href: '/admin/workforce/clearances',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
        subSection: 'شؤون العاملين والتعيينات',
        status: 'Implemented',
      },
      {
        id: 'workforce/approvals',
        module: 'workforce',
        title: 'مركز الاعتمادات والقرارات الفورية',
        href: '/admin/approvals',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
        subSection: 'شؤون العاملين والتعيينات',
        status: 'Implemented',
      },
      {
        id: 'workforce/export',
        module: 'workforce',
        title: 'تصدير كشوفات العمال',
        href: '/admin/workforce/export',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
        subSection: 'شؤون العاملين والتعيينات',
        status: 'Implemented',
      },
      {
        id: 'workforce/evaluations',
        module: 'workforce',
        title: '⭐ مؤشر التزام وموثوقية العمال',
        href: '/admin/workforce/evaluations',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
        subSection: 'شؤون العاملين والتعيينات',
        status: 'Implemented',
      },
    ],
  },
  {
    title: '💰 المالية والخزينة',
    href: '/admin/finance',
    iconName: 'Wallet',
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
    features: [
      {
        id: 'finance/treasury',
        module: 'finance',
        title: 'الخزائن ومرصد السيولة والعهد',
        href: '/admin/finance/treasury',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
        status: 'Implemented',
      },
    ],
  },
  {
    title: '🚜 تشغيل المواقع والإنتاج',
    href: '/admin/operations',
    iconName: 'Tractor',
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    features: [
      {
        id: 'operations/equipment',
        module: 'operations',
        title: 'المعدات والمحروقات الميدانية',
        href: '/admin/operations/equipment',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
        status: 'Implemented',
      },
    ],
  },
  {
    title: '⛽ التعيينات والمخازن',
    href: '/admin/logistics',
    iconName: 'PackageCheck',
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    features: [
      {
        id: 'logistics/canteen',
        module: 'logistics',
        title: 'مبيعات ومسحوبات الكانتين ومهمات الوقاية',
        href: '/admin/logistics/canteen',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
        status: 'Implemented',
      },
    ],
  },
  {
    title: '🏛️ الحوكمة وإدارة المخاطر',
    href: '/admin/settings',
    iconName: 'Settings',
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
    features: [
      {
        id: 'settings/sites',
        module: 'settings',
        title: 'المواقع والمشاريع',
        href: '/admin/settings/sites',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
        status: 'Implemented',
      },
      {
        id: 'settings/jobs',
        module: 'settings',
        title: 'مصفوفة الوظائف والأجور',
        href: '/admin/settings/jobs',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
        status: 'Implemented',
      },
      {
        id: 'settings/users',
        module: 'settings',
        title: 'المستخدمين والصلاحيات والتفويضات',
        href: '/admin/settings/users',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
        status: 'Implemented',
      },
      {
        id: 'settings/company',
        module: 'settings',
        title: 'ملف المنظومة المؤسسي',
        href: '/admin/settings/company',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
        status: 'Implemented',
      },
      {
        id: 'settings/bot-features',
        module: 'settings',
        title: 'هندسة موديولات وقوائم البوت',
        href: '/admin/settings/bot-features',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
        badge: 'NEW-85',
        status: 'Implemented',
      },
      {
        id: 'settings/matrix',
        module: 'settings',
        title: 'مصفوفة الصلاحيات (RBAC)',
        href: '/admin/settings/matrix',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
        badge: 'NEW-69',
        status: 'Implemented',
      },
      {
        id: 'settings/telegram-groups',
        module: 'settings',
        title: 'إدارة تليجرام والتوبيكات والإشعارات',
        href: '/admin/settings/telegram-groups',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
        badge: 'NEW-69',
        status: 'Implemented',
      },
      {
        id: 'settings/audit-vault',

        module: 'settings',
        title: 'خزينة التدقيق الجنائي',
        href: '/admin/settings/audit-vault',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
        status: 'Implemented',
      },
      {
        id: 'settings/telemetry',
        module: 'settings',
        title: 'مرصد الأداء والـ APM',
        href: '/admin/settings/telemetry',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
        status: 'Implemented',
      },
      {
        id: 'settings/studio',
        module: 'settings',
        title: 'استوديو تصحيح البيانات',
        href: '/admin/settings/studio',
        allowedRoles: ['SUPER_ADMIN'],
        status: 'Implemented',
      },
      {
        id: 'settings/prisma-studio',
        module: 'settings',
        title: 'أدوات المطور والمعمارية والتوثيق',
        href: '/admin/settings/prisma-studio',
        allowedRoles: ['SUPER_ADMIN'],
        status: 'Implemented',
      },
      {
        id: 'settings/ghost-mode',
        module: 'settings',
        title: 'محاكي وضع الشبح',
        href: '/admin/settings/ghost-mode',
        allowedRoles: ['SUPER_ADMIN'],
        status: 'Implemented',
      },
      {
        id: 'settings/preferences',
        module: 'settings',
        title: 'تفضيلات ومظهر الداشبورد',
        href: '/admin/settings/preferences',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
        status: 'Implemented',
      },
    ],
  },
];

export function buildNavItemsFromManifest(): NavItem[] {
  return DASHBOARD_SECTIONS_MANIFEST.map((section) => {
    const navItem: NavItem = {
      title: section.title,
      href: section.href,
      iconName: section.iconName,
      allowedRoles: section.allowedRoles,
    };
    if (section.badge) navItem.badge = section.badge;
    if (section.subSections) navItem.subSections = section.subSections;
    if (section.features && section.features.length > 0) {
      navItem.children = section.features.map((feat) => {
        const child: NavChildItem = {
          title: feat.title,
          href: feat.href,
          allowedRoles: feat.allowedRoles,
        };
        if (feat.badge) child.badge = feat.badge;
        if (feat.subSection) child.subSection = feat.subSection;
        return child;
      });
    }
    return navItem;
  });
}
