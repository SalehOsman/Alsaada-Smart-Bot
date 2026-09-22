import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runAgentCheck, runAgentAudit } from '../agent-dispatcher.js';

describe('Agent Dispatcher Tooling (R4 Specification)', () => {
  let fixtureDir: string;

  beforeAll(() => {
    fixtureDir = join(
      tmpdir(),
      `agent-dispatcher-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(fixtureDir, { recursive: true });
  });

  afterAll(() => {
    try {
      rmSync(fixtureDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  describe('runAgentCheck', () => {
    it(
      'executes in-process verification quickly on the workspace',
      async () => {
        const start = performance.now();
        const result = await runAgentCheck(process.cwd());
        const elapsed = performance.now() - start;

        expect(typeof result.ok).toBe('boolean');
        expect(result.checked).toBeGreaterThan(0);
        expect(Array.isArray(result.failures)).toBe(true);
        expect(Array.isArray(result.warnings)).toBe(true);
        // Ensure it finishes within reasonable SLA despite git process spawning and parallel test runner CPU load
        expect(elapsed).toBeLessThan(30000);
      },
      35000,
    );

    it(
      'validates target flow and SSOT preflight when a valid target is supplied',
      async () => {
        const result = await runAgentCheck(process.cwd(), '01.4-worker-export');
        expect(result.checked).toBeGreaterThan(10);
        const targetFailures = result.failures.filter((f) =>
          f.includes('No SSOT documentation found for target "01.4-worker-export"'),
        );
        expect(targetFailures).toHaveLength(0);
      },
      40000,
    );

    it(
      'fails SSOT preflight with TASK_SUSPENDED_MISSING_SSOT when an invalid target is supplied',
      async () => {
        const target = 'nonexistent_imaginary_flow_99999';
        const result = await runAgentCheck(process.cwd(), target);
        expect(result.ok).toBe(false);
        const preflightFailure = result.failures.find(
          (f) => f.includes(target) || f.includes('TASK_SUSPENDED_MISSING_SSOT'),
        );
        expect(preflightFailure).toBeDefined();
      },
      40000,
    );

    it(
      'fails gracefully when executed on an empty fixture directory missing governance docs',
      async () => {
        const result = await runAgentCheck(fixtureDir);
        expect(result.ok).toBe(false);
        expect(result.failures.length).toBeGreaterThan(0);
        const missingDoc = result.failures.some((f) => f.includes('Missing') || f.includes('failed'));
        expect(missingDoc).toBe(true);
      },
      30000,
    );
  });

  describe('runAgentAudit', () => {
    it(
      'aggregates checks and accepts configuration options',
      async () => {
        const result = await runAgentAudit(process.cwd(), {
          skipTypecheck: true,
          skipTests: true,
          requireEvidence: false,
          requireCleanGit: false,
        });

        expect(typeof result.ok).toBe('boolean');
        expect(result.checked).toBeGreaterThan(20);
        expect(Array.isArray(result.failures)).toBe(true);
        expect(Array.isArray(result.warnings)).toBe(true);
      },
      30000,
    );

    it(
      'fails when running in an empty fixture directory without evidence',
      async () => {
        const result = await runAgentAudit(fixtureDir, {
          skipTypecheck: true,
          skipTests: true,
          requireEvidence: true,
          requireCleanGit: false,
        });

        expect(result.ok).toBe(false);
        expect(result.failures.length).toBeGreaterThan(0);
      },
      30000,
    );
  });
});
