import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildGhostModeMenuKeyboard,
  buildWorkerPickerKeyboard,
  buildSupplierPickerKeyboard,
  buildExitGhostKeyboard,
} from '../flow.keyboard.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.6 UX Tests — محاكاة وتقمص الأدوار', () => {
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

  it('generates role simulation menu with distinct persona options and without exit action', () => {
    // Arrange
    const noop = null;

    // Act
    const kb = buildGhostModeMenuKeyboard();

    // Assert
    expect(kb).toBeDefined();
    expect(kb.inline_keyboard.length).toBeGreaterThan(0);
    const hasFieldAdmin = kb.inline_keyboard.some((row) =>
      row.some((btn) => 'callback_data' in btn && btn.callback_data === 'action:impersonate:FIELD_ADMIN')
    );
    const hasExitImpersonate = kb.inline_keyboard.some((row) =>
      row.some((btn) => 'callback_data' in btn && btn.callback_data === 'action:exit_impersonate')
    );
    expect(hasFieldAdmin).toBe(true);
    expect(hasExitImpersonate).toBe(false);
  });

  it('renders worker picker grid keyboard with 2-column layout for populated lists', () => {
    // Arrange
    const workers = [
      { id: 'w-1', name: 'أحمد', code: 'W-01' },
      { id: 'w-2', name: 'محمد', code: 'W-02' },
    ];

    // Act
    const kb = buildWorkerPickerKeyboard(workers);

    // Assert
    expect(kb).toBeDefined();
    expect(kb.inline_keyboard[0]).toHaveLength(2);
    const firstWorkerBtn = kb.inline_keyboard[0]?.[0];
    expect(firstWorkerBtn && 'callback_data' in firstWorkerBtn ? firstWorkerBtn.callback_data : '').toBe('action:impersonate:worker:w-1');
  });

  it('omits worker selector buttons when empty list is provided', () => {
    // Arrange
    const emptyWorkers: Array<{ id: string; name: string; code: string }> = [];

    // Act
    const kb = buildWorkerPickerKeyboard(emptyWorkers);

    // Assert
    expect(kb).toBeDefined();
    const hasWorkerAction = kb.inline_keyboard.some((row) =>
      row.some((btn) => 'callback_data' in btn && btn.callback_data?.startsWith('action:impersonate:worker:'))
    );
    expect(hasWorkerAction).toBe(false);
  });

  it('renders supplier picker grid keyboard correctly', () => {
    // Arrange
    const suppliers = [{ id: 's-1', name: 'الأمل للتوريدات', code: 'SUP-01' }];

    // Act
    const kb = buildSupplierPickerKeyboard(suppliers);

    // Assert
    expect(kb).toBeDefined();
    const firstSupplierBtn = kb.inline_keyboard[0]?.[0];
    expect(firstSupplierBtn && 'callback_data' in firstSupplierBtn ? firstSupplierBtn.callback_data : '').toBe('action:impersonate:supplier:s-1');
  });

  it('renders exit ghost keyboard returning to super admin session', () => {
    // Arrange
    const noop = null;

    // Act
    const kb = buildExitGhostKeyboard();

    // Assert
    expect(kb).toBeDefined();
    const exitBtn = kb.inline_keyboard[0]?.[0];
    expect(exitBtn && 'callback_data' in exitBtn ? exitBtn.callback_data : '').toBe('action:exit_impersonate');
  });
});
