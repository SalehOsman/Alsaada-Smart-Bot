import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildAdminAssignmentsHubKeyboard,
  buildUserAssignmentCardKeyboard,
} from '../flow.keyboard.js';
import type { AdminAssignmentDto, SiteOptionDto } from '../flow.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.5 UX Tests — تعيين وتوزيع مدراء المواقع', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const sampleUser: AdminAssignmentDto = {
    id: 'u-1',
    telegramId: 111222333n,
    fullName: 'المهندس أحمد ممدوح',
    role: 'FIELD_ADMIN',
    assignedSiteId: 's-1',
    assignedSiteName: 'موقع السويس',
    isOnLeave: false,
    freezeBotAccessOnLeave: true,
    ejectTelegramOnLeave: true,
    status: 'ACTIVE',
  };

  const sampleSites: SiteOptionDto[] = [
    { id: 's-1', code: 'SUZ', name: 'موقع السويس', workersCount: 15 },
    { id: 's-2', code: 'ALX', name: 'موقع الإسكندرية', workersCount: 22 },
  ];

  it('generates standard hub keyboard without impersonation button when list is empty', () => {
    // Arrange
    const users: AdminAssignmentDto[] = [];
    const isImpersonating = false;

    // Act
    const kb = buildAdminAssignmentsHubKeyboard(users, isImpersonating);

    // Assert
    expect(kb).toBeDefined();
    expect(kb.inline_keyboard.length).toBeGreaterThan(0);
    const hasExitImpersonate = kb.inline_keyboard.some((row) =>
      row.some((btn) => 'callback_data' in btn && btn.callback_data === 'action:exit_impersonate')
    );
    expect(hasExitImpersonate).toBe(false);
  });

  it('injects simulation termination button during impersonation session', () => {
    // Arrange
    const users: AdminAssignmentDto[] = [];
    const isImpersonating = true;

    // Act
    const kb = buildAdminAssignmentsHubKeyboard(users, isImpersonating);

    // Assert
    expect(kb).toBeDefined();
    const hasExitImpersonate = kb.inline_keyboard.some((row) =>
      row.some((btn) => 'callback_data' in btn && btn.callback_data === 'action:exit_impersonate')
    );
    expect(hasExitImpersonate).toBe(true);
  });

  it('renders user assignment card keyboard with leave pause button when active', () => {
    // Arrange
    const activeUser = { ...sampleUser, isOnLeave: false };

    // Act
    const kb = buildUserAssignmentCardKeyboard(activeUser, sampleSites);

    // Assert
    expect(kb).toBeDefined();
    const hasStartLeave = kb.inline_keyboard.some((row) =>
      row.some((btn) => 'callback_data' in btn && btn.callback_data?.startsWith('adm:sl:'))
    );
    expect(hasStartLeave).toBe(true);
  });

  it('renders resume button when supervisor is currently on leave', () => {
    // Arrange
    const onLeaveUser = { ...sampleUser, isOnLeave: true };

    // Act
    const kb = buildUserAssignmentCardKeyboard(onLeaveUser, sampleSites);

    // Assert
    expect(kb).toBeDefined();
    const hasResumeLeave = kb.inline_keyboard.some((row) =>
      row.some((btn) => 'callback_data' in btn && btn.callback_data?.startsWith('adm:rl:'))
    );
    expect(hasResumeLeave).toBe(true);
  });
});
