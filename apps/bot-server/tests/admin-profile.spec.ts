import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/redis.js', () => ({
  redis: {
    on: vi.fn(),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
  },
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
import { fastCache } from '../src/services/fast-cache.service.js';

describe('Admin Personal Profile Handler', () => {
  beforeEach(() => {
    fastCache.clearL1();
  });
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

  it('should render username with underscores inside backticks for Super Admin', async () => {
    const editMessageTextMock = vi.fn().mockResolvedValue(true);
    const mockCtx = {
      isRealSuperAdmin: true,
      from: { id: 7594239391 },
      callbackQuery: { data: 'action:settings:admin_profile', message: { message_id: 123 } },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      editMessageText: editMessageTextMock,
      reply: vi.fn().mockResolvedValue(true),
    } as unknown as MyContext;

    await renderAdminProfileCard(mockCtx, true);

    expect(editMessageTextMock).toHaveBeenCalled();
    const renderedText = editMessageTextMock.mock.calls[0][0] as string;
    // Verify that username is wrapped in code backticks
    expect(renderedText).toMatch(/`@?[^`]+`/);
    // Ensure no unescaped @ followed by underscores outside backticks
    const lines = renderedText.split('\n');
    const usernameLine = lines.find((l) => l.includes('اسم المستخدم:'));
    expect(usernameLine).toBeDefined();
    expect(usernameLine).toContain('`');
  });
});
