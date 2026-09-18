import { describe, expect, it } from 'vitest';
import {
  listEntityFiles,
  normalizeBuffer,
  resolveLockTarget,
  sha256NormalizedFile,
} from '../unified-lock-engine.js';
import { unlockEntity, VALID_UNLOCK_PHRASES } from '../unified-unlock-engine.js';

describe('Unified Lock & Unlock Engine (Plan 70)', () => {
  const root = process.cwd();

  describe('Target Resolution', () => {
    it('resolves core packages by prefix and name', () => {
      const byPrefix = resolveLockTarget(root, 'package:regional-engine');
      expect(byPrefix).not.toBeNull();
      expect(byPrefix?.id).toBe('package:regional-engine');
      expect(byPrefix?.type).toBe('package');
      expect(byPrefix?.directoryOrFile).toBe('packages/regional-engine');

      const byDirectName = resolveLockTarget(root, 'regional-engine');
      expect(byDirectName).not.toBeNull();
      expect(byDirectName?.id).toBe('package:regional-engine');

      const byScopedName = resolveLockTarget(root, '@alsaada/database');
      expect(byScopedName).not.toBeNull();
      expect(byScopedName?.id).toBe('package:database');

      const byPath = resolveLockTarget(root, 'packages/core-components');
      expect(byPath).not.toBeNull();
      expect(byPath?.id).toBe('package:core-components');
    });

    it('resolves bot flows by prefix, code, and slug', () => {
      const byPrefix = resolveLockTarget(root, 'flow:01.1');
      expect(byPrefix).not.toBeNull();
      expect(byPrefix?.id).toBe('flow:01.1');
      expect(byPrefix?.type).toBe('flow');
      expect(byPrefix?.directoryOrFile).toContain('01.1-worker-registration');

      const byCode = resolveLockTarget(root, '00.1');
      expect(byCode).not.toBeNull();
      expect(byCode?.id).toBe('flow:00.1');
      expect(byCode?.type).toBe('flow');
    });

    it('resolves admin dashboard screens and handles overview root page', () => {
      const overview = resolveLockTarget(root, 'dashboard:overview');
      expect(overview).not.toBeNull();
      expect(overview?.id).toBe('dashboard:overview');
      expect(overview?.type).toBe('dashboard');
      expect(overview?.directoryOrFile).toBe('apps/admin-dashboard/src/app/admin/page.tsx');

      const workforceNew = resolveLockTarget(root, 'dashboard:workforce/new');
      expect(workforceNew).not.toBeNull();
      expect(workforceNew?.id).toBe('dashboard:workforce/new');

      const dynamicRoute = resolveLockTarget(root, 'dashboard:workforce/[id]/edit');
      expect(dynamicRoute).not.toBeNull();
      expect(dynamicRoute?.id).toBe('dashboard:workforce/[id]/edit');
    });

    it('resolves infrastructure targets', () => {
      const docker = resolveLockTarget(root, 'infra:docker');
      expect(docker).not.toBeNull();
      expect(docker?.id).toBe('infra:docker');
      expect(docker?.type).toBe('infra');

      const speed = resolveLockTarget(root, 'infra:speed-engine');
      expect(speed).not.toBeNull();
      expect(speed?.id).toBe('infra:speed-engine');
    });

    it('returns null for nonexistent targets', () => {
      expect(resolveLockTarget(root, 'package:nonexistent-pkg')).toBeNull();
      expect(resolveLockTarget(root, 'flow:99.99')).toBeNull();
    });
  });

  describe('Buffer & CRLF/LF Normalization', () => {
    it('normalizes windows CRLF to LF in text files', () => {
      const crlfBuffer = Buffer.from('line1\r\nline2\r\nline3\r\n', 'utf8');
      const normalized = normalizeBuffer(crlfBuffer, 'test.ts');
      expect(normalized.toString('utf8')).toBe('line1\nline2\nline3\n');
    });

    it('leaves non-text files unmodified', () => {
      const binBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
      const normalized = normalizeBuffer(binBuffer, 'image.png');
      expect(normalized.equals(binBuffer)).toBe(true);
    });
  });

  describe('Zero Blast Radius Isolation', () => {
    it('excludes child sub-routes when listing files for a parent dashboard section', () => {
      const files = listEntityFiles(root, 'apps/admin-dashboard/src/app/admin/workforce', 'dashboard');
      // Must contain workforce/page.tsx
      expect(files.some((f) => f.endsWith('workforce/page.tsx'))).toBe(true);
      // Must NOT contain child routes like workforce/new/page.tsx or workforce/directory/page.tsx
      expect(files.some((f) => f.includes('workforce/new/'))).toBe(false);
      expect(files.some((f) => f.includes('workforce/directory/'))).toBe(false);
      expect(files.some((f) => f.includes('workforce/[id]/'))).toBe(false);
    });

    it('excludes flow subdirectories when listing files for a module', () => {
      const files = listEntityFiles(root, 'modules/workforce', 'module');
      expect(files.some((f) => f.includes('flows/'))).toBe(false);
      expect(files.some((f) => f.includes('src/index.ts'))).toBe(true);
    });
  });

  describe('Unlock Verifications & Sovereign Protection', () => {
    it('validates verbatim approval phrases strictly', () => {
      expect(VALID_UNLOCK_PHRASES.has('موافق على الفتح')).toBe(true);
      expect(VALID_UNLOCK_PHRASES.has('نعم موافق على التعديل')).toBe(true);
      expect(VALID_UNLOCK_PHRASES.has('تمام')).toBe(false);
      expect(VALID_UNLOCK_PHRASES.has('موافق')).toBe(false);
      expect(VALID_UNLOCK_PHRASES.has('اوك')).toBe(false);
    });

    it('rejects unlock requests without proper phrase or reason', () => {
      const invalidPhraseResult = unlockEntity('package:regional-engine', {
        phrase: 'تمام فك القفل',
        reason: 'تعديل العملة',
        root,
      });
      expect(invalidPhraseResult.ok).toBe(false);
      expect(invalidPhraseResult.error).toContain('Invalid approval phrase');

      const missingReasonResult = unlockEntity('package:regional-engine', {
        phrase: 'موافق على الفتح',
        reason: '',
        root,
      });
      expect(missingReasonResult.ok).toBe(false);
      expect(missingReasonResult.error).toContain('justification reason');
    });
  });
});
