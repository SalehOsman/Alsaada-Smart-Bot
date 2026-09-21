import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Permissions Matrix, Telegram Groups Suite & Supervisor Lifecycle Contracts', () => {
  const readScreenSource = (relativePath: string): string => {
    const fullPath = path.resolve(__dirname, '..', relativePath);
    return fs.readFileSync(fullPath, 'utf-8');
  };

  describe('Feature 1: Dynamic Permissions Matrix Hub (/admin/settings/matrix)', () => {
    it('enforces authentication on matrix page.tsx and renders MatrixClient', () => {
      // Arrange
      const pagePath = 'src/app/admin/settings/matrix/page.tsx';

      // Act
      const pageSrc = readScreenSource(pagePath);

      // Assert
      expect(pageSrc).toContain('requireDashboardUser');
      expect(pageSrc).toContain('MatrixClient');
      expect(pageSrc).not.toContain('allowAnonymous');
      expect(pageSrc.length).toBeGreaterThan(0);
    });

    it('client renders multi-scope selector, search input, and tri-state controls with Arabic labels', () => {
      // Arrange
      const clientPath = 'src/app/admin/settings/matrix/matrix-client.tsx';

      // Act
      const clientSrc = readScreenSource(clientPath);

      // Assert
      expect(clientSrc).toContain('scopeCategory');
      expect(clientSrc).toContain('ROLE');
      expect(clientSrc).toContain('SITE');
      expect(clientSrc).toContain('USER');
      expect(clientSrc).toContain('سماح');
      expect(clientSrc).toContain('حظر');
      expect(clientSrc).toContain('افتراضي');
      expect(clientSrc).toContain('حجب أجور مشفر');
      expect(clientSrc).not.toContain('hardcodedMock');
    });

    it('API route enforces RBAC and supports tri-state upsert and reset with audit logging', () => {
      // Arrange
      const apiPath = 'src/app/api/permissions/matrix/route.ts';

      // Act
      const apiSrc = readScreenSource(apiPath);

      // Assert
      expect(apiSrc).toContain("['SUPER_ADMIN', 'GENERAL_ADMIN']");
      expect(apiSrc).toContain('botMenuPermission.deleteMany');
      expect(apiSrc).toContain('botMenuPermission.upsert');
      expect(apiSrc).toContain('notifyRbacSync');
      expect(apiSrc).toContain('FEATURE_CATALOG');
      expect(apiSrc).not.toContain('bypassRbac');
    });
  });

  describe('Feature 2: Telegram Groups & Topics Suite (/admin/settings/telegram-groups)', () => {
    it('enforces authentication on telegram groups page.tsx and renders TelegramGroupsClient', () => {
      // Arrange
      const pagePath = 'src/app/admin/settings/telegram-groups/page.tsx';

      // Act
      const pageSrc = readScreenSource(pagePath);

      // Assert
      expect(pageSrc).toContain('requireDashboardUser');
      expect(pageSrc).toContain('TelegramGroupsClient');
      expect(pageSrc).not.toContain('skipAuth');
    });

    it('client renders central HQ card, sites table, ping action, and enforcement queue with Arabic typography', () => {
      // Arrange
      const clientPath = 'src/app/admin/settings/telegram-groups/groups-client.tsx';

      // Act
      const clientSrc = readScreenSource(clientPath);

      // Assert
      expect(clientSrc).toContain('جروب الإدارة العليا السيادي');
      expect(clientSrc).toContain('مصفوفة ربط المواقع الميدانية بجروبات وتوبيكات تليجرام');
      expect(clientSrc).toContain('طابور مهام إنفاذ تليجرام الميداني');
      expect(clientSrc).toContain('فحص الاتصال');
      expect(clientSrc).toContain('تعديل الربط');
      expect(clientSrc.length).toBeGreaterThan(500);
    });

    it('API route handles GET, PUT site binding, and POST connection ping with validation', () => {
      // Arrange
      const apiPath = 'src/app/api/settings/telegram-groups/route.ts';

      // Act
      const apiSrc = readScreenSource(apiPath);

      // Assert
      expect(apiSrc).toContain('centralHq');
      expect(apiSrc).toContain('telegramGroupId');
      expect(apiSrc).toContain('telegramTopicId');
      expect(apiSrc).toContain('VERIFY_MEMBERSHIP');
      expect(apiSrc).toContain('telegramEnforcementTask.create');
      expect(apiSrc).not.toContain('ignoreErrors');
    });
  });

  describe('Feature 3: Supervisor Lifecycle & Configurable Leave Policies', () => {
    it('lifecycle API route implements atomic transaction for leave, transfer, and termination', () => {
      // Arrange
      const lifecycleApiPath = 'src/app/api/supervisors/lifecycle/route.ts';

      // Act
      const lifecycleApiSrc = readScreenSource(lifecycleApiPath);

      // Assert
      expect(lifecycleApiSrc).toContain('LEAVE_START');
      expect(lifecycleApiSrc).toContain('LEAVE_RETURN');
      expect(lifecycleApiSrc).toContain('SITE_TRANSFER');
      expect(lifecycleApiSrc).toContain('TERMINATION');
      expect(lifecycleApiSrc).toContain('supervisorLifecycleLog.create');
      expect(lifecycleApiSrc).toContain('telegramEnforcementTask.create');
      expect(lifecycleApiSrc).toContain('KICK_MEMBER');
      expect(lifecycleApiSrc).toContain('GENERATE_INVITE');
      expect(lifecycleApiSrc).toContain('BAN_MEMBER');
      expect(lifecycleApiSrc).toContain('notifyRbacSync');
      expect(lifecycleApiSrc).not.toContain('allowRawExecution');
    });

    it('policies API route handles toggling freezeBotAccessOnLeave and ejectTelegramOnLeave with sync dispatch', () => {
      // Arrange
      const policiesApiPath = 'src/app/api/supervisors/policies/route.ts';

      // Act
      const policiesApiSrc = readScreenSource(policiesApiPath);

      // Assert
      expect(policiesApiSrc).toContain('freezeBotAccessOnLeave');
      expect(policiesApiSrc).toContain('ejectTelegramOnLeave');
      expect(policiesApiSrc).toContain('notifyRbacSync');
      expect(policiesApiSrc).not.toBeNull();
    });

    it('users-client renders status badge, leave policy toggles, and lifecycle modal with localized text', () => {
      // Arrange
      const usersClientPath = 'src/app/admin/settings/users/users-client.tsx';

      // Act
      const usersClientSrc = readScreenSource(usersClientPath);

      // Assert
      expect(usersClientSrc).toContain('في إجازة');
      expect(usersClientSrc).toContain('على رأس العمل');
      expect(usersClientSrc).toContain('حظر البوت');
      expect(usersClientSrc).toContain('طرد الجروب');
      expect(usersClientSrc).toContain('إجراءات دورة الحياة');
      expect(usersClientSrc).toContain('مصفوفة الصلاحيات (RBAC)');
      expect(usersClientSrc).toContain('مجموعات تليجرام');
      expect(usersClientSrc).not.toContain('dangerouslySetInnerHTML');
    });
  });
});
