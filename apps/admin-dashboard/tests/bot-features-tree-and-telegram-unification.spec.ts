import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PINNED_BASE_TIME } from '@alsaada/shared/testing';
import { DASHBOARD_SECTIONS_MANIFEST } from '../src/dashboard.manifest';

describe('Plan 73: Bot Features Hierarchical Tree UX, Drag & Drop, and Unified Telegram Hub', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const readSource = (relativePath: string): string => {
    const fullPath = path.resolve(__dirname, '..', relativePath);
    return fs.readFileSync(fullPath, 'utf-8');
  };

  describe('Requirement 1: Sidebar Manifest Hygiene & Deduplication', () => {
    const settingsSection = DASHBOARD_SECTIONS_MANIFEST.find((s) => s.href === '/admin/settings');

    it('contains exactly ONE entry for settings/bot-features without duplicates and resolves correct href', () => {
      // Arrange
      expect(settingsSection).toBeDefined();

      // Act
      const botFeaturesEntries = settingsSection!.features.filter((f) => f.id === 'settings/bot-features');

      // Assert
      expect(botFeaturesEntries.length).toBe(1);
      expect(botFeaturesEntries.length).not.toBeGreaterThan(1);
      expect(botFeaturesEntries[0]?.href).toBe('/admin/settings/bot-features');
      expect(botFeaturesEntries[0]?.href).not.toBe('/admin/settings');
    });

    it('unifies telegram groups and notifications into a single consolidated sidebar entry and evicts legacy entry', () => {
      // Arrange
      expect(settingsSection).toBeDefined();

      // Act
      const telegramEntry = settingsSection!.features.find((f) => f.id === 'settings/telegram-groups');
      const notificationsEntry = settingsSection!.features.find((f) => f.id === 'settings/notifications');

      // Assert
      expect(telegramEntry).toBeDefined();
      expect(telegramEntry!.title).toBe('إدارة تليجرام والتوبيكات والإشعارات');
      expect(telegramEntry!.href).toBe('/admin/settings/telegram-groups');
      expect(telegramEntry!.badge).toBe('NEW-69');
      expect(telegramEntry!.id).not.toBe('settings/notifications');

      // Standalone notifications item must NOT exist in the manifest
      expect(notificationsEntry).toBeUndefined();
      expect(notificationsEntry).not.toBeDefined();
    });
  });

  describe('Requirement 2: Unified Telegram Hub & Tab Switching', () => {
    it('wraps client component in Suspense boundary and parses initial tab parameter', () => {
      // Arrange
      const targetPath = 'src/app/admin/settings/telegram-groups/page.tsx';

      // Act
      const src = readSource(targetPath);

      // Assert
      expect(src).toContain('Suspense');
      expect(src).toContain('searchParams');
      expect(src).toContain('initialTab');
      expect(src).toContain('getNotificationTopicsData');
      expect(src).not.toContain('dangerouslySetInnerHTML');
    });

    it('supports dual tabs with URL query synchronizer and handles browser popstate navigation', () => {
      // Arrange
      const targetPath = 'src/app/admin/settings/telegram-groups/groups-client.tsx';

      // Act
      const src = readSource(targetPath);

      // Assert
      expect(src).toContain('المجموعات والتوبيكات');
      expect(src).toContain('سياسات توجيه الإشعارات');
      expect(src).toContain("url.searchParams.set('tab', tab)");
      expect(src).toContain('popstate');
      expect(src).toContain('filteredTopics');
      expect(src).not.toContain('sessionStorage.clear()');
    });

    it('renders a migration banner linking to unified tab from notifications legacy page', () => {
      // Arrange
      const targetPath = 'src/app/admin/settings/notifications/page.tsx';

      // Act
      const src = readSource(targetPath);

      // Assert
      expect(src).toContain('/admin/settings/telegram-groups?tab=notifications');
      expect(src).toContain('الانتقال للجناح الموحد');
      expect(src).not.toContain('window.location.reload()');
    });
  });

  describe('Requirement 3 & 4: Bot Node Card & Direct Shift / Drag Controls', () => {
    const cardRelPath = 'src/app/admin/settings/bot-features/components/bot-node-card.tsx';

    it('renders standard GripVertical drag handle while disabling drag for sovereign protected nodes', () => {
      // Arrange
      const targetPath = cardRelPath;

      // Act
      const src = readSource(targetPath);

      // Assert
      expect(src).toContain('GripVertical');
      expect(src).toContain('draggable={!isProtected}');
      expect(src).not.toContain('draggable={true}');
    });

    it('safeguards sovereign protected nodes by disabling shift arrows and rendering protection tooltip', () => {
      // Arrange
      const targetPath = cardRelPath;

      // Act
      const src = readSource(targetPath);

      // Assert
      expect(src).toContain('disabled={!canMoveUp || isProtected}');
      expect(src).toContain('disabled={!canMoveDown || isProtected}');
      expect(src).toContain('عنصر سيادي محصن غير قابل للتحريك');
      expect(src).not.toContain('disabled={false}');
    });

    it('renders HTML5 drop target border indicator and amber highlight styles', () => {
      // Arrange
      const targetPath = cardRelPath;

      // Act
      const src = readSource(targetPath);

      // Assert
      expect(src).toContain('!border-t-amber-400');
      expect(src).toContain('bg-amber-500/10');
      expect(src).not.toContain('border-red-500');
    });

    it('renders visual branch markers for nested tree levels with correct indentation', () => {
      // Arrange
      const targetPath = cardRelPath;

      // Act
      const src = readSource(targetPath);

      // Assert
      expect(src).toContain('├─');
      expect(src).toContain('│ ├─');
      expect(src).toContain('│ │ └─');
      expect(src).not.toContain('───▶');
    });
  });

  describe('Requirement 5: Bot Features Page Tree, Search, Reorder & Rollback', () => {
    const pageRelPath = 'src/app/admin/settings/bot-features/page.tsx';

    it('initializes tree state as fully collapsed by default using an empty Set', () => {
      // Arrange
      const targetPath = pageRelPath;

      // Act
      const src = readSource(targetPath);

      // Assert
      expect(src).toContain('const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());');
      expect(src).not.toContain('expandedParents = new Set(allParentIds)');
    });

    it('provides Expand All and Collapse All global actions with Arabic localized labels', () => {
      // Arrange
      const targetPath = pageRelPath;

      // Act
      const src = readSource(targetPath);

      // Assert
      expect(src).toContain('handleExpandAll');
      expect(src).toContain('handleCollapseAll');
      expect(src).toContain('توسيع الكل');
      expect(src).toContain('طي الكل');
      expect(src).not.toContain('alert(');
    });

    it('implements smart search auto-expansion with ancestor and descendant resolution', () => {
      // Arrange
      const targetPath = pageRelPath;

      // Act
      const src = readSource(targetPath);

      // Assert
      expect(src).toContain('searchAncestorIds');
      expect(src).toContain('searchDescendantIds');
      expect(src).toContain('effectiveExpandedParents');
      expect(src).not.toContain('eval(');
    });

    it('strictly enforces sibling constraints and protected element immunity on reorder operations', () => {
      // Arrange
      const targetPath = pageRelPath;

      // Act
      const src = readSource(targetPath);

      // Assert
      expect(src).toContain('targetNode.isProtected');
      expect(src).toContain('siblingToSwap?.isProtected');
      expect(src).toContain('draggedNode.isProtected || targetNode.isProtected');
      expect(src).not.toContain('allowProtectedReorder');
    });

    it('implements optimistic UI with automatic rollback and user notification on failure', () => {
      // Arrange
      const targetPath = pageRelPath;

      // Act
      const src = readSource(targetPath);

      // Assert
      expect(src).toContain('const previousNodes = [...nodes];');
      expect(src).toContain('setNodes(previousNodes);');
      expect(src).toContain('تمت استعادة الترتيب السابق تلقائياً');
      expect(src).not.toContain('location.reload()');
    });

    it('prevents HTML5 dragleave indicator flickering by checking relatedTarget containment', () => {
      // Arrange
      const targetPath = pageRelPath;

      // Act
      const src = readSource(targetPath);

      // Assert
      expect(src).toContain('e.currentTarget.contains(e.relatedTarget as Node)');
      expect(src).not.toContain('e.stopPropagation()');
    });
  });
});
