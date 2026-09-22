#!/usr/bin/env node
/**
 * Catalog CLI Entrypoint (Work Plan 89)
 */

import { generateCatalogArtifacts } from './generate-catalog.js';
import { scanMonorepoCatalog } from './catalog.js';
import { validateMonorepoCatalog } from './validate-catalog.js';

const args = process.argv.slice(2);
const command = args[0] ?? 'generate';

async function main() {
  const root = process.cwd();

  if (command === 'validate') {
    console.log('🔍 Scanning monorepo modules and flows...');
    const catalog = scanMonorepoCatalog(root);
    console.log(`📦 Discovered ${catalog.modules.length} modules, ${catalog.flows.length} flows.`);
    console.log('🛡️ Validating catalog boundaries, capabilities, and Telegram budget...');
    const report = validateMonorepoCatalog(catalog, root);

    if (!report.valid) {
      console.error(`❌ Validation failed with ${report.errors.length} error(s):`);
      for (const err of report.errors) {
        console.error(`   - ${err}`);
      }
      process.exit(1);
    }

    console.log('✅ Catalog validation PASSED 100%!');
    console.log(`   Modules checked: ${report.checked.modules}`);
    console.log(`   Flows checked:   ${report.checked.flows}`);
    console.log(`   Catalog Hash:    ${catalog.catalogHash}`);
    process.exit(0);
  }

  if (command === 'generate' || command === 'build') {
    console.log('🚀 Generating sovereign monorepo catalog artifacts...');
    try {
      const result = generateCatalogArtifacts(root);
      console.log('✅ Catalog generated successfully!');
      console.log(`   Output directory: ${result.outputDirectory}`);
      console.log(`   Files generated:  ${result.filesGenerated.join(', ')}`);
      console.log(`   Catalog Hash:     ${result.catalog.catalogHash}`);
      process.exit(0);
    } catch (err) {
      console.error('❌ Catalog generation failed:', err);
      process.exit(1);
    }
  }

  if (command === 'check') {
    console.log('🔍 Verifying catalog determinism and drift...');
    const catalog = scanMonorepoCatalog(root);
    const report = validateMonorepoCatalog(catalog, root);

    if (!report.valid) {
      console.error('❌ Catalog check failed: validation errors present.');
      process.exit(1);
    }

    console.log(`✅ Catalog is in sync and valid. Hash: ${catalog.catalogHash}`);
    process.exit(0);
  }

  console.error(`Unknown command "${command}". Available commands: generate, validate, check`);
  process.exit(1);
}

main().catch((err) => {
  console.error('Fatal CLI error:', err);
  process.exit(1);
});
