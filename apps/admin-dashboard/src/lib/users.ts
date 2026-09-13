import type { DashboardUser } from './rbac';

export const DEMO_USERS: Record<string, DashboardUser> = {
  superadmin: {
    id: 'user_superadmin_01',
    telegramId: '12345678',
    name: 'المدير العام (سوبر أدمن)',
    role: 'SUPER_ADMIN',
    assignedSiteId: null,
    assignedSiteName: 'كافة المواقع والمشاريع',
    isRealSuperAdmin: true,
  },
  generaladmin: {
    id: 'user_generaladmin_01',
    telegramId: '12345679',
    name: 'أ. حسام الدين (جينرال أدمن)',
    role: 'GENERAL_ADMIN',
    assignedSiteId: null,
    assignedSiteName: 'كافة المواقع والمشاريع',
  },
  fieldadmin: {
    id: 'user_fa_01',
    telegramId: '56789012',
    name: 'عصام عبد الله (مشرف موقع)',
    role: 'FIELD_ADMIN',
    assignedSiteId: 'site_cairo_01',
    assignedSiteName: 'مشروع العاصمة الإدارية',
  },
};
