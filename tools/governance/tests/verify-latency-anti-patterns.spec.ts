import { describe, it, expect } from 'vitest';
import {
  scanFileForLatencyAntiPatterns,
  verifyLatencyAntiPatterns,
  BYPASS_DIRECTIVE_REGEX,
} from '../verify-latency-anti-patterns.js';

describe('⚡ Zero-Regression AST Latency Anti-Patterns Governance Scanner', () => {
  it('should detect blocking await ctx.api.deleteMessage in flow handlers', () => {
    const code = `
      async function handleBadAction(ctx: any) {
        await ctx.api.deleteMessage(ctx.chat.id, 123);
      }
    `;
    const violations = scanFileForLatencyAntiPatterns('flow.handler.ts', code, false);
    expect(violations.length).toBe(1);
    expect(violations[0]?.pattern).toBe('BLOCKING_DELETE_MESSAGE');
    expect(violations[0]?.message).toContain('safeDeleteBackground');
  });

  it('should detect blocking await ctx.deleteMessage in bot-server', () => {
    const code = `
      async function handleBotAction(ctx: any) {
        await ctx.deleteMessage();
      }
    `;
    const violations = scanFileForLatencyAntiPatterns('src/handlers/start.handler.ts', code, true);
    expect(violations.length).toBe(1);
    expect(violations[0]?.pattern).toBe('BLOCKING_DELETE_MESSAGE');
  });

  it('should detect blocking await ctx.deleteMessage in business modules flow handlers', () => {
    const code = `
      async function handleFlowAction(ctx: any) {
        await ctx.deleteMessage();
      }
    `;
    const violations = scanFileForLatencyAntiPatterns('modules/settings/src/flows/00.1/flow.handler.ts', code, false);
    expect(violations.length).toBe(1);
    expect(violations[0]?.pattern).toBe('BLOCKING_DELETE_MESSAGE');
  });

  it('should allow blocking delete when accompanied by @governance-security-blocking-delete directive', () => {
    const code = `
      async function handleSensitiveOtp(ctx: any) {
        // @governance-security-blocking-delete: wipe temporary plaintext OTP before continuing
        await ctx.api.deleteMessage(ctx.chat.id, 123);
      }
    `;
    const violations = scanFileForLatencyAntiPatterns('flow.handler.ts', code, false);
    expect(violations.length).toBe(0);
  });

  it('should match bypass directive correctly via regex', () => {
    expect(BYPASS_DIRECTIVE_REGEX.test('// @governance-security-blocking-delete: security cleanup')).toBe(true);
    expect(BYPASS_DIRECTIVE_REGEX.test('//   @governance-security-blocking-delete: reason')).toBe(true);
    expect(BYPASS_DIRECTIVE_REGEX.test('// normal comment')).toBe(false);
  });

  it('should allow safe non-blocking background deletes', () => {
    const code = `
      async function handleGoodAction(ctx: any) {
        void ctx.api.deleteMessage(ctx.chat.id, 123).catch(() => {});
        safeDeleteBackground(ctx, 123);
      }
    `;
    const violations = scanFileForLatencyAntiPatterns('flow.handler.ts', code, false);
    expect(violations.length).toBe(0);
  });

  it('should detect blocking await setMyCommands in per-request handlers', () => {
    const code = `
      async function handleUserClick(ctx: any) {
        await ctx.api.setMyCommands([{ command: 'start', description: 'Start' }]);
      }
    `;
    const violations = scanFileForLatencyAntiPatterns('flow.handler.ts', code, false);
    expect(violations.length).toBe(1);
    expect(violations[0]?.pattern).toBe('AWAITED_SET_MY_COMMANDS');
  });

  it('should pass clean verification on entire repository without latency violations', () => {
    const result = verifyLatencyAntiPatterns(process.cwd());
    expect(result.ok).toBe(true);
    expect(result.failures).toHaveLength(0);
    expect(result.checked).toBeGreaterThan(0);
  });
});
