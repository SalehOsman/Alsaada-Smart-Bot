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

export interface NavChildItem {
  title: string;
  href: string;
  allowedRoles: UserRole[];
  badge?: string;
  subSection?: string;
}

export interface NavSubSection {
  title: string;
  allowedRoles: UserRole[];
  badge?: string;
  iconName?: string;
}

export interface NavItem {
  title: string;
  href: string;
  iconName: string;
  allowedRoles: UserRole[];
  badge?: string;
  subSections?: NavSubSection[];
  children?: NavChildItem[];
}

import { buildNavItemsFromManifest } from '../dashboard.manifest';

export const DASHBOARD_NAV_ITEMS: NavItem[] = buildNavItemsFromManifest();

export function hasAccess(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  if (userRole === 'SUPER_ADMIN') return true;
  return allowedRoles.includes(userRole);
}

export function filterNavItemsForUser(userRole: UserRole): NavItem[] {
  return DASHBOARD_NAV_ITEMS.filter((item) => hasAccess(userRole, item.allowedRoles))
    .map((item) => {
      const filtered: NavItem = { ...item };
      if (item.subSections) {
        filtered.subSections = item.subSections.filter((sub) => hasAccess(userRole, sub.allowedRoles));
      }
      if (item.children) {
        filtered.children = item.children.filter((child) => hasAccess(userRole, child.allowedRoles));
      }
      return filtered;
    });
}
