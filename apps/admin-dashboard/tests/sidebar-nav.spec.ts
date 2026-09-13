import { describe, it, expect, vi } from 'vitest';
import { DASHBOARD_NAV_ITEMS, filterNavItemsForUser, type NavItem, type UserRole } from '../src/lib/rbac.js';

describe('Sidebar Navigation & Accordion Engine (Milestone 2)', () => {
  const superAdminNav = filterNavItemsForUser('SUPER_ADMIN');

  // Logic helper mirroring sidebar.tsx
  const isChildActive = (group: NavItem, pathname: string): boolean =>
    Boolean(
      group.children?.some(
        (sub: { title: string; href: string; allowedRoles: UserRole[]; }) =>
          pathname === sub.href ||
          (sub.href !== '/admin' && pathname.startsWith(sub.href + '/'))
      )
    );

  const isGroupActive = (group: NavItem, pathname: string): boolean => {
    const hasActiveChild = isChildActive(group, pathname);
    return group.href === '/admin'
      ? pathname === '/admin'
      : pathname === group.href || hasActiveChild;
  };

  it('fixes root /admin matching bug: /admin is active ONLY on exact match', () => {
    const overviewGroup = superAdminNav.find((g: NavItem) => g.href === '/admin')!;
    expect(overviewGroup).toBeDefined();

    // Exact match
    expect(isGroupActive(overviewGroup, '/admin')).toBe(true);

    // Sub-paths in other groups must NOT activate /admin
    expect(isGroupActive(overviewGroup, '/admin/workforce')).toBe(false);
    expect(isGroupActive(overviewGroup, '/admin/workforce/directory')).toBe(false);
    expect(isGroupActive(overviewGroup, '/admin/settings')).toBe(false);
    expect(isGroupActive(overviewGroup, '/admin/settings/users')).toBe(false);
  });

  it('correctly activates parent section when a child route is active', () => {
    const workforceGroup = superAdminNav.find((g: NavItem) => g.href === '/admin/workforce')!;
    const settingsGroup = superAdminNav.find((g: NavItem) => g.href === '/admin/settings')!;

    // On workforce/directory
    expect(isGroupActive(workforceGroup, '/admin/workforce/directory')).toBe(true);
    expect(isChildActive(workforceGroup, '/admin/workforce/directory')).toBe(true);
    expect(isGroupActive(settingsGroup, '/admin/workforce/directory')).toBe(false);
    expect(isChildActive(settingsGroup, '/admin/workforce/directory')).toBe(false);

    // On settings/audit-vault
    expect(isGroupActive(settingsGroup, '/admin/settings/audit-vault')).toBe(true);
    expect(isChildActive(settingsGroup, '/admin/settings/audit-vault')).toBe(true);
    expect(isGroupActive(workforceGroup, '/admin/settings/audit-vault')).toBe(false);
  });

  it('activates parent section on hub landing pages (/admin/workforce and /admin/settings)', () => {
    const workforceGroup = superAdminNav.find((g: NavItem) => g.href === '/admin/workforce')!;
    const settingsGroup = superAdminNav.find((g: NavItem) => g.href === '/admin/settings')!;

    expect(isGroupActive(workforceGroup, '/admin/workforce')).toBe(true);
    expect(isGroupActive(settingsGroup, '/admin/settings')).toBe(true);
  });

  it('supports deep nested paths under child items', () => {
    const workforceGroup = superAdminNav.find((g: NavItem) => g.href === '/admin/workforce')!;
    expect(isChildActive(workforceGroup, '/admin/workforce/directory/worker-999')).toBe(true);
    expect(isGroupActive(workforceGroup, '/admin/workforce/directory/worker-999')).toBe(true);
  });

  it('verifies accordion expansion logic for multi-role navigation trees', () => {
    const fieldAdminNav = filterNavItemsForUser('FIELD_ADMIN');
    const workforceField = fieldAdminNav.find((g: NavItem) => g.href === '/admin/workforce')!;

    expect(workforceField).toBeDefined();
    expect(isGroupActive(workforceField, '/admin/workforce/directory')).toBe(true);

    // Field admin does not have export route
    const exportChild = workforceField.children?.find((c: { title: string; href: string; allowedRoles: UserRole[]; }) => c.href === '/admin/workforce/export');
    expect(exportChild).toBeUndefined();
  });
});
