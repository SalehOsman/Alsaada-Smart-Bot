import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runTransformPipeline, TRACK_DEFINITIONS } from './transform-pipeline.js';

export function verifyDocumentationPortal(
  root: string = process.cwd(),
  options: { dryRun?: boolean } = {}
): { success: boolean; errors: string[] } {
  const errors: string[] = [];
  console.log('🔍 [DOCS-VERIFY] Running Documentation Verification Gate...');

  // 1. Verify root SSOT docs existence
  const docsDir = join(root, 'docs');
  if (!existsSync(docsDir)) {
    errors.push(`SSOT docs directory missing: ${docsDir}`);
    return { success: false, errors };
  }

  let expectedCount = 0;
  for (const track of TRACK_DEFINITIONS) {
    for (const docFile of track.docs) {
      expectedCount++;
      const fullPath = join(docsDir, docFile);
      if (!existsSync(fullPath)) {
        errors.push(`Missing mandatory SSOT document: docs/${docFile}`);
      }
    }
  }

  // 2. Execute transform pipeline
  const dryRun = options.dryRun ?? false;
  try {
    const pipelineResult = runTransformPipeline(root, { dryRun });
    if (dryRun && pipelineResult.changedDocs > 0) {
      errors.push(
        `Documentation drift detected: ${pipelineResult.changedDocs} files need synchronization. Run "pnpm docs:sync".`
      );
    }
  } catch (err) {
    errors.push(`Transform pipeline execution failed: ${String(err)}`);
    return { success: false, errors };
  }

  // 3. Verify target generated files
  const targetBase = join(root, 'apps', 'docs', 'src', 'content', 'docs');
  if (!existsSync(targetBase)) {
    errors.push(`Target generated docs directory missing: ${targetBase}`);
    return { success: false, errors };
  }

  // Check portal landing page & living architecture
  if (!existsSync(join(targetBase, 'index.md'))) {
    errors.push('Missing portal landing page: apps/docs/src/content/docs/index.md');
  }
  if (!existsSync(join(targetBase, 'living-architecture.md'))) {
    errors.push('Missing living architecture page: apps/docs/src/content/docs/living-architecture.md');
  }
  if (!existsSync(join(targetBase, 'adrs', 'index.md'))) {
    errors.push('Missing ADR master register: apps/docs/src/content/docs/adrs/index.md');
  }

  // Check ADR files 001 to 037
  for (let i = 1; i <= 37; i++) {
    const numStr = i.toString().padStart(3, '0');
    const adrFile = join(targetBase, 'adrs', `adr-${numStr}.md`);
    if (!existsSync(adrFile)) {
      errors.push(`Missing ADR file: adr-${numStr}.md`);
    }
  }

  // Check track docs
  for (const track of TRACK_DEFINITIONS) {
    const trackDir = join(targetBase, track.dir);
    if (!existsSync(trackDir)) {
      errors.push(`Missing track directory: ${track.dir}`);
      continue;
    }
    for (const docFile of track.docs) {
      const docPath = join(trackDir, docFile);
      if (!existsSync(docPath)) {
        errors.push(`Missing transformed document: ${track.dir}/${docFile}`);
      }
    }
  }

  // 4. Verify Link Integrity across generated docs
  const allDocPaths: string[] = [];
  function collectFiles(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        collectFiles(full);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        allDocPaths.push(full);
      }
    }
  }
  collectFiles(targetBase);

  let checkedLinksCount = 0;
  for (const filePath of allDocPaths) {
    const content = readFileSync(filePath, 'utf8');
    const linkMatches = content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
    for (const match of linkMatches) {
      const url = match[2]?.trim() ?? '';
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:') || url.startsWith('#')) {
        continue;
      }
      checkedLinksCount++;
      const [pathPart] = url.split('#');
      if (!pathPart) continue;

      // Ensure path maps to an existing file
      const cleanPath = pathPart.replace(/^\//, '').replace(/\/$/, '');
      const possibleFile1 = join(targetBase, `${cleanPath}.md`);
      const possibleFile2 = join(targetBase, cleanPath, 'index.md');
      const possibleFile3 = join(targetBase, cleanPath);

      if (!existsSync(possibleFile1) && !existsSync(possibleFile2) && !existsSync(possibleFile3)) {
        errors.push(`[Unresolved Link] in ${filePath}: link target '${url}' does not map to any valid documentation file`);
      }
    }
  }

  console.log(`✅ [DOCS-VERIFY] Checked ${expectedCount} SSOT docs, 37 ADRs, and ${checkedLinksCount} internal links.`);

  if (errors.length > 0) {
    for (const err of errors) {
      console.error(`❌ ${err}`);
    }
    return { success: false, errors };
  }

  console.log('✅ [DOCS-VERIFY] Documentation verification passed with 0 errors.');
  return { success: true, errors: [] };
}

if (process.argv[1] && process.argv[1].includes('verify-docs')) {
  const { success } = verifyDocumentationPortal();
  if (!success) {
    process.exit(1);
  }
}
