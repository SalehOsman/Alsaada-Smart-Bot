import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DASHBOARD_SECTIONS_MANIFEST } from '../src/dashboard.manifest';

describe('Plan 73: Bot Features Hierarchical Tree UX, Drag & Drop, and Unified Telegram Hub', () => {
  const readSource = (relativePath: string): string => {
    const fullPath = path.resolve(__dirname, '..', relativePath);
    return fs.readFileSync(fullPath, 'utf-8');
  };

  describe('Requirement 1: Sidebar Manifest Hygiene & Deduplication', () => {
    const settingsSection = DASHBOARD_SECTIONS_MANIFEST.find((s) => s.href === '/admin/settings');

    it('contains exactly ONE entry for settings/bot-features without duplicates', () => {
      expect(settingsSection).toBeDefined();
      const botFeaturesEntries = settingsSection!.features.filter((f) => f.id === 'settings/bot-features');
      expect(botFeaturesEntries.length).toBe(1);
      expect(botFeaturesEntries[0]?.href).toBe('/admin/settings/bot-features');
    });

    it('unifies telegram groups and notifications into a single consolidated sidebar entry', () => {
      expect(settingsSection).toBeDefined();
      const telegramEntry = settingsSection!.features.find((f) => f.id === 'settings/telegram-groups');
      expect(telegramEntry).toBeDefined();
      expect(telegramEntry!.title).toBe('إدارة تليجرام والتوبيكات والإشعارات');
      expect(telegramEntry!.href).toBe('/admin/settings/telegram-groups');
      expect(telegramEntry!.badge).toBe('NEW-69');

      // Standalone notifications item must NOT exist in the manifest
      const notificationsEntry = settingsSection!.features.find((f) => f.id === 'settings/notifications');
      expect(notificationsEntry).toBeUndefined();
    });
  });

  describe('Requirement 2: Unified Telegram Hub & Tab Switching', () => {
    const groupsClientSrc = readSource('src/app/admin/settings/telegram-groups/groups-client.tsx');
    const groupsPageSrc = readSource('src/app/admin/settings/telegram-groups/page.tsx');
    const notificationsPageSrc = readSource('src/app/admin/settings/notifications/page.tsx');

    it('telegram-groups page wraps client in Suspense and parses tab parameter', () => {
      expect(groupsPageSrc).toContain('Suspense');
      expect(groupsPageSrc).toContain('searchParams');
      expect(groupsPageSrc).toContain('initialTab');
      expect(groupsPageSrc).toContain('getNotificationTopicsData');
    });

    it('groups-client supports dual tabs with URL query sync and popstate listener', () => {
      expect(groupsClientSrc).toContain('المجموعات والتوبيكات');
      expect(groupsClientSrc).toContain('سياسات توجيه الإشعارات');
      expect(groupsClientSrc).toContain('url.searchParams.set(\'tab\', tab)');
      expect(groupsClientSrc).toContain('popstate');
      expect(groupsClientSrc).toContain('filteredTopics');
    });

    it('notifications/page.tsx displays migration banner linking to unified tab', () => {
      expect(notificationsPageSrc).toContain('/admin/settings/telegram-groups?tab=notifications');
      expect(notificationsPageSrc).toContain('الانتقال للجناح الموحد');
    });
  });

  describe('Requirement 3 & 4: Bot Node Card & Direct Shift / Drag Controls', () => {
    const cardSrc = readSource('src/app/admin/settings/bot-features/components/bot-node-card.tsx');

    it('renders standard GripVertical handle with draggable={!isProtected}', () => {
      expect(cardSrc).toContain('GripVertical');
      expect(cardSrc).toContain('draggable={!isProtected}');
    });

    it('safeguards sovereign protected nodes from shift arrows', () => {
      expect(cardSrc).toContain('disabled={!canMoveUp || isProtected}');
      expect(cardSrc).toContain('disabled={!canMoveDown || isProtected}');
      expect(cardSrc).toContain('عنصر سيادي محصن غير قابل للتحريك');
    });

    it('renders HTML5 drop target border indicator', () => {
      expect(cardSrc).toContain('!border-t-amber-400');
      expect(cardSrc).toContain('bg-amber-500/10');
    });

    it('renders visual branch markers for nested tree levels', () => {
      expect(cardSrc).toContain('├─');
      expect(cardSrc).toContain('│ ├─');
      expect(cardSrc).toContain('│ │ └─');
    });
  });

  describe('Requirement 5: Bot Features Page Tree, Search, Reorder & Rollback', () => {
    const pageSrc = readSource('src/app/admin/settings/bot-features/page.tsx');

    it('initializes fully collapsed by default (new Set())', () => {
      expect(pageSrc).toContain('const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());');
    });

    it('provides Expand All and Collapse All global actions', () => {
      expect(pageSrc).toContain('handleExpandAll');
      expect(pageSrc).toContain('handleCollapseAll');
      expect(pageSrc).toContain('توسيع الكل');
      expect(pageSrc).toContain('طي الكل');
    });

    it('implements smart search auto-expansion with both ancestor and descendant resolution', () => {
      expect(pageSrc).toContain('searchAncestorIds');
      expect(pageSrc).toContain('searchDescendantIds');
      expect(pageSrc).toContain('effectiveExpandedParents');
    });

    it('strictly enforces sibling constraints and protected element immunity on reorder', () => {
      expect(pageSrc).toContain('targetNode.isProtected');
      expect(pageSrc).toContain('siblingToSwap?.isProtected');
      expect(pageSrc).toContain('draggedNode.isProtected || targetNode.isProtected');
    });

    it('implements optimistic UI with automatic rollback on network failure', () => {
      expect(pageSrc).toContain('const previousNodes = [...nodes];');
      expect(pageSrc).toContain('setNodes(previousNodes);');
      expect(pageSrc).toContain('تمت استعادة الترتيب السابق تلقائياً');
    });

    it('prevents HTML5 dragleave indicator flickering', () => {
      expect(pageSrc).toContain('e.currentTarget.contains(e.relatedTarget as Node)');
    });
  });
});
