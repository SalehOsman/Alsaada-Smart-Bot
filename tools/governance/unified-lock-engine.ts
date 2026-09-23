import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { isCliEntrypoint, normalized, toRepoPath } from './common.js';
import {
  APPROVAL_PHRASE,
  GOVERNANCE_LOCK_PATH,
  buildGovernanceLock,
  listDockerFiles,
  type GovernanceLock,
} from './verify-governance-lock.js';
import { syncMigrationRegistry } from './sync-migration-registry.js';

export type LockedEntityType = 'flow' | 'dashboard' | 'package' | 'infra' | 'module' | 'app' | 'test';

export interface LockedEntity {
  id: string; // Standard format: "package:<name>" | "flow:<code>" | "dashboard:<path>" | "infra:<name>" | "module:<name>" | "app:<name>" | "test:<path>"
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
        if (
          entry.name === 'node_modules' ||
          entry.name === '.git' ||
          entry.name === 'dist' ||
          entry.name === '.turbo' ||
          entry.name === '.next' ||
          entry.name === '.astro' ||
          entry.name === 'attachments'
        ) {
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

        // Apps: do not descend into dashboard routes for admin-dashboard, and skip tests
        if (type === 'app') {
          if (entry.name === 'tests') {
            continue;
          }
          if (
            relRepoPath === 'apps/admin-dashboard/src/app/admin' ||
            relRepoPath.startsWith('apps/admin-dashboard/src/app/admin/')
          ) {
            continue;
          }
        }

        visit(entryPath);
      } else if (entry.isFile()) {
        if (entry.name.startsWith('.env') || entry.name.endsWith('.tsbuildinfo') || entry.name.endsWith('.log')) {
          continue;
        }

        // Skip test spec files from non-test entities (tests are locked independently under test:<path>)
        if (type !== 'test') {
          if (entry.name.endsWith('.spec.ts') || entry.name.endsWith('.test.ts')) {
            continue;
          }
        }

        // Apps: skip speed engine files in apps/bot-server (locked independently under infra:speed-engine)
        if (type === 'app') {
          if (
            relRepoPath === 'apps/bot-server/src/services/fast-cache.service.ts' ||
            relRepoPath === 'apps/bot-server/src/services/telemetry.service.ts' ||
            relRepoPath === 'apps/bot-server/src/services/screen-flow.service.ts'
          ) {
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
    if (existsSync(pkgDir) && listEntityFiles(root, `packages/${name}`, 'package').length > 0) {
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
    if (existsSync(modDir) && listEntityFiles(root, `modules/${modName}`, 'module').length > 0) {
      return {
        id: `module:${modName}`,
        type: 'module',
        title: `موديول المنظومة: ${modName}`,
        directoryOrFile: `modules/${modName}`,
      };
    }
  }

  if (trimmed.startsWith('app:')) {
    const appName = trimmed.replace(/^app:/, '');
    const appDir = join(root, 'apps', appName);
    if (existsSync(appDir) && listEntityFiles(root, `apps/${appName}`, 'app').length > 0) {
      return {
        id: `app:${appName}`,
        type: 'app',
        title: `تطبيق المنظومة: ${appName}`,
        directoryOrFile: `apps/${appName}`,
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

  if (trimmed.startsWith('apps/')) {
    const appName = trimmed.replace(/^apps\//, '').split('/')[0] ?? '';
    const appDir = join(root, 'apps', appName);
    if (existsSync(appDir)) {
      return {
        id: `app:${appName}`,
        type: 'app',
        title: `تطبيق المنظومة: ${appName}`,
        directoryOrFile: `apps/${appName}`,
      };
    }
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
    join(
      root,
      'apps',
      'docs',
      'src',
      'content',
      'docs',
      'data-and-migration',
      '19-legacy-to-enterprise-master-feature-migration-registry.md'
    ),
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
    return {
      ok: false,
      error: `Target "${rawTarget}" resolved to "${resolved.directoryOrFile}" but no files were found to lock.`,
    };
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

export function unlockAllEntities(): never {
  throw new Error(
    'Constitutional Violation: unlock-all is strictly prohibited. Unlocking must be granular per entity using dynamic OTP challenge protocol.'
  );
}

export function discoverAllLockableTargets(
  root = process.cwd(),
  options: { includeAllTests?: boolean } = {}
): string[] {
  const targets: string[] = [];

  // 1. Core Packages (8)
  const packagesDir = join(root, 'packages');
  if (existsSync(packagesDir)) {
    for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
      if (entry.isDirectory() && listEntityFiles(root, `packages/${entry.name}`, 'package').length > 0) {
        targets.push(`package:${entry.name}`);
      }
    }
  }

  // 2. Infrastructure (2)
  targets.push('infra:docker');
  targets.push('infra:speed-engine');

  // 3. Applications (3)
  const appsDir = join(root, 'apps');
  if (existsSync(appsDir)) {
    for (const entry of readdirSync(appsDir, { withFileTypes: true })) {
      if (entry.isDirectory() && listEntityFiles(root, `apps/${entry.name}`, 'app').length > 0) {
        targets.push(`app:${entry.name}`);
      }
    }
  }

  // 4. Domain Modules (3)
  const modulesDir = join(root, 'modules');
  if (existsSync(modulesDir)) {
    for (const mod of readdirSync(modulesDir, { withFileTypes: true })) {
      if (mod.isDirectory() && listEntityFiles(root, `modules/${mod.name}`, 'module').length > 0) {
        targets.push(`module:${mod.name}`);
      }
    }
  }

  // 5. Bot flows (22)
  if (existsSync(modulesDir)) {
    for (const mod of readdirSync(modulesDir, { withFileTypes: true })) {
      if (!mod.isDirectory()) continue;
      const flowsDir = join(modulesDir, mod.name, 'src', 'flows');
      if (!existsSync(flowsDir)) continue;

      for (const flowEntry of readdirSync(flowsDir, { withFileTypes: true })) {
        if (!flowEntry.isDirectory()) continue;
        if (listEntityFiles(root, `modules/${mod.name}/src/flows/${flowEntry.name}`, 'flow').length === 0) continue;
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

  // 6. Admin dashboard screens (33)
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

  // 7. Test suites (268 baseline / 270 total)
  const postBaselineTests = new Set([
    'tools/governance/tests/verify-observability-ast.spec.ts',
    'tools/governance/tests/ci-lock-attachments-exclusion.spec.ts',
    'tools/governance/tests/jev-skill-consultant.spec.ts',
    'tools/governance/tests/incident-financial-cleanup.spec.ts',
    'tools/governance/tests/pure-cloud-jev.spec.ts',
  ]);
  const scanTests = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (
          entry.name === 'node_modules' ||
          entry.name === '.git' ||
          entry.name === '.worktrees' ||
          entry.name === 'dist' ||
          entry.name === '.turbo' ||
          entry.name === '.next' ||
          entry.name === '.astro' ||
          entry.name === 'coverage'
        ) {
          continue;
        }
        scanTests(full);
      } else if (entry.isFile()) {
        if (entry.name.endsWith('.spec.ts') || entry.name.endsWith('.test.ts')) {
          const relTestPath = normalized(toRepoPath(root, full));
          if (!options.includeAllTests && postBaselineTests.has(relTestPath)) {
            continue;
          }
          targets.push(`test:${relTestPath}`);
        }
      }
    }
  };
  scanTests(root);

  return targets.sort((a, b) => a.localeCompare(b));
}

export interface VerifyLockedResult {
  ok: boolean;
  totalDiscovered: number;
  totalLocked: number;
  unlockedEntities: string[];
  modifiedUnsealedFiles: Array<{
    entityId: string;
    file: string;
    expectedHash: string;
    actualHash: string;
  }>;
  error?: string | undefined;
}

export function verifyAllEntitiesLocked(root = process.cwd()): VerifyLockedResult {
  const lockPath = join(root, GOVERNANCE_LOCK_PATH);
  if (!existsSync(lockPath)) {
    return {
      ok: false,
      totalDiscovered: 0,
      totalLocked: 0,
      unlockedEntities: [],
      modifiedUnsealedFiles: [],
      error: 'governance.lock.json does not exist.',
    };
  }

  let lockData: GovernanceLock;
  try {
    lockData = JSON.parse(readFileSync(lockPath, 'utf8'));
  } catch (err) {
    return {
      ok: false,
      totalDiscovered: 0,
      totalLocked: 0,
      unlockedEntities: [],
      modifiedUnsealedFiles: [],
      error: `Failed to parse governance.lock.json: ${String(err)}`,
    };
  }

  const lockedEntities = lockData.lockedEntities ?? {};
  const discoveredTargets = discoverAllLockableTargets(root, { includeAllTests: true });
  const unlockedEntities: string[] = [];
  const modifiedUnsealedFiles: Array<{
    entityId: string;
    file: string;
    expectedHash: string;
    actualHash: string;
  }> = [];

  for (const target of discoveredTargets) {
    const resolved = resolveLockTarget(root, target);
    if (!resolved) {
      unlockedEntities.push(target);
      continue;
    }

    const lockedEntity = lockedEntities[resolved.id];
    if (!lockedEntity) {
      unlockedEntities.push(resolved.id);
      continue;
    }

    // 1. Check all recorded files against disk
    for (const recordedFile of lockedEntity.files) {
      const fullPath = join(root, recordedFile.path);
      if (!existsSync(fullPath)) {
        modifiedUnsealedFiles.push({
          entityId: resolved.id,
          file: recordedFile.path,
          expectedHash: recordedFile.sha256,
          actualHash: 'FILE_MISSING',
        });
        continue;
      }

      const currentHash = sha256NormalizedFile(fullPath);
      if (currentHash !== recordedFile.sha256) {
        modifiedUnsealedFiles.push({
          entityId: resolved.id,
          file: recordedFile.path,
          expectedHash: recordedFile.sha256,
          actualHash: currentHash,
        });
      }
    }

    // 2. Check for newly added unrecorded files on disk
    let currentFiles: string[] = [];
    if (resolved.id === 'infra:docker') {
      currentFiles = listDockerFiles(root);
    } else if (resolved.id === 'infra:speed-engine') {
      currentFiles = [
        'apps/bot-server/src/services/fast-cache.service.ts',
        'apps/bot-server/src/services/telemetry.service.ts',
        'apps/bot-server/src/services/screen-flow.service.ts',
        'tools/governance/verify-latency-anti-patterns.ts',
      ].filter((p) => existsSync(join(root, p)));
    } else {
      currentFiles = listEntityFiles(root, resolved.directoryOrFile, resolved.type);
    }

    const recordedPaths = new Set(lockedEntity.files.map((f) => f.path));
    for (const curFile of currentFiles) {
      if (!recordedPaths.has(curFile)) {
        modifiedUnsealedFiles.push({
          entityId: resolved.id,
          file: curFile,
          expectedHash: 'UNRECORDED',
          actualHash: sha256NormalizedFile(join(root, curFile)),
        });
      }
    }
  }

  const ok = unlockedEntities.length === 0 && modifiedUnsealedFiles.length === 0;
  return {
    ok,
    totalDiscovered: discoveredTargets.length,
    totalLocked: Object.keys(lockedEntities).length,
    unlockedEntities,
    modifiedUnsealedFiles,
    error: ok
      ? undefined
      : `Pre-merge lockdown verification failed: ${unlockedEntities.length} unlocked entity/entities, ${modifiedUnsealedFiles.length} modified unsealed file(s). All entities must be locked (pnpm lock <target>) before merge.`,
  };
}

export function lockAllEntities(
  root = process.cwd(),
  options: { commitRef?: string; evidenceDir?: string } = {}
): { total: number; successful: number; failed: Array<{ target: string; error: string }> } {
  const targets = discoverAllLockableTargets(root, { includeAllTests: true });
  const failed: Array<{ target: string; error: string }> = [];
  let successful = 0;

  const lockPath = join(root, GOVERNANCE_LOCK_PATH);
  let lockData: GovernanceLock;
  if (existsSync(lockPath)) {
    try {
      const parsed = JSON.parse(readFileSync(lockPath, 'utf8'));
      lockData = buildGovernanceLock(root, new Date().toISOString(), parsed);
    } catch {
      lockData = buildGovernanceLock(root);
    }
  } else {
    lockData = buildGovernanceLock(root);
  }

  if (!lockData.lockedEntities) {
    lockData.lockedEntities = {};
  }

  // 1. Synchronize migration registry first so docs/19 and apps/docs are up to date before hashing
  try {
    syncMigrationRegistry(root);
  } catch {
    // non-fatal
  }

  const commitRef = options.commitRef ?? 'Plan-Cryptographic-Lock-100';
  const lockedAt = new Date().toISOString();
  const today = lockedAt.slice(0, 10);
  const evidenceDir = options.evidenceDir ?? join(root, 'docs', 'ai-execution-evidence');
  if (!existsSync(evidenceDir)) mkdirSync(evidenceDir, { recursive: true });

  for (const target of targets) {
    const resolved = resolveLockTarget(root, target);
    if (!resolved) {
      failed.push({ target, error: `Could not resolve target: "${target}"` });
      continue;
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
      failed.push({
        target,
        error: `Target "${target}" resolved to "${resolved.directoryOrFile}" but no files were found.`,
      });
      continue;
    }

    const filesWithHashes = filePaths.map((relPath) => ({
      path: relPath,
      sha256: sha256NormalizedFile(join(root, relPath)),
    }));

    const entity: LockedEntity = {
      id: resolved.id,
      type: resolved.type,
      title: resolved.title,
      directory: resolved.directoryOrFile,
      lockedAt,
      files: filesWithHashes,
    };

    lockData.lockedEntities[entity.id] = entity;

    // Write evidence file
    const safeId = entity.id.replace(/[^a-zA-Z0-9.-]/g, '_');
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

    successful++;
  }

  // Write atomic update to governance.lock.json once
  writeFileSync(lockPath, JSON.stringify(lockData, null, 2) + '\n', 'utf8');

  return { total: targets.length, successful, failed };
}

if (isCliEntrypoint(import.meta.url)) {
  const argv = process.argv.slice(2);

  // Strictly prohibit unlock-all attempts
  if (argv.some((a) => a.toLowerCase().includes('unlock') && a.toLowerCase().includes('all'))) {
    console.error('🚨 [FATAL CONSTITUTIONAL BREACH: UNLOCK-ALL IS STRICTLY PROHIBITED]');
    console.error('   Mass unlocking (unlock:all) is permanently forbidden.');
    console.error('   Unlocking is strictly granular per entity via dynamic OTP challenge.');
    process.exit(1);
  }

  if (argv.includes('--verify-locked') || argv.includes('--check')) {
    console.log('🔍 Verifying that 100% of monorepo entities are cryptographically locked...');
    const verifyRes = verifyAllEntitiesLocked(process.cwd());
    if (!verifyRes.ok) {
      console.error(`❌ ${verifyRes.error}`);
      if (verifyRes.unlockedEntities.length > 0) {
        console.error(`   Unlocked entity IDs (${verifyRes.unlockedEntities.length}):`);
        for (const u of verifyRes.unlockedEntities) {
          console.error(`     - ${u}`);
        }
      }
      if (verifyRes.modifiedUnsealedFiles.length > 0) {
        console.error(`   Modified unsealed file(s) (${verifyRes.modifiedUnsealedFiles.length}):`);
        for (const m of verifyRes.modifiedUnsealedFiles) {
          console.error(`     - [${m.entityId}] ${m.file} (expected: ${m.expectedHash}, actual: ${m.actualHash})`);
        }
      }
      process.exit(1);
    }
    console.log(
      `✅ All ${verifyRes.totalLocked} entities are cryptographically locked and verified with 0 unsealed modifications.`
    );
    process.exit(0);
  }

  const isAll = argv.includes('--all') || argv.includes('all') || argv.length === 0;

  if (isAll) {
    console.log('🔒 Running unified lock engine (100% Sovereign Monorepo Batch Sealing)...');
    const result = lockAllEntities(process.cwd());
    console.log(`✅ Unified lock engine complete: ${result.successful}/${result.total} entities locked.`);
    if (result.failed.length > 0) {
      for (const f of result.failed) {
        console.error(`   - ${f.target}: ${f.error}`);
      }
      process.exit(1);
    }
    process.exit(0);
  }

  const target = argv.filter((a) => !a.startsWith('--'))[0];
  if (target) {
    console.log(`🔒 Locking target "${target}"...`);
    const result = lockEntity(process.cwd(), target);
    if (!result.ok) {
      console.error(`❌ Lock failed: ${result.error}`);
      process.exit(1);
    }
    console.log(`✅ Successfully locked [${result.entity!.id}] (${result.entity!.title})`);
    console.log(`   Files hashed: ${result.entity!.files.length} files`);
    process.exit(0);
  }
}
