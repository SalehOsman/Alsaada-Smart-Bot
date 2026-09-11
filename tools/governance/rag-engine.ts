import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { isCliEntrypoint } from './common.js';

export interface SectionNode {
  id: string;
  file: string;
  docNumber: string;
  title: string;
  level: number;
  startLine: number;
  endLine: number;
  flowCodes: string[];
  topics: string[];
  contentPreview: string;
  rawContent: string;
  normalizedContent?: string | undefined;
}

export interface SsotIndex {
  schemaVersion: 1;
  generatedAt: string;
  documentCount: number;
  sectionCount: number;
  sections: SectionNode[];
  flowCodeMap: Record<string, string[]>;
  docNumberMap: Record<string, string[]>;
  invertedIndex: Record<string, string[]>;
}

export interface QueryResultItem {
  section: SectionNode;
  score: number;
  matchReasons: string[];
}

export interface QueryResult {
  query: string;
  found: boolean;
  status: 'FOUND' | 'TASK_SUSPENDED_MISSING_SSOT';
  latencyMs: number;
  results: QueryResultItem[];
}

export interface QueryOptions {
  cachePath?: string | undefined;
  docsDir?: string | undefined;
  limit?: number | undefined;
  minScore?: number | undefined;
  strict?: boolean | undefined;
}

const STOP_WORDS = new Set([
  'and', 'or', 'the', 'in', 'to', 'for', 'of', 'a', 'an', 'is', 'flow', 'code',
  'non', 'not', 'on', 'with', 'from', 'by', 'at', 'this', 'that', 'feature',
  'من', 'في', 'عن', 'على', 'إلى', 'مع', 'أو', 'و', 'كل', 'تم', 'عبر',
]);

let memoryCache: SsotIndex | undefined = undefined;
let memoryCachePath: string | undefined = undefined;

/**
 * Normalizes Arabic and English text for bilingual matching:
 * - Lowercases English characters
 * - Strips Arabic diacritics (tashkeel)
 * - Strips Tatweel (kashida)
 * - Unifies Alef variants (أ, إ, آ, ٱ -> ا)
 * - Unifies Teh Marbuta (ة -> ه)
 * - Unifies Alef Maksura (ى -> ي)
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1632 + 48))
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\u0640/g, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
    .replace(/\u0629/g, '\u0647')
    .replace(/\u0649/g, '\u064A');
}

/**
 * Tokenizes text into search terms, supporting Arabic and English identifiers,
 * hyphenated codes, and Arabic definite article ("ال") stripping.
 */
export function tokenizeText(normalizedText: string): string[] {
  if (!normalizedText) return [];
  const rawTokens = normalizedText.match(/[\p{L}\p{N}]+(?:[-_.][\p{L}\p{N}]+)*/gu) ?? [];
  const tokenSet = new Set<string>();

  for (const token of rawTokens) {
    if (token.length < 1) continue;
    tokenSet.add(token);

    // If token contains hyphens, underscores, or dots, also index constituent parts
    if (token.includes('-') || token.includes('_') || token.includes('.')) {
      const subParts = token.split(/[-_.]/).filter((p) => p.length > 0);
      for (const part of subParts) {
        tokenSet.add(part);
      }
    }

    // Arabic definite article handling: "السلف" -> "سلف", "المقاصه" -> "مقاصه"
    if (token.startsWith('ال') && token.length > 3) {
      const withoutAl = token.slice(2);
      if (withoutAl.length >= 2) {
        tokenSet.add(withoutAl);
      }
    } else if (token.startsWith('وال') && token.length > 4) {
      const withoutWaw = token.slice(1);
      tokenSet.add(withoutWaw);
      const withoutWal = token.slice(3);
      if (withoutWal.length >= 2) {
        tokenSet.add(withoutWal);
      }
    }
  }

  return Array.from(tokenSet);
}

/**
 * Extracts flow codes, novel features, governance gates, and work plan codes:
 * - Legacy flow codes: 01.1, 01.4.D, 10.6, 01.2.A
 * - Novel feature codes: NEW-01, NEW-44
 * - Governance gates: G1 through G12
 * - Work plans: PLAN-01 through PLAN-99
 */
