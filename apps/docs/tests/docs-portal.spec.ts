import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ADR_RECORDS,
  buildDocMapping,
  extractFrontmatterAndTitle,
  generateAdrDetail,
  generateAdrsIndex,
  generateLivingArchitecturePage,
  generateMigrationProgressWidget,
  generatePortalIndexPage,
  rewriteMarkdownLinks,
  runTransformPipeline,
  sanitizeHtmlTags,
  TRACK_DEFINITIONS,
} from '../../../tools/docs/transform-pipeline.js';
import { verifyDocumentationPortal } from '../../../tools/docs/verify-docs.js';

describe('Documentation Portal & AST Transform Pipeline (Plan 62)', () => {
  const root = join(__dirname, '../../..');

  it('should sanitize unescaped generic tags while preserving valid HTML and dollar tokens in code', () => {
    const raw = `
Here is a generic <T> type and <module_name> placeholder.
<div class="test">Valid Div</div>
Result<T, AppError> is used.
\`<code_tag>\` should remain untouched.
<!-- Valid HTML comment -->
\`\`\`bash
echo "$1" and "$@" and "$&"
\`\`\`
`;
    const sanitized = sanitizeHtmlTags(raw);

    expect(sanitized).toContain('&lt;T&gt;');
    expect(sanitized).toContain('&lt;module_name&gt;');
    expect(sanitized).toContain('<div class="test">Valid Div</div>');
    expect(sanitized).toContain('`<code_tag>`');
    expect(sanitized).toContain('<!-- Valid HTML comment -->');
    expect(sanitized).toContain('echo "$1" and "$@" and "$&"');
  });

  it('should rewrite relative doc links, F:\\HR references, and repository paths', () => {
    const docMap = buildDocMapping(root);
    const rawMarkdown = `
See [Baseline SSOT](00-baseline-and-ssot-charter.md) and [Architecture](docs/01-architecture-and-tempot-synergy.md#tempot-synergy).
Also check [ADR-012](docs/adrs/adr-012.md) and external [Google](https://google.com).
Reference to [F:\\HR](file:///F:/HR) and [packages/core-components](file:///F:/Alsaada-Smart-Bot/packages/core-components).
`;
    const rewritten = rewriteMarkdownLinks(rawMarkdown, docMap);

    expect(rewritten).toContain('[Baseline SSOT](/foundations/00-baseline-and-ssot-charter/)');
    expect(rewritten).toContain('[Architecture](/foundations/01-architecture-and-tempot-synergy/#tempot-synergy)');
    expect(rewritten).toContain('[ADR-012](/adrs/adr-012/)');
    expect(rewritten).toContain('[Google](https://google.com)');
    expect(rewritten).toContain('`F:\\HR`');
    expect(rewritten).toContain('https://github.com/SalehOsman/Alsaada-Smart-Bot/tree/main/packages/core-components');
  });

  it('should clean and safely truncate frontmatter descriptions without breaking links', () => {
    const rawMarkdown = `
> **المرجع الدستوري:** البند 1.6 من [AGENTS.md](/foundations/14-ai-agent-governance-and-file-rules/)، البند 1.6 من [GEMINI.md](/foundations/14-ai-agent-governance-and-file-rules/)، ودستور حفظ مصدر الحقيقة.

# عنوان الوثيقة
`;
    const { frontmatter } = extractFrontmatterAndTitle(rawMarkdown, 'عنوان افتراضي', 1);
    expect(frontmatter).not.toContain('[AGENTS.md]');
    expect(frontmatter).not.toContain('(/foundations/');
    expect(frontmatter).toContain('المرجع الدستوري: البند 1.6 من AGENTS.md');
  });

  it('should generate interactive migration widget for Doc 19', () => {
    const mockDoc19 = `
| F01.1 | 🟢 مكتمل وموثق 100% |
| F01.2 | 🟢 مكتمل وموثق 100% |
| F01.3 | 🟡 قيد التنفيذ |
`;
    const widget = generateMigrationProgressWidget(mockDoc19);
    expect(widget).toContain('مؤشر الإنجاز اللحظي لرادار الترحيل المؤسسي');
    expect(widget).toContain('progress-bar-fill');
    expect(widget).toContain('F:\\HR (Functional SSOT 100%)');
  });

  it('should generate living architecture page with turborepo mermaid graph', () => {
    const content = generateLivingArchitecturePage();
    expect(content).toContain('خريطة المعمارية الحية');
    expect(content).toContain('flowchart TD');
    expect(content).toContain('@alsaada/bot-server');
    expect(content).toContain('@alsaada/admin-dashboard');
    expect(content).toContain('@alsaada/docs');
    expect(content).toContain('@alsaada/core-components');
    expect(content).toContain('@alsaada/database');
  });

  it('should generate all 37 ADR records and master index', () => {
    expect(ADR_RECORDS.length).toBe(37);

    const indexContent = generateAdrsIndex();
    expect(indexContent).toContain('ADR-001');
    expect(indexContent).toContain('ADR-037');

    for (let i = 0; i < 37; i++) {
      const adrContent = generateAdrDetail(i);
      const expectedId = `ADR-${(i + 1).toString().padStart(3, '0')}`;
      expect(adrContent).toContain(expectedId);
      expect(adrContent).toContain('السياق والمشكلة');
      expect(adrContent).toContain('القرار المعماري المعتمد');
    }
  });

  it('should verify sanitizeHtmlTags is strictly idempotent across multiple runs', () => {
    const raw = `
# Sample Title

Here is a generic <T> type and <module_name> placeholder.
<div class="test">Valid Div</div>
Result<T, AppError> is used.
\`<code_tag>\` should remain untouched.
<!-- Valid HTML comment -->
\`\`\`bash
echo "$1" and "$@" and "$&"
\`\`\`

    \`\`\`ts
    // Indented code block
    function test<U>(x: U): U {
      return x;
    }
    \`\`\`

Paragraph after code fence.
`;
    const run1 = sanitizeHtmlTags(raw);
    const run2 = sanitizeHtmlTags(run1);
    const run3 = sanitizeHtmlTags(run2);

    expect(run1).toBe(run2);
    expect(run2).toBe(run3);
    expect(run1).toContain('&lt;T&gt;');
    expect(run1).toContain('&lt;module_name&gt;');
    expect(run1).toContain('echo "$1" and "$@" and "$&"');
    expect(run1).toContain('function test<U>(x: U): U');
  });

  it('should execute full transform pipeline and pass docs verification gate with zero errors', () => {
    // Run pipeline in non-mutating dry-run mode to verify zero drift
    const result = runTransformPipeline(root, { dryRun: true });
    expect(result.changedDocs).toBe(0);
    expect(result.errors).toHaveLength(0);

    // Verify all 5 tracks have output files
    const targetBase = join(root, 'apps', 'docs', 'src', 'content', 'docs');
    expect(existsSync(join(targetBase, 'index.md'))).toBe(true);
    expect(existsSync(join(targetBase, 'living-architecture.md'))).toBe(true);
    expect(existsSync(join(targetBase, 'adrs', 'index.md'))).toBe(true);

    for (let i = 1; i <= 37; i++) {
      const numStr = i.toString().padStart(3, '0');
      expect(existsSync(join(targetBase, 'adrs', `adr-${numStr}.md`))).toBe(true);
    }

    for (const track of TRACK_DEFINITIONS) {
      for (const docFile of track.docs) {
        const fullPath = join(targetBase, track.dir, docFile);
        expect(existsSync(fullPath)).toBe(true);
        const fileContent = readFileSync(fullPath, 'utf8');
        expect(fileContent).toContain('title:');
        expect(fileContent).toContain('sidebar:');
      }
    }

    // Run verification gate in dry-run mode
    const gateResult = verifyDocumentationPortal(root, { dryRun: true });
    expect(gateResult.success).toBe(true);
    expect(gateResult.errors).toHaveLength(0);
  });

  it('should compile and build static documentation portal with Pagefind search index', async (ctx) => {
    const isFullBuild = process.env.DOCS_FULL_BUILD === '1';
    const distDir = join(root, 'apps', 'docs', 'dist');

    if (isFullBuild) {
      process.env.ASTRO_TELEMETRY_DISABLED = '1';
      const { build } = await import('astro');
      await build({ root: join(root, 'apps/docs') });
    } else if (!existsSync(distDir)) {
      console.warn('Pre-built dist/ not found — run pnpm docs:build first');
      ctx.skip();
      return;
    }

    expect(existsSync(distDir)).toBe(true);
    expect(existsSync(join(distDir, 'index.html'))).toBe(true);
    expect(existsSync(join(distDir, 'living-architecture', 'index.html'))).toBe(true);
    expect(existsSync(join(distDir, 'adrs', 'index.html'))).toBe(true);
    expect(existsSync(join(distDir, 'pagefind', 'pagefind.js'))).toBe(true);
  }, process.env.DOCS_FULL_BUILD === '1' ? 360_000 : 15_000);
});
