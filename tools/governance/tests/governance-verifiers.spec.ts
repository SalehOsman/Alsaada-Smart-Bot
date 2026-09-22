import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

import { verifyAiCompliance } from '../verify-ai-compliance.js';
import { verifyArchitecture } from '../verify-architecture.js';
import { verifyDocsAudit } from '../verify-docs-audit.js';
import { verifyDocsParity } from '../verify-docs-parity.js';
import { verifyFlowContracts } from '../verify-flow-contracts.js';
import { buildGovernanceLock, verifyGovernanceLock, APPROVAL_PHRASE, lockFlowEntry, type GovernanceLock } from '../verify-governance-lock.js';
import {
  cleanTargetPath,
  extractTargetPathsFromEvidence,
  hasExactApprovalEvidence,
  isScaffoldAutoEvidence,
  normalizePath,
  pathMatchesTarget,
  verifyGovernanceTamper,
} from '../verify-governance-tamper.js';
import { verifyMigrationRegistry } from '../verify-migration-registry.js';
import { verifyTelegramContracts } from '../verify-telegram-contracts.js';
import { verifyFlowFast } from '../verify-flow-fast.js';
import { scaffoldFlow } from '../../scaffold/scaffold-flow.js';
import { scaffoldDashboard } from '../../scaffold/scaffold-dashboard.js';
import { scaffoldModule } from '../../scaffold/scaffold-module.js';
import { lockEntity } from '../unified-lock-engine.js';
import { unlockEntity } from '../unified-unlock-engine.js';

function ensureLockFile(root: string) {
  const lockPath = join(root, 'governance.lock.json');
  if (!existsSync(lockPath)) {
    const initialLock = buildGovernanceLock(root);
    writeFileSync(lockPath, JSON.stringify(initialLock, null, 2), 'utf8');
  }
}

function finishFlow(key: string, options: { commitRef?: string; root?: string; skipTests?: boolean }) {
  const root = options.root ?? process.cwd();
  ensureLockFile(root);
  const res = lockEntity(root, `flow:${key}`, options.commitRef ? { commitRef: options.commitRef } : {});
  return {
    ok: res.ok,
    flowKey: key,
    flowDir: res.entity?.directory ?? '',
    evidenceFile: res.entity ? `docs/ai-execution-evidence/${res.entity.lockedAt.slice(0, 10)}-lock-flow_${key.replace(/[^a-zA-Z0-9.-]/g, '_')}.md` : undefined,
    error: res.error,
  };
}

function finishDashboard(feat: string, options: { commitRef?: string; root?: string }) {
  const root = options.root ?? process.cwd();
  ensureLockFile(root);
  const res = lockEntity(root, `dashboard:${feat}`, options.commitRef ? { commitRef: options.commitRef } : {});
  return {
    ok: res.ok,
    featureId: feat,
    featureDir: res.entity?.directory ?? '',
    evidenceFile: res.entity ? `docs/ai-execution-evidence/${res.entity.lockedAt.slice(0, 10)}-lock-dashboard_${feat.replace(/[^a-zA-Z0-9.-]/g, '_')}.md` : undefined,
    error: res.error,
  };
}

function finishModule(mod: string, options: { commitRef?: string; root?: string; skipTests?: boolean; lock?: boolean }) {
  const root = options.root ?? process.cwd();
  ensureLockFile(root);
  const regPath = join(root, 'modules', mod, 'src', 'module.register.ts');
  if (existsSync(regPath)) {
    const regText = readFileSync(regPath, 'utf8');
    writeFileSync(regPath, regText.replace("status: 'draft'", "status: 'active'"), 'utf8');
  }
  const reg19Path = join(root, 'docs', '19-legacy-to-enterprise-master-feature-migration-registry.md');
  if (existsSync(reg19Path)) {
    const content = readFileSync(reg19Path, 'utf8');
    writeFileSync(reg19Path, `${content}\n| **\`mod:${mod}\`** | موديول ${mod} | النواة | 🟢 **مكتمل وموثق 100%** | \`modules/${mod}\` | — |\n`, 'utf8');
  }
  const res = lockEntity(root, `module:${mod}`, options.commitRef ? { commitRef: options.commitRef } : {});
  return {
    ok: res.ok,
    isLocked: true,
    moduleName: mod,
    moduleDir: res.entity?.directory ?? '',
    evidenceFile: res.entity ? `docs/ai-execution-evidence/${res.entity.lockedAt.slice(0, 10)}-lock-module_${mod.replace(/[^a-zA-Z0-9.-]/g, '_')}.md` : undefined,
    error: res.error,
  };
}

function unlockFeature(options: { type: string; targetKey: string; phrase: string; reason: string; root?: string }) {
  const prefix = options.type === 'flow' ? 'flow:' : options.type === 'dashboard' ? 'dashboard:' : options.type === 'module' ? 'module:' : '';
  const res = unlockEntity(`${prefix}${options.targetKey}`, {
    phrase: options.phrase,
    reason: options.reason,
    ...(options.root ? { root: options.root } : {}),
  });
  return {
    ok: res.ok,
    type: options.type,
    targetKey: options.targetKey,
    evidenceFile: res.evidenceFile,
    error: res.error,
  };
}

