import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@alsaada/database';
import type { SettingsModuleContext } from '../../../shared/module.types.js';
import { TelegramGroupsRepository } from '../flow.repository.js';
import { TelegramGroupsService } from '../flow.service.js';
import { TelegramGroupsHandler } from '../flow.handler.js';

describe('Flow 00.11: RBAC Spec', () => {
  it('strictly rejects non-super admin roles', async () => {
    const mockPrisma = {} as unknown as PrismaClient;
    const repo = new TelegramGroupsRepository(mockPrisma);
    const service = new TelegramGroupsService(repo);
    const handler = new TelegramGroupsHandler(service, repo);

    const blockedRoles = ['FIELD_ADMIN', 'ACCOUNTANT', 'WORKER', 'GUEST'];

    for (const role of blockedRoles) {
      const ctx = {
        isRealSuperAdmin: false,
        effectiveRole: role,
        isImpersonating: false,
        callbackQuery: {},
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
      };

      await handler.renderGroupsHub(ctx as unknown as SettingsModuleContext, true);
      expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
        expect.objectContaining({ show_alert: true })
      );
    }
  });
});
