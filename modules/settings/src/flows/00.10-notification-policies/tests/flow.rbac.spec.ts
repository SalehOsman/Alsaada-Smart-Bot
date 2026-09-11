import { describe, it, expect, vi } from 'vitest';
import { NotificationPoliciesHandler } from '../flow.handler.js';
import { NotificationPoliciesService } from '../flow.service.js';

describe('Flow 00.10: RBAC Spec', () => {
  it('strictly rejects non-super admin roles', async () => {
    const service = new NotificationPoliciesService();
    const handler = new NotificationPoliciesHandler(service);

    const blockedRoles = ['FIELD_ADMIN', 'ACCOUNTANT', 'WORKER', 'GUEST'];

    for (const role of blockedRoles) {
      const ctx = {
        isRealSuperAdmin: false,
        effectiveRole: role,
        isImpersonating: false,
        callbackQuery: {},
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
      };

      await handler.renderPoliciesHub(ctx as unknown as import('../../../shared/module.types.js').SettingsModuleContext, true);
      expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
        expect.objectContaining({ show_alert: true })
      );
    }
  });
});
