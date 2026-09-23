import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  createResult,
  fail,
  isCliEntrypoint,
  printAndExit,
  readUtf8,
  toRepoPath,
  type VerificationResult,
} from './common.js';

export interface IncidentFrontmatter {
  incident_id?: string;
  date?: string;
  branch?: string;
  component?: string;
  severity?: string;
  category?: string;
  status?: string;
  work_plan?: string;
  affected_test?: string;
  regression_test?: string;
}

export function parseYamlFrontmatter(content: string): {
  frontmatter: IncidentFrontmatter;
  rawYaml: string;
  body: string;
} | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;

  const rawYaml = match[1] ?? '';
  const body = match[2] ?? '';
  const frontmatter: IncidentFrontmatter = {};

  for (const line of rawYaml.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim() as keyof IncidentFrontmatter;
    let val = trimmed.slice(colonIdx + 1).trim();

    if (val.startsWith('"')) {
      const closing = val.indexOf('"', 1);
      if (closing !== -1) {
        val = val.slice(1, closing);
      } else {
        val = val.slice(1);
      }
    } else if (val.startsWith("'")) {
      const closing = val.indexOf("'", 1);
      if (closing !== -1) {
        val = val.slice(1, closing);
      } else {
        val = val.slice(1);
      }
    } else {
      const commentIdx = val.indexOf('#');
      if (commentIdx !== -1) {
        val = val.slice(0, commentIdx).trim();
      }
    }

    frontmatter[key] = val;
  }

  return { frontmatter, rawYaml, body };
}

