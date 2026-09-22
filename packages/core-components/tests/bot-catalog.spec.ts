import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  BotFeatureRegistryService,
  FeatureGateGuard,
  BotNodeType,
  BotNodeStatus,
  DisabledBehavior,
  type BotMenuNodeDTO,
} from '../src/index.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Bot Feature Registry & Feature Gate Guard (Plan-71)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const sampleNodes: BotMenuNodeDTO[] = [
    {
      id: 'm1',
      code: 'mod:hr',
      parentId: null,
      type: BotNodeType.MODULE,
      title: 'الموارد البشرية',
      icon: '👥',
      callbackData: 'mod:hr',
      status: BotNodeStatus.ACTIVE,
      disabledBehavior: DisabledBehavior.LOCK_WITH_ALERT,
      maintenanceMessage: null,
      sortOrder: 1,
      isProtected: false,
      allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
    },
    {
      id: 's1',
      code: 'sec:workforce',
      parentId: 'm1',
      type: BotNodeType.SECTION,
      title: 'شؤون العاملين',
      icon: '👷‍♂️',
      callbackData: 'sec:workforce',
      status: BotNodeStatus.ACTIVE,
      disabledBehavior: DisabledBehavior.LOCK_WITH_ALERT,
      maintenanceMessage: null,
      sortOrder: 1,
      isProtected: false,
      allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
    },
    {
      id: 'f1',
      code: 'flow:01.1',
      parentId: 's1',
      type: BotNodeType.FLOW,
      title: 'تسجيل عامل جديد',
      icon: '⚡',
      callbackData: 'flow:01.1:start',
      status: BotNodeStatus.ACTIVE,
      disabledBehavior: DisabledBehavior.LOCK_WITH_ALERT,
      maintenanceMessage: null,
      sortOrder: 1,
      isProtected: false,
      allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
    },
    {
      id: 'f2',
      code: 'flow:01.2',
      parentId: 's1',
      type: BotNodeType.FLOW,
      title: 'سلفة عامل',
      icon: '💵',
      callbackData: 'flow:01.2:start',
      status: BotNodeStatus.DISABLED,
      disabledBehavior: DisabledBehavior.HIDE,
      maintenanceMessage: 'موقوف للتحديث',
      sortOrder: 2,
      isProtected: false,
      allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
    },
    {
      id: 'f3',
      code: 'flow:01.3',
      parentId: 's1',
      type: BotNodeType.FLOW,
      title: 'مهمات الوقاية',
      icon: '🦺',
      callbackData: 'flow:01.3:start',
      status: BotNodeStatus.MAINTENANCE,
      disabledBehavior: DisabledBehavior.LOCK_WITH_ALERT,
      maintenanceMessage: 'صيانة طارئة',
      sortOrder: 3,
      isProtected: false,
      allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
    },
    {
      id: 'f_sov',
      code: 'flow:00.1',
      parentId: null,
      type: BotNodeType.FLOW,
      title: 'فتح لوحة التحكم',
      icon: '🖥️',
      callbackData: 'flow:00.1:start',
      status: BotNodeStatus.DISABLED, // Even if marked disabled, protection overrides
      disabledBehavior: DisabledBehavior.HIDE,
      maintenanceMessage: 'لن يتم تعطيله أبداً',
      sortOrder: 99,
      isProtected: true, // Sovereign anchor!
      allowedRoles: ['SUPER_ADMIN'],
    },
  ];

  describe('BotFeatureRegistryService.buildMenuTree', () => {
    it('1. builds hierarchical tree preserving sort order', () => {
      // Arrange
      const nodes = [...sampleNodes];

      // Act
      const tree = BotFeatureRegistryService.buildMenuTree(nodes);

      // Assert
      expect(tree.length).toBe(2); // m1 and f_sov
      const mod = tree.find((n) => n.id === 'm1');
      expect(mod?.code).toBe('mod:hr');
      expect(mod?.children?.length).toBe(1); // s1
      expect(mod?.children?.[0]?.children?.length).toBe(3); // f1, f2, f3
      expect(mod?.children?.[0]?.children?.[0]?.code).toBe('flow:01.1');
    });

    it('2. formats button titles properly with lock indicators', () => {
      // Arrange
      const activeNode = sampleNodes.find((n) => n.id === 'f1')!;
      const lockedNode = sampleNodes.find((n) => n.id === 'f3')!;
      const sovereignNode = sampleNodes.find((n) => n.id === 'f_sov')!;

      // Act
      const activeTitle = BotFeatureRegistryService.formatButtonTitle(activeNode);
      const lockedTitle = BotFeatureRegistryService.formatButtonTitle(lockedNode);
      const sovereignTitle = BotFeatureRegistryService.formatButtonTitle(sovereignNode);

      // Assert
      expect(activeTitle).toBe('⚡ تسجيل عامل جديد');
      expect(lockedTitle).toBe('🔒 🦺 مهمات الوقاية');
      expect(sovereignTitle).toBe('🖥️ فتح لوحة التحكم');
    });

    it('3. filters nodes according to visibility and role', () => {
      // Arrange
      const nodes = [...sampleNodes];

      // Act
      const fieldWorkerVisible = BotFeatureRegistryService.filterNodesForUser(nodes, 'FIELD_ADMIN');
      const superAdminVisible = BotFeatureRegistryService.filterNodesForUser(nodes, 'SUPER_ADMIN');

      // Assert
      // f1 is restricted to SUPER_ADMIN / GENERAL_ADMIN, so should not appear
      expect(fieldWorkerVisible.find((n) => n.id === 'f1')).toBeUndefined();

      // f2 is HIDE, so should not appear in bot menu
      expect(superAdminVisible.find((n) => n.id === 'f2')).toBeUndefined();
      // f3 is LOCK_WITH_ALERT, so should appear
      expect(superAdminVisible.find((n) => n.id === 'f3')?.code).toBe('flow:01.3');
    });

    it('4. resolves callback data across domains, sections, and flow actions', () => {
      // Arrange
      const nodes = [...sampleNodes];

      // Act & Assert
      // Act 1: Direct callback match
      const directMatch = BotFeatureRegistryService.findNodeByCallback('flow:01.1:start', nodes);
      // Act 2: Domain module callback mapping
      const domainMatch = BotFeatureRegistryService.findNodeByCallback('menu:domain:hr', nodes);
      // Act 3: Section callback mapping
      const sectionMatch = BotFeatureRegistryService.findNodeByCallback('node:sec:workforce', nodes);
      // Act 4: Flow sub-action prefix matching
      const prefixMatch = BotFeatureRegistryService.findNodeByCallback('flow:01.1:step_2', nodes);
      // Act 5: Non-matching callback returns null
      const nonMatch = BotFeatureRegistryService.findNodeByCallback('unknown:callback', nodes);

      // Assert
      expect(directMatch?.id).toBe('f1');
      expect(domainMatch?.id).toBe('m1');
      expect(sectionMatch?.id).toBe('s1');
      expect(prefixMatch?.id).toBe('f1');
      expect(nonMatch).toBeNull();
    });
  });

  describe('FeatureGateGuard', () => {
    it('5. allows access to active features for authorized role', () => {
      // Arrange
      const f1 = sampleNodes.find((n) => n.id === 'f1')!;

      // Act
      const check = FeatureGateGuard.checkFeatureAccess(f1, 'GENERAL_ADMIN');

      // Assert
      expect(check.allowed).toBe(true);
      expect(check.status).toBe(BotNodeStatus.ACTIVE);
    });

    it('6. blocks access if role is unauthorized', () => {
      // Arrange
      const f1 = sampleNodes.find((n) => n.id === 'f1')!;

      // Act
      const check = FeatureGateGuard.checkFeatureAccess(f1, 'VISITOR');

      // Assert
      expect(check.allowed).toBe(false);
      expect(check.reason).toBe('ROLE_UNAUTHORIZED');
    });

    it('7. blocks disabled features and returns maintenance message', () => {
      // Arrange
      const f3 = sampleNodes.find((n) => n.id === 'f3')!;

      // Act
      const check = FeatureGateGuard.checkFeatureAccess(f3, 'GENERAL_ADMIN');

      // Assert
      expect(check.allowed).toBe(false);
      expect(check.status).toBe(BotNodeStatus.MAINTENANCE);
      expect(check.maintenanceMessage).toBe('صيانة طارئة');
      expect(check.behavior).toBe(DisabledBehavior.LOCK_WITH_ALERT);
    });

    it('8. SOVEREIGN IMMUNITY: always allows protected nodes even if disabled', () => {
      // Arrange
      const sov = sampleNodes.find((n) => n.id === 'f_sov')!;

      // Act
      const check = FeatureGateGuard.checkFeatureAccess(sov, 'VISITOR');

      // Assert
      expect(check.allowed).toBe(true);
      expect(check.isProtected).toBe(true);
    });

    it('9. throws error for disabled features via assertFeatureActive', () => {
      // Arrange
      const f3 = sampleNodes.find((n) => n.id === 'f3')!;

      // Act
      const throwFn = () => FeatureGateGuard.assertFeatureActive(f3, 'GENERAL_ADMIN');

      // Assert
      expect(throwFn).toThrow('صيانة طارئة');
    });
  });
});
