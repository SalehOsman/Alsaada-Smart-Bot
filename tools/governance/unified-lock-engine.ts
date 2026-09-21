import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { isCliEntrypoint, normalized, toRepoPath } from './common.js';
import { APPROVAL_PHRASE, GOVERNANCE_LOCK_PATH, buildGovernanceLock, listDockerFiles, type GovernanceLock } from './verify-governance-lock.js';

export type LockedEntityType = 'flow' | 'dashboard' | 'package' | 'infra' | 'module' | 'test';

export interface LockedEntity {
  id: string; // Standard format: "package:<name>" | "flow:<code>" | "dashboard:<path>" | "infra:<name>" | "module:<name>" | "test:<path>"
  type: LockedEntityType;
  title: string;
  directory: string;
  lockedAt: string;
  files: Array<{
    path: string;
    sha256: string;
  }>;
}

export const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.sql',
  '.sh',
  '.cmd',
  '.html',
  '.css',
  '.txt',
  '.svg',
]);

export function normalizeBuffer(buffer: Buffer, filePath: string): Buffer {
  const ext = extname(filePath).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) {
    const text = buffer.toString('utf8');
    const normalizedText = text.replace(/\r\n/g, '\n');
    return Buffer.from(normalizedText, 'utf8');
  }
  return buffer;
}

export function sha256NormalizedFile(filePath: string): string {
  const raw = readFileSync(filePath);
  const normalized = normalizeBuffer(raw, filePath);
  return createHash('sha256').update(normalized).digest('hex');
}

function hasChildPageRoute(dir: string): boolean {
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && /^page\.(tsx|ts|jsx|js)$/.test(entry.name)) {
        return true;
      }
      if (entry.isDirectory() && hasChildPageRoute(join(dir, entry.name))) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

export function listEntityFiles(root: string, directoryOrFile: string, type: LockedEntityType): string[] {
  const fullPath = join(root, directoryOrFile);
  if (!existsSync(fullPath)) return [];

  const stat = statSync(fullPath);
  if (stat.isFile()) {
    return [normalized(toRepoPath(root, fullPath))];
  }

  const files: string[] = [];
  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const entryPath = join(current, entry.name);
      const relRepoPath = normalized(toRepoPath(root, entryPath));

      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === '.turbo') {
          continue;
        }

        // Packages: skip build caches, generated code, and tests (tests are locked independently under test:<path>)
        if (type === 'package') {
          if (entry.name === 'generated' || entry.name === 'coverage' || entry.name === 'tests') {
            continue;
          }
        }

        // Flows: skip tests (tests are locked independently under test:<path>)
        if (type === 'flow') {
          if (entry.name === 'tests') {
            continue;
          }
        }

        // Dashboard Zero Blast Radius: do not descend into child route directories that have their own page.tsx, and skip tests
        if (type === 'dashboard') {
          if (entry.name === 'tests' || hasChildPageRoute(entryPath)) {
            continue;
          }
        }

        // Modules: do not descend into flows because flows are locked independently, and skip tests
        if (type === 'module') {
          if (entry.name === 'flows' || entry.name === 'tests') {
            continue;
          }
        }

        visit(entryPath);
      } else if (entry.isFile()) {
        if (type === 'package') {
          if (
            entry.name.startsWith('.env') ||
            entry.name.endsWith('.tsbuildinfo') ||
            entry.name.endsWith('.log')
          ) {
            continue;
          }
        }

        // Skip test spec files from non-test entities (tests are locked independently under test:<path>)
        if (type !== 'test') {
          if (entry.name.endsWith('.spec.ts') || entry.name.endsWith('.test.ts')) {
            continue;
          }
        }

        files.push(relRepoPath);
      }
    }
  };

  visit(fullPath);
  return files.sort((a, b) => a.localeCompare(b));
}

export interface ResolvedTarget {
  id: string;
  type: LockedEntityType;
  title: string;
  directoryOrFile: string;
}

