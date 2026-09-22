export interface AdminNavItem {
  id: string;
  labelArabic: string;
  path: string;
  icon: string;
  requiredRole: string;
  order: number;
}

export const adminNavigationItems: AdminNavItem[] = [
  {
    id: 'sample-domain-overview',
    labelArabic: 'نطاق العينة',
    path: '/modules/sample-domain',
    icon: 'Beaker',
    requiredRole: 'SUPER_ADMIN',
    order: 99,
  },
];
