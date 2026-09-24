import { describe, expect, it } from 'vitest';
import { detectActiveTestScope, getChangedFiles } from '../smart-test-runner.js';
import { checkRedirectPoisoning, getStagedFiles } from '../pre-commit-orchestrator.js';

describe('⚡ Work Plan 104: Smart Test Runner & Pre-Commit Orchestrator', () => {
  describe('detectActiveTestScope', () => {
    it('returns scopeType: "none" when no files are changed', () => {
      const scope = detectActiveTestScope([]);
      expect(scope.scopeType).toBe('none');
      expect(scope.targetPaths).toHaveLength(0);
      expect(scope.description).toContain('لا توجد');
    });

    it('detects active flow scope for files inside modules/*/src/flows/*', () => {
      const mockFiles = [
        'modules/workforce/src/flows/01.1-worker-registration/controller.ts',
        'modules/workforce/src/flows/01.1-worker-registration/service.ts',
      ];
      const scope = detectActiveTestScope(mockFiles);
      expect(scope.scopeType).toBe('flow');
      expect(scope.targetPaths.length).toBeGreaterThan(0);
      expect(scope.targetPaths[0]).toContain('modules/workforce/src/flows/01.1-worker-registration/tests');
      expect(scope.description).toContain('workforce');
    });

    it('detects package scope for files inside packages/*', () => {
      const mockFiles = ['packages/shared/src/utils/date.ts'];
      const scope = detectActiveTestScope(mockFiles);
      expect(scope.scopeType).toBe('package');
      expect(scope.targetPaths[0]).toBe('packages/shared/tests');
    });

    it('detects governance scope for files inside tools/governance/*', () => {
      const mockFiles = ['tools/governance/smart-test-runner.ts'];
      const scope = detectActiveTestScope(mockFiles);
      expect(scope.scopeType).toBe('governance');
      expect(scope.targetPaths[0]).toBe('tools/governance/tests');
    });

    it('returns generic scope for loose TypeScript files outside modules/packages', () => {
      const mockFiles = ['scripts/custom-migration.ts'];
      const scope = detectActiveTestScope(mockFiles);
      expect(scope.scopeType).toBe('generic');
      expect(scope.targetPaths).toEqual(['scripts/custom-migration.ts']);
    });
  });

  describe('pre-commit-orchestrator utility functions', () => {
    it('getStagedFiles returns an array of strings without crashing', () => {
      const files = getStagedFiles();
      expect(Array.isArray(files)).toBe(true);
      expect(files.every((f) => typeof f === 'string')).toBe(true);
    });

    it('checkRedirectPoisoning safely passes when no poisoned test files exist', () => {
      expect(() => checkRedirectPoisoning(['tools/governance/tests/pre-commit-orchestrator.spec.ts'])).not.toThrow();
    });
  });
});