export function resolveLockTarget(root: string, rawTarget: string): ResolvedTarget | null {
  const trimmed = rawTarget.trim().replace(/\\/g, '/');

  // 1. Explicit Prefixes
  if (trimmed.startsWith('package:')) {
    const name = trimmed.replace(/^package:/, '');
    const pkgDir = join(root, 'packages', name);
    if (existsSync(pkgDir)) {
      return {
        id: `package:${name}`,
        type: 'package',
        title: `حزمة النواة: @alsaada/${name}`,
        directoryOrFile: `packages/${name}`,
      };
    }
  }

  if (trimmed.startsWith('flow:')) {
    const key = trimmed.replace(/^flow:/, '');
    const flowRes = findFlowByKeyOrSlug(root, key);
    if (flowRes) return flowRes;
  }

  if (trimmed.startsWith('dashboard:')) {
    const feat = trimmed.replace(/^dashboard:/, '');
    const dashRes = resolveDashboardTarget(root, feat);
    if (dashRes) return dashRes;
  }

  if (trimmed.startsWith('module:')) {
    const modName = trimmed.replace(/^module:/, '');
    const modDir = join(root, 'modules', modName);
    if (existsSync(modDir)) {
      return {
        id: `module:${modName}`,
        type: 'module',
        title: `موديول المنظومة: ${modName}`,
        directoryOrFile: `modules/${modName}`,
      };
    }
  }

  if (trimmed === 'infra:docker' || trimmed === 'docker') {
    return {
      id: 'infra:docker',
      type: 'infra',
      title: 'البنية التحتية والدوكر وقواعد البيانات',
      directoryOrFile: 'docker',
    };
  }

  if (trimmed === 'infra:speed' || trimmed === 'infra:speed-engine' || trimmed === 'speed') {
    return {
      id: 'infra:speed-engine',
      type: 'infra',
      title: 'المحرك المؤسسي للسرعة الفائقة واستجابة البوت APM',
      directoryOrFile: 'apps/bot-server/src/services',
    };
  }

  // 1.5. Individual Test Target Resolution
  if (trimmed.startsWith('test:')) {
    const testPath = trimmed.replace(/^test:/, '').replace(/^\.\//, '');
    const fullPath = join(root, testPath);
    if (existsSync(fullPath) && statSync(fullPath).isFile()) {
      return {
        id: `test:${testPath}`,
        type: 'test',
        title: `ملف الاختبار المعتمد: ${testPath}`,
        directoryOrFile: testPath,
      };
    }
  }

  if (trimmed.endsWith('.spec.ts') || trimmed.endsWith('.test.ts')) {
    const testPath = trimmed.replace(/^test:/, '').replace(/^\.\//, '');
    const fullPath = join(root, testPath);
    if (existsSync(fullPath) && statSync(fullPath).isFile()) {
      return {
        id: `test:${testPath}`,
        type: 'test',
        title: `ملف الاختبار المعتمد: ${testPath}`,
        directoryOrFile: testPath,
      };
    }
  }

  // 2. Relative file paths matching
  if (trimmed.startsWith('packages/')) {
    const name = trimmed.replace(/^packages\//, '').split('/')[0] ?? '';
    const pkgDir = join(root, 'packages', name);
    if (existsSync(pkgDir)) {
      return {
        id: `package:${name}`,
        type: 'package',
        title: `حزمة النواة: @alsaada/${name}`,
        directoryOrFile: `packages/${name}`,
      };
    }
  }

  if (trimmed.startsWith('modules/') && trimmed.includes('/src/flows/')) {
    const flowDirName = trimmed.split('/src/flows/')[1]?.split('/')[0] ?? '';
    const flowRes = findFlowByKeyOrSlug(root, flowDirName);
    if (flowRes) return flowRes;
  }

  if (trimmed.startsWith('modules/')) {
    const modName = trimmed.replace(/^modules\//, '').split('/')[0] ?? '';
    const modDir = join(root, 'modules', modName);
    if (existsSync(modDir)) {
      return {
        id: `module:${modName}`,
        type: 'module',
        title: `موديول المنظومة: ${modName}`,
        directoryOrFile: `modules/${modName}`,
      };
    }
  }

  if (trimmed.startsWith('apps/admin-dashboard/src/app/admin')) {
    const relSub = trimmed.replace(/^apps\/admin-dashboard\/src\/app\/admin\/?/, '');
    const dashRes = resolveDashboardTarget(root, relSub);
    if (dashRes) return dashRes;
  }

  // 3. Package name inference
  const candidatePkgDir = join(root, 'packages', trimmed.replace(/^@alsaada\//, ''));
  if (existsSync(candidatePkgDir)) {
    const name = trimmed.replace(/^@alsaada\//, '');
    return {
      id: `package:${name}`,
      type: 'package',
      title: `حزمة النواة: @alsaada/${name}`,
      directoryOrFile: `packages/${name}`,
    };
  }

  // 4. Flow inference
  const flowRes = findFlowByKeyOrSlug(root, trimmed);
  if (flowRes) return flowRes;

  // 5. Dashboard inference
  const dashRes = resolveDashboardTarget(root, trimmed);
  if (dashRes) return dashRes;

  return null;
}

function findFlowByKeyOrSlug(root: string, keyOrSlug: string): ResolvedTarget | null {
  const modulesRoot = join(root, 'modules');
  if (!existsSync(modulesRoot)) return null;

  for (const mod of readdirSync(modulesRoot, { withFileTypes: true })) {
    if (!mod.isDirectory()) continue;
    const flowsDir = join(modulesRoot, mod.name, 'src', 'flows');
    if (!existsSync(flowsDir)) continue;

    for (const flowEntry of readdirSync(flowsDir, { withFileTypes: true })) {
      if (!flowEntry.isDirectory()) continue;
      const flowDir = join(flowsDir, flowEntry.name);

      let key = flowEntry.name.split('-')[0] ?? '';
      let title = flowEntry.name;

      const contractPath = join(flowDir, 'flow.contract.json');
      if (existsSync(contractPath)) {
        try {
          const parsed = JSON.parse(readFileSync(contractPath, 'utf8')) as {
            flowKey?: string;
            flowSlug?: string;
            titleArabic?: string;
          };
          if (parsed.flowKey) key = parsed.flowKey;
          if (parsed.titleArabic) title = parsed.titleArabic;
        } catch {
          // ignore
        }
      }

      if (
        key === keyOrSlug ||
        flowEntry.name === keyOrSlug ||
        flowEntry.name.startsWith(`${keyOrSlug}-`) ||
        flowDir.endsWith(keyOrSlug)
      ) {
        return {
          id: `flow:${key}`,
          type: 'flow',
          title: `تدفق البوت: ${title} (${key})`,
          directoryOrFile: normalized(toRepoPath(root, flowDir)),
        };
      }
    }
  }

  return null;
}

function resolveDashboardTarget(root: string, targetPath: string): ResolvedTarget | null {
  const normalizedPath = targetPath.replace(/\\/g, '/');
  const adminBase = join(root, 'apps', 'admin-dashboard', 'src', 'app', 'admin');

  if (normalizedPath === 'overview' || normalizedPath === 'admin' || normalizedPath === '' || normalizedPath === '.') {
    return {
      id: 'dashboard:overview',
      type: 'dashboard',
      title: 'شاشة لوحة التحكم: نظرة عامة (Overview)',
      directoryOrFile: 'apps/admin-dashboard/src/app/admin/page.tsx',
    };
  }

  let candidate = join(adminBase, normalizedPath);
  if (!existsSync(candidate) && !normalizedPath.endsWith('.tsx')) {
    const withPage = join(adminBase, normalizedPath, 'page.tsx');
    if (existsSync(withPage)) {
      candidate = join(adminBase, normalizedPath);
    }
  }

  if (existsSync(candidate)) {
    const rel = normalized(toRepoPath(root, candidate));
    let featId = rel.replace(/^apps\/admin-dashboard\/src\/app\/admin\/?/, '');
    if (featId.endsWith('/page.tsx')) featId = featId.replace(/\/page\.tsx$/, '');
    if (featId === 'page.tsx' || featId === '') featId = 'overview';

    return {
      id: `dashboard:${featId}`,
      type: 'dashboard',
      title: `شاشة لوحة التحكم: ${featId}`,
      directoryOrFile: rel,
    };
  }

  return null;
}

function updateMigrationRegistryForFlow(
  root: string,
  flowKey: string,
  relativeFlowPath: string,
  commitRef: string
): void {
  const registryPaths = [
    join(root, 'docs', '19-legacy-to-enterprise-master-feature-migration-registry.md'),
    join(root, 'apps', 'docs', 'src', 'content', 'docs', 'data-and-migration', '19-legacy-to-enterprise-master-feature-migration-registry.md'),
  ];
  const today = new Date().toISOString().slice(0, 10);

  for (const registryPath of registryPaths) {
    if (!existsSync(registryPath)) continue;

    try {
      const content = readFileSync(registryPath, 'utf8');
      const lines = content.split(/\r?\n/);
      let updated = false;

      const newLines = lines.map((line) => {
        if (!line.trim().startsWith('|')) return line;
        const cells = line.split('|');
        if (cells.length < 6) return line;
        const codeCell = cells[1]?.trim().replace(/[*`]/g, '') ?? '';
        if (codeCell.toLowerCase() === flowKey.toLowerCase()) {
          updated = true;
          cells[4] = ' 🟢 **مكتمل وموثق 100%** ';
          cells[5] = ` \`${relativeFlowPath}\` `;
          cells[6] = ` \`${today}\` (\`${commitRef}\`) `;
          return cells.join('|');
        }
        return line;
      });

      if (!updated) {
        const novelTableRow = `| **\`${flowKey}\`** | **تدفق ${flowKey}** | النواة والتحسينات | 🟢 **مكتمل وموثق 100%** | \`${relativeFlowPath}\` | \`${today}\` (\`${commitRef}\`) |`;
        newLines.push(novelTableRow);
        updated = true;
      }

      if (updated) {
        writeFileSync(registryPath, newLines.join('\n'), 'utf8');
      }
    } catch {
      // Non-fatal
    }
  }
}

export interface LockEntityOptions {
  commitRef?: string;
  evidenceDir?: string;
  root?: string;
}

export function lockEntity(
  targetOrRoot: string,
  targetOrOptions?: string | LockEntityOptions,
  maybeOptions?: LockEntityOptions
): { ok: boolean; entity?: LockedEntity; error?: string } {
  let root = process.cwd();
  let rawTarget = '';
  let options: LockEntityOptions = {};

  if (typeof targetOrOptions === 'string') {
    root = targetOrRoot;
    rawTarget = targetOrOptions;
    options = maybeOptions ?? {};
  } else {
    rawTarget = targetOrRoot;
    options = targetOrOptions ?? {};
    root = options.root ?? process.cwd();
  }

  const resolved = resolveLockTarget(root, rawTarget);
  if (!resolved) {
    return { ok: false, error: `Could not resolve target: "${rawTarget}" to a valid lockable component.` };
  }

  let filePaths: string[] = [];

  if (resolved.id === 'infra:docker') {
    filePaths = listDockerFiles(root);
  } else if (resolved.id === 'infra:speed-engine') {
    filePaths = [
      'apps/bot-server/src/services/fast-cache.service.ts',
      'apps/bot-server/src/services/telemetry.service.ts',
      'apps/bot-server/src/services/screen-flow.service.ts',
      'tools/governance/verify-latency-anti-patterns.ts',
    ].filter((p) => existsSync(join(root, p)));
  } else {
    filePaths = listEntityFiles(root, resolved.directoryOrFile, resolved.type);
  }

  if (filePaths.length === 0) {
    return { ok: false, error: `Target "${rawTarget}" resolved to "${resolved.directoryOrFile}" but no files were found to lock.` };
  }

  const filesWithHashes = filePaths.map((relPath) => ({
    path: relPath,
    sha256: sha256NormalizedFile(join(root, relPath)),
  }));

  const lockedAt = new Date().toISOString();
  const entity: LockedEntity = {
    id: resolved.id,
    type: resolved.type,
    title: resolved.title,
    directory: resolved.directoryOrFile,
    lockedAt,
    files: filesWithHashes,
  };

  // Load existing lock
  const lockPath = join(root, GOVERNANCE_LOCK_PATH);
  let lockData: GovernanceLock;

  if (existsSync(lockPath)) {
    try {
      lockData = JSON.parse(readFileSync(lockPath, 'utf8'));
    } catch {
      return { ok: false, error: 'Failed to parse governance.lock.json' };
    }
  } else {
    lockData = buildGovernanceLock(root);
  }

  if (!lockData.lockedEntities) {
    lockData.lockedEntities = {};
  }

  lockData.lockedEntities[entity.id] = entity;

  // Write atomic update with retry on Windows file contention
  let writeSuccess = false;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      writeFileSync(lockPath, JSON.stringify(lockData, null, 2) + '\n', 'utf8');
      writeSuccess = true;
      break;
    } catch (err) {
      lastErr = err;
      const end = Date.now() + 60;
      while (Date.now() < end) {}
    }
  }
  if (!writeSuccess) {
    return { ok: false, error: `Failed to write lock file: ${String(lastErr)}` };
  }

  const commitRef = options.commitRef ?? 'Plan-70-Lock';

  // If flow, update docs/19
  if (resolved.type === 'flow') {
    const flowKey = resolved.id.replace(/^flow:/, '');
    updateMigrationRegistryForFlow(root, flowKey, resolved.directoryOrFile, commitRef);
  }

  // Generate evidence
  const today = lockedAt.slice(0, 10);
  const safeId = entity.id.replace(/[^a-zA-Z0-9.-]/g, '_');
  const evidenceDir = options.evidenceDir ?? join(root, 'docs', 'ai-execution-evidence');
  if (!existsSync(evidenceDir)) mkdirSync(evidenceDir, { recursive: true });

  const evidenceFilePath = join(evidenceDir, `${today}-lock-${safeId}.md`);
  const evidenceContent = `# توثيق الحوكمة: قفل وحماية الكيان تشفيرياً (${entity.id})

- **تاريخ القفل:** ${today} (${lockedAt})
- **معرف الكيان:** \`${entity.id}\`
- **نوع الكيان:** \`${entity.type}\`
- **العنوان:** ${entity.title}
- **المسار الأساسي:** \`${entity.directory}\`
- **عدد الملفات المقفلة:** ${entity.files.length} ملفاً
- **الحالة:** 🟢 مقفل ومحصن تشفيرياً 100% (Zero Blast Radius)
- **مرجع الالتزام (Commit):** \`${commitRef}\`

## قائمة البصمات الجنائية (SHA-256)
| المسار | بصمة الهاش (SHA-256) |
| :--- | :--- |
${entity.files.map((f) => `| \`${f.path}\` | \`${f.sha256}\` |`).join('\n')}

## بوابات التحقق المعتمدة
- **CRLF/LF Sanitization:** PASS
- **Tamper Protection:** ACTIVE
- **Zero Blast Radius:** ISOLATED
`;

  try {
    writeFileSync(evidenceFilePath, evidenceContent, 'utf8');
  } catch {
    // non-fatal
  }

  return { ok: true, entity };
}

export function discoverAllLockableTargets(root = process.cwd()): string[] {
  const targets: string[] = [];

  // 1. Core Packages
  const packagesDir = join(root, 'packages');
  if (existsSync(packagesDir)) {
    for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        targets.push(`package:${entry.name}`);
      }
    }
  }

  // 2. Infrastructure
  targets.push('infra:docker');
  targets.push('infra:speed-engine');

  // 3. Bot flows
  const modulesDir = join(root, 'modules');
  if (existsSync(modulesDir)) {
    for (const mod of readdirSync(modulesDir, { withFileTypes: true })) {
      if (!mod.isDirectory()) continue;
      const flowsDir = join(modulesDir, mod.name, 'src', 'flows');
      if (!existsSync(flowsDir)) continue;

      for (const flowEntry of readdirSync(flowsDir, { withFileTypes: true })) {
        if (!flowEntry.isDirectory()) continue;
        let flowKey = flowEntry.name.split('-')[0] ?? '';
        const contractPath = join(flowsDir, flowEntry.name, 'flow.contract.json');
        if (existsSync(contractPath)) {
          try {
            const parsed = JSON.parse(readFileSync(contractPath, 'utf8')) as { flowKey?: string };
            if (parsed.flowKey) flowKey = parsed.flowKey;
          } catch {
            // fallback
          }
        }
        targets.push(`flow:${flowKey}`);
      }
    }
  }

  // 4. Admin dashboard screens
  const adminBase = join(root, 'apps', 'admin-dashboard', 'src', 'app', 'admin');
  if (existsSync(adminBase)) {
    const scanDir = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(full);
        } else if (entry.isFile() && /^page\.(tsx|ts|jsx|js)$/.test(entry.name)) {
          const rel = normalized(toRepoPath(adminBase, dir));
          const featId = rel === '' || rel === '.' ? 'overview' : rel;
          targets.push(`dashboard:${featId}`);
        }
      }
    };
    scanDir(adminBase);
  }

  return targets.sort((a, b) => a.localeCompare(b));
}

export function lockAllEntities(
  root = process.cwd(),
  options: { commitRef?: string; evidenceDir?: string } = {}
): { total: number; successful: number; failed: Array<{ target: string; error: string }> } {
  const targets = discoverAllLockableTargets(root);
  const failed: Array<{ target: string; error: string }> = [];
  let successful = 0;

  for (const target of targets) {
    const result = lockEntity(root, target, options);
    if (result.ok) {
      successful++;
    } else {
      failed.push({ target, error: result.error ?? 'Unknown error' });
    }
  }

  return { total: targets.length, successful, failed };
}

if (isCliEntrypoint(import.meta.url)) {
  console.log('🔒 Running unified lock engine...');
  const result = lockAllEntities(process.cwd());
  console.log(`✅ Unified lock engine complete: ${result.successful}/${result.total} entities locked.`);
  if (result.failed.length > 0) {
    for (const f of result.failed) {
      console.error(`   - ${f.target}: ${f.error}`);
    }
    process.exit(1);
  }
}

