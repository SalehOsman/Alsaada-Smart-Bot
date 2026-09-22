import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildAuditVaultHubKeyboard,
  buildUnresolvedErrorsKeyboard,
  buildErrorDetailKeyboard,
} from '../flow.keyboard.js';
import type { UnresolvedErrorDto } from '../flow.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.7 UX Tests — وحدة التحقيق الجنائي والأعطال', () => {
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

  it('generates standard audit hub keyboard without simulation termination button', () => {
    // Arrange
    const isImpersonating = false;

    // Act
    const kb = buildAuditVaultHubKeyboard(isImpersonating);

    // Assert
    expect(kb).toBeDefined();
    expect(kb.inline_keyboard.length).toBeGreaterThan(0);
    const hasExit = kb.inline_keyboard.some((row) =>
      row.some((btn) => 'callback_data' in btn && btn.callback_data === 'action:exit_impersonate')
    );
    expect(hasExit).toBe(false);
  });

  it('injects simulation exit button when impersonation is active', () => {
    // Arrange
    const isImpersonating = true;

    // Act
    const kb = buildAuditVaultHubKeyboard(isImpersonating);

    // Assert
    expect(kb).toBeDefined();
    const hasExit = kb.inline_keyboard.some((row) =>
      row.some((btn) => 'callback_data' in btn && btn.callback_data === 'action:exit_impersonate')
    );
    expect(hasExit).toBe(true);
  });

  it('renders unresolved errors keyboard with paging controls', () => {
    // Arrange
    const sampleErrors: UnresolvedErrorDto[] = [
      {
        id: 'err-1',
        errorReference: 'ERR-001',
        errorHash: 'hash-001',
        errorMessage: 'Database connection dropped',
        stackTrace: null,
        sourceLocation: null,
        actorTelegramId: 7594239391n,
        actorRole: 'SUPER_ADMIN',
        actionTrigger: 'menu:settings',
        occurrenceCount: 3,
        severity: 'CRITICAL',
        lastSeenAt: new Date(),
        createdAt: new Date(),
      },
    ];

    // Act
    const kb = buildUnresolvedErrorsKeyboard(sampleErrors, 1, 15, 5);

    // Assert
    expect(kb).toBeDefined();
    const errorBtn = kb.inline_keyboard[0]?.[0];
    expect(errorBtn && 'callback_data' in errorBtn ? errorBtn.callback_data : '').toBe('action:audit:error_view:err-1');
  });

  it('renders error resolution action button in detail keyboard', () => {
    // Arrange
    const errorId = 'err-xyz';

    // Act
    const kb = buildErrorDetailKeyboard(errorId);

    // Assert
    expect(kb).toBeDefined();
    const resolveBtn = kb.inline_keyboard[0]?.[0];
    expect(resolveBtn && 'callback_data' in resolveBtn ? resolveBtn.callback_data : '').toBe('action:audit:resolve:err-xyz');
  });
});