const FORBIDDEN_PLACEHOLDER_PATTERNS = [
  { pattern: /\[\s*\.\.\.\s*\]/, desc: 'Literal [...] placeholder' },
  { pattern: /\bTODO\b/i, desc: 'TODO marker' },
  { pattern: /\bTBD\b/i, desc: 'TBD marker' },
  { pattern: /\bFIXME\b/i, desc: 'FIXME marker' },
  { pattern: /\bXXX\b/, desc: 'XXX marker' },
  { pattern: /INC-YYYYMMDD-01/, desc: 'Unreplaced template incident ID' },
  { pattern: /fix\/inc-YYYYMMDD-slug/, desc: 'Unreplaced template branch name' },
  { pattern: /YYYY-MM-DD(?:\s+HH:MM:SS)?/, desc: 'Unreplaced template date/time' },
  { pattern: /\[عنوان المشكلة البرمجية بدقة وإيجاز\]/, desc: 'Template title placeholder' },
  { pattern: /\[اشرح بدقة/, desc: 'Template symptom description placeholder' },
  { pattern: /Expected:\s*\.\.\./, desc: 'Template Expected output placeholder' },
  { pattern: /Received:\s*\.\.\./, desc: 'Template Received output placeholder' },
  { pattern: /\/\/\s*أدرج المقطع البرمجي للاختبار المعني/, desc: 'Template test snippet placeholder' },
  { pattern: /\[الإجابة\s*\d*\]/, desc: 'Template 5 Whys answer placeholder' },
  { pattern: /\[الصياغة النهائية للسبب الجذري/, desc: 'Template root cause placeholder' },
  { pattern: /\[كيف كان يتصرف النظام القديم/, desc: 'Template F:\\HR comparison placeholder' },
  { pattern: /path\/to\/(?:source\.ts|test\.spec\.ts)/, desc: 'Template path placeholder' },
  { pattern: /functionName\(\)/, desc: 'Template function name placeholder' },
  { pattern: /\/\/\s*الفارق البرمجي أو الكود بعد التعديل/, desc: 'Template diff placeholder' },
  { pattern: /it\('should \.\.\.', \.\.\.\)/, desc: 'Template test case placeholder' },
  { pattern: /\[شرح مختصر لكيفية حماية السيناريو\]/, desc: 'Template test explanation placeholder' },
  { pattern: /#\s*الصق هنا مخرجات/, desc: 'Template terminal output placeholder' },
  { pattern: /Tests\s+X\s+passed\s+\(X\)/, desc: 'Template test count placeholder' },
  { pattern: /\[مقترح:/, desc: 'Template recommendation placeholder' },
  { pattern: /\[CONCURRENCY_RACE_CONDITION\s*\|/, desc: 'Template category choice comment' },
];

export function checkPlaceholders(text: string): string[] {
  const violations: string[] = [];

  for (const { pattern, desc } of FORBIDDEN_PLACEHOLDER_PATTERNS) {
    if (pattern.test(text)) {
      violations.push(desc);
    }
  }

  // Generic bracketed prompt checker: catches [اشرح...], [اكتب...], [أدخل...] etc.
  const bracketMatches = text.matchAll(/\[(?!\!|x|X|\s|REDACTED|PASS|FAIL|CONDITIONAL|REJECT|INC-)[^\]\n]+\]/g);
  for (const match of bracketMatches) {
    const inner = match[0];
    // Ignore markdown links [text](url)
    const afterMatch = text.slice((match.index ?? 0) + inner.length, (match.index ?? 0) + inner.length + 1);
    if (afterMatch === '(') continue;

    if (/اشرح|اكتب|أدخل|عنوان|الإجابة|الصياغة|مختصر|مقترح|\.\.\./.test(inner)) {
      violations.push(`Unfilled prompt bracket: "${inner}"`);
    }
  }

  return violations;
}

export function extractRepoLinks(text: string): string[] {
  const links: string[] = [];

  // Match file:/// links inside repo
  const fileUrlRegex = /file:\/\/\/(?:[A-Za-z]:)?\/?[^\)\#\`\s]*Alsaada-Smart-Bot\/([^\)\#\`\s]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = fileUrlRegex.exec(text)) !== null) {
    if (m[1]) links.push(m[1].replace(/\\/g, '/'));
  }

  // Match markdown relative links e.g. [text](packages/...)
  const mdLinkRegex = /\[[^\]]+\]\(((?:packages|modules|tools|apps|docs|\.github)\/[^\)\#\s]+)\)/g;
  while ((m = mdLinkRegex.exec(text)) !== null) {
    if (m[1]) links.push(m[1].replace(/\\/g, '/'));
  }

  return links;
}

export function verifyIncidents(root = process.cwd()): VerificationResult {
  const result = createResult();
  const incidentsDir = join(root, 'docs', 'code-incidents');

  if (!existsSync(incidentsDir)) {
    fail(result, `docs/code-incidents directory does not exist at ${incidentsDir}`);
    return result;
  }

  const entries = readdirSync(incidentsDir, { withFileTypes: true });
  const incidentFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name.toLowerCase() !== 'template.md')
    .map((e) => join(incidentsDir, e.name));

  if (incidentFiles.length === 0) {
    return result;
  }

  for (const filePath of incidentFiles) {
    result.checked += 1;
    const relPath = toRepoPath(root, filePath);
    const content = readUtf8(filePath);

    if (content.trim().length < 100) {
      fail(result, `${relPath}: File is too short or empty`);
      continue;
    }

    // 1. YAML Frontmatter Verification
    const parsed = parseYamlFrontmatter(content);
    if (!parsed) {
      fail(result, `${relPath}: Missing or malformed YAML frontmatter (must start and end with ---)`);
      continue;
    }

    const { frontmatter, body } = parsed;

    // Check required frontmatter fields
    if (!frontmatter.incident_id || !/^INC-\d{8}-[A-Za-z0-9_-]+$/.test(frontmatter.incident_id)) {
      fail(
        result,
        `${relPath}: Invalid or missing incident_id "${frontmatter.incident_id ?? ''}". Must match INC-YYYYMMDD-SLUG`,
      );
    }

    if (!frontmatter.date || !/^\d{4}-\d{2}-\d{2}$/.test(frontmatter.date)) {
      fail(result, `${relPath}: Invalid or missing date "${frontmatter.date ?? ''}". Must be YYYY-MM-DD`);
    }

    if (!frontmatter.branch || !/^(fix\/inc-|feat\/|plan\/).+/.test(frontmatter.branch)) {
      fail(
        result,
        `${relPath}: Invalid or missing branch "${frontmatter.branch ?? ''}". Must start with fix/inc- (e.g. fix/inc-YYYYMMDD-slug)`,
      );
    }

    if (!frontmatter.component || frontmatter.component.includes('[') || frontmatter.component.includes('TODO')) {
      fail(result, `${relPath}: Invalid or missing component: "${frontmatter.component ?? ''}"`);
    }

    if (!frontmatter.severity || !/^SEV-[1-4]/.test(frontmatter.severity)) {
      fail(result, `${relPath}: Invalid or missing severity "${frontmatter.severity ?? ''}". Must be SEV-1, SEV-2, SEV-3, or SEV-4`);
    }

    if (!frontmatter.category || frontmatter.category.includes('|') || frontmatter.category.includes('[')) {
      fail(result, `${relPath}: Invalid or missing category: "${frontmatter.category ?? ''}"`);
    }

    if (!frontmatter.status || frontmatter.status.includes('[')) {
      fail(result, `${relPath}: Invalid or missing status: "${frontmatter.status ?? ''}"`);
    }

    if (!frontmatter.work_plan || frontmatter.work_plan.includes('[')) {
      fail(result, `${relPath}: Invalid or missing work_plan: "${frontmatter.work_plan ?? ''}"`);
    }

    if (!frontmatter.affected_test || frontmatter.affected_test.includes('example.spec.ts')) {
      fail(result, `${relPath}: Invalid or missing affected_test: "${frontmatter.affected_test ?? ''}"`);
    } else {
      const cleanAffectedTest = frontmatter.affected_test.split('#')[0]!.trim();
      const testPath = join(root, cleanAffectedTest);
      if (!existsSync(testPath)) {
        fail(result, `${relPath}: affected_test file not found on disk: "${cleanAffectedTest}"`);
      }
    }

    if (!frontmatter.regression_test || frontmatter.regression_test.includes('example.spec.ts')) {
      fail(result, `${relPath}: Invalid or missing regression_test: "${frontmatter.regression_test ?? ''}"`);
    } else {
      const cleanRegressionTest = frontmatter.regression_test.split('#')[0]!.trim();
      const testPath = join(root, cleanRegressionTest);
      if (!existsSync(testPath)) {
        fail(result, `${relPath}: regression_test file not found on disk: "${cleanRegressionTest}"`);
      }
    }

    // 2. Mandatory 6 Sections Verification
    const section1 = /##\s*1️⃣|##\s*1\b|بطاقة وسياق الخلل|Incident Metadata/i.test(body);
    const section2 = /##\s*2️⃣|##\s*2\b|مخرجات الفشل|الأعراض|Symptoms/i.test(body);
    const section3 = /##\s*3️⃣|##\s*3\b|التحليل الجذري للسبب|5 Whys|Root Cause/i.test(body);
    const section4 = /##\s*4️⃣|##\s*4\b|تفاصيل الحل|ترخيص الكود المصدري|Resolution/i.test(body);
    const section5 = /##\s*5️⃣|##\s*5\b|التحقق|اختبار الانحدار|Regression Proof|Verification/i.test(body);
    const section6 = /##\s*6️⃣|##\s*6\b|التوصيات الوقائية|Preventive Recommendations/i.test(body);

    if (!section1) fail(result, `${relPath}: Missing mandatory Section 1 (Incident Metadata & Scope)`);
    if (!section2) fail(result, `${relPath}: Missing mandatory Section 2 (Symptoms & Error Signatures)`);
    if (!section3) fail(result, `${relPath}: Missing mandatory Section 3 (Root Cause Analysis - RCA & 5 Whys)`);
    if (!section4) fail(result, `${relPath}: Missing mandatory Section 4 (Resolution & Source Fix Authorization)`);
    if (!section5) fail(result, `${relPath}: Missing mandatory Section 5 (Verification & Permanent Regression Proof)`);
    if (!section6) fail(result, `${relPath}: Missing mandatory Section 6 (Preventive Recommendations)`);

    // 3. User Authorization Formula in Section 4
    const hasAuthorizationFormula =
      body.includes('موافق على تعديل الكود المصدري') ||
      body.includes('موافق على خطة الإصلاح') ||
      body.includes('موافق على تعديل الكود') ||
      body.includes('موافق على التعديل');

    if (!hasAuthorizationFormula) {
      fail(
        result,
        `${relPath}: Section 4 must record the untranslated user authorization formula («موافق على تعديل الكود المصدري» or «موافق على خطة الإصلاح»)`,
      );
    }

    // 4. Physical Path Existence in Body Links
    const repoLinks = extractRepoLinks(body);
    for (const link of repoLinks) {
      const cleanLink = link.split('#')[0]!.trim();
      if (!cleanLink || cleanLink.startsWith('http') || cleanLink.includes('F:/HR')) continue;
      const fullTarget = join(root, cleanLink);
      if (!existsSync(fullTarget)) {
        fail(result, `${relPath}: Referenced file link does not exist on disk: "${cleanLink}"`);
      }
    }

    // 5. Zero Unfilled Placeholders Check
    const placeholderViolations = checkPlaceholders(content);
    for (const violation of placeholderViolations) {
      fail(result, `${relPath}: Contains unfilled placeholder: ${violation}`);
    }
  }

  return result;
}

if (isCliEntrypoint(import.meta.url)) {
  const result = verifyIncidents();
  printAndExit('Defect Incidents Dossier Verifier (WP 93)', result);
}
