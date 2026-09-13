import { resolve } from 'node:path';
import { createResult, fail, listFilesRecursive, readUtf8 } from './common.js';

export async function verifyObservabilityContract(repoRoot: string) {
  const result = createResult();

  // Audit files in critical security routes:
  // - apps/admin-dashboard/src/app/api/auth/
  // - apps/admin-dashboard/src/app/api/export/
  // - apps/admin-dashboard/src/app/api/delegations/
  // - apps/bot-server/src/services/dashboard-auth.service.ts
  // - apps/bot-server/src/services/session-monitor.service.ts
  const criticalDirs = [
    resolve(repoRoot, 'apps/admin-dashboard/src/app/api/auth'),
    resolve(repoRoot, 'apps/admin-dashboard/src/app/api/export'),
    resolve(repoRoot, 'apps/admin-dashboard/src/app/api/delegations'),
  ];

  const criticalFiles = [
    resolve(repoRoot, 'apps/bot-server/src/services/dashboard-auth.service.ts'),
    resolve(repoRoot, 'apps/bot-server/src/services/session-monitor.service.ts'),
  ];

  const allFiles: string[] = [...criticalFiles];
  for (const dir of criticalDirs) {
    allFiles.push(...listFilesRecursive(dir));
  }

  for (const file of allFiles) {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
    result.checked++;
    const content = readUtf8(file);

    // Rule 1: Zero console.error in critical auth, delegations, and export code
    if (content.includes('console.error')) {
      fail(result, `File ${file} contains console.error. Use structured logging or error vault.`);
    }

    // Rule 2: No empty catch blocks: e.g. catch (e) {} or catch {}
    const emptyCatchRegex = /catch\s*(\([^)]*\))?\s*\{\s*\}/g;
    if (emptyCatchRegex.test(content)) {
      fail(result, `File ${file} contains silent empty catch block!`);
    }

    // Rule 3: traceId integration check in API routes
    if (file.includes('api') && !content.includes('traceId') && !content.includes('extractTraceId')) {
      fail(result, `API route ${file} missing traceId tracking.`);
    }
  }

  return result;
}

if (process.argv[1]?.includes('verify-observability-contract')) {
  const repoRoot = resolve(process.cwd());
  verifyObservabilityContract(repoRoot)
    .then((res) => {
      console.log(`\n📡 [Observability Gate] Checked ${res.checked} critical security files.`);
      if (!res.ok) {
        console.error('❌ Failures found:');
        for (const f of res.failures) {
          console.error(`  - ${f}`);
        }
        process.exit(1);
      }
      console.log('✅ Zero console.error & anti-silent failure contract 100% verified.\n');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Crash in verify-observability-contract:', err);
      process.exit(1);
    });
}
