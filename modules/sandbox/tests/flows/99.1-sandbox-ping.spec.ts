import { describe, it, expect } from 'vitest';
import { assertRichMessage } from '@alsaada/core-components';
import {
  SandboxPingService,
  validateSandboxPingInput,
  buildSandboxPingMainMenuKeyboard,
  buildSandboxPingConfirmKeyboard,
  buildSandboxPingPromptMessage,
  buildSandboxPingConfirmMessage,
  handleSandboxPingError,
  handleSandboxPingAction,
} from '../../src/flows/99.1-sandbox-ping/index.js';

describe('Work Plan 89 — Flow 99.1 (sandbox-ping) Constitutional 10-File Slice Spec', () => {
  it('validates input with strict boundary checks', () => {
    // Valid standard input
    const valid = validateSandboxPingInput({
      idempotencyKey: 'idemp-key-12345',
      actorTelegramId: 'user-1',
      notes: 'Sample test notes',
    });
    expect(valid.success).toBe(true);

    // Boundary: exactly 8 chars
    const min8 = validateSandboxPingInput({
      idempotencyKey: '12345678',
      actorTelegramId: 'user-1',
    });
    expect(min8.success).toBe(true);

    // Boundary: exactly 64 chars
    const max64 = validateSandboxPingInput({
      idempotencyKey: 'a'.repeat(64),
      actorTelegramId: 'user-1',
    });
    expect(max64.success).toBe(true);

    // Too short (< 8 chars)
    const tooShort = validateSandboxPingInput({
      idempotencyKey: '1234567',
      actorTelegramId: 'user-1',
    });
    expect(tooShort.success).toBe(false);

    // Too long (> 64 chars)
    const tooLong = validateSandboxPingInput({
      idempotencyKey: 'a'.repeat(65),
      actorTelegramId: 'user-1',
    });
    expect(tooLong.success).toBe(false);

    // Empty actorTelegramId
    const emptyActor = validateSandboxPingInput({
      idempotencyKey: '12345678',
      actorTelegramId: '',
    });
    expect(emptyActor.success).toBe(false);

    // Null or undefined
    expect(validateSandboxPingInput(null).success).toBe(false);
    expect(validateSandboxPingInput(undefined).success).toBe(false);
    expect(validateSandboxPingInput('not-an-object').success).toBe(false);
  });

  it('executes service operation and returns standard reference result', async () => {
    const service = new SandboxPingService();
    const res = await service.executeOperation({
      idempotencyKey: 'test-key-12345678',
      actorTelegramId: 'usr-99',
    });

    expect(res.success).toBe(true);
    expect(res.referenceId).toBeDefined();
    expect(res.referenceId).toContain('SANDBOX-PING');
    expect(res.messageArabic).toContain('تم تنفيذ العملية بنجاح');
  });

  it('builds keyboard conforming strictly to Telegram Ergonomics Budget (36/16/7/3)', () => {
    const kb = buildSandboxPingMainMenuKeyboard();
    expect(kb.inline_keyboard.length).toBeLessThanOrEqual(7);

    for (const row of kb.inline_keyboard) {
      expect(row.length).toBeLessThanOrEqual(3);
      for (const btn of row) {
        expect(btn.text.length).toBeLessThanOrEqual(16);
        expect(btn.callback_data.length).toBeLessThanOrEqual(64);
      }
    }

    const confirmKb = buildSandboxPingConfirmKeyboard('ref-123');
    for (const row of confirmKb.inline_keyboard) {
      expect(row.length).toBeLessThanOrEqual(3);
      for (const btn of row) {
        expect(btn.text.length).toBeLessThanOrEqual(16);
        expect(btn.callback_data.length).toBeLessThanOrEqual(64);
      }
    }
  });

  it('builds valid Rich Messages compliant with Rule 8.1 Zero Raw Text Policy', () => {
    const promptMsg = buildSandboxPingPromptMessage('فحص النبض والاستجابة');
    expect(() => assertRichMessage(promptMsg)).not.toThrow();
    expect(promptMsg.is_rtl).toBe(true);
    expect(promptMsg.blocks?.length).toBeGreaterThan(0);

    const confirmMsg = buildSandboxPingConfirmMessage('PING-001');
    expect(() => assertRichMessage(confirmMsg)).not.toThrow();
    expect(confirmMsg.is_rtl).toBe(true);
  });

  it('handles error gracefully without crashing', () => {
    const fromError = handleSandboxPingError(new Error('Network timeout'));
    expect(fromError.handled).toBe(true);
    expect(fromError.userMessageArabic).toContain('حدث خطأ');

    const fromString = handleSandboxPingError('Unknown failure');
    expect(fromString.handled).toBe(true);
    expect(fromString.userMessageArabic).toContain('حدث خطأ');
  });

  it('handles callback query action cleanly', async () => {
    const service = new SandboxPingService();
    const replied: unknown[] = [];
    const mockCtx = {
      callbackQuery: { data: 'action:sandbox:sandbox-ping:start' },
      reply: async (content: unknown) => {
        replied.push(content);
      },
    };

    const handled = await handleSandboxPingAction(mockCtx, service);
    expect(handled).toBe(true);
    expect(replied.length).toBe(1);
    expect(() => assertRichMessage(replied[0] as any)).not.toThrow();

    // Unknown action returns false
    const unhandled = await handleSandboxPingAction({ ...mockCtx, callbackQuery: { data: 'unknown' } }, service);
    expect(unhandled).toBe(false);
  });
});
