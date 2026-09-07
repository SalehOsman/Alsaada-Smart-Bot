import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/redis.js', () => ({
  redis: { on: vi.fn(), get: vi.fn().mockResolvedValue(null) },
  getPendingSiteAction: vi.fn().mockResolvedValue(null),
  setPendingSiteAction: vi.fn().mockResolvedValue(undefined),
  clearPendingSiteAction: vi.fn().mockResolvedValue(undefined),
}));

import {
  renderSitesHub,
  handleSiteTextInput,
} from '../src/handlers/sites-hub.handler.js';
import { MyContext } from '../src/types/context.js';

describe('Sites & Projects Hub Handler', () => {
  it('should reject non-super-admin user from sites hub', async () => {
    const mockAnswerCallbackQuery = vi.fn();
    const mockCtx = {
      isRealSuperAdmin: false,
      callbackQuery: { data: 'action:settings:sites_hub' },
      answerCallbackQuery: mockAnswerCallbackQuery,
    } as unknown as MyContext;

    await renderSitesHub(mockCtx, true);

    expect(mockAnswerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        show_alert: true,
        text: expect.stringContaining('حصرياً للمدير العام'),
      })
    );
  });

  it('should return false if text arrives without pending site action', async () => {
    const mockCtx = {
      isRealSuperAdmin: true,
      from: { id: 7594239391 },
      message: { text: 'موقع تجريبي' },
    } as unknown as MyContext;

    const handled = await handleSiteTextInput(mockCtx);
    expect(handled).toBe(false);
  });
});