export function extractFlowCodes(text: string): string[] {
  if (!text) return [];
  const codes = new Set<string>();

  const patterns = [
    /\b(\d{2}\.\d{1,2}(?:\.[A-Z0-9]+)?)\b/g,
    /\b(NEW-[A-Za-z0-9_-]+)\b/g,
    /\b(G[1-9]|G1[0-2])\b/g,
    /\b(PLAN-[0-9]{2})\b/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const code = match[1];
      if (code) {
        codes.add(code);
      }
    }
  }

  return Array.from(codes);
}

interface ParsedHeading {
  title: string;
  level: number;
  lineNumber: number; // 1-indexed
}

/**
 * Parses markdown into AST sections with code-fence awareness and exact line bounds.
 */
export function parseMarkdownSections(relPath: string, fileContent: string): SectionNode[] {
  const lines = fileContent.split(/\r?\n/);
  const docNumberMatch = basename(relPath).match(/^(\d{2})/);
  const docNumber = docNumberMatch ? (docNumberMatch[1] ?? '') : '';

  let activeFenceMarker: '```' | '~~~' | null = null;
  let inHtmlComment = false;
  const headings: ParsedHeading[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const fenceMatch = line.match(/^\s*(```|~~~)/);
    if (fenceMatch) {
      const marker = fenceMatch[1] as '```' | '~~~';
      if (activeFenceMarker === null) {
        activeFenceMarker = marker;
      } else if (activeFenceMarker === marker) {
        activeFenceMarker = null;
      }
      continue;
    }
    if (activeFenceMarker !== null) {
      continue;
    }

    if (inHtmlComment) {
      if (line.includes('-->')) {
        inHtmlComment = false;
      }
      continue;
    }

    if (line.includes('<!--') && !line.includes('-->')) {
      inHtmlComment = true;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const hashes = headingMatch[1] ?? '';
      const title = (headingMatch[2] ?? '').trim();
      headings.push({
        title,
        level: hashes.length,
        lineNumber: i + 1,
      });
    }
  }

  const sections: SectionNode[] = [];
  let sectionCounter = 1;

  if (headings.length === 0) {
    // Single section for files without headers
    const content = fileContent.trim();
    const codes = extractFlowCodes(content);
    const normalizedContent = normalizeText(content);
    sections.push({
      id: `${relPath}#section-1`,
      file: relPath,
      docNumber,
      title: basename(relPath, '.md'),
      level: 1,
      startLine: 1,
      endLine: Math.max(1, lines.length),
      flowCodes: codes,
      topics: tokenizeText(normalizedContent.slice(0, 500)),
      contentPreview: content.slice(0, 300).trim(),
      rawContent: content,
      normalizedContent,
    });
    return sections;
  }

  // Check for preamble before the first heading
  const firstHeading = headings[0]!;
  if (firstHeading.lineNumber > 1) {
    const preambleLines = lines.slice(0, firstHeading.lineNumber - 1);
    const preambleText = preambleLines.join('\n').trim();
    if (preambleText.length > 0) {
      const normalizedContent = normalizeText(preambleText);
      sections.push({
        id: `${relPath}#section-0`,
        file: relPath,
        docNumber,
        title: docNumber ? `Doc ${docNumber} Header` : 'Overview',
        level: 1,
        startLine: 1,
        endLine: firstHeading.lineNumber - 1,
        flowCodes: extractFlowCodes(preambleText),
        topics: tokenizeText(normalizedContent),
        contentPreview: preambleText.slice(0, 300).trim(),
        rawContent: preambleText,
        normalizedContent,
      });
    }
  }

  for (let k = 0; k < headings.length; k++) {
    const h = headings[k]!;
    const startLine = h.lineNumber;

    // Bounds: until the next heading of equal or higher level (<= h.level)
    let endLine = lines.length;
    for (let m = k + 1; m < headings.length; m++) {
      const nextHeading = headings[m]!;
      if (nextHeading.level <= h.level) {
        endLine = nextHeading.lineNumber - 1;
        break;
      }
    }

    const sectionLines = lines.slice(startLine - 1, endLine);
    const rawContent = sectionLines.join('\n');
    const flowCodes = extractFlowCodes(h.title + '\n' + rawContent);
    const normalizedTitle = normalizeText(h.title);
    const topics = tokenizeText(normalizedTitle);
    const normalizedContent = normalizeText(rawContent);

    sections.push({
      id: `${relPath}#section-${sectionCounter++}`,
      file: relPath,
      docNumber,
      title: h.title,
      level: h.level,
      startLine,
      endLine,
      flowCodes,
      topics,
      contentPreview: rawContent.slice(0, 300).trim(),
      rawContent,
      normalizedContent,
    });
  }

  return sections;
}

/**
 * Scans docs/*.md, parses AST headings & flow codes, builds inverted index,
 * and serializes the index to .cache/ssot-index.json.
 */
export function parseDocsAndBuildIndex(
  docsDir?: string | undefined,
  cachePath?: string | undefined,
): SsotIndex {
  const root = process.cwd();
  const targetDocsDir = docsDir ? resolve(root, docsDir) : join(root, 'docs');
  const targetCachePath = cachePath ? resolve(root, cachePath) : join(root, '.cache', 'ssot-index.json');

  if (!existsSync(targetDocsDir)) {
    throw new Error(`Docs directory not found: ${targetDocsDir}`);
  }

  const mdFiles: string[] = [];
  const entries = readdirSync(targetDocsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      mdFiles.push(join(targetDocsDir, entry.name));
    }
  }
  mdFiles.sort();

  const sections: SectionNode[] = [];
  const flowCodeMap: Record<string, string[]> = {};
  const docNumberMap: Record<string, string[]> = {};
  const invertedIndex: Record<string, string[]> = {};

  for (const filePath of mdFiles) {
    const fileContent = readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    const relPath = relative(root, filePath).split(sep).join('/');
    const docParsed = parseMarkdownSections(relPath, fileContent);

    for (const sec of docParsed) {
      sections.push(sec);

      // Index docNumber
      if (sec.docNumber) {
        const docList = docNumberMap[sec.docNumber] ?? [];
        docList.push(sec.id);
        docNumberMap[sec.docNumber] = docList;
      }

      // Index flowCodes
      for (const fc of sec.flowCodes) {
        const fcList = flowCodeMap[fc] ?? [];
        fcList.push(sec.id);
        flowCodeMap[fc] = fcList;

        const lower = fc.toLowerCase();
        if (lower !== fc) {
          const lowerList = flowCodeMap[lower] ?? [];
          lowerList.push(sec.id);
          flowCodeMap[lower] = lowerList;
        }
      }

      // Index tokens
      const normalizedTitle = normalizeText(sec.title);
      const normalizedContent = normalizeText(sec.rawContent);
      const tokens = new Set([
        ...tokenizeText(normalizedTitle),
        ...tokenizeText(normalizedContent),
      ]);

      for (const token of tokens) {
        const tokenList = invertedIndex[token] ?? [];
        tokenList.push(sec.id);
        invertedIndex[token] = tokenList;
      }
    }
  }

  const index: SsotIndex = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    documentCount: mdFiles.length,
    sectionCount: sections.length,
    sections,
    flowCodeMap,
    docNumberMap,
    invertedIndex,
  };

  const cacheDir = dirname(targetCachePath);
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }
  writeFileSync(targetCachePath, JSON.stringify(index, null, 2), 'utf8');

  memoryCache = index;
  memoryCachePath = targetCachePath;

  return index;
}