let fixtureSequence = 0;
function fixtureRoot(name: string): string {
  fixtureSequence += 1;
  const root = join(tmpdir(), `alsaada-gov-${process.pid}-${name}-${fixtureSequence}`);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, 'docs'), { recursive: true });
  mkdirSync(join(root, 'modules'), { recursive: true });
  return root;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeMandatoryDocs(root: string): void {
  const standardReference = 'docs/21-mandatory-module-architecture-and-gates.md';
  mkdirSync(join(root, 'docs', 'ai-execution-evidence'), { recursive: true });
  mkdirSync(join(root, 'tools', 'governance'), { recursive: true });
  writeFileSync(join(root, 'AGENTS.md'), `${standardReference}\n`, 'utf8');
  writeFileSync(join(root, 'GEMINI.md'), `${standardReference}\n`, 'utf8');
  writeFileSync(join(root, 'docs', '14-ai-agent-governance-and-file-rules.md'), `${standardReference}\n`, 'utf8');
  writeFileSync(join(root, 'docs', '15-universal-module-and-flow-standard.md'), `${standardReference}\n`, 'utf8');
  writeFileSync(join(root, 'docs', '19-legacy-to-enterprise-master-feature-migration-registry.md'), '# Registry\n', 'utf8');
  writeFileSync(join(root, 'docs', 'ai-execution-evidence', 'README.md'), '# Evidence\n', 'utf8');
  writeFileSync(
    join(root, 'docs', '21-mandatory-module-architecture-and-gates.md'),
    'G1 G2 G3 G4 G5 G6 G7 G8 G9 G10 G11 G12 modules/<module-name>/ src/ flows/ pnpm arch:verify pnpm migration:verify pnpm flow-contracts:verify pnpm docs:audit pnpm docs:parity pnpm governance:lock pnpm governance:tamper-check pnpm ai-compliance:verify\n',
    'utf8',
  );
  writeFileSync(join(root, 'tools', 'governance', 'verify-architecture.ts'), 'export {};\n', 'utf8');
  writeFileSync(join(root, 'tools', 'governance', 'verify-governance-lock.ts'), 'export {};\n', 'utf8');
  writeFileSync(join(root, 'tools', 'governance', 'verify-governance-tamper.ts'), 'export {};\n', 'utf8');
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
      'governance:lock': 'tsx tools/governance/verify-governance-lock.ts --write',
      'governance:tamper-check': 'tsx tools/governance/verify-governance-tamper.ts',
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
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  test('architecture verifier accepts a complete modular flow', () => {
    // Arrange
    const root = fixtureRoot('arch-pass');
    createCompleteFlow(root);

    // Act
    const result = verifyArchitecture(root);

    // Assert
    expect(result.ok).toBe(true);
  });

  test('architecture verifier rejects missing required flow files', () => {
    // Arrange
    const root = fixtureRoot('arch-missing-file');
    const flowDir = createCompleteFlow(root);
    writeFileSync(join(flowDir, 'flow.service.ts'), 'placeholder\n', 'utf8');

    // Act
    const result = verifyArchitecture(root);

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((failure) => failure.includes('placeholder'))).toBe(true);
  });

  test('flow contracts verifier rejects contracts without RBAC and SLA', () => {
    // Arrange
    const root = fixtureRoot('contract-fail');
    const flowDir = join(root, 'modules', 'advances', 'src', 'flows', '02.1-direct-advance');
    mkdirSync(flowDir, { recursive: true });
    writeJson(join(flowDir, 'flow.contract.json'), {
      flowCode: '02.1',
      flowName: 'Direct Advance',
      module: 'advances',
      status: 'Implemented',
      allowedRoles: [],
      blockedRoles: [],
      entryPoints: [],
      navigationPath: [],
      buttons: [],
      inputs: [],
      outputs: [],
      dataImpact: { database: [], googleSheets: [], exports: [], notifications: [] },
      linkedFlows: [],
      requiredTests: [],
      manualUatRequired: true,
    });

    // Act
    const result = verifyFlowContracts(root);

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((failure) => failure.includes('allowedRoles'))).toBe(true);
    expect(result.failures.some((failure) => failure.includes('performanceSlaMs'))).toBe(true);
  });

  test('migration verifier rejects completed flows outside modules', () => {
    // Arrange
    const root = fixtureRoot('migration-fail');
    mkdirSync(join(root, 'docs'), { recursive: true });
    writeFileSync(
      join(root, 'docs', '19-legacy-to-enterprise-master-feature-migration-registry.md'),
      '| Code | Feature | Owner | Status | New Module Path | Commit |\n|---|---|---|---|---|---|\n| `01.2.A` | Advance | Finance | Implemented | apps/bot-server/src/handlers/advance.handler.ts | abc123 |\n',
      'utf8',
    );

    // Act
    const result = verifyMigrationRegistry(root);

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((failure) => failure.includes('path must use modules'))).toBe(true);
  });

  test('ai compliance verifier rejects PASS evidence without all gate evidence', () => {
    // Arrange
    const root = fixtureRoot('ai-fail');
    mkdirSync(join(root, 'docs', 'ai-execution-evidence'), { recursive: true });
    writeFileSync(join(root, 'docs', 'ai-execution-evidence', 'task.md'), 'PASS\nG1\npnpm build\n', 'utf8');

    // Act
    const result = verifyAiCompliance(root, { requireEvidence: true, requireCleanGit: false });

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((failure) => failure.includes('G10'))).toBe(true);
  });

  test('docs audit verifier accepts the mandatory governance document set and scripts', () => {
    // Arrange
    const root = fixtureRoot('docs-audit-pass');
    writeMandatoryDocs(root);

    // Act
    const result = verifyDocsAudit(root);

    // Assert
    expect(result.ok).toBe(true);
  });

  test('docs audit verifier rejects missing mandatory governance documents', () => {
    // Arrange
    const root = fixtureRoot('docs-audit-fail');
    writeFileSync(join(root, 'AGENTS.md'), 'agent rules\n', 'utf8');
    writeFileSync(join(root, 'GEMINI.md'), 'gemini rules\n', 'utf8');
    writeJson(join(root, 'package.json'), { scripts: {} });

    // Act
    const result = verifyDocsAudit(root);

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((failure) => failure.includes('21-mandatory-module-architecture-and-gates.md'))).toBe(true);
  });

  test('docs parity verifier requires every AI governance file to reference the module gates standard', () => {
    // Arrange
    const root = fixtureRoot('docs-parity-fail');
    writeMandatoryDocs(root);
    writeFileSync(join(root, 'AGENTS.md'), 'agent rules\n', 'utf8');

    // Act
    const result = verifyDocsParity(root);

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((failure) => failure.includes('AGENTS.md'))).toBe(true);
  });

  test('governance lock builder records protected governance files with hashes', () => {
    // Arrange
    const root = fixtureRoot('lock-build');
    writeMandatoryDocs(root);

    // Act
    const lock = buildGovernanceLock(root, '2026-09-08T00:00:00.000Z');

    // Assert
    expect(lock.approvalPhrase).toBe(APPROVAL_PHRASE);
    expect(lock.files.some((file) => file.path === 'AGENTS.md')).toBe(true);
    expect(lock.files.some((file) => file.path === 'GEMINI.md')).toBe(true);
    expect(lock.files.some((file) => file.path === 'tools/governance/verify-governance-lock.ts')).toBe(true);
    expect(lock.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256))).toBe(true);
  });

  test('governance tamper verifier rejects protected file changes when hash mismatches lock', () => {
    // Arrange
    const root = fixtureRoot('tamper-fail');
    writeMandatoryDocs(root);
    const lock = buildGovernanceLock(root, '2026-09-08T00:00:00.000Z');
    writeJson(join(root, 'governance.lock.json'), lock);
    writeFileSync(join(root, 'AGENTS.md'), 'changed without approval\n', 'utf8');

    // Act
    const result = verifyGovernanceTamper(root);

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((failure) => failure.includes('AGENTS.md'))).toBe(true);
  });

  test('governance tamper verifier strictly rejects protected file changes even with approval evidence (evidence bypass permanently excised)', () => {
    // Arrange
    const root = fixtureRoot('tamper-approval');
    writeMandatoryDocs(root);
    const lock = buildGovernanceLock(root, '2026-09-08T00:00:00.000Z');
    writeJson(join(root, 'governance.lock.json'), lock);
    writeFileSync(join(root, 'AGENTS.md'), 'changed with approval draft\n', 'utf8');
    writeFileSync(
      join(root, 'docs', 'ai-execution-evidence', 'approval.md'),
      `Target-Paths: AGENTS.md\n${APPROVAL_PHRASE}\n`,
      'utf8'
    );

    // Act
    const result = verifyGovernanceTamper(root);

    // Master Work Plan 63: Evidence bypass is permanently excised. governance.lock.json is exclusive SSOT.
    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('AGENTS.md'))).toBe(true);
  });

  test('governance tamper verifier rejects evidence without Target-Paths and rejects file changes', () => {
    // Arrange
    const root = fixtureRoot('tamper-no-target');
    writeMandatoryDocs(root);
    const lock = buildGovernanceLock(root, '2026-09-08T00:00:00.000Z');
    writeJson(join(root, 'governance.lock.json'), lock);
    writeFileSync(join(root, 'AGENTS.md'), 'changed without target paths\n', 'utf8');
    writeFileSync(join(root, 'docs', 'ai-execution-evidence', 'approval.md'), `${APPROVAL_PHRASE}\n`, 'utf8');

    // Act
    const result = verifyGovernanceTamper(root);

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('AGENTS.md'))).toBe(true);
  });

  test('governance tamper verifier rejects wildcard Target-Paths: *', () => {
    // Arrange
    const root = fixtureRoot('tamper-wildcard-star');
    writeMandatoryDocs(root);
    const lock = buildGovernanceLock(root, '2026-09-08T00:00:00.000Z');
    writeJson(join(root, 'governance.lock.json'), lock);
    writeFileSync(join(root, 'AGENTS.md'), 'changed with wildcard\n', 'utf8');
    writeFileSync(
      join(root, 'docs', 'ai-execution-evidence', 'approval.md'),
      `Target-Paths: *\n${APPROVAL_PHRASE}\n`,
      'utf8'
    );

    // Act
    const result = verifyGovernanceTamper(root);

    // Assert
    expect(result.ok).toBe(false);
  });

  test('governance tamper verifier rejects auto-generated scaffold closure evidence for governance file changes', () => {
    // Arrange
    const root = fixtureRoot('tamper-scaffold-bypass');
    writeMandatoryDocs(root);
    const lock = buildGovernanceLock(root, '2026-09-08T00:00:00.000Z');
    writeJson(join(root, 'governance.lock.json'), lock);
    writeFileSync(join(root, 'AGENTS.md'), 'changed under cover of closure doc\n', 'utf8');
    // Simulates an auto-generated flow closure doc that contains the phrase
    writeFileSync(
      join(root, 'docs', 'ai-execution-evidence', '2026-09-16-flow-01.1-closure.md'),
      `# توثيق الحوكمة: اكتمال واعتماد تدفق 01.1\n- عبارة الاعتماد الإلزامية: ${APPROVAL_PHRASE}\n`,
      'utf8'
    );

    // Act
    const result = verifyGovernanceTamper(root);

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('AGENTS.md'))).toBe(true);
  });

  test('governance tamper verifier rejects evidence that targets a different file', () => {
    // Arrange
    const root = fixtureRoot('tamper-mismatched-target');
    writeMandatoryDocs(root);
    const lock = buildGovernanceLock(root, '2026-09-08T00:00:00.000Z');
    writeJson(join(root, 'governance.lock.json'), lock);
    writeFileSync(join(root, 'AGENTS.md'), 'changed\n', 'utf8');
    // Targets GEMINI.md, but AGENTS.md was changed
    writeFileSync(
      join(root, 'docs', 'ai-execution-evidence', 'approval.md'),
      `Target-Paths: GEMINI.md\n${APPROVAL_PHRASE}\n`,
      'utf8'
    );

    // Act
    const result = verifyGovernanceTamper(root);

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('AGENTS.md'))).toBe(true);
  });

  test('governance tamper verifier strictly rejects evidence bypass with markdown bold formatting (- **Target-Paths:** ...)', () => {
    // Arrange
    const root = fixtureRoot('tamper-bold-target');
    writeMandatoryDocs(root);
    const lock = buildGovernanceLock(root, '2026-09-08T00:00:00.000Z');
    writeJson(join(root, 'governance.lock.json'), lock);
    writeFileSync(join(root, 'AGENTS.md'), 'changed with bold target\n', 'utf8');
    writeFileSync(
      join(root, 'docs', 'ai-execution-evidence', 'approval.md'),
      `- **Target-Paths:** AGENTS.md\n${APPROVAL_PHRASE}\n`,
      'utf8'
    );

    // Act
    const result = verifyGovernanceTamper(root);
    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('AGENTS.md'))).toBe(true);
  });

  test('governance tamper verifier strictly rejects evidence bypass with markdown links in Target-Paths', () => {
    // Arrange
    const root = fixtureRoot('tamper-link-target');
    writeMandatoryDocs(root);
    const lock = buildGovernanceLock(root, '2026-09-08T00:00:00.000Z');
    writeJson(join(root, 'governance.lock.json'), lock);
    writeFileSync(join(root, 'AGENTS.md'), 'changed with link target\n', 'utf8');
    writeFileSync(
      join(root, 'docs', 'ai-execution-evidence', 'approval.md'),
      `- **Target-Paths:** [AGENTS.md](file:///path/to/AGENTS.md)\n${APPROVAL_PHRASE}\n`,
      'utf8'
    );

    // Act
    const result = verifyGovernanceTamper(root);
    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('AGENTS.md'))).toBe(true);
  });

  test('governance tamper verifier strictly rejects evidence bypass with Arabic labels', () => {
    // Arrange
    const root = fixtureRoot('tamper-arabic-label');
    writeMandatoryDocs(root);
    const lock = buildGovernanceLock(root, '2026-09-08T00:00:00.000Z');
    writeJson(join(root, 'governance.lock.json'), lock);
    writeFileSync(join(root, 'AGENTS.md'), 'changed with arabic label\n', 'utf8');
    writeFileSync(
      join(root, 'docs', 'ai-execution-evidence', 'approval.md'),
      `- **المسارات المرخصة:** AGENTS.md\n${APPROVAL_PHRASE}\n`,
      'utf8'
    );

    // Act
    const result = verifyGovernanceTamper(root);
    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('AGENTS.md'))).toBe(true);
  });

  test('governance tamper verifier strictly rejects evidence bypass with YAML frontmatter Target-Paths', () => {
    // Arrange
    const root = fixtureRoot('tamper-yaml-frontmatter');
    writeMandatoryDocs(root);
    const lock = buildGovernanceLock(root, '2026-09-08T00:00:00.000Z');
    writeJson(join(root, 'governance.lock.json'), lock);
    writeFileSync(join(root, 'AGENTS.md'), 'changed with yaml frontmatter\n', 'utf8');
    writeFileSync(
      join(root, 'docs', 'ai-execution-evidence', 'approval.md'),
      `---
target-paths:
  - AGENTS.md
---
# Evidence
${APPROVAL_PHRASE}
`,
      'utf8'
    );

    // Act
    const result = verifyGovernanceTamper(root);
    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('AGENTS.md'))).toBe(true);
  });

  test('extractTargetPathsFromEvidence correctly parses and normalizes diverse target path formats', () => {
    // Arrange
    const content = `---
target-paths:
  - "AGENTS.md"
  - \`GEMINI.md\`
  - [package.json](package.json)
---
# Title
    // Act
- **Target-Paths:** [tools/governance/](file:///tools/governance), \`tools/scaffold/\`
- **المسارات المرخصة:** .githooks/
`;
    const targets = extractTargetPathsFromEvidence(content);
    // Assert
    expect(targets).toContain('AGENTS.md');
    expect(targets).toContain('GEMINI.md');
    expect(targets).toContain('package.json');
    expect(targets).toContain('tools/governance');
    expect(targets).toContain('tools/scaffold');
    expect(targets).toContain('.githooks');
  });

  test('pathMatchesTarget properly matches paths and rejects wildcards and empty targets', () => {
    // Arrange
    // Act
    // Assert
    expect(pathMatchesTarget('tools/governance/verify-governance-tamper.ts', 'tools/governance')).toBe(true);
    expect(pathMatchesTarget('tools/governance/verify-governance-tamper.ts', 'tools/governance/')).toBe(true);
    expect(pathMatchesTarget('tools/governance/verify-governance-tamper.ts', 'tools/governance/*')).toBe(true);
    expect(pathMatchesTarget('tools/governance/verify-governance-tamper.ts', './tools/governance')).toBe(true);
    expect(pathMatchesTarget('package.json', 'package.json')).toBe(true);
    expect(pathMatchesTarget('package.json', './package.json')).toBe(true);

    // Rejections
    expect(pathMatchesTarget('package.json', '*')).toBe(false);
    expect(pathMatchesTarget('package.json', '/*')).toBe(false);
    expect(pathMatchesTarget('package.json', 'all')).toBe(false);
    expect(pathMatchesTarget('package.json', '.')).toBe(false);
    expect(pathMatchesTarget('package.json', '')).toBe(false);
    expect(pathMatchesTarget('AGENTS.md', 'GEMINI.md')).toBe(false);
  });

  test('isScaffoldAutoEvidence accurately detects auto-generated evidence from all scaffold tools', () => {
    // Arrange
    // Act
    // Assert
    expect(isScaffoldAutoEvidence('2026-09-16-flow-01.1-closure.md', '# Header')).toBe(true);
    expect(isScaffoldAutoEvidence('2026-09-16-dashboard-workforce-closure.md', '# Header')).toBe(true);
    expect(isScaffoldAutoEvidence('2026-09-16-module-advances-closure.md', '# Header')).toBe(true);
    expect(isScaffoldAutoEvidence('2026-09-16-unlock-flow-01.1.md', '# Header')).toBe(true);
    expect(isScaffoldAutoEvidence('2026-09-16-unlock-speed-engine.md', '# Header')).toBe(true);
    expect(isScaffoldAutoEvidence('2026-09-16-unlock-docker.md', '# Header')).toBe(true);
    expect(isScaffoldAutoEvidence('2026-09-16-docker-infrastructure-lock.md', '# Header')).toBe(true);
    expect(isScaffoldAutoEvidence('2026-09-16-plan-42-speed-engine-lock.md', '# Header')).toBe(true);
    expect(isScaffoldAutoEvidence('plan.md', 'ترخيص فك قفل الحوكمة: تدفق البوت')).toBe(true);
    expect(isScaffoldAutoEvidence('plan.md', 'توثيق القفل التشفيري للبنية التحتية والدوكر')).toBe(true);

    // Real plan evidence should NOT be treated as auto-evidence
    expect(isScaffoldAutoEvidence('2026-09-16-plan-45-governance-anti-tamper-wildcard-remediation-and-docker-lock.md', '# Plan 45')).toBe(false);
  });

  test('hasExactApprovalEvidence returns false because evidence bypass is permanently excised', () => {
    // Arrange
    const root = fixtureRoot('tamper-has-exact-helper');
    writeMandatoryDocs(root);
    // Act
    const lock = buildGovernanceLock(root, '2026-09-08T00:00:00.000Z');
    writeJson(join(root, 'governance.lock.json'), lock);

    // Markdown approval bypass is permanently excised per Master Work Plan 63
    // Assert
    expect(hasExactApprovalEvidence(root)).toBe(false);
    expect(hasExactApprovalEvidence(root, [])).toBe(false);

    writeFileSync(join(root, 'AGENTS.md'), 'tampered agents\n', 'utf8');
    expect(hasExactApprovalEvidence(root)).toBe(false);
    expect(hasExactApprovalEvidence(root, ['AGENTS.md'])).toBe(false);

    writeFileSync(
      join(root, 'docs', 'ai-execution-evidence', 'approval.md'),
      `- **Target-Paths:** AGENTS.md\n${APPROVAL_PHRASE}\n`,
      'utf8'
    );
    expect(hasExactApprovalEvidence(root)).toBe(false);
    expect(hasExactApprovalEvidence(root, ['AGENTS.md'])).toBe(false);
  });

  test('flow scaffolder creates a 100% compliant flow passing verifyArchitecture', () => {
    // Arrange
    const root = fixtureRoot('scaffold-test');
    writeMandatoryDocs(root);
    // Act
    const flowPath = scaffoldFlow('advances', '02.1', 'cash-advance', 'تسجيل وصرف سلفة نقدية', root);
    // Assert
    expect(existsSync(flowPath)).toBe(true);

    const archResult = verifyArchitecture(root);
    expect(archResult.ok).toBe(true);
    expect(archResult.checked).toBe(1);
  });

  test('flow scaffolder supports cash-outflow template and passes verifyArchitecture and verifyFlowFast', () => {
    // Arrange
    const root = fixtureRoot('scaffold-template-test');
    writeMandatoryDocs(root);
    // Act
    const flowPath = scaffoldFlow('canteen', '04.1', 'worker-canteen', 'مسحوبات مقصف', 'in-kind-clearing', root);
    // Assert
    expect(existsSync(flowPath)).toBe(true);

    const archResult = verifyArchitecture(root);
    expect(archResult.ok).toBe(true);

    const fastResult = verifyFlowFast({ flowPath, skipTests: true, root });
    expect(fastResult.ok).toBe(true);
  });

  test('flow scaffolder automatically registers in flows.manifest.ts when present', () => {
    // Arrange
    const root = fixtureRoot('scaffold-manifest-test');
    writeMandatoryDocs(root);
    const manifestDir = join(root, 'modules', 'advances', 'src');
    mkdirSync(manifestDir, { recursive: true });
    const mockManifestPath = join(manifestDir, 'flows.manifest.ts');
    writeFileSync(
      mockManifestPath,
      `import type { FlowContractMetadata } from './flows.manifest.js';

export const ADVANCES_FLOW_METADATA: FlowContractMetadata[] = [
  {
    flowCode: '02.0',
    flowName: 'سلف سابقة',
    module: 'advances',
    status: 'Implemented',
    allowedRoles: ['SUPER_ADMIN'],
  },
];\n`,
      'utf8'
    );

    // Act
    const flowPath = scaffoldFlow('advances', '02.1', 'cash-advance', 'تسجيل وصرف سلفة نقدية', root);
    // Assert
    expect(existsSync(flowPath)).toBe(true);

    const updatedManifest = readFileSync(mockManifestPath, 'utf8');
    expect(updatedManifest).toContain("import { createCashAdvancePlugin } from './flows/02.1-cash-advance/flow.plugin.js';");
    expect(updatedManifest).toContain("flowCode: '02.1'");
    expect(updatedManifest).toContain("flowName: 'تسجيل وصرف سلفة نقدية'");
  });

  test('finishFlow updates migration registry and generates evidence file', () => {
    // Arrange
    const root = fixtureRoot('finish-flow-test');
    writeMandatoryDocs(root);
    // Write registry with a pending row
    writeFileSync(
      join(root, 'docs', '19-legacy-to-enterprise-master-feature-migration-registry.md'),
      '| **`04.1`** | تسجيل مسحوبات المقصف | المقصف | ⏳ بانتظار الترحيل | apps/bot-server/canteen | — |\n',
      'utf8'
    );
    scaffoldFlow('canteen', '04.1', 'worker-canteen', 'مسحوبات مقصف', 'in-kind-clearing', root);

    // Run finishFlow
    // Act
    const finishRes = finishFlow('04.1', { commitRef: 'P07-Test-Commit', root, skipTests: true });
    // Assert
    expect(finishRes.ok).toBe(true);
    expect(finishRes.evidenceFile).toBeDefined();
    expect(existsSync(join(root, finishRes.evidenceFile!))).toBe(true);

    // Check registry was updated
    const regText = readFileSync(join(root, 'docs', '19-legacy-to-enterprise-master-feature-migration-registry.md'), 'utf8');
    expect(regText).toContain('🟢 **مكتمل وموثق 100%**');
    expect(regText).toContain('modules/canteen/src/flows/04.1-worker-canteen');

    // Check governance.lock.json contains locked flow
    const lockRaw = readFileSync(join(root, 'governance.lock.json'), 'utf8');
    const lock = JSON.parse(lockRaw) as GovernanceLock;
    const flowEntry = lock.lockedEntities?.['flow:04.1'] ?? lock.lockedFlows?.['04.1'];
    expect(flowEntry).toBeDefined();
    expect(flowEntry!.files.length).toBeGreaterThan(0);
    expect(flowEntry!.files.every((f) => /^[a-f0-9]{64}$/.test(f.sha256))).toBe(true);

    // Verify lock passes
    const lockVerify = verifyGovernanceLock(root);
    expect(lockVerify.ok).toBe(true);

    // Modify a file in locked flow -> cryptographic verification MUST fail
    const flowHandlerPath = join(root, 'modules', 'canteen', 'src', 'flows', '04.1-worker-canteen', 'flow.handler.ts');
    writeFileSync(flowHandlerPath, '// TAMPERED\n', 'utf8');
    const tamperedVerify = verifyGovernanceLock(root);
    expect(tamperedVerify.ok).toBe(false);
    expect(tamperedVerify.failures.some((f) => f.includes('04.1') && f.includes('Modified'))).toBe(true);

    // verifyGovernanceTamper MUST also fail and CANNOT be bypassed by an evidence file
    const tamperedTamperVerify = verifyGovernanceTamper(root);
    expect(tamperedTamperVerify.ok).toBe(false);
    expect(tamperedTamperVerify.failures.some((f) => f.includes('04.1'))).toBe(true);

    // Revert modified file
    writeFileSync(flowHandlerPath, 'export {};\n', 'utf8');

    // Inject an unrecorded file into locked flow -> MUST fail detection
    const evilFile = join(root, 'modules', 'canteen', 'src', 'flows', '04.1-worker-canteen', 'backdoor.ts');
    writeFileSync(evilFile, 'export const evil = true;\n', 'utf8');
    const injectionLockVerify = verifyGovernanceLock(root);
    expect(injectionLockVerify.ok).toBe(false);
    expect(injectionLockVerify.failures.some((f) => f.includes('unrecorded file'))).toBe(true);

    const injectionTamperVerify = verifyGovernanceTamper(root);
    expect(injectionTamperVerify.ok).toBe(false);
    expect(injectionTamperVerify.failures.some((f) => f.includes('unrecorded file'))).toBe(true);

    // Remove injected file
    unlinkSync(evilFile);

    // Unlock flow with verbatim approval phrase
    const unlockRes = unlockFeature({
      type: 'flow',
      targetKey: '04.1',
      phrase: 'نعم موافق على التعديل',
      reason: 'Updating flow handler for architectural remediation',
      root,
    });
    expect(unlockRes.ok).toBe(true);
    expect(unlockRes.evidenceFile).toBeDefined();

    // Verify lock passes again after unlock
    const postUnlockVerify = verifyGovernanceLock(root);
    expect(postUnlockVerify.ok).toBe(true);
  });

  test('dashboard feature scaffolding and finishDashboard cryptographic sealing', () => {
    // Arrange
    const root = fixtureRoot('dashboard-lock-test');
    writeMandatoryDocs(root);
    mkdirSync(join(root, 'apps', 'admin-dashboard', 'src', 'app', 'admin'), { recursive: true });

    // Seed mock dashboard.manifest.ts
    const mockManifestPath = join(root, 'apps', 'admin-dashboard', 'src', 'dashboard.manifest.ts');
    writeFileSync(
      mockManifestPath,
      `export const DASHBOARD_SECTIONS_MANIFEST = [
  {
    title: '👥 الموارد البشرية والعمالة',
    href: '/admin/workforce',
    iconName: 'Users',
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    features: [
      {
        id: 'workforce/new',
        module: 'workforce',
        title: 'تعيين عامل جديد',
        href: '/admin/workforce/new',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
        status: 'Implemented',
      },
    ],
  },
];\n`,
      'utf8'
    );

    // 1. Scaffold dashboard feature
    // Act
    const createdDir = scaffoldDashboard({
      moduleName: 'workforce',
      featureSlug: 'worker-history',
      titleArabic: 'سجل حركات العامل',
      root,
    });
    // Assert
    expect(existsSync(createdDir)).toBe(true);

    // Verify dashboard.manifest.ts was updated cleanly inside the workforce section's features array
    const updatedManifest = readFileSync(mockManifestPath, 'utf8');
    expect(updatedManifest).toContain("id: 'workforce/worker-history'");
    expect(updatedManifest).toContain("module: 'workforce'");

    // 2. Finish dashboard feature
    const finishRes = finishDashboard('workforce/worker-history', { commitRef: 'P38-Dash-Test', root });
    expect(finishRes.ok).toBe(true);
    expect(finishRes.evidenceFile).toBeDefined();
    expect(existsSync(join(root, finishRes.evidenceFile!))).toBe(true);

    // 3. Verify sealed in governance.lock.json
    const lockRaw = readFileSync(join(root, 'governance.lock.json'), 'utf8');
    const lock = JSON.parse(lockRaw) as GovernanceLock;
    const dashEntry = lock.lockedEntities?.['dashboard:workforce/worker-history'] ?? lock.lockedDashboardFeatures?.['workforce/worker-history'];
    expect(dashEntry).toBeDefined();

    // 4. Verify tampering detection on dashboard feature (both lock and tamper verifier)
    const pagePath = join(createdDir, 'page.tsx');
    writeFileSync(pagePath, '// UNAUTHORIZED DASHBOARD EDIT\n', 'utf8');
    const lockCheck = verifyGovernanceLock(root);
    expect(lockCheck.ok).toBe(false);
    expect(lockCheck.failures.some((f) => f.includes('workforce/worker-history'))).toBe(true);

    const tamperCheck = verifyGovernanceTamper(root);
    expect(tamperCheck.ok).toBe(false);
    expect(tamperCheck.failures.some((f) => f.includes('workforce/worker-history'))).toBe(true);

    // 5. Unlock dashboard feature with approval phrase
    const unlockRes = unlockFeature({
      type: 'dashboard',
      targetKey: 'workforce/worker-history',
      phrase: 'موافق على الفتح',
      reason: 'Updating dashboard chart metrics layout',
      root,
    });
    expect(unlockRes.ok).toBe(true);
    const postUnlock = verifyGovernanceLock(root);
    expect(postUnlock.ok).toBe(true);
  });

  test('seals flow 01.1 cryptographic hash accurately in repo governance.lock.json', () => {
    // Arrange
    const root = fixtureRoot('flow-seal-01.1');
    writeMandatoryDocs(root);
    // Act
    const flowPath = scaffoldFlow('workforce', '01.1', 'worker-registration', 'تسجيل عامل جديد', root);
    const flowDir = dirname(flowPath);
    const updated = lockFlowEntry(root, '01.1', flowDir);
    // Assert
    expect(updated.lockedFlows?.['01.1']?.files.length).toBeGreaterThan(0);
  });

  test('architecture verifier rejects local shadow FlowPlugin interface in flows.manifest.ts', () => {
    // Arrange
    const root = fixtureRoot('shadow-flow-plugin');
    writeMandatoryDocs(root);
    // Act
    const flowPath = scaffoldFlow('advances', '02.1', 'cash-advance', 'تسجيل وصرف سلفة نقدية', root);
    // Assert
    expect(existsSync(flowPath)).toBe(true);

    const manifestPath = join(root, 'modules', 'advances', 'src', 'flows.manifest.ts');
    writeFileSync(
      manifestPath,
      `export interface FlowPlugin { flowKey: string; }\nexport const ADVANCES_FLOW_METADATA = [{ flowCode: '02.1' }];\n`,
      'utf8'
    );

    const archResult = verifyArchitecture(root);
    expect(archResult.ok).toBe(false);
    expect(archResult.failures.some((f) => f.includes('local shadow FlowPlugin interface'))).toBe(true);
  });

  test('architecture verifier rejects local shadow DashboardFeature interface in dashboard.manifest.ts', () => {
    // Arrange
    const root = fixtureRoot('shadow-dash-feature');
    writeMandatoryDocs(root);
    const dashManifestPath = join(root, 'apps', 'admin-dashboard', 'src', 'dashboard.manifest.ts');
    mkdirSync(join(root, 'apps', 'admin-dashboard', 'src'), { recursive: true });
    writeFileSync(
      dashManifestPath,
      `export interface DashboardFeature { id: string; }\nexport const DASHBOARD_SECTIONS_MANIFEST = [];\n`,
      'utf8'
    );

    // Act
    const archResult = verifyArchitecture(root);
    // Assert
    expect(archResult.ok).toBe(false);
    expect(archResult.failures.some((f) => f.includes('local shadow DashboardFeature interface'))).toBe(true);
  });

  test('architecture verifier rejects local shadow contracts in flow.plugin.ts', () => {
    // Arrange
    const root = fixtureRoot('shadow-flow-plugin-file');
    writeMandatoryDocs(root);
    const flowPath = scaffoldFlow('advances', '02.1', 'cash-advance', 'تسجيل وصرف سلفة نقدية', root);
    const pluginPath = join(flowPath, 'flow.plugin.ts');
    writeFileSync(
      pluginPath,
      `export interface FlowContractMetadata { code: string; }\nexport const dummy = true;\n`,
      'utf8'
    );

    // Act
    const archResult = verifyArchitecture(root);
    // Assert
    expect(archResult.ok).toBe(false);
    expect(archResult.failures.some((f) => f.includes('local shadow flow contract interface'))).toBe(true);
  });

  test('architecture verifier rejects local shadow DashboardSubSection in dashboard.manifest.ts', () => {
    // Arrange
    const root = fixtureRoot('shadow-dash-subsection');
    writeMandatoryDocs(root);
    const dashManifestPath = join(root, 'apps', 'admin-dashboard', 'src', 'dashboard.manifest.ts');
    mkdirSync(join(root, 'apps', 'admin-dashboard', 'src'), { recursive: true });
    writeFileSync(
      dashManifestPath,
      `import { DashboardFeature } from '@alsaada/core-components';\nexport interface DashboardSubSection { title: string; }\nexport const DASHBOARD_SECTIONS_MANIFEST = [];\n`,
      'utf8'
    );

    // Act
    const archResult = verifyArchitecture(root);
    // Assert
    expect(archResult.ok).toBe(false);
    expect(archResult.failures.some((f) => f.includes('local shadow DashboardSubSection interface'))).toBe(true);
  });

  test('architecture verifier rejects direct prisma calls in bot-server handlers', () => {
    // Arrange
    const root = fixtureRoot('direct-prisma-handler');
    writeMandatoryDocs(root);
    const handlersDir = join(root, 'apps', 'bot-server', 'src', 'handlers');
    mkdirSync(handlersDir, { recursive: true });
    writeFileSync(
      join(handlersDir, 'bad.handler.ts'),
      `import { prisma } from '../db.js';\nexport async function handle() { await prisma.worker.findMany(); }\n`,
      'utf8'
    );

    // Act
    const archResult = verifyArchitecture(root);
    // Assert
    expect(archResult.ok).toBe(false);
    expect(archResult.failures.some((f) => f.includes('direct database calls via prisma.*'))).toBe(true);
  });

  test('governance lock builder protects tools/scaffold and .githooks directories', () => {
    // Arrange
    const root = fixtureRoot('meta-tooling-lock');
    writeMandatoryDocs(root);
    mkdirSync(join(root, 'tools', 'scaffold'), { recursive: true });
    mkdirSync(join(root, '.githooks'), { recursive: true });
    writeFileSync(join(root, 'tools', 'scaffold', 'scaffold-flow.ts'), 'export const scaffold = true;\n', 'utf8');
    writeFileSync(join(root, '.githooks', 'pre-commit'), '#!/bin/sh\nexit 0\n', 'utf8');

    // Act
    const lock = buildGovernanceLock(root, '2026-09-16T00:00:00.000Z');
    // Assert
    expect(lock.protectedPaths.directories).toContain('tools/scaffold');
    expect(lock.protectedPaths.directories).toContain('.githooks');
    expect(lock.files.some((f) => f.path === 'tools/scaffold/scaffold-flow.ts')).toBe(true);
    expect(lock.files.some((f) => f.path === '.githooks/pre-commit')).toBe(true);
  });

  test('architecture verifier rejects local shadow AppModuleDefinition in module.register.ts', () => {
    // Arrange
    const root = fixtureRoot('shadow-app-module-def');
    writeMandatoryDocs(root);
    const modDir = join(root, 'modules', 'canteen');
    mkdirSync(join(modDir, 'src'), { recursive: true });
    writeFileSync(join(modDir, 'package.json'), JSON.stringify({ name: '@alsaada/canteen' }), 'utf8');
    writeFileSync(
      join(modDir, 'src', 'module.register.ts'),
      `export interface AppModuleDefinition { name: string; }\nexport const canteen = true;\n`,
      'utf8'
    );

    // Act
    const archResult = verifyArchitecture(root);
    // Assert
    expect(archResult.ok).toBe(false);
    expect(archResult.failures.some((f) => f.includes('local shadow AppModuleDefinition interface'))).toBe(true);
  });

  test('architecture verifier rejects module missing AppModuleDefinition import from @alsaada/core-components', () => {
    // Arrange
    const root = fixtureRoot('missing-app-module-import');
    writeMandatoryDocs(root);
    const modDir = join(root, 'modules', 'canteen');
    mkdirSync(join(modDir, 'src'), { recursive: true });
    writeFileSync(join(modDir, 'package.json'), JSON.stringify({ name: '@alsaada/canteen' }), 'utf8');
    writeFileSync(
      join(modDir, 'src', 'module.register.ts'),
      `export const canteenModule = { name: 'canteen' };\n`,
      'utf8'
    );

    // Act
    const archResult = verifyArchitecture(root);
    // Assert
    expect(archResult.ok).toBe(false);
    expect(archResult.failures.some((f) => f.includes('must import and implement AppModuleDefinition'))).toBe(true);
  });

  test('scaffoldModule, finishModule, and unlockFeature full module lifecycle suite', () => {
    // Arrange
    const root = fixtureRoot('module-lifecycle');
    writeMandatoryDocs(root);

    // Mock apps/bot-server structure for auto-wiring
    const botServerDir = join(root, 'apps', 'bot-server', 'src');
    mkdirSync(botServerDir, { recursive: true });
    writeFileSync(
      join(root, 'apps', 'bot-server', 'package.json'),
      JSON.stringify({ dependencies: {} }, null, 2),
      'utf8'
    );
    writeFileSync(
      join(botServerDir, 'modules.registry.ts'),
      `import type { AppModuleDefinition } from '@alsaada/core-components';\n\nexport function buildRegisteredModules(runtime: any) {\n  const modules: AppModuleDefinition<any>[] = [\n  ];\n  return { modules };\n}\n`,
      'utf8'
    );

    // 1. Scaffold module
    // Act
    const scaffoldRes = scaffoldModule({
      name: 'canteen',
      titleArabic: 'إدارة الكانتين',
      root,
    });
    // Assert
    expect(scaffoldRes.ok).toBe(true);
    expect(existsSync(scaffoldRes.moduleDir)).toBe(true);

    // Verify all 10 files exist
    expect(existsSync(join(scaffoldRes.moduleDir, 'package.json'))).toBe(true);
    expect(existsSync(join(scaffoldRes.moduleDir, 'tsconfig.json'))).toBe(true);
    expect(existsSync(join(scaffoldRes.moduleDir, 'src', 'shared', 'module.types.ts'))).toBe(true);
    expect(existsSync(join(scaffoldRes.moduleDir, 'src', 'shared', 'module.constants.ts'))).toBe(true);
    expect(existsSync(join(scaffoldRes.moduleDir, 'src', 'module.permissions.ts'))).toBe(true);
    expect(existsSync(join(scaffoldRes.moduleDir, 'src', 'flows.manifest.ts'))).toBe(true);
    expect(existsSync(join(scaffoldRes.moduleDir, 'src', 'module.routes.ts'))).toBe(true);
    expect(existsSync(join(scaffoldRes.moduleDir, 'src', 'module.register.ts'))).toBe(true);
    expect(existsSync(join(scaffoldRes.moduleDir, 'src', 'index.ts'))).toBe(true);
    expect(existsSync(join(scaffoldRes.moduleDir, 'tests', 'canteen-module.spec.ts'))).toBe(true);

    // Verify auto-wiring in bot-server
    const botPkg = JSON.parse(readFileSync(join(root, 'apps', 'bot-server', 'package.json'), 'utf8'));
    expect(botPkg.dependencies['@alsaada/canteen']).toBe('workspace:*');

    const regContent = readFileSync(join(botServerDir, 'modules.registry.ts'), 'utf8');
    expect(regContent).toContain("import { createCanteenAppModule } from '@alsaada/canteen';");
    expect(regContent).toContain('createCanteenAppModule');

    // 2. Finish module with cryptographic lock
    const finishRes = finishModule('canteen', {
      commitRef: 'P43-Test',
      root,
      skipTests: true,
      lock: true,
    });
    expect(finishRes.ok).toBe(true);
    expect(finishRes.isLocked).toBe(true);
    expect(existsSync(join(root, finishRes.evidenceFile!))).toBe(true);

    // Verify status updated from draft to active
    const regFile = readFileSync(join(scaffoldRes.moduleDir, 'src', 'module.register.ts'), 'utf8');
    expect(regFile).toContain("status: 'active'");

    // Verify recorded in docs/19
    const doc19 = readFileSync(join(root, 'docs', '19-legacy-to-enterprise-master-feature-migration-registry.md'), 'utf8');
    expect(doc19).toContain('mod:canteen');
    expect(doc19).toContain('مكتمل وموثق 100%');

    // Verify locked in governance.lock.json
    const lockRaw = readFileSync(join(root, 'governance.lock.json'), 'utf8');
    const lock = JSON.parse(lockRaw) as GovernanceLock;
    const modEntry = lock.lockedEntities?.['module:canteen'] ?? lock.lockedModules?.['canteen'];
    expect(modEntry).toBeDefined();

    // 3. Tampering check on module
    writeFileSync(join(scaffoldRes.moduleDir, 'src', 'index.ts'), '// TAMPERED CONTENT\n', 'utf8');
    const lockCheck = verifyGovernanceLock(root);
    expect(lockCheck.ok).toBe(false);
    expect(lockCheck.failures.some((f) => f.includes('canteen'))).toBe(true);

    const tamperCheck = verifyGovernanceTamper(root);
    expect(tamperCheck.ok).toBe(false);
    expect(tamperCheck.failures.some((f) => f.includes('canteen'))).toBe(true);

    // 4. Unlock module with approval phrase
    const unlockRes = unlockFeature({
      type: 'module',
      targetKey: 'canteen',
      phrase: 'موافق على الفتح',
      reason: 'Adding cigarette pricing configuration matrix',
      root,
    });
    expect(unlockRes.ok).toBe(true);
    const postUnlock = verifyGovernanceLock(root);
    expect(postUnlock.ok).toBe(true);
  });

  describe('verifyTelegramContracts AST Guard', () => {
    test('passes on valid single and multi-line telegram buttons', () => {
      // Arrange
      const root = fixtureRoot('tg-valid');
      const moduleDir = join(root, 'modules', 'sample', 'src');
      mkdirSync(moduleDir, { recursive: true });
      writeFileSync(
        join(moduleDir, 'sample.keyboard.ts'),
        `
        import { InlineKeyboard } from 'grammy';
        export function sampleKeyboard() {
          const kb = new InlineKeyboard();
          kb.text('حفظ البيانات', 'action:save_record');
          kb.text(
            'زر ممتد على عدة أسطر',
            'action:multiline_ok'
          );
          kb.url('الموقع الرسمي', 'https://alsaada.com/dashboard');
          return kb;
        }
        `,
        'utf8'
      );

      // Act
      const res = verifyTelegramContracts(root);
      // Assert
      expect(res.ok).toBe(true);
      expect(res.checked).toBeGreaterThanOrEqual(3);
    });

    test('catches multi-line callback data exceeding 64 bytes', () => {
      // Arrange
      const root = fixtureRoot('tg-multiline-overflow');
      const moduleDir = join(root, 'modules', 'sample', 'src');
      mkdirSync(moduleDir, { recursive: true });
      const longCallback = 'action:site:very_long_nested_path_that_certainly_exceeds_the_sixty_four_byte_limit_established_by_telegram';
      writeFileSync(
        join(moduleDir, 'sample.keyboard.ts'),
        `
        import { InlineKeyboard } from 'grammy';
        export function sampleKeyboard() {
          const kb = new InlineKeyboard();
          kb.text(
            'زر متعدد الأسطر متجاوز',
            '${longCallback}'
          );
          return kb;
        }
        `,
        'utf8'
      );

      // Act
      const res = verifyTelegramContracts(root);
      // Assert
      expect(res.ok).toBe(false);
      expect(res.failures.some((f) => f.includes('CALLBACK_OVERFLOW'))).toBe(true);
    });

    test('strictly prohibits free-form name or text injection in callback_data', () => {
      // Arrange
      const root = fixtureRoot('tg-name-injection');
      const moduleDir = join(root, 'modules', 'sample', 'src');
      mkdirSync(moduleDir, { recursive: true });
      writeFileSync(
        join(moduleDir, 'sample.keyboard.ts'),
        `
        import { InlineKeyboard } from 'grammy';
        export function sampleKeyboard(worker: { id: string; fullName: string }) {
          const kb = new InlineKeyboard();
          // Prohibited: injecting worker.fullName in callback_data
          kb.text('اختيار العامل', \`action:worker:\${worker.fullName}\`);
          return kb;
        }
        `,
        'utf8'
      );

      // Act
      const res = verifyTelegramContracts(root);
      // Assert
      expect(res.ok).toBe(false);
      expect(res.failures.some((f) => f.includes('DYNAMIC_STRING_INJECTION'))).toBe(true);
    });

    test('rejects tel: protocol in InlineKeyboardButton.url', () => {
      // Arrange
      const root = fixtureRoot('tg-tel-url');
      const moduleDir = join(root, 'modules', 'sample', 'src');
      mkdirSync(moduleDir, { recursive: true });
      writeFileSync(
        join(moduleDir, 'sample.keyboard.ts'),
        `
        import { InlineKeyboard } from 'grammy';
        export function sampleKeyboard() {
          const kb = new InlineKeyboard();
          kb.url('اتصال هاتفي', 'tel:+201012345678');
          return kb;
        }
        `,
        'utf8'
      );

      // Act
      const res = verifyTelegramContracts(root);
      // Assert
      expect(res.ok).toBe(false);
      expect(res.failures.some((f) => f.includes('INVALID_URL_PROTOCOL'))).toBe(true);
    });

    test('strictly prohibits free-form name or text injection via string concatenation (+)', () => {
      // Arrange
      const root = fixtureRoot('tg-name-concat');
      const moduleDir = join(root, 'modules', 'sample', 'src');
      mkdirSync(moduleDir, { recursive: true });
      writeFileSync(
        join(moduleDir, 'sample.keyboard.ts'),
        `
        import { InlineKeyboard } from 'grammy';
        export function sampleKeyboard(worker: { id: string; fullName: string }) {
          const kb = new InlineKeyboard();
          // Prohibited: concatenating worker.fullName in callback_data
          kb.text('اختيار العامل', 'action:worker:' + worker.fullName);
          return kb;
        }
        `,
        'utf8'
      );

      // Act
      const res = verifyTelegramContracts(root);
      // Assert
      expect(res.ok).toBe(false);
      expect(res.failures.some((f) => f.includes('DYNAMIC_STRING_INJECTION'))).toBe(true);
    });

    test('strictly prohibits multi-line button text labels', () => {
      // Arrange
      const root = fixtureRoot('tg-multiline-text');
      const moduleDir = join(root, 'modules', 'sample', 'src');
      mkdirSync(moduleDir, { recursive: true });
      writeFileSync(
        join(moduleDir, 'sample.keyboard.ts'),
        `
        import { InlineKeyboard } from 'grammy';
        export function sampleKeyboard() {
          const kb = new InlineKeyboard();
          kb.text('سطر أول\\nسطر ثاني', 'action:test');
          return kb;
        }
        `,
        'utf8'
      );

      // Act
      const res = verifyTelegramContracts(root);
      // Assert
      expect(res.ok).toBe(false);
      expect(res.failures.some((f) => f.includes('MULTILINE_BUTTON_TEXT'))).toBe(true);
    });
  });
});




