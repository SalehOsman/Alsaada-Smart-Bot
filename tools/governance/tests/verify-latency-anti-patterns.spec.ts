import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  scanFileForLatencyAntiPatterns,
  verifyLatencyAntiPatterns,
  BYPASS_DIRECTIVE_REGEX,
} from '../verify-latency-anti-patterns.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('⚡ Zero-Regression AST Latency Anti-Patterns Governance Scanner', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('detects blocking await ctx.api.deleteMessage in flow handlers', () => {
    // Arrange
    const code = `
      async function handleBadAction(ctx: any) {
        await ctx.api.deleteMessage(ctx.chat.id, 123);
      }
    `;

    // Act
    const violations = scanFileForLatencyAntiPatterns('flow.handler.ts', code, false);

    // Assert
    expect(violations).toHaveLength(1);
    expect(violations[0]?.pattern).toBe('BLOCKING_DELETE_MESSAGE');
    expect(violations[0]?.message).toContain('safeDeleteBackground');
    expect(violations[0]?.pattern).not.toBe('AWAITED_SET_MY_COMMANDS');
  });

  it('detects blocking await ctx.deleteMessage in bot-server', () => {
    // Arrange
    const code = `
      async function handleBotAction(ctx: any) {
        await ctx.deleteMessage();
      }
    `;

    // Act
    const violations = scanFileForLatencyAntiPatterns('src/handlers/start.handler.ts', code, true);

    // Assert
    expect(violations).toHaveLength(1);
    expect(violations[0]?.pattern).toBe('BLOCKING_DELETE_MESSAGE');
    expect(violations[0]?.pattern).not.toBe('AWAITED_SET_MY_COMMANDS');
  });

  it('detects blocking await ctx.deleteMessage in business modules flow handlers', () => {
    // Arrange
    const code = `
      async function handleFlowAction(ctx: any) {
        await ctx.deleteMessage();
      }
    `;

    // Act
    const violations = scanFileForLatencyAntiPatterns('modules/settings/src/flows/00.1/flow.handler.ts', code, false);

    // Assert
    expect(violations).toHaveLength(1);
    expect(violations[0]?.pattern).toBe('BLOCKING_DELETE_MESSAGE');
    expect(violations[0]?.pattern).not.toBe('AWAITED_SET_MY_COMMANDS');
  });

  it('allows blocking delete when accompanied by bypass directive', () => {
    // Arrange
    const code = `
      async function handleSensitiveOtp(ctx: any) {
        // @governance-security-blocking-delete: wipe temporary plaintext OTP before continuing
        await ctx.api.deleteMessage(ctx.chat.id, 123);
      }
    `;

    // Act
    const violations = scanFileForLatencyAntiPatterns('flow.handler.ts', code, false);

    // Assert
    expect(violations).toHaveLength(0);
  });

  it('matches bypass directive correctly via regex', () => {
    // Arrange
    const directive1 = '// @governance-security-blocking-delete: security cleanup';
    const directive2 = '//   @governance-security-blocking-delete: reason';
    const regularComment = '// normal comment';

    // Act
    const match1 = BYPASS_DIRECTIVE_REGEX.test(directive1);
    const match2 = BYPASS_DIRECTIVE_REGEX.test(directive2);
    const matchRegular = BYPASS_DIRECTIVE_REGEX.test(regularComment);

    // Assert
    expect(match1).toBe(true);
    expect(match2).toBe(true);
    expect(matchRegular).toBe(false);
  });

  it('allows safe non-blocking background deletes', () => {
    // Arrange
    const code = `
      async function handleGoodAction(ctx: any) {
        void ctx.api.deleteMessage(ctx.chat.id, 123).catch(() => {});
        safeDeleteBackground(ctx, 123);
      }
    `;

    // Act
    const violations = scanFileForLatencyAntiPatterns('flow.handler.ts', code, false);

    // Assert
    expect(violations).toHaveLength(0);
  });

  it('detects blocking await setMyCommands in per-request handlers', () => {
    // Arrange
    const code = `
      async function handleUserClick(ctx: any) {
        await ctx.api.setMyCommands([{ command: 'start', description: 'Start' }]);
      }
    `;

    // Act
    const violations = scanFileForLatencyAntiPatterns('flow.handler.ts', code, false);

    // Assert
    expect(violations).toHaveLength(1);
    expect(violations[0]?.pattern).toBe('AWAITED_SET_MY_COMMANDS');
    expect(violations[0]?.pattern).not.toBe('BLOCKING_DELETE_MESSAGE');
  });

  it('passes clean verification on entire repository without latency violations', () => {
    // Arrange
    const cwd = process.cwd();

    // Act
    const result = verifyLatencyAntiPatterns(cwd);

    // Assert
    expect(result.ok).toBe(true);
    expect(result.failures).toHaveLength(0);
    expect(result.checked).toBeGreaterThan(0);
  });
});
