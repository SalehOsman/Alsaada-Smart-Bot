import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/redis.js', () => ({
  redis: { on: vi.fn(), get: vi.fn().mockResolvedValue(null) },
  getPendingAdminEdit: vi.fn().mockResolvedValue(null),
  setPendingAdminEdit: vi.fn().mockResolvedValue(undefined),
  clearPendingAdminEdit: vi.fn().mockResolvedValue(undefined),
}));

import {
  ADMIN_FIELD_LABELS,
  renderAdminProfileCard,
  handleAdminFieldTextInput,
} from '../src/handlers/admin-profile.handler.js';
import { MyContext } from '../src/types/context.js';

describe('Admin Personal Profile Handler', () => {
  it('should define admin profile field labels correctly', () => {
    expect(ADMIN_FIELD_LABELS.fullName).toBe('الاسم الرسمي');
    expect(ADMIN_FIELD_LABELS.phone).toBe('رقم الهاتف المعتمد');
  });

  it('should reject non-super-admin user from viewing admin profile', async () => {
    const mockAnswerCallbackQuery = vi.fn();
    const mockCtx = {
      isRealSuperAdmin: false,
      callbackQuery: { data: 'action:settings:admin_profile' },
      answerCallbackQuery: mockAnswerCallbackQuery,
    } as unknown as MyContext;

    await renderAdminProfileCard(mockCtx, true);

    expect(mockAnswerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        show_alert: true,
        text: expect.stringContaining('حصرياً للمدير العام'),
      })
    );
  });

  it('should return false if text arrives without pending admin edit state', async () => {
    const mockCtx = {
      isRealSuperAdmin: true,
      from: { id: 7594239391 },
      message: { text: 'رسالة عادية' },
    } as unknown as MyContext;

    const handled = await handleAdminFieldTextInput(mockCtx);
    expect(handled).toBe(false);
  });
});
