import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  JevDaemon,
  sendDaemonRequest,
  probeJevDaemon,
  type DaemonRequest,
  type DaemonResponse,
} from '../jev-daemon.js';
import { analyzeCodeWithAst, evaluateBatchParallel } from '../jev-auditor.js';
import { JEV_AUDIT_CATALOG } from '../typesafe/audit-catalog.js';

describe('JEV Persistent Cloud Daemon & Ambient Sentinel Suite (WP 109)', () => {
  const isWin = process.platform === 'win32';
  const testPipe = isWin
    ? `\\\\.\\pipe\\test-jev-daemon-${Date.now()}-${Math.floor(Math.random() * 10000)}`
    : join('/tmp', `test-jev-daemon-${Date.now()}.sock`);

  let daemon: JevDaemon | null = null;

  afterEach(async () => {
    if (daemon) {
      await daemon.stop().catch(() => {});
      daemon = null;
    }
  });

  describe('1. Daemon Lifecycle & IPC Communication', () => {
    it('starts daemon, accepts IPC connection, and responds to PING and STATUS', async () => {
      daemon = new JevDaemon({ pipeName: testPipe });
      await daemon.start();

      const isAlive = await probeJevDaemon({ pipeName: testPipe, timeoutMs: 1000 });
      expect(isAlive).toBe(true);

      const pingRes = await sendDaemonRequest(
        { id: 'test-ping', type: 'PING' },
        { pipeName: testPipe, timeoutMs: 1000 }
      );
      expect(pingRes.ok).toBe(true);
      if (pingRes.ok) {
        expect(pingRes.data?.pong).toBe(true);
      }

      const statusRes = await sendDaemonRequest(
        { id: 'test-status', type: 'STATUS' },
        { pipeName: testPipe, timeoutMs: 1000 }
      );
      expect(statusRes.ok).toBe(true);
      if (statusRes.ok) {
        expect(statusRes.data?.running).toBe(true);
        expect(statusRes.data?.pid).toBe(process.pid);
        expect(typeof statusRes.data?.uptimeSeconds).toBe('number');
      }
    });

    it('returns false gracefully when probing a non-existent daemon pipe without crashing', async () => {
      const nonExistentPipe = isWin
        ? `\\\\.\\pipe\\non-existent-jev-pipe-${Date.now()}`
        : `/tmp/non-existent-jev-${Date.now()}.sock`;

      const isAlive = await probeJevDaemon({ pipeName: nonExistentPipe, timeoutMs: 150 });
      expect(isAlive).toBe(false);
    });

    it('gracefully stops daemon and cleans up resources', async () => {
      daemon = new JevDaemon({ pipeName: testPipe });
      await daemon.start();

      expect(await probeJevDaemon({ pipeName: testPipe, timeoutMs: 500 })).toBe(true);

      const stopRes = await sendDaemonRequest(
        { id: 'test-stop', type: 'STOP' },
        { pipeName: testPipe, timeoutMs: 1500 }
      );
      expect(stopRes.ok).toBe(true);

      // Give daemon a moment to finish graceful teardown
      await new Promise((r) => setTimeout(r, 200));

      const isStillAlive = await probeJevDaemon({ pipeName: testPipe, timeoutMs: 200 });
      expect(isStillAlive).toBe(false);
      daemon = null; // already stopped
    });
  });

  describe('2. Batch Evaluation via Daemon IPC', () => {
    it('dispatches EVALUATE_BATCH over IPC and returns reconciled judgments', async () => {
      daemon = new JevDaemon({ pipeName: testPipe });
      await daemon.start();

      const questions = {
        violatesTemporalInvariants: JEV_AUDIT_CATALOG.temporalInvariantGuard.violatesTemporalInvariants,
        buttonLabelErgonomics: JEV_AUDIT_CATALOG.telegramUx.buttonLabelErgonomics,
      };

      const start = Date.now();
      const res = await sendDaemonRequest(
        {
          id: 'test-eval',
          type: 'EVALUATE_BATCH',
          payload: {
            state: {
              code: 'export const PINNED_BASE_TIME = "2026-09-25T10:00:00Z"; const btn = { text: "حفظ البيانات" };',
            },
            questions,
            apiKey: 'heuristic',
          },
        },
        { pipeName: testPipe, timeoutMs: 3000 }
      );
      const elapsed = Date.now() - start;

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toBeDefined();
        expect(res.data.violatesTemporalInvariants).toBeDefined();
        expect(res.data.buttonLabelErgonomics).toBeDefined();
      }
      expect(elapsed).toBeLessThan(1500);
    });
  });

  describe('3. Ambient Sentinel Local AST Triage (<5ms, 0 Tokens)', () => {
    it('detects button labels exceeding 16 characters in 0 tokens', () => {
      const codeWithLongBtn = `
        export const keyboard = [
          [{ text: "تأكيد طلب السلفة النقدية العاجلة", callback_data: "adv:req" }]
        ];
      `;
      const ast = analyzeCodeWithAst(codeWithLongBtn, 'flow.keyboard.ts');
      expect(ast.hasLongButtonLabel).toBe(true);
      expect(ast.maxButtonLabelLength).toBeGreaterThan(16);
    });

    it('detects raw ctx.reply bypass in 0 tokens', () => {
      const codeWithRawReply = `
        export async function handle(ctx: any) {
          await ctx.reply("مرحباً بك في البوت الذكي لنظام السعادة");
        }
      `;
      const ast = analyzeCodeWithAst(codeWithRawReply, 'flow.handler.ts');
      expect(ast.hasRawMessageBypass).toBe(true);
      expect(ast.richMessageCompliance).toBe(false);
    });

    it('detects unpinned Date.now() temporal drift in 0 tokens', () => {
      const codeWithDrift = `
        export function getPayroll() {
          const now = Date.now();
          return now;
        }
      `;
      const ast = analyzeCodeWithAst(codeWithDrift, 'flow.service.ts');
      expect(ast.violatesTemporalInvariants).toBe(true);
      expect(ast.hasUnanchoredDrift).toBe(true);
    });
  });
});
