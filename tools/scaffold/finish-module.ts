import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isCliEntrypoint, readUtf8, toRepoPath } from '../governance/common.js';
import { lockModuleEntry } from '../governance/verify-governance-lock.js';
import { verifyFlowFast } from '../governance/verify-flow-fast.js';

export interface FinishModuleOptions {
  commitRef?: string | undefined;
  root?: string | undefined;
  skipTests?: boolean | undefined;
  lock?: boolean | undefined;
  approvalPhrase?: string | undefined;
}

export interface FinishModuleResult {
  ok: boolean;
  moduleName: string;
  moduleDir: string;
  evidenceFile?: string | undefined;
  isLocked?: boolean | undefined;
  error?: string | undefined;
}

export function finishModule(
  moduleNameOrPath: string,
  options: FinishModuleOptions | string = {},
  maybeRoot = process.cwd()
): FinishModuleResult {
  const opts: FinishModuleOptions = typeof options === 'string'
    ? { commitRef: options, root: maybeRoot }
    : options;

  const root = opts.root ?? process.cwd();
  const commitRef = opts.commitRef ?? 'P43-Module-Finish';

  const cleanName = moduleNameOrPath.replace(/^modules[\\/]/, '').replace(/[\\/].*$/, '').trim().toLowerCase();
  const moduleDir = join(root, 'modules', cleanName);

  if (!existsSync(moduleDir)) {
    return {
      ok: false,
      moduleName: cleanName,
      moduleDir: '',
      error: `Module directory not found: ${toRepoPath(root, moduleDir)}`,
    };
  }

  // 1. Run tests and flow checks if not skipped
  if (!opts.skipTests) {
    // 1.1 Verify all module flows via verifyFlowFast
    const flowsDir = join(moduleDir, 'src', 'flows');
    if (existsSync(flowsDir)) {
      for (const entry of readdirSync(flowsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const flowDirPath = join(flowsDir, entry.name);
        const flowVerification = verifyFlowFast({ flowPath: flowDirPath, root, skipTests: false });
        if (!flowVerification.ok) {
          return {
            ok: false,
            moduleName: cleanName,
            moduleDir,
            error: `Flow verification failed for ${entry.name}:\n${flowVerification.failures.join('\n')}`,
          };
        }
      }
    }

    // 1.2 Run module test suite
    try {
      const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
      execSync(`${pnpmCmd} --filter @alsaada/${cleanName} test`, {
        cwd: root,
        stdio: 'pipe',
        encoding: 'utf8',
      });
    } catch (err: unknown) {
      const errMsg = err && typeof err === 'object' && 'stderr' in err ? String(err.stderr) : String(err);
      return {
        ok: false,
        moduleName: cleanName,
        moduleDir,
        error: `Module test verification failed:\n${errMsg}`,
      };
    }
  }

  // 2. Read title and update status from 'draft' to 'active' in src/module.register.ts
  const registerPath = join(moduleDir, 'src', 'module.register.ts');
  let titleArabic = cleanName;
  if (existsSync(registerPath)) {
    let content = readFileSync(registerPath, 'utf8');
    const titleMatch = content.match(/titleArabic:\s*['"]([^'"]+)['"]/);
    if (titleMatch?.[1]) {
      titleArabic = titleMatch[1];
    }
    content = content.replace(/status:\s*['"]draft['"]/, "status: 'active'");
    writeFileSync(registerPath, content, 'utf8');
  }

  const relativePath = toRepoPath(root, moduleDir);
  const today = new Date().toISOString().slice(0, 10);

  // 3. Update docs/19-legacy-to-enterprise-master-feature-migration-registry.md
  const registryPath = join(root, 'docs', '19-legacy-to-enterprise-master-feature-migration-registry.md');
  if (existsSync(registryPath)) {
    const lines = readUtf8(registryPath).split(/\r?\n/);
    let updated = false;

    const newLines = lines.map((line) => {
      if (!line.trim().startsWith('|')) return line;
      const cells = line.split('|');
      if (cells.length < 6) return line;
      const codeCell = cells[1]?.trim().replace(/[*`]/g, '') ?? '';
      if (codeCell.toLowerCase() === cleanName || codeCell.toLowerCase() === `mod:${cleanName}`) {
        updated = true;
        cells[4] = ' 🟢 **مكتمل وموثق 100%** ';
        cells[5] = ` \`${relativePath}\` `;
        cells[6] = ` \`${today}\` (\`${commitRef}\`) `;
        return cells.join('|');
      }
      return line;
    });

    if (!updated) {
      const row = `| **\`mod:${cleanName}\`** | **${titleArabic}** | موديولات المنظومة | 🟢 **مكتمل وموثق 100%** | \`${relativePath}\` | \`${today}\` (\`${commitRef}\`) |`;
      newLines.push(row);
    }

    writeFileSync(registryPath, newLines.join('\n'), 'utf8');
  }

  // 4. Generate evidence file
  const evidenceDir = join(root, 'docs', 'ai-execution-evidence');
  mkdirSync(evidenceDir, { recursive: true });
  const evidenceFileName = `${today}-module-${cleanName}-closure.md`;
  const evidenceFilePath = join(evidenceDir, evidenceFileName);

  const evidenceContent = `# توثيق الحوكمة: اكتمال واعتماد موديول ${cleanName} (${titleArabic})

- التاريخ: ${today}
- مسار الموديول: \`${relativePath}\`
- الحالة: 🟢 مكتمل وموثق 100%
- مرجع الالتزام (Commit): \`${commitRef}\`

## نطاق الموديول المعتمد
- العقد المشترك: \`AppModuleDefinition\` من \`@alsaada/core-components\`
- المجلد: \`${relativePath}\`
`;
  writeFileSync(evidenceFilePath, evidenceContent, 'utf8');

  // 5. Locking handling per AGENTS.md
  let isLocked = false;
  if (opts.lock || opts.approvalPhrase === 'نعم اقفل') {
    lockModuleEntry(root, cleanName, moduleDir, titleArabic);
    isLocked = true;
  }

  return {
    ok: true,
    moduleName: cleanName,
    moduleDir,
    evidenceFile: toRepoPath(root, evidenceFilePath),
    isLocked,
  };
}

if (isCliEntrypoint(import.meta.url)) {
  const args = process.argv.slice(2);
  const moduleArg = args[0];
  const lockFlag = args.includes('--lock') || args.includes('نعم اقفل');

  if (!moduleArg || moduleArg === '--help' || moduleArg === '-h') {
    console.log('Usage: pnpm module:finish <module-name> [--lock]');
    process.exit(moduleArg ? 0 : 1);
  }

  const result = finishModule(moduleArg, { lock: lockFlag });
  if (!result.ok) {
    console.error(`❌ Module finish failed: ${result.error}`);
    process.exit(1);
  }

  console.log(`✅ Module ${result.moduleName} marked as 'active' and documented in docs/19.`);
  console.log(`📄 Evidence generated: ${result.evidenceFile}`);

  if (result.isLocked) {
    console.log(`🔒 Module cryptographically sealed in governance.lock.json`);
  } else {
    console.log('\n======================================================');
    console.log(`تم الانتهاء بنجاح من بناء واختبار موديول [${result.moduleName}]. هل نقفل ونحمى هذا الموديول تشفيرياً ضد أي تعديل؟`);
    console.log(`لإتمام القفل والحماية، يرجى الرد بالصيغة المعتمدة حصراً:`);
    console.log(`«نعم اقفل»`);
    console.log(`(أو تشغيل: pnpm module:finish ${result.moduleName} --lock)`);
    console.log('======================================================\n');
  }
}
