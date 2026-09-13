import type { CanonicalRole } from '@alsaada/rbac';

export type UserRole = CanonicalRole;

export interface DashboardUser {
  id: string;
  telegramId?: string | null;
  name: string;
  role: UserRole;
  assignedSiteId?: string | null;
  assignedSiteName?: string | null;
  isRealSuperAdmin?: boolean;
}

export interface NavItem {
  title: string;
  href: string;
  iconName: string;
  allowedRoles: UserRole[];
  badge?: string;
  children?: Array<{
    title: string;
    href: string;
    allowedRoles: UserRole[];
  }>;
}

export const DASHBOARD_NAV_ITEMS: NavItem[] = [
  {
    title: 'نظرة عامة والمؤشرات',
    href: '/admin',
    iconName: 'LayoutDashboard',
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },
  {
    title: '📊 مركز الإحصائيات والتحليلات',
    href: '/admin/analytics',
    iconName: 'BarChart3',
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },
  {
    title: '👥 الموارد البشرية والعمالة',
    href: '/admin/workforce',
    iconName: 'Users',
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    children: [
      {
        title: 'دليل العاملين',
        href: '/admin/workforce/directory',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
      },
      {
        title: 'تعيين عامل جديد',
        href: '/admin/workforce/new',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
      },
      {
        title: 'مخالصات إنهاء الخدمة',
        href: '/admin/workforce/clearances',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
      },
      {
        title: 'مركز الاعتمادات والقرارات الفورية',
        href: '/admin/approvals',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
      },
      {
        title: 'تصدير كشوفات العمال',
        href: '/admin/workforce/export',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
      },
    ],
  },
  {
    title: '🏛️ الحوكمة وإدارة المخاطر',
    href: '/admin/settings',
    iconName: 'Settings',
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
    children: [
      {
        title: 'المواقع والمشاريع',
        href: '/admin/settings/sites',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
      },
      {
        title: 'مصفوفة الوظائف والأجور',
        href: '/admin/settings/jobs',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
      },
      {
        title: 'المستخدمين والصلاحيات والتفويضات',
        href: '/admin/settings/users',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
      },
      {
        title: 'ملف المنظومة المؤسسي',
        href: '/admin/settings/company',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
      },
      {
        title: 'خزينة التدقيق الجنائي',
        href: '/admin/settings/audit-vault',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
      },
      {
        title: 'مرصد الأداء والـ APM',
        href: '/admin/settings/telemetry',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
      },
      {
        title: 'استوديو تصحيح البيانات',
        href: '/admin/settings/studio',
        allowedRoles: ['SUPER_ADMIN'],
      },
      {
        title: 'محاكي وضع الشبح',
        href: '/admin/settings/ghost-mode',
        allowedRoles: ['SUPER_ADMIN'],
      },
      {
        title: 'سياسات الإشعارات والتوبيكات',
        href: '/admin/settings/notifications',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
      },
    ],
  },
  {
    title: '💰 المالية والخزينة',
    href: '/admin/finance',
    iconName: 'Wallet',
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
    children: [
      {
        title: 'الخزائن ومرصد السيولة والعهد',
        href: '/admin/finance/treasury',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
      },
    ],
  },
  {
    title: '🚜 تشغيل المواقع والإنتاج',
    href: '/admin/operations',
    iconName: 'Tractor',
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    children: [
      {
        title: 'المعدات والمحروقات الميدانية',
        href: '/admin/operations/equipment',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
      },
    ],
  },
  {
    title: '⛽ التعيينات والمخازن والكانتين',
    href: '/admin/logistics',
    iconName: 'PackageCheck',
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    children: [
      {
        title: 'مبيعات ومسحوبات الكانتين ومهمات الوقاية',
        href: '/admin/logistics/canteen',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
      },
    ],
  },
];

export function hasAccess(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  if (userRole === 'SUPER_ADMIN') return true;
  return allowedRoles.includes(userRole);
}

export function filterNavItemsForUser(userRole: UserRole): NavItem[] {
  return DASHBOARD_NAV_ITEMS.filter((item) => hasAccess(userRole, item.allowedRoles))
    .map((item) => {
      if (!item.children) return item;
      return {
        ...item,
        children: item.children.filter((child) => hasAccess(userRole, child.allowedRoles)),
      };
    });
}
