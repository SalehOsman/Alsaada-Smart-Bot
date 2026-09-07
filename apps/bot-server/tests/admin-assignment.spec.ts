import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/db.js', () => ({
  prisma: {
    user: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'user-1',
          telegramId: 1111111111n,
          fullName: 'محمود أحمد',
          role: 'FIELD_ADMIN',
          assignedSiteId: 'site-kharga',
          assignedSite: { name: 'موقع الخارجة', code: 'STE-01' },
        },
      ]),
      findUnique: vi.fn().mockResolvedValue({
        id: 'user-1',
        telegramId: 1111111111n,
        fullName: 'محمود أحمد',
        role: 'FIELD_ADMIN',
        assignedSiteId: 'site-kharga',
        assignedSite: { name: 'موقع الخارجة', code: 'STE-01' },
      }),
      update: vi.fn().mockImplementation(({ data }) => ({
        id: 'user-1',
        telegramId: 1111111111n,
        fullName: 'محمود أحمد',
        role: 'FIELD_ADMIN',
        assignedSiteId: data.assignedSiteId,
        assignedSite: data.assignedSiteId ? { name: 'موقع الخارجة', code: 'STE-01' } : null,
      })),
    },
    site: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'site-kharga', code: 'STE-01', name: 'موقع الخارجة', status: 'ACTIVE' },
        { id: 'site-hq', code: 'STE-HQ', name: 'المقر الرئيسي', status: 'ACTIVE' },
      ]),
    },
  },
}));

import {
  renderAdminAssignmentsHub,
  renderUserAssignmentCard,
  handleSetUserSiteAssignment,
} from '../src/handlers/admin-assignment.handler.js';
import { prisma } from '../src/db.js';
import { MyContext } from '../src/types/context.js';

describe('Admin Site Assignment & Scoping Handler', () => {
  it('should reject non-super-admin from viewing admin assignments hub', async () => {
    const mockAnswer = vi.fn();
    const mockCtx = {
      isRealSuperAdmin: false,
      callbackQuery: { data: 'action:settings:admin_assignments' },
      answerCallbackQuery: mockAnswer,
    } as unknown as MyContext;

    await renderAdminAssignmentsHub(mockCtx, true);

    expect(mockAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ show_alert: true, text: expect.stringContaining('حصرياً للمدير العام') })
    );
  });

  it('should render assignments hub with user and current site scope in keyboard buttons', async () => {
    const editMock = vi.fn().mockResolvedValue(true);
    const mockCtx = {
      isRealSuperAdmin: true,
      from: { id: 7594239391 },
      callbackQuery: { data: 'action:settings:admin_assignments' },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      editMessageText: editMock,
      reply: vi.fn().mockResolvedValue(true),
    } as unknown as MyContext;

    await renderAdminAssignmentsHub(mockCtx, true);

    expect(editMock).toHaveBeenCalled();
    const replyMarkup = editMock.mock.calls[0][1]?.reply_markup;
    const markupStr = JSON.stringify(replyMarkup);
    expect(markupStr).toContain('محمود أحمد');
    expect(markupStr).toContain('موقع الخارجة');
  });

  it('should update user to a specific site and re-render card', async () => {
    const editMock = vi.fn().mockResolvedValue(true);
    const mockCtx = {
      isRealSuperAdmin: true,
      from: { id: 7594239391 },
      callbackQuery: { data: 'action:admin_assign:set:1111111111:site-kharga' },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      editMessageText: editMock,
      reply: vi.fn().mockResolvedValue(true),
    } as unknown as MyContext;

    await handleSetUserSiteAssignment(mockCtx, 1111111111n, 'site-kharga');

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { telegramId: 1111111111n },
        data: { assignedSiteId: 'site-kharga' },
      })
    );
  });

  it('should update user to global access (null siteId) when GLOBAL is passed', async () => {
    const editMock = vi.fn().mockResolvedValue(true);
    const mockCtx = {
      isRealSuperAdmin: true,
      from: { id: 7594239391 },
      callbackQuery: { data: 'action:admin_assign:set:1111111111:GLOBAL' },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      editMessageText: editMock,
      reply: vi.fn().mockResolvedValue(true),
    } as unknown as MyContext;

    await handleSetUserSiteAssignment(mockCtx, 1111111111n, 'GLOBAL');

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { telegramId: 1111111111n },
        data: { assignedSiteId: null },
      })
    );
  });
});
