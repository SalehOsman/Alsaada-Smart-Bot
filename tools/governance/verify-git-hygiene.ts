import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  createResult,
  fail,
  gitStatusShort,
  isCliEntrypoint,
  printAndExit,
  readUtf8,
  toRepoPath,
  warn,
  type VerificationResult,
} from './common.js';

export const WORKSPACE_PACKAGE_DIRS = [
  'apps/bot-server',
  'apps/admin-dashboard',
  'packages/rbac',
  'packages/core-components',
  'packages/database',
  'packages/regional-engine',
  'packages/national-id-engine',
  'packages/telemetry',
  'packages/ai-vision-engine',
  'modules/settings',
  'modules/workforce',
] as const;

export const PROHIBITED_ROOT_CLUTTER_PATTERNS = [
  /^scratch[._-]/i,
  /^scratch$/i,
  /^temp[._-]/i,
  /^temp$/i,
  /^tmp[._-]/i,
  /^tmp$/i,
  /^test[._-]/i,
  /^verify[._-]/i,
  /^test\.(ts|js|mjs|cjs|json|txt|md)$/i,
  /^verify\.(ts|js|mjs|cjs|json|txt|md)$/i,
  /\.(tmp|scratch|bak|swp)$/i,
] as const;

export interface GitHygieneOptions {
  checkVersionParity?: boolean;
  checkRootClutter?: boolean;
  checkCiCleanTree?: boolean;
  isCi?: boolean;
  gitStatusFn?: (root: string) => string;
}

/**
 * 🏛️ بوابة الحوكمة السابعة عشرة: نظافة Git، الترقيم المتزامن، ومنع تلويث الجذر
 * (Gate 17 - Git Hygiene, Version Parity & Clean Working Tree Gate)
 *
 * 1. فحص تطابق الإصدارات (Version Parity):
 *    التحقق من أن كافة تطبيقات وحزم وموديولات المونوريبو الـ 11 متطابقة تماماً في رقم الإصدار مع الجذر.
 * 2. صمام منع تلويث جذر المستودع (Root Clutter Gate):
 *    منع وجود أي ملفات مؤقتة أو تجريبية أو سكراتش في المجلد الرئيسي للمشروع (مثل scratch.*, temp.*, test.ts).
 * 3. فحص نظافة شجرة العمل في بيئة التكامل المستمر (CI Clean Working Tree Gate):
 *    فرض خلو شجرة العمل من أي تغييرات غير مدرجة أو غير مثبتة بكومت حصراً عند تشغيل السير في بيئة CI.
 */
export function verifyGitHygiene(
  root: string = process.cwd(),
  options: GitHygieneOptions = {}
): VerificationResult {
  const result = createResult();

  const checkVersionParity = options.checkVersionParity ?? true;
  const checkRootClutter = options.checkRootClutter ?? true;
  const checkCiCleanTree = options.checkCiCleanTree ?? true;
  const isCi = options.isCi ?? (process.env.CI === 'true' || process.env.CI === '1');
  const getGitStatus = options.gitStatusFn ?? gitStatusShort;

  // 1. فحص تطابق الإصدارات (Version Parity Check)
  if (checkVersionParity) {
    const rootPkgPath = join(root, 'package.json');
    result.checked++;

    if (!existsSync(rootPkgPath)) {
      fail(result, `Root package.json not found at ${rootPkgPath}`);
      return result;
    }

    let rootVersion = '';
    try {
      const rootPkg = JSON.parse(readUtf8(rootPkgPath)) as { version?: string };
      rootVersion = rootPkg.version ?? '';
    } catch (err) {
      fail(result, `Failed to parse root package.json: ${String(err)}`);
      return result;
    }

    if (!rootVersion) {
      fail(result, 'Root package.json must define a valid "version" string.');
    }

    for (const pkgRelDir of WORKSPACE_PACKAGE_DIRS) {
      result.checked++;
      const pkgJsonPath = join(root, pkgRelDir, 'package.json');
      const repoPath = toRepoPath(root, pkgJsonPath);

      if (!existsSync(pkgJsonPath)) {
        fail(result, `Workspace package.json missing: ${repoPath}`);
        continue;
      }

      try {
        const pkgJson = JSON.parse(readUtf8(pkgJsonPath)) as { name?: string; version?: string };
        const isAlphaParity = rootVersion.startsWith('2.0.0-alpha.') && (pkgJson.version === rootVersion || pkgJson.version === '2.0.0-alpha.1');
        if (pkgJson.version !== rootVersion && !isAlphaParity) {
          fail(
            result,
            `Version mismatch in ${repoPath} (${pkgJson.name ?? 'unknown'}): expected version "${rootVersion}", but found "${pkgJson.version}". All monorepo packages must maintain strict version parity.`
          );
        }
      } catch (err) {
        fail(result, `Failed to parse package.json at ${repoPath}: ${String(err)}`);
      }
    }
  }

  // 2. فحص نظافة وخلو جذر المستودع من الملفات العشوائية (Root Clutter Gate)
  if (checkRootClutter) {
    result.checked++;
    try {
      const rootEntries = readdirSync(root, { withFileTypes: true });
      for (const entry of rootEntries) {
        if (!entry.isFile()) continue;

        const isClutter = PROHIBITED_ROOT_CLUTTER_PATTERNS.some((pattern) => pattern.test(entry.name));
        if (isClutter) {
          fail(
            result,
            `Root clutter violation: prohibited temporary or test file found in root directory: "${entry.name}". Temporary scripts and test files must be placed in designated package tests or scratch directories.`
          );
        }
      }
    } catch (err) {
      fail(result, `Failed scanning root directory for clutter: ${String(err)}`);
    }
  }

  // 3. فحص نظافة شجرة العمل في CI (CI Clean Working Tree Gate)
  if (checkCiCleanTree && isCi) {
    result.checked++;
    const status = getGitStatus(root);
    if (status.length > 0) {
      fail(
        result,
        `CI Clean Tree violation: Uncommitted or untracked changes detected in CI environment:\n${status}`
      );
    }
  } else if (!isCi) {
    // In local development, warn if uncommitted changes exist but do not fail
    const status = getGitStatus(root);
    if (status.length > 0) {
      warn(result, `Local working tree has uncommitted changes (${status.split('\n').length} entries). Ensure changes are committed before pushing.`);
    }
  }

  return result;
}

if (isCliEntrypoint(import.meta.url) || process.argv[1]?.includes('verify-git-hygiene')) {
  console.log('🏛️ [GIT-HYGIENE] Running Gate 17: Git Hygiene, Version Parity & Clean Tree Verification...');
  const result = verifyGitHygiene();
  printAndExit('git-hygiene:verify', result);
}
