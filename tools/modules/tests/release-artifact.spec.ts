import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildRelease, computeCoreHash } from '../build-release.js';
import { verifyRelease } from '../verify-release.js';
import { deployRelease } from '../deploy-release.js';

describe('Work Plan 89 — Production Release Artifact, Build & Deployment (Phase P7)', () => {
  const sandboxDir = path.resolve(process.cwd(), 'tmp-test-release-sandbox');

  beforeEach(() => {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
    fs.mkdirSync(sandboxDir, { recursive: true });

    // Setup minimal modules in sandbox
    const mod1Dir = path.join(sandboxDir, 'modules', 'alpha-ops');
    fs.mkdirSync(path.join(mod1Dir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(mod1Dir, 'package.json'),
      JSON.stringify({ name: '@alsaada/module-alpha-ops', version: '2.0.0' })
    );
    fs.writeFileSync(
      path.join(mod1Dir, 'module.contract.json'),
      JSON.stringify({
        schemaVersion: '2.0.0',
        id: 'alpha-ops',
        titleArabic: 'عمليات ألفا',
        version: '2.0.0',
        status: 'ready',
        requiredCapabilities: ['storage:attachment'],
        callbackPrefixes: ['action:alpha:'],
        flows: [
          {
            id: '89.1',
            slug: 'do-alpha',
            titleArabic: 'إجراء ألفا',
            version: '2.0.0',
            status: 'ready',
            module: 'alpha-ops',
            topicId: 1,
            actionPrefix: 'action:alpha:do',
            requiredPermissions: ['ops:alpha'],
            sessionStateSchema: 'types.ts#AlphaSession',
            entrypointFiles: {
              contract: 'flow.contract.json',
              handler: 'controller.ts',
              service: 'service.ts',
              keyboard: 'menu.builder.ts',
              types: 'types.ts',
              validators: 'validator.ts',
              messages: 'menu.builder.ts',
              telemetry: 'controller.ts',
              docs: 'flow.docs.md',
            },
            menuButton: {
              labelArabic: 'إجراء ألفا',
              callbackData: 'action:alpha:do:start',
              row: 1,
              order: 1,
            },
            telegramBudget: {
              maxCallbackBytes: 64,
              maxButtonChars: 16,
              maxKeyboardRows: 7,
              maxButtonsPerRow: 3,
            },
            idempotencyRequired: true,
            typesafeQuestions: [],
          },
        ],
      })
    );
    // Create flow directory and flow contract
    const flowDir = path.join(mod1Dir, 'src', 'flows', '89.1-do-alpha');
    fs.mkdirSync(flowDir, { recursive: true });
    fs.writeFileSync(
      path.join(flowDir, 'flow.contract.json'),
      JSON.stringify({
        schemaVersion: '2.0.0',
        id: '89.1',
        module: 'alpha-ops',
        slug: 'do-alpha',
        titleArabic: 'إجراء ألفا',
        status: 'ready',
        topicId: 1,
        actionPrefix: 'action:alpha:do',
        requiredPermissions: ['ops:alpha'],
        sessionStateSchema: 'types.ts#AlphaSession',
        entrypointFiles: {
          contract: 'flow.contract.json',
          handler: 'controller.ts',
          service: 'service.ts',
          keyboard: 'menu.builder.ts',
          types: 'types.ts',
          validators: 'validator.ts',
          messages: 'menu.builder.ts',
          telemetry: 'controller.ts',
          docs: 'flow.docs.md',
        },
        menuButton: {
          labelArabic: 'إجراء ألفا',
          callbackData: 'action:alpha:do:start',
          row: 1,
          order: 1,
        },
        telegramBudget: {
          maxCallbackBytes: 64,
          maxButtonChars: 16,
          maxKeyboardRows: 7,
          maxButtonsPerRow: 3,
        },
        idempotencyRequired: true,
        typesafeQuestions: [],
      })
    );
    fs.writeFileSync(path.join(flowDir, 'index.ts'), 'export const ready = true;');

    // Setup minimal core directories
    fs.mkdirSync(path.join(sandboxDir, 'packages', 'core-components', 'src'), { recursive: true });
    fs.writeFileSync(path.join(sandboxDir, 'packages', 'core-components', 'src', 'index.ts'), 'export const v = 1;');
  });

  afterEach(() => {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  });

  it('builds release manifest dynamically without hardcoded module lists', () => {
    const res = buildRelease({
      root: sandboxDir,
      gitCommitSha: 'test-commit-sha-12345',
      environment: 'development',
    });

    expect(res.ok).toBe(true);
    expect(res.modulesCount).toBe(1);
    expect(res.flowsCount).toBe(1);
    expect(fs.existsSync(res.manifestPath)).toBe(true);

    const manifest = res.manifest!;
    expect(manifest.schemaVersion).toBe('2.0.0');
    expect(manifest.gitCommitSha).toBe('test-commit-sha-12345');
    expect(manifest.modules[0]?.id).toBe('alpha-ops');
    expect(manifest.checksum).toBeDefined();
    expect(manifest.coreHash).toBeDefined();
  });

  it('rejects draft modules when building for production environment', () => {
    // Add a draft module
    const draftModDir = path.join(sandboxDir, 'modules', 'beta-draft');
    fs.mkdirSync(path.join(draftModDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(draftModDir, 'package.json'),
      JSON.stringify({ name: '@alsaada/module-beta-draft', version: '2.0.0' })
    );
    fs.writeFileSync(
      path.join(draftModDir, 'module.contract.json'),
      JSON.stringify({
        schemaVersion: '2.0.0',
        id: 'beta-draft',
        titleArabic: 'مسودة بيتا',
        version: '2.0.0',
        status: 'draft',
        requiredCapabilities: [],
        callbackPrefixes: ['action:beta:'],
        flows: [],
      })
    );

    const prodRes = buildRelease({
      root: sandboxDir,
      isProduction: true,
    });

    expect(prodRes.ok).toBe(false);
    expect(prodRes.error).toContain('rejects draft module');
    expect(prodRes.error).toContain('beta-draft');
  });

  it('verifies valid manifest and detects cryptographic tampering', () => {
    const buildRes = buildRelease({
      root: sandboxDir,
      environment: 'staging',
    });
    expect(buildRes.ok).toBe(true);

    // Verify pristine manifest
    const verifyPristine = verifyRelease({
      manifestPath: buildRes.manifestPath,
      root: sandboxDir,
    });
    expect(verifyPristine.ok).toBe(true);
    expect(verifyPristine.errors).toHaveLength(0);

    // Tamper with manifest content
    const manifestContent = JSON.parse(fs.readFileSync(buildRes.manifestPath, 'utf8'));
    manifestContent.totalFlows = 999; // Tampered count without updating checksum
    fs.writeFileSync(buildRes.manifestPath, JSON.stringify(manifestContent, null, 2), 'utf8');

    const verifyTampered = verifyRelease({
      manifestPath: buildRes.manifestPath,
      root: sandboxDir,
    });
    expect(verifyTampered.ok).toBe(false);
    expect(verifyTampered.errors.some((e) => e.includes('checksum mismatch'))).toBe(true);
  });

  it('deploys release artifact and records deployment audit log', () => {
    const buildRes = buildRelease({
      root: sandboxDir,
      environment: 'staging',
    });
    expect(buildRes.ok).toBe(true);

    const deployRes = deployRelease({
      manifestPath: buildRes.manifestPath,
      root: sandboxDir,
      environment: 'staging',
      dryRun: false,
    });

    expect(deployRes.ok).toBe(true);
    expect(deployRes.deployedModules).toContain('alpha-ops');
    expect(fs.existsSync(deployRes.logPath)).toBe(true);

    const logContent = fs.readFileSync(deployRes.logPath, 'utf8');
    expect(logContent).toContain('Sovereign Module Deployment Log');
    expect(logContent).toContain('alpha-ops');
    expect(logContent).toContain('SUCCESS');
  });
});
