import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PrismaClient } from '@alsaada/database';
import type { SettingsModuleContext } from '../../../shared/module.types.js';
import { TelegramGroupsRepository } from '../flow.repository.js';
import { TelegramGroupsService } from '../flow.service.js';
import { TelegramGroupsHandler } from '../flow.handler.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.11 RBAC Spec — مجموعات تليجرام', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('strictly rejects non-super admin roles with alert notification', async () => {
    // Arrange
    const mockPrisma = {} as unknown as PrismaClient;
    const repo = new TelegramGroupsRepository(mockPrisma);
    const service = new TelegramGroupsService(repo);
    const handler = new TelegramGroupsHandler(service, repo);
    const answerMock = vi.fn().mockResolvedValue(true);
    const editMock = vi.fn();
    const ctx = {
      isRealSuperAdmin: false,
      effectiveRole: 'WORKER',
      isImpersonating: false,
      callbackQuery: {},
      answerCallbackQuery: answerMock,
      editMessageText: editMock,
    };

    // Act
    await handler.renderGroupsHub(ctx as unknown as SettingsModuleContext, true);

    // Assert
    expect(answerMock).toHaveBeenCalledWith(
      expect.objectContaining({ show_alert: true })
    );
    expect(editMock).not.toHaveBeenCalled();
  });

  it('permits authorized Super Admin to render groups hub', async () => {
    // Arrange
    const mockPrisma = {
      site: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaClient;
    const repo = new TelegramGroupsRepository(mockPrisma);
    const service = new TelegramGroupsService(repo);
    const handler = new TelegramGroupsHandler(service, repo);
    const answerMock = vi.fn().mockResolvedValue(true);
    const editMock = vi.fn().mockResolvedValue(true);
    const ctx = {
      isRealSuperAdmin: true,
      effectiveRole: 'SUPER_ADMIN',
      isImpersonating: false,
      callbackQuery: {},
      answerCallbackQuery: answerMock,
      editMessageText: editMock,
    };

    // Act
    await handler.renderGroupsHub(ctx as unknown as SettingsModuleContext, true);

    // Assert
    expect(editMock).toHaveBeenCalled();
    expect(answerMock).not.toHaveBeenCalledWith(expect.objectContaining({ show_alert: true }));
  });
});
