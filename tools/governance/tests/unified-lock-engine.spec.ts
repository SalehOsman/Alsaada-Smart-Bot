import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listEntityFiles, normalizeBuffer, resolveLockTarget, sha256NormalizedFile } from '../unified-lock-engine.js';
import { unlockEntity, VALID_UNLOCK_PHRASES } from '../unified-unlock-engine.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Unified Lock & Unlock Engine (Plan 70)', () => {
  const root = process.cwd();

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Target Resolution', () => {
    it('resolves core packages by prefix and name', () => {
      // Arrange
      const targetPrefix = 'package:regional-engine';
      const targetDirectName = 'regional-engine';
      const targetScopedName = '@alsaada/database';
      const targetPath = 'packages/core-components';

      // Act
      const byPrefix = resolveLockTarget(root, targetPrefix);
      const byDirectName = resolveLockTarget(root, targetDirectName);
      const byScopedName = resolveLockTarget(root, targetScopedName);
      const byPath = resolveLockTarget(root, targetPath);

      // Assert
      expect(byPrefix).not.toBeNull();
      expect(byPrefix?.id).toBe('package:regional-engine');
      expect(byPrefix?.type).toBe('package');
      expect(byPrefix?.directoryOrFile).toBe('packages/regional-engine');

      expect(byDirectName).not.toBeNull();
      expect(byDirectName?.id).toBe('package:regional-engine');

      expect(byScopedName).not.toBeNull();
      expect(byScopedName?.id).toBe('package:database');

      expect(byPath).not.toBeNull();
      expect(byPath?.id).toBe('package:core-components');
    });

    it('resolves bot flows by prefix, code, and slug', () => {
      // Arrange
      const flowPrefix = 'flow:01.1';
      const flowCode = '00.1';

      // Act
      const byPrefix = resolveLockTarget(root, flowPrefix);
      const byCode = resolveLockTarget(root, flowCode);

      // Assert
      expect(byPrefix).not.toBeNull();
      expect(byPrefix?.id).toBe('flow:01.1');
      expect(byPrefix?.type).toBe('flow');
      expect(byPrefix?.directoryOrFile).toContain('01.1-worker-registration');

      expect(byCode).not.toBeNull();
      expect(byCode?.id).toBe('flow:00.1');
      expect(byCode?.type).toBe('flow');
    });

    it('resolves admin dashboard screens and handles overview root page', () => {
      // Arrange
      const overviewTarget = 'dashboard:overview';
      const workforceNewTarget = 'dashboard:workforce/new';
      const dynamicRouteTarget = 'dashboard:workforce/[id]/edit';

      // Act
      const overview = resolveLockTarget(root, overviewTarget);
      const workforceNew = resolveLockTarget(root, workforceNewTarget);
      const dynamicRoute = resolveLockTarget(root, dynamicRouteTarget);

      // Assert
      expect(overview).not.toBeNull();
      expect(overview?.id).toBe('dashboard:overview');
      expect(overview?.type).toBe('dashboard');
      expect(overview?.directoryOrFile).toBe('apps/admin-dashboard/src/app/admin/page.tsx');

      expect(workforceNew).not.toBeNull();
      expect(workforceNew?.id).toBe('dashboard:workforce/new');

      expect(dynamicRoute).not.toBeNull();
      expect(dynamicRoute?.id).toBe('dashboard:workforce/[id]/edit');
    });

    it('resolves infrastructure targets', () => {
      // Arrange
      const dockerTarget = 'infra:docker';
      const speedTarget = 'infra:speed-engine';

      // Act
      const docker = resolveLockTarget(root, dockerTarget);
      const speed = resolveLockTarget(root, speedTarget);

      // Assert
      expect(docker).not.toBeNull();
      expect(docker?.id).toBe('infra:docker');
      expect(docker?.type).toBe('infra');

      expect(speed).not.toBeNull();
      expect(speed?.id).toBe('infra:speed-engine');
    });

    it('returns null for nonexistent targets', () => {
      // Arrange
      const invalidPkg = 'package:nonexistent-pkg';
      const invalidFlow = 'flow:99.99';

      // Act
      const pkgResult = resolveLockTarget(root, invalidPkg);
      const flowResult = resolveLockTarget(root, invalidFlow);

      // Assert
      expect(pkgResult).toBeNull();
      expect(flowResult).toBeNull();
    });
  });

  describe('Buffer & CRLF/LF Normalization', () => {
    it('normalizes windows CRLF to LF in text files', () => {
      // Arrange
      const crlfBuffer = Buffer.from('line1\r\nline2\r\nline3\r\n', 'utf8');

      // Act
      const normalized = normalizeBuffer(crlfBuffer, 'test.ts');

      // Assert
      expect(normalized.toString('utf8')).toBe('line1\nline2\nline3\n');
    });

    it('leaves non-text files unmodified', () => {
      // Arrange
      const binBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

      // Act
      const normalized = normalizeBuffer(binBuffer, 'image.png');

      // Assert
      expect(normalized.equals(binBuffer)).toBe(true);
    });
  });

  describe('Zero Blast Radius Isolation', () => {
    it('excludes child sub-routes when listing files for a parent dashboard section', () => {
      // Arrange
      const targetSection = 'apps/admin-dashboard/src/app/admin/workforce';

      // Act
      const files = listEntityFiles(root, targetSection, 'dashboard');

      // Assert
      expect(files.some((f) => f.endsWith('workforce/page.tsx'))).toBe(true);
      expect(files.some((f) => f.includes('workforce/new/'))).toBe(false);
      expect(files.some((f) => f.includes('workforce/directory/'))).toBe(false);
      expect(files.some((f) => f.includes('workforce/[id]/'))).toBe(false);
    });

    it('excludes flow subdirectories when listing files for a module', () => {
      // Arrange
      const modulePath = 'modules/workforce';

      // Act
      const files = listEntityFiles(root, modulePath, 'module');

      // Assert
      expect(files.some((f) => f.includes('flows/'))).toBe(false);
      expect(files.some((f) => f.includes('src/index.ts'))).toBe(true);
    });
  });

  describe('Unlock Verifications & Sovereign Protection', () => {
    it('validates verbatim approval phrases strictly', () => {
      // Arrange
      const validPhrase1 = 'موافق على الفتح';
      const validPhrase2 = 'نعم موافق على التعديل';
      const invalidPhrase1 = 'تمام';
      const invalidPhrase2 = 'موافق';
      const invalidPhrase3 = 'اوك';

      // Act
      const hasValid1 = VALID_UNLOCK_PHRASES.has(validPhrase1);
      const hasValid2 = VALID_UNLOCK_PHRASES.has(validPhrase2);
      const hasInvalid1 = VALID_UNLOCK_PHRASES.has(invalidPhrase1);
      const hasInvalid2 = VALID_UNLOCK_PHRASES.has(invalidPhrase2);
      const hasInvalid3 = VALID_UNLOCK_PHRASES.has(invalidPhrase3);

      // Assert
      expect(hasValid1).toBe(true);
      expect(hasValid2).toBe(true);
      expect(hasInvalid1).toBe(false);
      expect(hasInvalid2).toBe(false);
      expect(hasInvalid3).toBe(false);
    });

    it('rejects unlock requests without proper phrase or reason', () => {
      // Arrange
      const targetEntity = 'package:regional-engine';
      const invalidOptions = {
        phrase: 'تمام فك القفل',
        reason: 'تعديل العملة',
        root,
      };
      const missingReasonOptions = {
        phrase: 'موافق على الفتح',
        reason: '',
        root,
      };

      // Act
      const invalidPhraseResult = unlockEntity(targetEntity, invalidOptions);
      const missingReasonResult = unlockEntity(targetEntity, missingReasonOptions);

      // Assert
      expect(invalidPhraseResult.ok).toBe(false);
      expect(invalidPhraseResult.error).toContain('Invalid approval phrase');
      expect(missingReasonResult.ok).toBe(false);
      expect(missingReasonResult.error).toContain('justification reason');
    });

    it('strictly prohibits unlock-all feature across both engines', () => {
      // Arrange & Act & Assert
      expect(() => {
        unlockEntity('all', { phrase: 'موافق على الفتح', reason: 'Unlocking all components' });
      }).toThrow(/Constitutional Violation: unlock-all is strictly prohibited/);

      expect(() => {
        unlockEntity('unlock:all', { phrase: 'موافق على الفتح', reason: 'Unlocking all components' });
      }).toThrow(/Constitutional Violation: unlock-all is strictly prohibited/);
    });
  });

  describe('Comprehensive 100% Monorepo Discovery & Pre-Merge Lockdown', () => {
    it('resolves app and test targets', () => {
      const appBot = resolveLockTarget(root, 'app:bot-server');
      const appDash = resolveLockTarget(root, 'app:admin-dashboard');
      const appDocs = resolveLockTarget(root, 'app:docs');
      const testTarget = resolveLockTarget(root, 'test:tools/governance/tests/unified-lock-engine.spec.ts');

      expect(appBot).not.toBeNull();
      expect(appBot?.type).toBe('app');
      expect(appDash).not.toBeNull();
      expect(appDash?.type).toBe('app');
      expect(appDocs).not.toBeNull();
      expect(appDocs?.type).toBe('app');
      expect(testTarget).not.toBeNull();
      expect(testTarget?.type).toBe('test');
    });

    it('discovers 100% of all lockable components across the monorepo independently (352/359 targets)', async () => {
      const { discoverAllLockableTargets, listEntityFiles } = await import('../unified-lock-engine.js');
      const targets = discoverAllLockableTargets(root);
      const hasSandbox = listEntityFiles(root, 'modules/sandbox', 'module').length > 0;

      const pkgs = targets.filter((t) => t.startsWith('package:'));
      const flows = targets.filter((t) => t.startsWith('flow:'));
      const dashboards = targets.filter((t) => t.startsWith('dashboard:'));
      const apps = targets.filter((t) => t.startsWith('app:'));
      const modules = targets.filter((t) => t.startsWith('module:'));
      const infra = targets.filter((t) => t.startsWith('infra:'));
      const tests = targets.filter((t) => t.startsWith('test:'));

      expect(targets.length).toBe(hasSandbox ? 359 : 352);
      expect(pkgs.length).toBe(9);
      expect(flows.length).toBe(hasSandbox ? 23 : 21);
      expect(dashboards.length).toBe(34);
      expect(apps.length).toBe(3);
      expect(modules.length).toBe(hasSandbox ? 3 : 2);
      expect(infra.length).toBe(2);
      expect(tests.length).toBe(hasSandbox ? 285 : 281);
    });
  });
});
