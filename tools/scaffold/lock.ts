import { isCliEntrypoint } from '../governance/common.js';
import { syncMigrationRegistry } from '../governance/sync-migration-registry.js';
import { lockAllEntities, lockEntity, resolveLockTarget } from '../governance/unified-lock-engine.js';

export function runLockCli(argv = process.argv.slice(2), root = process.cwd()): void {
  const commitArg = argv.find((a) => a.startsWith('--commit='));
  const commitRef = commitArg ? commitArg.replace('--commit=', '') : undefined;
  const lockOptions = commitRef ? { commitRef } : {};

  const isAll = argv.includes('--all') || argv.includes('all');

  if (isAll) {
    console.log('🔒 Executing Sovereign Batch Sealing for ALL entities...');
    const result = lockAllEntities(root, lockOptions);
    console.log(`✅ Batch sealing complete: ${result.successful}/${result.total} entities locked.`);
    try {
      const syncRes = syncMigrationRegistry(root);
      if (syncRes.synced > 0) {
        console.log(`🗺️ Master Migration Registry synchronized: ${syncRes.synced} flow(s) updated.`);
      }
    } catch (syncErr) {
      // Non-blocking sync warning
    }
    if (result.failed.length > 0) {
      console.error(`❌ Failures (${result.failed.length}):`);
      for (const f of result.failed) {
        console.error(`   - ${f.target}: ${f.error}`);
      }
      process.exit(1);
    }
    return;
  }

  const args = argv.filter((a) => !a.startsWith('--'));
  const target = args[0];

  if (!target) {
    console.error('Usage: pnpm lock <target> | pnpm lock --all');
    console.error('Examples:');
    console.error('  pnpm lock package:regional-engine');
    console.error('  pnpm lock flow:01.1');
    console.error('  pnpm lock dashboard:workforce/new');
    console.error('  pnpm lock infra:docker');
    console.error('  pnpm lock infra:speed-engine');
    console.error('  pnpm lock test:packages/rbac/tests/rbac.spec.ts');
    process.exit(1);
  }

  console.log(`🔒 Locking target "${target}"...`);
  const result = lockEntity(root, target, lockOptions);

  if (!result.ok) {
    console.error(`❌ Lock failed: ${result.error}`);
    process.exit(1);
  }

  const entity = result.entity!;
  console.log(`✅ Successfully locked [${entity.id}] (${entity.title})`);
  console.log(`   Directory: ${entity.directory}`);
  console.log(`   Files hashed: ${entity.files.length} files`);
  console.log(`   Evidence written to: docs/ai-execution-evidence/`);

  if (entity.type === 'flow' || target.startsWith('flow:')) {
    try {
      const syncRes = syncMigrationRegistry(root);
      if (syncRes.synced > 0) {
        console.log(`   🗺️ Master Migration Registry synchronized: ${syncRes.synced} flow(s) updated.`);
      }
    } catch {
      // Non-blocking sync warning
    }
  }
}

if (isCliEntrypoint(import.meta.url)) {
  runLockCli();
}
