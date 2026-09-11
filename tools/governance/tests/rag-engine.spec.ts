import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  extractFlowCodes,
  normalizeText,
  parseDocsAndBuildIndex,
  parseMarkdownSections,
  querySsotIndex,
  tokenizeText,
  verifySsotPreflight,
  type SsotIndex,
} from '../rag-engine.js';

describe('Local SSOT RAG Engine (R1 Specification)', () => {
  let fixtureDir: string;
  let cacheFile: string;

  beforeAll(() => {
    fixtureDir = join(tmpdir(), `rag-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    cacheFile = join(fixtureDir, '.cache', 'ssot-index.json');
    mkdirSync(join(fixtureDir, 'docs'), { recursive: true });
  });

  afterAll(() => {
    try {
      rmSync(fixtureDir, { recursive: true, force: true });
    } catch {
      // cleanup ignore
    }
  });

  describe('Bilingual Arabic/English Normalizer', () => {
    it('strips Arabic diacritics (tashkeel)', () => {
      const input = 'سُلفَةٌ نَقْدِيَّةٌ وَمَصْرُوفَاتٌ';
      const output = normalizeText(input);
      expect(output).toBe('سلفه نقديه ومصروفات');
    });

    it('strips Arabic tatweel (kashida)', () => {
      const input = 'ســـــلـفـة';
      const output = normalizeText(input);
      expect(output).toBe('سلفه');
    });

    it('unifies Alef variants (أ, إ, آ, ٱ -> ا)', () => {
      expect(normalizeText('إدارة')).toBe('اداره');
      expect(normalizeText('أجور')).toBe('اجور');
      expect(normalizeText('آلية')).toBe('اليه');
      expect(normalizeText('ٱستحقاق')).toBe('استحقاق');
    });

    it('unifies Teh Marbuta (ة -> ه) and Alef Maksura (ى -> ي)', () => {
      expect(normalizeText('خزينة')).toBe('خزينه');
      expect(normalizeText('مستشفى')).toBe('مستشفي');
      expect(normalizeText('إلغاء عهدة مستشفى')).toBe('الغاء عهده مستشفي');
    });

    it('converts Eastern Arabic numerals (٠-٩) to ASCII digits', () => {
      expect(normalizeText('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
      expect(normalizeText('تدفق ٠١.٤')).toBe('تدفق 01.4');
      expect(normalizeText('وثيقة رقم ١٣')).toBe('وثيقه رقم 13');
    });

    it('lowercases English and handles mixed bilingual text', () => {
      const input = 'Closed-Loop FINANCIAL Ledger & مسحوبات الكانتين';
      const output = normalizeText(input);
      expect(output).toContain('closed-loop');
      expect(output).toContain('financial');
      expect(output).toContain('ledger');
      expect(output).toContain('مسحوبات');
      expect(output).toContain('الكانتين');
    });

    it('tokenizes Arabic words with and without the "ال" definite article', () => {
      const tokens = tokenizeText(normalizeText('تسجيل السلف النقدية والمقاصة'));
      expect(tokens).toContain('السلف');
      expect(tokens).toContain('سلف');
      expect(tokens).toContain('النقديه');
      expect(tokens).toContain('نقديه');
      expect(tokens).toContain('المقاصه');
      expect(tokens).toContain('مقاصه');
    });

    it('tokenizes hyphenated codes into full code and subparts', () => {
      const tokens = tokenizeText(normalizeText('NEW-07 flow 01.4 and PLAN-13'));
      expect(tokens).toContain('new-07');
      expect(tokens).toContain('new');
      expect(tokens).toContain('07');
      expect(tokens).toContain('01.4');
      expect(tokens).toContain('01');
      expect(tokens).toContain('4');
      expect(tokens).toContain('plan-13');
      expect(tokens).toContain('plan');
      expect(tokens).toContain('13');
    });
  });

  describe('Flow Code Extraction', () => {
    it('extracts standard legacy flow codes (01.1, 01.4.D, 10.6, 01.2.A)', () => {
      const text = 'Flows: 01.1 worker creation, 01.4.D export service, 10.6 audit, and 01.2.A update.';
      const codes = extractFlowCodes(text);
      expect(codes).toContain('01.1');
      expect(codes).toContain('01.4.D');
      expect(codes).toContain('10.6');
      expect(codes).toContain('01.2.A');
    });

    it('extracts novel feature codes (NEW-01 through NEW-44)', () => {
      const text = 'Features NEW-01 (attendance), NEW-07 (corporate profile), and NEW-44 (audit).';
      const codes = extractFlowCodes(text);
      expect(codes).toContain('NEW-01');
      expect(codes).toContain('NEW-07');
      expect(codes).toContain('NEW-44');
    });

    it('extracts governance gates (G1 through G12)', () => {
      const text = 'Gates evaluated: G1, G2, G8, G11, G12 and invalid G0, G13, G99.';
      const codes = extractFlowCodes(text);
      expect(codes).toContain('G1');
      expect(codes).toContain('G2');
      expect(codes).toContain('G8');
      expect(codes).toContain('G11');
      expect(codes).toContain('G12');
      expect(codes).not.toContain('G0');
      expect(codes).not.toContain('G13');
      expect(codes).not.toContain('G99');
    });

    it('extracts work plan codes (PLAN-01 through PLAN-99)', () => {
      const text = 'Refers to PLAN-01 baseline, PLAN-12, and current PLAN-13 roadmap.';
      const codes = extractFlowCodes(text);
      expect(codes).toContain('PLAN-01');
      expect(codes).toContain('PLAN-12');
      expect(codes).toContain('PLAN-13');
    });
  });

  describe('Markdown AST Parser & Code-Fence Tracking', () => {
    it('does NOT treat headings inside code blocks as markdown headers', () => {
      const markdown = [
        '# Document Title',
        'Line 2 text',
        '```typescript',
        '# This is a comment inside code block, not a header',
        '## Another code comment',
        '```',
        '## Genuine Section 2',
        'Content of section 2',
      ].join('\n');

      const sections = parseMarkdownSections('docs/test-codeblock.md', markdown);
      const titles = sections.map((s) => s.title);
      expect(titles).toContain('Document Title');
      expect(titles).toContain('Genuine Section 2');
      expect(titles).not.toContain('This is a comment inside code block, not a header');
      expect(titles).not.toContain('Another code comment');
    });

    it('handles alternating code fences without premature termination (~~~ inside ```)', () => {
      const markdown = [
        '# Main Heading',
        '```markdown',
        'Nested example with tildes:',
        '~~~python',
        '# This should NOT become a heading',
        'print("hello")',
        '~~~',
        '# Still inside backticks fence, NOT a heading',
        '```',
        '## Legitimate Post-Fence Heading',
        'Post fence content',
      ].join('\n');

      const sections = parseMarkdownSections('docs/test-alternating-fence.md', markdown);
      const titles = sections.map((s) => s.title);
      expect(titles).toContain('Main Heading');
      expect(titles).toContain('Legitimate Post-Fence Heading');
      expect(titles).not.toContain('This should NOT become a heading');
      expect(titles).not.toContain('Still inside backticks fence, NOT a heading');
    });

    it('handles opening with tildes and nested backticks without premature termination', () => {
      const markdown = [
        '# Tilde Outer Heading',
        '~~~markdown',
        '```typescript',
        '# Nested comment inside backticks',
        '```',
        '# Still inside tilde fence',
        '~~~',
        '## Post Tilde Heading',
      ].join('\n');

      const sections = parseMarkdownSections('docs/test-tilde-outer.md', markdown);
      const titles = sections.map((s) => s.title);
      expect(titles).toContain('Tilde Outer Heading');
      expect(titles).toContain('Post Tilde Heading');
      expect(titles).not.toContain('Nested comment inside backticks');
      expect(titles).not.toContain('Still inside tilde fence');
    });

    it('computes exact 1-indexed startLine and endLine section bounds', () => {
      const markdown = [
        '# Title Level 1', // Line 1
        'Preamble line 2', // Line 2
        'Preamble line 3', // Line 3
        '## Section A (Level 2)', // Line 4
        'Content line 5', // Line 5
        '### Subsection A.1 (Level 3)', // Line 6
        'Content line 7', // Line 7
        '### Subsection A.2 (Level 3)', // Line 8
        'Content line 9', // Line 9
        '## Section B (Level 2)', // Line 10
        'Final line 11', // Line 11
      ].join('\n');

      const sections = parseMarkdownSections('docs/test-bounds.md', markdown);

      // Section A (H2 at line 4) spans until before Section B (H2 at line 10)
      const secA = sections.find((s) => s.title.includes('Section A'));
      expect(secA).toBeDefined();
      expect(secA!.startLine).toBe(4);
      expect(secA!.endLine).toBe(9);

      // Subsection A.1 (H3 at line 6) spans until before Subsection A.2 (line 8)
      const secA1 = sections.find((s) => s.title.includes('Subsection A.1'));
      expect(secA1).toBeDefined();
      expect(secA1!.startLine).toBe(6);
      expect(secA1!.endLine).toBe(7);

      // Subsection A.2 (H3 at line 8) spans until before Section B (H2, level 2 <= 3) at line 10
      const secA2 = sections.find((s) => s.title.includes('Subsection A.2'));
      expect(secA2).toBeDefined();
      expect(secA2!.startLine).toBe(8);
      expect(secA2!.endLine).toBe(9);

      // Section B (H2 at line 10) spans until EOF (line 11)
      const secB = sections.find((s) => s.title.includes('Section B'));
      expect(secB).toBeDefined();
      expect(secB!.startLine).toBe(10);
      expect(secB!.endLine).toBe(11);
    });
  });

  describe('Index Construction & Persistence', () => {
    beforeAll(() => {
      const doc13Content = [
        '# 13 - المنظومة المالية المحاسبية المغلقة وقائمة الدخل والأرباح',
        '## Closed-Loop Financial & PnL Engine',
        '### 1. نظرة عامة',
        'توثيق تدفقات 01.1 و 13.2 الخاصة بالقيود المحاسبية.',
        '## 🔄 5. المنظومة المعيارية لمسحوبات وسلف العاملين (The 3-Way Advance)',
        'قواعد السلف النقدية ومسحوبات الكانتين والمقاصة الثلاثية.',
        'تتضمن تدفق ADVANCE_CASH وتدفق 01.4 وتدفق 01.4.D وتخضع لبوابة G8 و PLAN-13.',
      ].join('\n');

      const doc16Content = [
        '# 16 - ميثاق أمان قواعد البيانات وحوكمة القيود الجنائية',
        '## Database Security & Tamper-Proof Cryptographic Ledger',
        '### 1. سلسلة الهاش الرياضية',
        'كل قيد في دفتر الأستاذ (ledger) يخضع لتشفير AES-256-GCM وبوابة G11.',
      ].join('\n');

      writeFileSync(join(fixtureDir, 'docs', '13-closed-loop-financial-and-pnl-engine.md'), doc13Content, 'utf8');
      writeFileSync(join(fixtureDir, 'docs', '16-database-security-and-tamper-proof-ledger.md'), doc16Content, 'utf8');
    });

    it('builds the index and serializes to .cache/ssot-index.json', () => {
      const index: SsotIndex = parseDocsAndBuildIndex(join(fixtureDir, 'docs'), cacheFile);

      expect(index.schemaVersion).toBe(1);
      expect(index.documentCount).toBe(2);
      expect(index.sectionCount).toBeGreaterThan(4);
      expect(existsSync(cacheFile)).toBe(true);

      const cachedRaw = readFileSync(cacheFile, 'utf8');
      const cached = JSON.parse(cachedRaw) as SsotIndex;
      expect(cached.documentCount).toBe(2);
      expect(cached.docNumberMap['13']).toBeDefined();
      expect(cached.docNumberMap['16']).toBeDefined();
      expect(cached.flowCodeMap['01.1']).toBeDefined();
      expect(cached.flowCodeMap['G8']).toBeDefined();
      expect(cached.flowCodeMap['PLAN-13']).toBeDefined();
    });
  });

  describe('Query Engine & SLA Latency (< 15ms)', () => {
    it('queries by doc number ("13") and returns doc 13 sections', () => {
      const result = querySsotIndex('13', {
        cachePath: cacheFile,
        docsDir: join(fixtureDir, 'docs'),
      });

      expect(result.found).toBe(true);
      expect(result.status).toBe('FOUND');
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0]!.section.docNumber).toBe('13');
    });

    it('queries by flow code ("01.1") and extracts corresponding section', () => {
      const result = querySsotIndex('01.1', {
        cachePath: cacheFile,
        docsDir: join(fixtureDir, 'docs'),
      });

      expect(result.found).toBe(true);
      expect(result.status).toBe('FOUND');
      expect(result.results[0]!.section.flowCodes).toContain('01.1');
    });

    it('queries by English topic ("ledger") and returns cryptographic ledger section', () => {
      const result = querySsotIndex('ledger', {
        cachePath: cacheFile,
        docsDir: join(fixtureDir, 'docs'),
      });

      expect(result.found).toBe(true);
      expect(result.status).toBe('FOUND');
      const matched = result.results.some((r) => r.section.file.includes('16-database-security'));
      expect(matched).toBe(true);
    });

    it('queries by Arabic keyword ("سلف") and returns advance section with line numbers', () => {
      const result = querySsotIndex('سلف', {
        cachePath: cacheFile,
        docsDir: join(fixtureDir, 'docs'),
      });

      expect(result.found).toBe(true);
      expect(result.status).toBe('FOUND');
      const top = result.results[0]!;
      expect(top.section.file).toContain('13-closed-loop');
      expect(top.section.startLine).toBeGreaterThan(0);
      expect(top.section.endLine).toBeGreaterThanOrEqual(top.section.startLine);
    });

    it('achieves sub-15ms retrieval latency from cached index', () => {
      const result = querySsotIndex('سلف', {
        cachePath: cacheFile,
        docsDir: join(fixtureDir, 'docs'),
      });

      expect(result.latencyMs).toBeLessThan(15);
    });

    it('queries using Eastern Arabic numerals for doc number ("١٣") and flow code ("٠١.٤")', () => {
      const docResult = querySsotIndex('١٣', {
        cachePath: cacheFile,
        docsDir: join(fixtureDir, 'docs'),
      });
      expect(docResult.found).toBe(true);
      expect(docResult.status).toBe('FOUND');
      expect(docResult.results[0]!.section.docNumber).toBe('13');

      const flowResult = querySsotIndex('٠١.٤', {
        cachePath: cacheFile,
        docsDir: join(fixtureDir, 'docs'),
      });
      expect(flowResult.found).toBe(true);
      expect(flowResult.status).toBe('FOUND');
      expect(flowResult.results[0]!.section.flowCodes).toContain('01.4');
    });
  });

  describe('Missing Knowledge Protocol (بروتوكول غياب التوثيق)', () => {
    it('returns TASK_SUSPENDED_MISSING_SSOT and found=false when 0 hits match', () => {
      const result = querySsotIndex('nonexistent_random_unregistered_feature_xyz_99', {
        cachePath: cacheFile,
        docsDir: join(fixtureDir, 'docs'),
      });

      expect(result.found).toBe(false);
      expect(result.status).toBe('TASK_SUSPENDED_MISSING_SSOT');
      expect(result.results).toHaveLength(0);
    });

    it('handles empty query strings with TASK_SUSPENDED_MISSING_SSOT', () => {
      const result = querySsotIndex('   ', {
        cachePath: cacheFile,
        docsDir: join(fixtureDir, 'docs'),
      });

      expect(result.found).toBe(false);
      expect(result.status).toBe('TASK_SUSPENDED_MISSING_SSOT');
    });
  });

  describe('SSOT Preflight Verification API (verifySsotPreflight)', () => {
    it('verifies existing documentation successfully', () => {
      const result = verifySsotPreflight('13', fixtureDir);
      expect(result.found).toBe(true);
      expect(result.status).toBe('FOUND');
    });

    it('halts and signals missing documentation on unindexed queries', () => {
      const result = verifySsotPreflight('totally_unknown_flow_code_9999', fixtureDir);
      expect(result.found).toBe(false);
      expect(result.status).toBe('TASK_SUSPENDED_MISSING_SSOT');
    });
  });

  describe('Real Repository Indexing & Verification against docs/*.md', () => {
    const repoRoot = process.cwd();
    const realDocsDir = join(repoRoot, 'docs');
    const realCachePath = join(repoRoot, '.cache', 'ssot-index.json');

    it('indexes all real repository docs/*.md (23 documents)', () => {
      const index = parseDocsAndBuildIndex(realDocsDir, realCachePath);
      expect(index.documentCount).toBeGreaterThanOrEqual(23);
      expect(index.sectionCount).toBeGreaterThan(100);
      expect(Object.keys(index.flowCodeMap).length).toBeGreaterThan(20);
      expect(Object.keys(index.invertedIndex).length).toBeGreaterThan(500);
      expect(existsSync(realCachePath)).toBe(true);
    });

    it('queries real repo for doc "13" with latency < 150ms', () => {
      // Warm-up to prime in-memory cache
      querySsotIndex('13', { cachePath: realCachePath, docsDir: realDocsDir });

      const result = querySsotIndex('13', {
        cachePath: realCachePath,
        docsDir: realDocsDir,
      });

      expect(result.found).toBe(true);
      expect(result.status).toBe('FOUND');
      expect(result.latencyMs).toBeLessThan(150);
      expect(result.results[0]!.section.file).toContain('13-closed-loop');
    });

    it('queries real repo for flow code "01.1" with latency < 150ms', () => {
      const result = querySsotIndex('01.1', {
        cachePath: realCachePath,
        docsDir: realDocsDir,
      });

      expect(result.found).toBe(true);
      expect(result.status).toBe('FOUND');
      expect(result.latencyMs).toBeLessThan(150);
    });

    it('queries real repo for Arabic keyword "سلف" with latency < 150ms', () => {
      const result = querySsotIndex('سلف', {
        cachePath: realCachePath,
        docsDir: realDocsDir,
      });

      expect(result.found).toBe(true);
      expect(result.status).toBe('FOUND');
      expect(result.latencyMs).toBeLessThan(150);
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('queries real repo for gate "G1" with latency < 150ms', () => {
      const result = querySsotIndex('G1', {
        cachePath: realCachePath,
        docsDir: realDocsDir,
      });

      expect(result.found).toBe(true);
      expect(result.status).toBe('FOUND');
      expect(result.latencyMs).toBeLessThan(150);
    });

    it('triggers Missing Knowledge Protocol on imaginary flow in real repo', () => {
      const result = querySsotIndex('nonexistent_feature_flow_code_99999', {
        cachePath: realCachePath,
        docsDir: realDocsDir,
      });

      expect(result.found).toBe(false);
      expect(result.status).toBe('TASK_SUSPENDED_MISSING_SSOT');
      expect(result.results).toHaveLength(0);
    });
  });
});
