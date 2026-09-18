import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Plan 69: Permissions Matrix, Telegram Groups Suite & Supervisor Lifecycle Contracts', () => {
  const readScreenSource = (relativePath: string): string => {
    const fullPath = path.resolve(__dirname, '..', relativePath);
    return fs.readFileSync(fullPath, 'utf-8');
  };

  describe('Feature 1: Dynamic Permissions Matrix Hub (/admin/settings/matrix)', () => {
    const pageSrc = readScreenSource('src/app/admin/settings/matrix/page.tsx');
    const clientSrc = readScreenSource('src/app/admin/settings/matrix/matrix-client.tsx');
    const apiSrc = readScreenSource('src/app/api/permissions/matrix/route.ts');

    it('enforces authentication on matrix page.tsx', () => {
      expect(pageSrc).toContain('requireDashboardUser');
      expect(pageSrc).toContain('MatrixClient');
    });

    it('client renders multi-scope selector, search input, and tri-state controls', () => {
      expect(clientSrc).toContain('scopeCategory');
      expect(clientSrc).toContain('ROLE');
      expect(clientSrc).toContain('SITE');
      expect(clientSrc).toContain('USER');
      expect(clientSrc).toContain('سماح');
      expect(clientSrc).toContain('حظر');
      expect(clientSrc).toContain('افتراضي');
      expect(clientSrc).toContain('حجب أجور مشفر');
    });

    it('API route enforces RBAC and supports tri-state upsert and reset', () => {
      expect(apiSrc).toContain("['SUPER_ADMIN', 'GENERAL_ADMIN']");
      expect(apiSrc).toContain('botMenuPermission.deleteMany');
      expect(apiSrc).toContain('botMenuPermission.upsert');
      expect(apiSrc).toContain('notifyRbacSync');
      expect(apiSrc).toContain('FEATURE_CATALOG');
    });
  });

  describe('Feature 2: Telegram Groups & Topics Suite (/admin/settings/telegram-groups)', () => {
    const pageSrc = readScreenSource('src/app/admin/settings/telegram-groups/page.tsx');
    const clientSrc = readScreenSource('src/app/admin/settings/telegram-groups/groups-client.tsx');
    const apiSrc = readScreenSource('src/app/api/settings/telegram-groups/route.ts');

    it('enforces authentication on telegram groups page.tsx', () => {
      expect(pageSrc).toContain('requireDashboardUser');
      expect(pageSrc).toContain('TelegramGroupsClient');
    });

    it('client renders central HQ card, sites table, ping action, and enforcement queue', () => {
      expect(clientSrc).toContain('جروب الإدارة العليا السيادي');
      expect(clientSrc).toContain('مصفوفة ربط المواقع الميدانية بجروبات وتوبيكات تليجرام');
      expect(clientSrc).toContain('طابور مهام إنفاذ تليجرام الميداني');
      expect(clientSrc).toContain('فحص الاتصال');
      expect(clientSrc).toContain('تعديل الربط');
    });

    it('API route handles GET, PUT site binding, and POST connection ping', () => {
      expect(apiSrc).toContain('centralHq');
      expect(apiSrc).toContain('telegramGroupId');
      expect(apiSrc).toContain('telegramTopicId');
      expect(apiSrc).toContain('VERIFY_MEMBERSHIP');
      expect(apiSrc).toContain('telegramEnforcementTask.create');
    });
  });

  describe('Feature 3: Supervisor Lifecycle & Configurable Leave Policies', () => {
    const lifecycleApiSrc = readScreenSource('src/app/api/supervisors/lifecycle/route.ts');
    const policiesApiSrc = readScreenSource('src/app/api/supervisors/policies/route.ts');
    const usersClientSrc = readScreenSource('src/app/admin/settings/users/users-client.tsx');

    it('lifecycle API route implements atomic transaction for leave, transfer, and termination', () => {
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
    });

    it('policies API route handles toggling freezeBotAccessOnLeave and ejectTelegramOnLeave', () => {
      expect(policiesApiSrc).toContain('freezeBotAccessOnLeave');
      expect(policiesApiSrc).toContain('ejectTelegramOnLeave');
      expect(policiesApiSrc).toContain('notifyRbacSync');
    });

    it('users-client renders status badge, leave policy toggles, and lifecycle modal', () => {
      expect(usersClientSrc).toContain('في إجازة');
      expect(usersClientSrc).toContain('على رأس العمل');
      expect(usersClientSrc).toContain('حظر البوت');
      expect(usersClientSrc).toContain('طرد الجروب');
      expect(usersClientSrc).toContain('إجراءات دورة الحياة');
      expect(usersClientSrc).toContain('مصفوفة الصلاحيات (RBAC)');
      expect(usersClientSrc).toContain('مجموعات تليجرام');
    });
  });
});
