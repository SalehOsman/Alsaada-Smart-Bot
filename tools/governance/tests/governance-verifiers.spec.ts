import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, test } from 'vitest';

import { verifyAiCompliance } from '../verify-ai-compliance.js';
import { verifyArchitecture } from '../verify-architecture.js';
import { verifyDocsAudit } from '../verify-docs-audit.js';
import { verifyDocsParity } from '../verify-docs-parity.js';
import { verifyFlowContracts } from '../verify-flow-contracts.js';
import { verifyMigrationRegistry } from '../verify-migration-registry.js';

function fixtureRoot(name: string): string {
  const root = join(tmpdir(), `alsaada-governance-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(root, { recursive: true });
  mkdirSync(join(root, 'docs'), { recursive: true });
  mkdirSync(join(root, 'modules'), { recursive: true });
  return root;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeMandatoryDocs(root: string): void {
  const standardReference = 'docs/21-mandatory-module-architecture-and-gates.md';
  writeFileSync(join(root, 'AGENTS.md'), `${standardReference}\n`, 'utf8');
  writeFileSync(join(root, 'GEMINI.md'), `${standardReference}\n`, 'utf8');
  writeFileSync(join(root, 'docs', '14-ai-agent-governance-and-file-rules.md'), `${standardReference}\n`, 'utf8');
  writeFileSync(join(root, 'docs', '15-universal-module-and-flow-standard.md'), `${standardReference}\n`, 'utf8');
  writeFileSync(join(root, 'docs', '19-legacy-to-enterprise-master-feature-migration-registry.md'), '# Registry\n', 'utf8');
  mkdirSync(join(root, 'docs', 'ai-execution-evidence'), { recursive: true });
  writeFileSync(join(root, 'docs', 'ai-execution-evidence', 'README.md'), '# Evidence\\n', 'utf8');
  writeFileSync(
    join(root, 'docs', '21-mandatory-module-architecture-and-gates.md'),
    'G1 G2 G3 G4 G5 G6 G7 G8 G9 G10 modules/<module-name>/ src/ flows/ pnpm arch:verify pnpm migration:verify pnpm flow-contracts:verify pnpm ai-compliance:verify\n',
    'utf8',
  );
  writeJson(join(root, 'package.json'), {
    scripts: {
      build: 'pnpm -r run build',
      test: 'vitest run',
      lint: 'pnpm typecheck',
      'arch:verify': 'tsx tools/governance/verify-architecture.ts',
      'migration:verify': 'tsx tools/governance/verify-migration-registry.ts',
      'flow-contracts:verify': 'tsx tools/governance/verify-flow-contracts.ts',
      'docs:audit': 'tsx tools/governance/verify-docs-audit.ts',
      'docs:parity': 'tsx tools/governance/verify-docs-parity.ts',
      'ai-compliance:verify': 'tsx tools/governance/verify-ai-compliance.ts',
    },
  });
}

function createCompleteFlow(root: string): string {
  const flowDir = join(root, 'modules', 'advances', 'src', 'flows', '02.1-direct-advance');
  mkdirSync(join(flowDir, 'tests'), { recursive: true });
  writeJson(join(flowDir, 'flow.contract.json'), {
    flowCode: '02.1',
    flowName: 'Direct Advance',
    module: 'advances',
    status: 'Implemented',
    allowedRoles: ['FIELD_ADMIN'],
    blockedRoles: ['WORKER'],
    entryPoints: ['callback:advances:direct'],
    navigationPath: ['Main Menu', 'Advances', 'Direct Advance'],
    buttons: ['Confirm'],
    inputs: ['workerId', 'amount'],
    outputs: ['receipt'],
    dataImpact: {
      database: ['financial_ledgers'],
      googleSheets: [],
      exports: [],
      notifications: ['telegram', 'whatsapp'],
    },
    linkedFlows: [],
    performanceSlaMs: {
      buttonP95: 700,
      stepP95: 1200,
      commitP95: 2000,
    },
    requiredTests: ['unit', 'integration', 'ux', 'rbac', 'data', 'performance'],
    manualUatRequired: true,
  });
  for (const file of [
    'flow.handler.ts',
    'flow.keyboard.ts',
    'flow.service.ts',
    'flow.repository.ts',
    'flow.types.ts',
    'flow.validators.ts',
    'flow.messages.ts',
    'flow.telemetry.ts',
    'flow.docs.md',
    'tests/flow.unit.spec.ts',
    'tests/flow.integration.spec.ts',
    'tests/flow.ux.spec.ts',
    'tests/flow.rbac.spec.ts',
    'tests/flow.data.spec.ts',
  ]) {
    writeFileSync(join(flowDir, file), file.endsWith('.md') ? '# Flow\n' : 'export {};\n', 'utf8');
  }
  return flowDir;
}

describe('governance verifiers', () => {
  test('architecture verifier accepts a complete modular flow', () => {
    const root = fixtureRoot('arch-pass');
    createCompleteFlow(root);

    const result = verifyArchitecture(root);

    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  test('architecture verifier rejects a modular flow with a missing required file', () => {
    const root = fixtureRoot('arch-missing-file');
    const flowDir = createCompleteFlow(root);
    writeFileSync(join(flowDir, 'flow.service.ts'), '', 'utf8');

    const result = verifyArchitecture(root);

    expect(result.ok).toBe(false);
    expect(result.failures.some((failure) => failure.includes('flow.service.ts'))).toBe(true);
  });

  test('flow contracts verifier rejects contracts missing RBAC and SLA fields', () => {
    const root = fixtureRoot('contract-fail');
    const flowDir = join(root, 'modules', 'advances', 'src', 'flows', '02.1-direct-advance');
    mkdirSync(flowDir, { recursive: true });
    writeJson(join(flowDir, 'flow.contract.json'), {
      flowCode: '02.1',
      flowName: 'Direct Advance',
      module: 'advances',
      status: 'Implemented',
    });

    const result = verifyFlowContracts(root);

    expect(result.ok).toBe(false);
    expect(result.failures.some((failure) => failure.includes('allowedRoles'))).toBe(true);
    expect(result.failures.some((failure) => failure.includes('performanceSlaMs'))).toBe(true);
  });

  test('migration verifier rejects completed registry entries outside modules', () => {
    const root = fixtureRoot('migration-fail');
    writeFileSync(join(root, 'docs', '19-legacy-to-enterprise-master-feature-migration-registry.md'), [
      '| الكود | الوظيفة | القسم | الحالة | المسار | Commit |',
      '|---|---|---|---|---|---|',
      '| **`02.1`** | تسجيل سلفة | المالية | 🟢 مكتمل وموثق 100% | `apps/bot-server/src/flows/advances/direct-advance.ts` | abc123 |',
    ].join('\n'), 'utf8');

    const result = verifyMigrationRegistry(root);

    expect(result.ok).toBe(false);
    expect(result.failures.some((failure) => failure.includes('must use modules/'))).toBe(true);
  });

  test('ai compliance verifier rejects PASS evidence without all gate results', () => {
    const root = fixtureRoot('ai-fail');
    const evidenceDir = join(root, 'docs', 'ai-execution-evidence');
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(join(evidenceDir, 'task.md'), 'القرار: PASS\nG1 - العزل الموديولي: PASS\n', 'utf8');

    const result = verifyAiCompliance(root, { requireEvidence: true, requireCleanGit: false });

    expect(result.ok).toBe(false);
    expect(result.failures.some((failure) => failure.includes('G10'))).toBe(true);
  });

  test('docs audit verifier accepts the mandatory governance document set and scripts', () => {
    const root = fixtureRoot('docs-audit-pass');
    writeMandatoryDocs(root);

    const result = verifyDocsAudit(root);

    expect(result.ok).toBe(true);
  });

  test('docs audit verifier rejects missing mandatory governance documents', () => {
    const root = fixtureRoot('docs-audit-fail');
    writeFileSync(join(root, 'AGENTS.md'), 'agent rules\n', 'utf8');
    writeFileSync(join(root, 'GEMINI.md'), 'gemini rules\n', 'utf8');
    writeJson(join(root, 'package.json'), { scripts: {} });

    const result = verifyDocsAudit(root);

    expect(result.ok).toBe(false);
    expect(result.failures.some((failure) => failure.includes('21-mandatory-module-architecture-and-gates.md'))).toBe(true);
  });

  test('docs parity verifier requires every AI governance file to reference the module gates standard', () => {
    const root = fixtureRoot('docs-parity-fail');
    writeMandatoryDocs(root);
    writeFileSync(join(root, 'AGENTS.md'), 'agent rules\n', 'utf8');

    const result = verifyDocsParity(root);

    expect(result.ok).toBe(false);
    expect(result.failures.some((failure) => failure.includes('AGENTS.md'))).toBe(true);
  });
});