/**
 * Queries the cached SSOT index with sub-15ms retrieval latency.
 * Returns TASK_SUSPENDED_MISSING_SSOT if zero matches are found.
 */
export function querySsotIndex(
  query: string,
  options?: QueryOptions | undefined,
): QueryResult {
  const start = performance.now();
  const root = process.cwd();
  const targetCachePath = options?.cachePath ? resolve(root, options.cachePath) : join(root, '.cache', 'ssot-index.json');
  const targetDocsDir = options?.docsDir ? resolve(root, options.docsDir) : join(root, 'docs');

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return {
      query,
      found: false,
      status: 'TASK_SUSPENDED_MISSING_SSOT',
      latencyMs: performance.now() - start,
      results: [],
    };
  }

  // Load index from memory or disk cache
  let index: SsotIndex;
  if (memoryCache && memoryCachePath === targetCachePath) {
    index = memoryCache;
  } else if (existsSync(targetCachePath)) {
    try {
      const jsonText = readFileSync(targetCachePath, 'utf8');
      index = JSON.parse(jsonText) as SsotIndex;
      memoryCache = index;
      memoryCachePath = targetCachePath;
    } catch {
      index = parseDocsAndBuildIndex(targetDocsDir, targetCachePath);
    }
  } else {
    index = parseDocsAndBuildIndex(targetDocsDir, targetCachePath);
  }

  const normalizedQuery = normalizeText(trimmedQuery);
  const queryTokens = tokenizeText(normalizedQuery);
  const extractedCodes = extractFlowCodes(trimmedQuery);

  const sectionMap = new Map<string, SectionNode>();
  for (const sec of index.sections) {
    sectionMap.set(sec.id, sec);
  }

  const scores = new Map<string, { score: number; reasons: Set<string> }>();

  function addScore(secId: string, delta: number, reason: string): void {
    const current = scores.get(secId) ?? { score: 0, reasons: new Set<string>() };
    current.score += delta;
    current.reasons.add(reason);
    scores.set(secId, current);
  }

  // 1. Doc Number direct lookup: "13", "00", "docs/13"
  const docNumMatch = trimmedQuery.match(/^(?:docs\/)?(\d{2})(?:[.-].*)?$/i);
  if (docNumMatch) {
    const docNum = docNumMatch[1] ?? '';
    const secIds = index.docNumberMap[docNum];
    if (secIds) {
      for (const secId of secIds) {
        addScore(secId, 100, `doc-number:${docNum}`);
      }
    }
  }

  // 2. Flow Code exact lookup
  const flowCodeCandidates = new Set<string>([
    trimmedQuery,
    ...extractedCodes,
  ]);

  for (const candidate of flowCodeCandidates) {
    const secIds = index.flowCodeMap[candidate] ?? index.flowCodeMap[candidate.toLowerCase()];
    if (secIds) {
      for (const secId of secIds) {
        addScore(secId, 150, `flow-code:${candidate}`);
      }
    }
  }

  // 3. Inverted Index token lookup
  for (const token of queryTokens) {
    const isStopWord = STOP_WORDS.has(token);
    const weight = isStopWord ? 3 : 25;
    const secIds = index.invertedIndex[token];
    if (secIds) {
      for (const secId of secIds) {
        addScore(secId, weight, isStopWord ? `stop-word:${token}` : `token:${token}`);
      }
    }
  }

  // 4. Title and content matches
  for (const sec of index.sections) {
    const normTitle = normalizeText(sec.title);
    if (normTitle === normalizedQuery) {
      addScore(sec.id, 120, 'exact-title-match');
    } else if (normTitle.includes(normalizedQuery)) {
      addScore(sec.id, 60, 'partial-title-match');
    }

    let titleTokenHits = 0;
    for (const qToken of queryTokens) {
      if (!STOP_WORDS.has(qToken) && normTitle.includes(qToken)) {
        titleTokenHits++;
      }
    }
    if (titleTokenHits > 0) {
      addScore(sec.id, titleTokenHits * 25, `title-tokens:${titleTokenHits}`);
    }

    if (normalizedQuery.length >= 3) {
      const contentToMatch = sec.normalizedContent ?? normalizeText(sec.rawContent);
      if (contentToMatch.includes(normalizedQuery)) {
        addScore(sec.id, 30, 'content-phrase-match');
      }
    }
  }

  const scoredItems: QueryResultItem[] = [];
  const minScore = options?.minScore ?? 20;
  const limit = options?.limit ?? 5;

  for (const [secId, entry] of scores.entries()) {
    if (entry.score >= minScore) {
      const section = sectionMap.get(secId);
      if (section) {
        scoredItems.push({
          section,
          score: entry.score,
          matchReasons: Array.from(entry.reasons),
        });
      }
    }
  }

  scoredItems.sort((a, b) => b.score - a.score);
  const finalResults = scoredItems.slice(0, limit);
  const latencyMs = performance.now() - start;

  if (finalResults.length === 0) {
    return {
      query,
      found: false,
      status: 'TASK_SUSPENDED_MISSING_SSOT',
      latencyMs,
      results: [],
    };
  }

  return {
    query,
    found: true,
    status: 'FOUND',
    latencyMs,
    results: finalResults,
  };
}

