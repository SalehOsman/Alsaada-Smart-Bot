import { existsSync, readFileSync, statSync } from 'node:fs';
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

  it('sanitizes unescaped generic tags to HTML entities while preserving valid HTML elements, inline code tags, and shell tokens', () => {
    // Arrange
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

    // Act
    const sanitized = sanitizeHtmlTags(raw);

    // Assert
    expect(sanitized).toContain('&lt;T&gt;');
    expect(sanitized).toContain('&lt;module_name&gt;');
    expect(sanitized).toContain('<div class="test">Valid Div</div>');
    expect(sanitized).toContain('`<code_tag>`');
    expect(sanitized).toContain('<!-- Valid HTML comment -->');
    expect(sanitized).toContain('echo "$1" and "$@" and "$&"');
    // Negative assertions — unescaped generic placeholders must be completely eliminated
    expect(sanitized).not.toContain('<T>');
    expect(sanitized).not.toContain('<module_name>');
  });

  it('rewrites relative doc links, legacy file references, and internal repository paths to portal routes and GitHub tree URLs', () => {
    // Arrange
    const docMap = buildDocMapping(root);
    const rawMarkdown = `
See [Baseline SSOT](00-baseline-and-ssot-charter.md) and [Architecture](docs/01-architecture-and-tempot-synergy.md#tempot-synergy).
Also check [ADR-012](docs/adrs/adr-012.md) and external [Google](https://google.com).
Reference to [F:\\HR](file:///F:/HR) and [packages/core-components](file:///F:/Alsaada-Smart-Bot/packages/core-components).
`;

    // Act
    const rewritten = rewriteMarkdownLinks(rawMarkdown, docMap);

    // Assert
    expect(rewritten).toContain('[Baseline SSOT](/foundations/00-baseline-and-ssot-charter/)');
    expect(rewritten).toContain('[Architecture](/foundations/01-architecture-and-tempot-synergy/#tempot-synergy)');
    expect(rewritten).toContain('[ADR-012](/adrs/adr-012/)');
    expect(rewritten).toContain('[Google](https://google.com)');
    expect(rewritten).toContain('`F:\\HR`');
    expect(rewritten).toContain('https://github.com/SalehOsman/Alsaada-Smart-Bot/tree/main/packages/core-components');
    // Negative assertions — raw legacy relative paths and file:/// URI schemes must not persist
    expect(rewritten).not.toContain('00-baseline-and-ssot-charter.md');
    expect(rewritten).not.toContain('docs/01-architecture-and-tempot-synergy.md');
    expect(rewritten).not.toContain('docs/adrs/adr-012.md');
    expect(rewritten).not.toContain('file:///F:/HR');
    expect(rewritten).not.toContain('file:///F:/Alsaada-Smart-Bot');
  });

  it('strips markdown link syntax from blockquote text when extracting clean frontmatter description and document metadata', () => {
    // Arrange
    const rawMarkdown = `
> **المرجع الدستوري:** البند 1.6 من [AGENTS.md](/foundations/14-ai-agent-governance-and-file-rules/)، البند 1.6 من [GEMINI.md](/foundations/14-ai-agent-governance-and-file-rules/)، ودستور حفظ مصدر الحقيقة.

# عنوان الوثيقة
`;

    // Act
    const { frontmatter, body } = extractFrontmatterAndTitle(rawMarkdown, 'عنوان افتراضي', 1);

    // Assert
    expect(frontmatter).not.toContain('[AGENTS.md]');
    expect(frontmatter).not.toContain('(/foundations/');
    expect(frontmatter).toContain('المرجع الدستوري: البند 1.6 من AGENTS.md');
    expect(frontmatter).toContain('title: "عنوان الوثيقة"');
    expect(frontmatter).toContain('sidebar:');
    expect(body).toContain('# عنوان الوثيقة');
  });

  it('generates interactive migration radar progress widget with completion metrics from markdown feature status table', () => {
    // Arrange
    const mockDoc19 = `
| F01.1 | 🟢 مكتمل وموثق 100% |
| F01.2 | 🟢 مكتمل وموثق 100% |
| F01.3 | 🟡 قيد التنفيذ |
`;

    // Act
    const widget = generateMigrationProgressWidget(mockDoc19);

    // Assert
    expect(widget).toContain('مؤشر الإنجاز اللحظي لرادار الترحيل المؤسسي');
    expect(widget).toContain('progress-bar-fill');
    expect(widget).toContain('F:\\HR (Functional SSOT 100%)');
    // Mathematical & metric accuracy assertions (2 implemented of 126 = 2%, 1 in progress)
    expect(widget).toContain('2 من 126 (2%)');
    expect(widget).toContain('style="width: 2%;"');
    expect(widget).toContain('🟢 المكتمل والمعتمد: <strong>2</strong>');
    expect(widget).toContain('🟡 قيد التنفيذ: <strong>1</strong>');
    // Negative assertions — no unparsed variables or NaN arithmetic
    expect(widget).not.toContain('NaN%');
    expect(widget).not.toContain('undefined');
  });

  it('generates interactive portal splash index page with all six strategic navigation cards and hero action buttons', () => {
    // Arrange
    const expectedTracks = [
      'الأسس والميثاق التأسيسي',
      'المعمارية وحزم النواة',
      'المالية والحوكمة والرقابة',
      'قواعد البيانات ورادار الترحيل',
      'تجربة مستخدم البوت (Telegram UX)',
      'السجلات المعمارية المعتمدة (ADRs)',
    ];

    // Act
    const portalIndex = generatePortalIndexPage();

    // Assert
    expect(portalIndex).toContain('title: "منظومة السعادة سمارت بوت"');
    expect(portalIndex).toContain('template: splash');
    expect(portalIndex).toContain('@astrojs/starlight/components');
    expect(portalIndex).toContain('المسارات الاستراتيجية الستة للمنظومة');
    for (const track of expectedTracks) {
      expect(portalIndex).toContain(track);
    }
    // Hero navigation actions verification
    expect(portalIndex).toContain('ابدأ استعراض الأسس والميثاق');
    expect(portalIndex).toContain('/foundations/00-baseline-and-ssot-charter/');
    expect(portalIndex).toContain('خريطة المعمارية الحية');
    expect(portalIndex).toContain('/living-architecture/');
    // Negative assertions
    expect(portalIndex).not.toContain('undefined');
    expect(portalIndex).not.toContain('[object Object]');
  });

  it('generates living architecture page with turborepo mermaid dependency graph containing monorepo apps and core packages', () => {
    // Arrange
    const expectedApps = ['@alsaada/bot-server', '@alsaada/admin-dashboard', '@alsaada/docs'];
    const expectedPackages = ['@alsaada/core-components', '@alsaada/database'];

    // Act
    const content = generateLivingArchitecturePage();

    // Assert
    expect(content).toContain('خريطة المعمارية الحية');
    expect(content).toContain('flowchart TD');
    expect(content).toContain('subgraph Apps');
    expect(content).toContain('subgraph Modules');
    expect(content).toContain('subgraph CoreEngines');
    expect(content).toContain('subgraph DataLayer');
    for (const app of expectedApps) {
      expect(content).toContain(app);
    }
    for (const pkg of expectedPackages) {
      expect(content).toContain(pkg);
    }
    // Negative assertion
    expect(content).not.toContain('undefined');
  });

  it('generates complete set of 37 architectural decision records and master index containing mandatory architectural sections', () => {
    // Arrange
    const expectedTotal = 37;

    // Act
    const indexContent = generateAdrsIndex();

    // Assert
    expect(ADR_RECORDS.length).toBe(expectedTotal);
    expect(indexContent).toContain('title: "سجل القرارات المعمارية المعتمدة (Master ADR Register)"');
    expect(indexContent).toContain('ADR-001');
    expect(indexContent).toContain('ADR-037');
    // Negative assertions — strict index boundary checking
    expect(indexContent).not.toContain('ADR-000');
    expect(indexContent).not.toContain('ADR-038');

    for (let i = 0; i < expectedTotal; i++) {
      const adrContent = generateAdrDetail(i);
      const expectedId = `ADR-${(i + 1).toString().padStart(3, '0')}`;
      expect(adrContent).toContain(expectedId);
      expect(adrContent).toContain('السياق والمشكلة');
      expect(adrContent).toContain('القرار المعماري المعتمد');
    }
  });

  it('maintains strict transformation idempotency when sanitizeHtmlTags processes complex markdown blocks repeatedly', () => {
    // Arrange
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

    // Act
    const run1 = sanitizeHtmlTags(raw);
    const run2 = sanitizeHtmlTags(run1);
    const run3 = sanitizeHtmlTags(run2);

    // Assert
    expect(run1).toBe(run2);
    expect(run2).toBe(run3);
    expect(run1).toContain('&lt;T&gt;');
    expect(run1).toContain('&lt;module_name&gt;');
    expect(run1).toContain('echo "$1" and "$@" and "$&"');
    expect(run1).toContain('function test<U>(x: U): U');
    // Negative assertions
    expect(run1).not.toContain('<T>');
    expect(run1).not.toContain('<module_name>');
  });

  it('executes documentation transform pipeline in dry-run mode and verifies zero drift across all track documents and verification gate', () => {
    // Arrange
    const targetBase = join(root, 'apps', 'docs', 'src', 'content', 'docs');

    // Act
    const result = runTransformPipeline(root, { dryRun: true });
    const gateResult = verifyDocumentationPortal(root, { dryRun: true });

    // Assert
    expect(result.changedDocs).toBe(0);
    expect(result.errors).toHaveLength(0);
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

    expect(gateResult.success).toBe(true);
    expect(gateResult.errors).toHaveLength(0);
  });

  it('verifies static documentation portal build configuration, Starlight framework integration contracts, and package build scripts', () => {
    // Arrange
    const docsRoot = join(root, 'apps', 'docs');
    const astroConfigFile = join(docsRoot, 'astro.config.mjs');
    const packageJsonFile = join(docsRoot, 'package.json');
    const customCssFile = join(docsRoot, 'src', 'styles', 'custom.css');
    const headComponentFile = join(docsRoot, 'src', 'components', 'Head.astro');

    // Act
    const configExists = existsSync(astroConfigFile);
    const configContent = configExists ? readFileSync(astroConfigFile, 'utf8') : '';
    const docsPkg = JSON.parse(readFileSync(packageJsonFile, 'utf8'));

    // Assert — Build configuration and Starlight framework integration
    expect(configExists).toBe(true);
    expect(configContent).toContain('@astrojs/starlight');
    expect(configContent).toContain("site: 'https://docs.alsaada.internal'");
    expect(configContent).toContain("dir: 'rtl'");
    expect(configContent).toContain("dir: 'ltr'");
    expect(configContent).toContain("lang: 'ar'");
    expect(configContent).toContain("lang: 'en'");
    expect(configContent).toContain("Head: './src/components/Head.astro'");
    expect(configContent).toContain("customCss: ['./src/styles/custom.css']");
    expect(configContent).toContain("directory: 'foundations'");
    expect(configContent).toContain("directory: 'core-architecture'");
    expect(configContent).toContain("directory: 'financial-and-governance'");
    expect(configContent).toContain("directory: 'data-and-migration'");
    expect(configContent).toContain("directory: 'telegram-ux'");
    expect(configContent).toContain("directory: 'adrs'");

    // Assert — Component and style assets physical existence
    expect(existsSync(customCssFile)).toBe(true);
    expect(statSync(customCssFile).size).toBeGreaterThan(0);
    expect(existsSync(headComponentFile)).toBe(true);
    expect(statSync(headComponentFile).size).toBeGreaterThan(0);

    // Assert — Package scripts and dependencies
    expect(docsPkg.scripts.build).toBe('astro build');
    expect(docsPkg.scripts.prebuild).toContain('transform-pipeline.ts');
    expect(docsPkg.dependencies['@astrojs/starlight']).toBeDefined();
    expect(docsPkg.dependencies['astro']).toBeDefined();

    // Negative assertions
    expect(docsPkg.scripts.build).not.toBe('');
    expect(configContent).not.toContain('unmanaged');
  });

  const distDir = join(root, 'apps', 'docs', 'dist');
  const distExists = existsSync(distDir);

  it.runIf(distExists)('verifies pre-compiled documentation portal distribution assets and Pagefind search index integrity', () => {
    // Arrange
    const indexHtmlPath = join(distDir, 'index.html');
    const archHtmlPath = join(distDir, 'living-architecture', 'index.html');
    const adrsHtmlPath = join(distDir, 'adrs', 'index.html');
    const pagefindJsPath = join(distDir, 'pagefind', 'pagefind.js');

    // Act
    const indexHtml = readFileSync(indexHtmlPath, 'utf8');
    const pagefindJs = readFileSync(pagefindJsPath, 'utf8');

    // Assert — Main landing and track HTML pages
    expect(existsSync(indexHtmlPath)).toBe(true);
    expect(statSync(indexHtmlPath).size).toBeGreaterThan(1000);
    expect(indexHtml).toContain('<!DOCTYPE html>');
    expect(indexHtml).toContain('منظومة السعادة سمارت بوت');

    expect(existsSync(archHtmlPath)).toBe(true);
    expect(statSync(archHtmlPath).size).toBeGreaterThan(1000);

    expect(existsSync(adrsHtmlPath)).toBe(true);
    expect(statSync(adrsHtmlPath).size).toBeGreaterThan(1000);

    // Assert — Pagefind static search engine bundle
    expect(existsSync(pagefindJsPath)).toBe(true);
    expect(statSync(pagefindJsPath).size).toBeGreaterThan(1000);
    expect(pagefindJs).toContain('pagefind');

    // Negative assertions — no build error traces or empty documents
    expect(indexHtml).not.toContain('UnhandledPromiseRejection');
    expect(indexHtml).not.toContain('Internal Server Error');
  });
});
