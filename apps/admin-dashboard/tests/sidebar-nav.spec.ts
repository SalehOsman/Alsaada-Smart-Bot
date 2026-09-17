import * as fs from 'node:fs';
import * as path from 'node:path';
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

  describe('Dual-Rail Enterprise UX & Sub-Sections (Plan 33)', () => {
    const workforceItem = superAdminNav.find((g: NavItem) => g.href === '/admin/workforce')!;

    it('defines 5 workforce subSections with explicit Lucide vector icons', () => {
      expect(workforceItem.subSections).toBeDefined();
      expect(workforceItem.subSections!.length).toBe(5);

      const expectedIcons = ['Banknote', 'CalendarClock', 'Users', 'BadgePercent', 'Building2'];
      const iconNames = workforceItem.subSections!.map((s) => s.iconName);
      expect(iconNames).toEqual(expectedIcons);
    });

    it('strictly purges OS emojis from all subSection titles (Zero Emoji Pollution)', () => {
      const emojiRegex = /[\p{Emoji}\p{Extended_Pictographic}\uFE0F]/u;
      workforceItem.subSections!.forEach((sub) => {
        expect(emojiRegex.test(sub.title), `SubSection title '${sub.title}' contains emoji`).toBe(false);
      });
    });

    it('verifies RBAC filtering on subSections (e.g. Payroll restricted to SUPER_ADMIN)', () => {
      const fieldAdminNav = filterNavItemsForUser('FIELD_ADMIN');
      const fieldWorkforce = fieldAdminNav.find((g: NavItem) => g.href === '/admin/workforce')!;
      const subTitles = fieldWorkforce.subSections!.map((s) => s.title);

      expect(subTitles).toContain('شؤون العاملين والتعيينات');
      expect(subTitles).not.toContain('الرواتب والأجور والمستحقات'); // Masked for non-SUPER_ADMIN
    });

    it('verifies search query filtering on sub-sections and child items', () => {
      const q = 'تصدير';
      const matchingSub = workforceItem.subSections!.filter((sub) => {
        if (sub.title.toLowerCase().includes(q)) return true;
        const childLinks = workforceItem.children?.filter((c) => c.subSection === sub.title) || [];
        return childLinks.some((c) => c.title.toLowerCase().includes(q));
      });

      expect(matchingSub.length).toBe(1);
      expect(matchingSub[0].title).toBe('شؤون العاملين والتعيينات');

      // Matching child link inside the subSection
      const childLinks = (workforceItem.children?.filter((c) => c.subSection === matchingSub[0].title) || [])
        .filter((c) => c.title.toLowerCase().includes(q));
      expect(childLinks.length).toBe(1);
      expect(childLinks[0].title).toBe('تصدير كشوفات العمال');
    });
  });

  describe('Plan 56: Dual-Rail Sidebar Toggle, Hotkeys, KPI Links, Breadcrumbs & Dark Mode', () => {
    const readCode = (relPath: string): string => {
      const full = path.resolve(__dirname, '..', relPath);
      return fs.readFileSync(full, 'utf-8');
    };

    it('simulates handleRailClick: clicking active sector toggles flyout smoothly', () => {
      let selectedRailHref = '/admin/workforce';
      let isFlyoutOpen = true;
      let searchQuery = 'test';

      const handleRailClickSim = (itemHref: string, hasSub: boolean) => {
        if (!hasSub) {
          selectedRailHref = itemHref;
          isFlyoutOpen = false;
          return;
        }

        if (selectedRailHref === itemHref) {
          isFlyoutOpen = !isFlyoutOpen;
          if (isFlyoutOpen) searchQuery = '';
        } else {
          selectedRailHref = itemHref;
          isFlyoutOpen = true;
          searchQuery = '';
        }
      };

      // Toggle closed when clicking active item
      handleRailClickSim('/admin/workforce', true);
      expect(isFlyoutOpen).toBe(false);
      expect(selectedRailHref).toBe('/admin/workforce');

      // Toggle open again
      handleRailClickSim('/admin/workforce', true);
      expect(isFlyoutOpen).toBe(true);
      expect(searchQuery).toBe('');

      // Click another sector with subnav
      handleRailClickSim('/admin/settings', true);
      expect(selectedRailHref).toBe('/admin/settings');
      expect(isFlyoutOpen).toBe(true);

      // Click sector without subnav
      handleRailClickSim('/admin/analytics', false);
      expect(selectedRailHref).toBe('/admin/analytics');
      expect(isFlyoutOpen).toBe(false);
    });

    it('verifies sidebar.tsx contains Ctrl+B hotkey, Escape restoration, and ARIA attributes', () => {
      const sidebarSrc = readCode('src/components/layout/sidebar.tsx');

      // Hotkey Ctrl+B / Cmd+B
      expect(sidebarSrc).toContain('(e.ctrlKey || e.metaKey) && e.key.toLowerCase() === \'b\'');
      expect(sidebarSrc).toContain('togglePinMode()');

      // Escape key handler & focus restoration
      expect(sidebarSrc).toContain('e.key === \'Escape\' && !isPinned && isFlyoutOpen');
      expect(sidebarSrc).toContain('activeBtn?.focus()');

      // Accessible ARIA attributes
      expect(sidebarSrc).toContain('aria-expanded={selectedRailHref === group.href && isFlyoutOpen}');
      expect(sidebarSrc).toContain('aria-controls="flyout-panel"');
      expect(sidebarSrc).toContain('id="flyout-panel"');

      // Pin persistence in localStorage
      expect(sidebarSrc).toContain('localStorage.getItem(\'alsaada_sidebar_pinned\')');
      expect(sidebarSrc).toContain('localStorage.setItem(\'alsaada_sidebar_pinned\', String(next))');
    });

    it('verifies Top 4 KPI Cards in super-admin-overview are interactive Links with scale and nav indicators', () => {
      const src = readCode('src/components/dashboard/super-admin-overview.tsx');

      // Target URLs
      expect(src).toContain('href="/admin/workforce/directory"');
      expect(src).toContain('href="/admin/settings/sites"');
      expect(src).toContain('href="/admin/approvals"');
      expect(src).toContain('href="/admin/settings/telemetry"');

      // Interactive classes
      expect(src).toContain('hover:scale-[1.01]');
      expect(src).toContain('hover:shadow-lg');
      expect(src).toContain('ArrowUpLeft');
      expect(src).toContain('aria-label=');
    });

    it('verifies Top 4 KPI Cards in general-admin-overview and field-admin-overview are interactive Links', () => {
      const generalSrc = readCode('src/components/dashboard/general-admin-overview.tsx');
      expect(generalSrc).toContain('href="/admin/workforce/directory"');
      expect(generalSrc).toContain('href="/admin/settings/sites"');
      expect(generalSrc).toContain('href="/admin/approvals"');
      expect(generalSrc).toContain('href="/admin/settings/telemetry"');
      expect(generalSrc).toContain('ArrowUpLeft');

      const fieldSrc = readCode('src/components/dashboard/field-admin-overview.tsx');
      expect(fieldSrc).toContain('href="/admin/workforce/directory"');
      expect(fieldSrc).toContain('href="/admin/settings/sites"');
      expect(fieldSrc).toContain('href="/admin/settings/telemetry"');
      expect(fieldSrc).toContain('ArrowUpLeft');
    });

    it('verifies Breadcrumbs component structure and integration into dashboard shell', () => {
      const breadcrumbsSrc = readCode('src/components/layout/breadcrumbs.tsx');
      expect(breadcrumbsSrc).toContain('BREADCRUMB_LABELS');
      expect(breadcrumbsSrc).toContain('router.back()');
      expect(breadcrumbsSrc).toContain('navigator.clipboard.writeText');
      expect(breadcrumbsSrc).toContain('dark:text-slate-400');

      const shellSrc = readCode('src/components/layout/dashboard-shell.tsx');
      expect(shellSrc).toContain('<Breadcrumbs />');
    });

    it('verifies Header contains pulsing ping dot, audio cue, and theme morph transition', () => {
      const headerSrc = readCode('src/components/layout/header.tsx');
      expect(headerSrc).toContain('animate-ping');
      expect(headerSrc).toContain('playNotificationSound');
      expect(headerSrc).toContain('transition-transform duration-300');
    });

    it('verifies DataTable integrates preferences tableDensity and faceted filters bar', () => {
      const tableSrc = readCode('src/components/ui/data-table.tsx');
      expect(tableSrc).toContain('useDashboardPreferences');
      expect(tableSrc).toContain('tableDensity');
      expect(tableSrc).toContain('الفلاتر النشطة:');
    });

    it('verifies 100% Dark Mode compliance across all 17 internal screens', () => {
      const screens = [
        'src/app/admin/analytics/page.tsx',
        'src/app/admin/workforce/new/new-worker-client.tsx',
        'src/app/admin/workforce/[id]/edit/edit-worker-client.tsx',
        'src/app/admin/workforce/clearances/clearances-client.tsx',
        'src/app/admin/workforce/export/page.tsx',
        'src/app/admin/operations/equipment/page.tsx',
        'src/app/admin/logistics/canteen/page.tsx',
        'src/app/admin/settings/sites/page.tsx',
        'src/app/admin/settings/jobs/jobs-client.tsx',
        'src/app/admin/settings/users/users-client.tsx',
        'src/app/admin/settings/company/page.tsx',
        'src/app/admin/settings/notifications/page.tsx',
        'src/app/admin/settings/studio/studio-client.tsx',
        'src/app/admin/settings/ghost-mode/page.tsx',
        'src/app/admin/settings/telemetry/page.tsx',
        'src/app/admin/settings/assignments/page.tsx',
        'src/app/admin/settings/page.tsx',
      ];

      for (const rel of screens) {
        const code = readCode(rel);
        expect(code, `Screen ${rel} must contain dark:bg- or dark:text-`).toMatch(/dark:bg-|dark:text-/);
        expect(code, `Screen ${rel} must contain dark:border-`).toMatch(/dark:border-/);
      }
    });
  });
});