/**
 * Pre-flight verification helper for tooling and pre-commit hooks.
 */
export function verifySsotPreflight(
  query: string,
  root?: string | undefined,
): QueryResult {
  const currentRoot = root ?? process.cwd();
  const docsDir = join(currentRoot, 'docs');
  const cachePath = join(currentRoot, '.cache', 'ssot-index.json');
  return querySsotIndex(query, { docsDir, cachePath });
}

function runCli(): void {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  if (!command || command === '--help' || command === '-h') {
    console.log(`SSOT RAG Engine CLI
Usage:
  tsx tools/governance/rag-engine.ts index [docsDir] [cachePath]
  tsx tools/governance/rag-engine.ts query <topic|flow-code|docNumber|keyword>
  tsx tools/governance/rag-engine.ts <query-term>
`);
    process.exit(0);
  }

  if (command === 'index') {
    const docsDir = args[1];
    const cachePath = args[2];
    const start = performance.now();
    const index = parseDocsAndBuildIndex(docsDir, cachePath);
    const elapsed = (performance.now() - start).toFixed(2);
    console.log(`[SSOT Indexer] Generated index in ${elapsed}ms:`);
    console.log(`- Documents indexed: ${index.documentCount}`);
    console.log(`- Sections indexed: ${index.sectionCount}`);
    console.log(`- Flow codes mapped: ${Object.keys(index.flowCodeMap).length}`);
    console.log(`- Inverted tokens: ${Object.keys(index.invertedIndex).length}`);
    process.exit(0);
  }

  const queryTerm = command === 'query' ? args.slice(1).join(' ') : args.join(' ');
  if (!queryTerm.trim()) {
    console.error('Error: query term cannot be empty.');
    process.exit(1);
  }

  const result = querySsotIndex(queryTerm);
  if (!result.found) {
    console.log(`
================================================================================
 [DOCS_MISSING] SSOT Documentation Not Found
 Query: "${result.query}" | Latency: ${result.latencyMs.toFixed(2)}ms
 Status: ${result.status}
================================================================================

🚫 ZERO-HALLUCINATION POLICY TRIGGERED:
No authoritative SSOT documentation exists for the requested query.
In accordance with Al-Saada Enterprise Architecture Charter & GEMINI.md,
agents and developers are STRICTLY PROHIBITED from guessing, inventing,
or generating implementation code without ratified documentation.

Current Task Status: TASK_SUSPENDED_MISSING_SSOT

Mandatory Escalation Protocol (Missing Knowledge Protocol / بروتوكول غياب التوثيق):
  1. Chief Arbitrator is alerted of the documentation gap.
  2. Legacy Parity Inspector inspects F:\\HR, extracts legacy business logic,
     and prepares a draft for docs/*.md.
  3. Documentation-Driven Development (DDD):
     - The user/project manager reviews and approves the draft in docs/.
     - Run \`pnpm ssot:sync\` to regenerate the SSOT index.
  4. The implementing agent may then resume coding.

================================================================================
`);
    process.exit(2);
  }

  console.log(`
================================================================================
 SSOT RAG Engine — Results
 Query: "${result.query}" | Latency: ${result.latencyMs.toFixed(2)}ms | Matches: ${result.results.length}
================================================================================
`);

  for (let i = 0; i < result.results.length; i++) {
    const item = result.results[i]!;
    console.log(`[SSOT Match ${i + 1}] ${item.section.file} (Lines ${item.section.startLine}-${item.section.endLine})`);
    console.log(`Section: ${item.section.title}`);
    console.log(`Score: ${item.score} | Reasons: [${item.matchReasons.join(', ')}]`);
    if (item.section.flowCodes.length > 0) {
      console.log(`Flow Codes: ${item.section.flowCodes.join(', ')}`);
    }
    console.log('--------------------------------------------------------------------------------');
    console.log(item.section.contentPreview);
    console.log('--------------------------------------------------------------------------------\n');
  }

  process.exit(0);
}

if (isCliEntrypoint(import.meta.url)) {
  runCli();
}
