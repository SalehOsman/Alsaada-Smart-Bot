import { describe, expect, it } from 'vitest';
import {
  BotFeatureRegistryService,
  FeatureGateGuard,
  BotNodeType,
  BotNodeStatus,
  DisabledBehavior,
  type BotMenuNodeDTO,
} from '../src/index.js';

describe('Bot Feature Registry & Feature Gate Guard (Plan-71)', () => {
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
    it('should build hierarchical tree preserving sort order', () => {
      const tree = BotFeatureRegistryService.buildMenuTree(sampleNodes);

      expect(tree.length).toBe(2); // m1 and f_sov
      const mod = tree.find((n) => n.id === 'm1');
      expect(mod).toBeDefined();
      expect(mod?.children?.length).toBe(1); // s1
      expect(mod?.children?.[0]?.children?.length).toBe(3); // f1, f2, f3
      expect(mod?.children?.[0]?.children?.[0]?.code).toBe('flow:01.1');
    });

    it('should format button titles properly with lock indicators', () => {
      const activeNode = sampleNodes.find((n) => n.id === 'f1')!;
      expect(BotFeatureRegistryService.formatButtonTitle(activeNode)).toBe('⚡ تسجيل عامل جديد');

      const lockedNode = sampleNodes.find((n) => n.id === 'f3')!;
      expect(BotFeatureRegistryService.formatButtonTitle(lockedNode)).toBe('🔒 🦺 مهمات الوقاية');

      const sovereignNode = sampleNodes.find((n) => n.id === 'f_sov')!;
      expect(BotFeatureRegistryService.formatButtonTitle(sovereignNode)).toBe('🖥️ فتح لوحة التحكم');
    });

    it('should filter nodes according to visibility and role', () => {
      const fieldWorkerVisible = BotFeatureRegistryService.filterNodesForUser(sampleNodes, 'FIELD_ADMIN');
      // f1 is restricted to SUPER_ADMIN / GENERAL_ADMIN, so should not appear
      expect(fieldWorkerVisible.find((n) => n.id === 'f1')).toBeUndefined();

      const superAdminVisible = BotFeatureRegistryService.filterNodesForUser(sampleNodes, 'SUPER_ADMIN');
      // f2 is HIDE, so should not appear in bot menu
      expect(superAdminVisible.find((n) => n.id === 'f2')).toBeUndefined();
      // f3 is LOCK_WITH_ALERT, so should appear
      expect(superAdminVisible.find((n) => n.id === 'f3')).toBeDefined();
    });

    it('should resolve callback data across domains, sections, and flow actions', () => {
      // 1. Direct callback match
      expect(BotFeatureRegistryService.findNodeByCallback('flow:01.1:start', sampleNodes)?.id).toBe('f1');

      // 2. Domain module callback mapping: menu:domain:hr -> mod:hr
      expect(BotFeatureRegistryService.findNodeByCallback('menu:domain:hr', sampleNodes)?.id).toBe('m1');

      // 3. Section callback mapping: node:sec:workforce -> sec:workforce
      expect(BotFeatureRegistryService.findNodeByCallback('node:sec:workforce', sampleNodes)?.id).toBe('s1');

      // 4. Flow sub-action prefix matching: flow:01.1:step_2 -> flow:01.1
      expect(BotFeatureRegistryService.findNodeByCallback('flow:01.1:step_2', sampleNodes)?.id).toBe('f1');

      // 5. Non-matching callback returns null
      expect(BotFeatureRegistryService.findNodeByCallback('unknown:callback', sampleNodes)).toBeNull();
    });
  });

  describe('FeatureGateGuard', () => {
    it('should allow access to active features for authorized role', () => {
      const f1 = sampleNodes.find((n) => n.id === 'f1')!;
      const check = FeatureGateGuard.checkFeatureAccess(f1, 'GENERAL_ADMIN');
      expect(check.allowed).toBe(true);
      expect(check.status).toBe(BotNodeStatus.ACTIVE);
    });

    it('should block access if role is unauthorized', () => {
      const f1 = sampleNodes.find((n) => n.id === 'f1')!;
      const check = FeatureGateGuard.checkFeatureAccess(f1, 'VISITOR');
      expect(check.allowed).toBe(false);
      expect(check.reason).toBe('ROLE_UNAUTHORIZED');
    });

    it('should block disabled features and return maintenance message', () => {
      const f3 = sampleNodes.find((n) => n.id === 'f3')!;
      const check = FeatureGateGuard.checkFeatureAccess(f3, 'GENERAL_ADMIN');
      expect(check.allowed).toBe(false);
      expect(check.status).toBe(BotNodeStatus.MAINTENANCE);
      expect(check.maintenanceMessage).toBe('صيانة طارئة');
      expect(check.behavior).toBe(DisabledBehavior.LOCK_WITH_ALERT);
    });

    it('SOVEREIGN IMMUNITY: should always allow protected nodes even if disabled', () => {
      const sov = sampleNodes.find((n) => n.id === 'f_sov')!;
      const check = FeatureGateGuard.checkFeatureAccess(sov, 'VISITOR');
      expect(check.allowed).toBe(true);
      expect(check.isProtected).toBe(true);
    });

    it('assertFeatureActive should throw error for disabled features', () => {
      const f3 = sampleNodes.find((n) => n.id === 'f3')!;
      expect(() => FeatureGateGuard.assertFeatureActive(f3, 'GENERAL_ADMIN')).toThrow('صيانة طارئة');
    });
  });
});
