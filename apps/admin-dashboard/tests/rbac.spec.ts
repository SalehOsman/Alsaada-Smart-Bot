import { describe, it, expect } from 'vitest';
import { hasAccess, filterNavItemsForUser, DASHBOARD_NAV_ITEMS, type NavItem } from '../src/lib/rbac.js';

describe('Admin Dashboard RBAC Engine', () => {
  it('SUPER_ADMIN has sovereign access to all features and pages', () => {
    expect(hasAccess('SUPER_ADMIN', ['SUPER_ADMIN'])).toBe(true);
    expect(hasAccess('SUPER_ADMIN', ['GENERAL_ADMIN'])).toBe(true);
    expect(hasAccess('SUPER_ADMIN', ['FIELD_ADMIN'])).toBe(true);
  });

  it('GENERAL_ADMIN can access authorized admin sections', () => {
    expect(hasAccess('GENERAL_ADMIN', ['SUPER_ADMIN', 'GENERAL_ADMIN'])).toBe(true);
    expect(hasAccess('GENERAL_ADMIN', ['SUPER_ADMIN'])).toBe(false);
  });

  it('FIELD_ADMIN has site-scoped workforce access and is masked from unpermitted settings', () => {
    expect(hasAccess('FIELD_ADMIN', ['SUPER_ADMIN', 'FIELD_ADMIN'])).toBe(true);
    expect(hasAccess('FIELD_ADMIN', ['SUPER_ADMIN', 'GENERAL_ADMIN'])).toBe(false);
    expect(hasAccess('FIELD_ADMIN', ['SUPER_ADMIN'])).toBe(false);
  });

  it('GUEST, WORKER, WORKER_SUPERVISOR, SUPPLIER have zero access to admin dashboard', () => {
    expect(hasAccess('GUEST', ['SUPER_ADMIN'])).toBe(false);
    expect(hasAccess('WORKER', ['SUPER_ADMIN', 'FIELD_ADMIN'])).toBe(false);
    expect(hasAccess('WORKER_SUPERVISOR', ['SUPER_ADMIN', 'FIELD_ADMIN'])).toBe(false);
    expect(hasAccess('SUPPLIER', ['SUPER_ADMIN', 'GENERAL_ADMIN'])).toBe(false);
  });

  it('filterNavItemsForUser filters menu items strictly by role', () => {
    const superAdminNav = filterNavItemsForUser('SUPER_ADMIN');
    expect(superAdminNav.length).toBe(DASHBOARD_NAV_ITEMS.length);

    const fieldAdminNav = filterNavItemsForUser('FIELD_ADMIN');
    const titles = fieldAdminNav.map((i: NavItem) => i.title);
    expect(titles).toContain('👥 الموارد البشرية والعمالة');
    expect(titles).not.toContain('🏛️ الحوكمة وإدارة المخاطر');
  });
});
