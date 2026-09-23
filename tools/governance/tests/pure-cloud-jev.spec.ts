import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  compressDiffIfLarge,
  evaluateBatchParallel,
  FatalJevSystemOneError,
  loadCloudCache,
  resolveGitDiff,
  runJevAudit,
  saveCloudCache,
  selectAdaptiveQuestions,
} from '../jev-auditor.js';
import { JEV_AUDIT_CATALOG } from '../typesafe/audit-catalog.js';
import { formatSalehVerdictReport, runSalehAuditSuite, type SalehAuditReport } from '../saleh-audit-suite.js';
import {
  loadPrecedentIndex,
  queryPrecedentBySignature,
  searchPrecedents,
} from '../precedent-index.js';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

describe('Work Plan 97: Pure Cloud JEV Sentinel, Resilient Strategic Saleh Advisor, and Precedent-Indexed Token Economy', () => {
  const root = process.cwd();
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.TYPESAFE_API_KEY;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalApiKey !== undefined) {
      process.env.TYPESAFE_API_KEY = originalApiKey;
    } else {
      delete process.env.TYPESAFE_API_KEY;
    }
  });

  describe('1. Pure Cloud Enforcement & 3-Tier Exponential Backoff Retry', () => {
    it('fails fast with FatalJevSystemOneError when engine is api and TYPESAFE_API_KEY is missing', async () => {
      delete process.env.TYPESAFE_API_KEY;

      await expect(
        evaluateBatchParallel(
          { target: 'unit-test' },
          { buttonLabelErgonomics: JEV_AUDIT_CATALOG.telegramUx.buttonLabelErgonomics },
          undefined,
          'api'
        )
      ).rejects.toThrow(FatalJevSystemOneError);
    });

    it('retries 3 times on network failure and throws FatalJevSystemOneError without silent fallback', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        throw new Error('Connection refused / ECONNREFUSED');
      });

      const fastDelays = [1, 2, 4]; // Fast backoff for tests
      await expect(
        evaluateBatchParallel(
          { target: `test-retry-${Date.now()}-${Math.random()}` },
          { buttonLabelErgonomics: JEV_AUDIT_CATALOG.telegramUx.buttonLabelErgonomics },
          'test-api-key',
          'api',
          { delays: fastDelays, timeoutMs: 50, maxRetries: 3 },
          root
        )
      ).rejects.toThrow(FatalJevSystemOneError);

      expect(callCount).toBe(3);
    });

    it('recovers and returns API judgment if a transient failure succeeds on retry 2', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Transient 503 gateway timeout');
        }
        return new Response(
          JSON.stringify({
            answers: {
              buttonLabelErgonomics: {
                type: 'choice',
                choice: 'optimal',
                confidence: 0.95,
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const results = await evaluateBatchParallel(
        { target: `test-recovery-${Date.now()}-${Math.random()}` },
        { buttonLabelErgonomics: JEV_AUDIT_CATALOG.telegramUx.buttonLabelErgonomics },
        'test-api-key',
        'api',
        { delays: [1, 2, 4], timeoutMs: 50, maxRetries: 3 },
        root
      );

      expect(callCount).toBe(2);
      expect(results.buttonLabelErgonomics?.answer).toBe('optimal');
      expect(results.buttonLabelErgonomics?.source).toBe('api');
    });

    it('retains programmatic engine: heuristic offline mode without touching network', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const results = await evaluateBatchParallel(
        { code: 'const x = 1;' },
        { assertsRealDomainState: JEV_AUDIT_CATALOG.testAuthenticity.assertsRealDomainState },
        undefined,
        'heuristic'
      );

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(results.assertsRealDomainState?.source).toBe('heuristic');
    });
  });

  describe('2. Resilient Strategic /saleh Advisor & Transparent Fallback', () => {
    it('continues independent physical audit when JEV live cloud fails, without halting or failing checks', async () => {
      process.env.TYPESAFE_API_KEY = 'test-cloud-key';
      const cachePath = join(root, '.governance-cache', 'jev-cloud-cache.json');
      if (existsSync(cachePath)) {
        rmSync(cachePath, { force: true });
      }

      // Mock fetch to simulate cloud network failure
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        throw new Error('TypeSafe Cloud connection refused / ECONNREFUSED');
      });

      const report = await runSalehAuditSuite({
        guards: true,
        jev: true,
        jevEngine: 'api',
        retryOptions: { delays: [1, 2, 4], timeoutMs: 20, maxRetries: 3 },
      });

      // /saleh must NOT crash or fail due to JEV cloud outage
      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(typeof report.summary.passed).toBe('boolean');
      expect(report.checkResults.guards?.ok).toBe(true);
      expect(report.jevCloudNotice).toBeDefined();
      expect(report.jevCloudNotice).toContain('تعذر الاتصال بمحرك JEV السحابي مؤقتاً');
    });

    it('formats transparent governance notice in formatSalehVerdictReport when jevCloudNotice is present', () => {
      const mockReport: SalehAuditReport = {
        verdict: 'PASS',
        timestamp: '2026-09-23T19:00:00.000Z',
        checkedTotals: { flows: 10, files: 100, checks: 250 },
        checkResults: {},
        presentationFindings: [],
        jevCloudNotice:
          '⚠️ [ملاحظة حوكمية]: تعذر الاتصال بمحرك JEV السحابي مؤقتاً. واصل الوكيل صالح المراجعة استناداً إلى التحليل الاستراتيجي الفيزيائي المستقل.',
        summary: { passed: true, errorsCount: 0, warningsCount: 0 },
      };

      const formatted = formatSalehVerdictReport(mockReport);
      expect(formatted).toContain('### 5. JEV Permanent Co-Auditor Summary (WP 96/97)');
      expect(formatted).toContain('تعذر الاتصال بمحرك JEV السحابي مؤقتاً');
      expect(formatted).toContain('واصل الوكيل صالح المراجعة استناداً إلى التحليل الاستراتيجي الفيزيائي المستقل');
    });
  });

  describe('3. Deterministic Git Diff Base Resolution & Delta Chunking', () => {
    it('resolves deterministic git diff base and lists changed files', () => {
      const result = resolveGitDiff(root);
      expect(result).toBeDefined();
      expect(result.baseRef).toBeDefined();
      expect(Array.isArray(result.changedFiles)).toBe(true);
    });

    it('compresses large diffs > 300 lines by extracting AST structural signatures and critical deltas', () => {
      // Construct a synthetic 500-line diff with comments and repetitive lines
      const header = 'diff --git a/modules/test/src/service.ts b/modules/test/src/service.ts\n--- a/modules/test/src/service.ts\n+++ b/modules/test/src/service.ts\n@@ -1,500 +1,500 @@\n';
      const lines = [header];
      for (let i = 0; i < 400; i++) {
        lines.push(`+ // Just a comment line ${i}`);
      }
      lines.push('+ export async function processPayment(amount: number) {');
      lines.push('+   await captureFlowError(new Error("fail"), context);');
      lines.push('+   return amount;');
      lines.push('+ }');

      const fullDiff = lines.join('\n');
      expect(fullDiff.split('\n').length).toBeGreaterThan(300);

      const compression = compressDiffIfLarge(fullDiff, 300);
      expect(compression.isCompressed).toBe(true);
      expect(compression.originalLines).toBeGreaterThan(300);
      expect(compression.finalLines).toBeLessThan(compression.originalLines);
      expect(compression.compressedText).toContain('export async function processPayment');
      expect(compression.compressedText).toContain('captureFlowError');
    });

    it('leaves small diffs <= 300 lines uncompressed', () => {
      const smallDiff = '--- a/test.ts\n+++ b/test.ts\n+ const a = 1;\n';
      const compression = compressDiffIfLarge(smallDiff, 300);
      expect(compression.isCompressed).toBe(false);
      expect(compression.compressedText).toBe(smallDiff);
    });
  });

  describe('4. Dynamic Adaptive Question Routing', () => {
    it('routes 2-4 targeted questions for plans slice', () => {
      const questions = selectAdaptiveQuestions('plans', JEV_AUDIT_CATALOG);
      const keys = Object.keys(questions);
      expect(keys.length).toBeGreaterThanOrEqual(2);
      expect(keys.length).toBeLessThanOrEqual(4);
      expect(keys).toContain('planSixPillarCompleteness');
      expect(keys).toContain('skillRulebookAlignment');
    });

    it('routes 2-4 targeted questions for tests slice', () => {
      const questions = selectAdaptiveQuestions('tests', JEV_AUDIT_CATALOG);
      const keys = Object.keys(questions);
      expect(keys.length).toBeGreaterThanOrEqual(2);
      expect(keys.length).toBeLessThanOrEqual(4);
      expect(keys).toContain('assertsRealDomainState');
      expect(keys).toContain('excessiveMocking');
      expect(keys).toContain('assertionRigorScore');
    });

    it('routes 2-4 targeted questions for flows slice', () => {
      const questions = selectAdaptiveQuestions('flows', JEV_AUDIT_CATALOG);
      const keys = Object.keys(questions);
      expect(keys.length).toBeGreaterThanOrEqual(2);
      expect(keys.length).toBeLessThanOrEqual(4);
      expect(keys).toContain('buttonLabelErgonomics');
      expect(keys).toContain('usesCanonicalCaptureFlowError');
    });

    it('routes 2-4 targeted questions for architecture slice', () => {
      const questions = selectAdaptiveQuestions('arch', JEV_AUDIT_CATALOG);
      const keys = Object.keys(questions);
      expect(keys.length).toBeGreaterThanOrEqual(2);
      expect(keys.length).toBeLessThanOrEqual(4);
      expect(keys).toContain('layerResponsibilitySeparation');
      expect(keys).toContain('violatesTemporalInvariants');
    });
  });

  describe('5. SHA-256 Cloud Caching', () => {
    it('saves and reloads judgments from .governance-cache/jev-cloud-cache.json', () => {
      const testCache = loadCloudCache(root);
      const sampleKey = 'test-hash-' + Date.now();
      testCache[sampleKey] = {
        answers: {
          buttonLabelErgonomics: { type: 'choice', choice: 'optimal', confidence: 0.99 },
        },
        cachedAt: new Date().toISOString(),
      };

      saveCloudCache(testCache, root);
      const reloaded = loadCloudCache(root);
      expect(reloaded[sampleKey]).toBeDefined();
      expect(reloaded[sampleKey]?.answers?.buttonLabelErgonomics?.choice).toBe('optimal');
    });
  });

  describe('6. Zero-Token Precedent Index (.agents/knowledge/precedents/index.json)', () => {
    it('successfully loads and validates the Precedent Index schema', () => {
      const index = loadPrecedentIndex(root);
      expect(index.version).toBe('1.0.0');
      expect(index.totalPrecedents).toBeGreaterThanOrEqual(4);
      expect(index.precedents.length).toBeGreaterThanOrEqual(4);
    });

    it('resolves precedent for telegram table RTL direction in 0ms and 0 tokens', () => {
      const precedent = queryPrecedentBySignature('telegram-table-rtl-direction-alignment', root);
      expect(precedent).toBeDefined();
      expect(precedent?.verdict).toBe('cell_rtl_marks');
      expect(precedent?.constitutionalGate).toContain('G5');
      expect(precedent?.approvedResolution).toContain('Unicode RTL Isolate');
    });

    it('searches precedents by keyword with relevance ranking', () => {
      const results = searchPrecedents('financial test cleanup status column', root);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.issueSignature).toBe('ephemeral-financial-fixtures-cleanup');
      expect(results[0]?.verdict).toBe('use_canonical_status_column');
    });

    it('searches precedents by Arabic keyword query with high relevance', () => {
      const arabicResults = searchPrecedents('تنظيف الجداول المالية واختبارات قاعدة البيانات', root);
      expect(arabicResults.length).toBeGreaterThan(0);
      expect(arabicResults[0]?.id).toBe('PREC-20260923-02');
      expect(arabicResults[0]?.verdict).toBe('use_canonical_status_column');

      const rtlResults = searchPrecedents('محاذاة جداول تليجرام لليمين', root);
      expect(rtlResults.length).toBeGreaterThan(0);
      expect(rtlResults[0]?.id).toBe('PREC-20260923-01');
    });
  });

  describe('7. Cache Parity & Unstructured Diff Fallback Guards', () => {
    it('guarantees identical judgment reconciliation whether serving from cache or live API', async () => {
      const mockAnswers = {
        buttonLabelErgonomics: { type: 'choice', choice: 'optimal', confidence: 0.95 },
      };

      // 1. First call: Live API fetch (will write to cache)
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ answers: mockAnswers }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const target = `cache-parity-test-${Date.now()}`;
      const liveResult = await evaluateBatchParallel(
        { target },
        { buttonLabelErgonomics: JEV_AUDIT_CATALOG.telegramUx.buttonLabelErgonomics },
        'test-key',
        'api',
        undefined,
        root
      );

      // 2. Second call: Cache hit (fetch should not be called again)
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const cachedResult = await evaluateBatchParallel(
        { target },
        { buttonLabelErgonomics: JEV_AUDIT_CATALOG.telegramUx.buttonLabelErgonomics },
        'test-key',
        'api',
        undefined,
        root
      );

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(cachedResult.buttonLabelErgonomics?.answer).toEqual(liveResult.buttonLabelErgonomics?.answer);
      expect(cachedResult.buttonLabelErgonomics?.confidence).toEqual(liveResult.buttonLabelErgonomics?.confidence);
      expect(cachedResult.buttonLabelErgonomics?.source).toEqual(liveResult.buttonLabelErgonomics?.source);
    });

    it('retains structured head/tail fallback on large non-code JSON/data diffs > 300 lines', () => {
      const jsonLines = ['diff --git a/config.json b/config.json', '--- a/config.json', '+++ b/config.json', '@@ -1,400 +1,400 @@'];
      for (let i = 0; i < 350; i++) {
        jsonLines.push(`+  "unrelated_data_key_${i}": "raw_value_${i}",`);
      }
      const largeJsonDiff = jsonLines.join('\n');
      expect(largeJsonDiff.split('\n').length).toBeGreaterThan(300);

      const compressed = compressDiffIfLarge(largeJsonDiff, 300);
      expect(compressed.isCompressed).toBe(true);
      expect(compressed.compressedText).toContain('Fallback head/tail sample');
      expect(compressed.compressedText).toContain('unrelated_data_key_0');
      expect(compressed.compressedText).toContain('unrelated_data_key_349');
      expect(compressed.finalLines).toBeLessThan(compressed.originalLines);
    });
  });
});
