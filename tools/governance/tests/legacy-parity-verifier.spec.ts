import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { verifyLegacyParity } from '../verify-legacy-parity.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

let fixtureSequence = 0;
function fixtureRoot(name: string): string {
  fixtureSequence += 1;
  const root = join(tmpdir(), `alsaada-legacy-parity-${name}-${fixtureSequence}`);
  mkdirSync(join(root, 'docs', 'work-plans'), { recursive: true });
  mkdirSync(join(root, 'modules', 'sample', 'src', 'flows', '01.1-test'), { recursive: true });
  return root;
}

describe('verifyLegacyParity Gate (G12)', () => {
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

  test('passes on valid classification and matching legacy migration registry', () => {
    // Arrange
    const root = fixtureRoot('valid');
    writeFileSync(
      join(root, 'docs', '19-legacy-to-enterprise-master-feature-migration-registry.md'),
      '| `01.1` | تسجيل عامل | HR | 🟢 مكتمل وموثق 100% | `modules/sample/src/flows/01.1-test` | `abc1234` |\n',
      'utf8'
    );
    writeFileSync(
      join(root, 'modules', 'sample', 'src', 'flows', '01.1-test', 'flow.contract.json'),
      JSON.stringify(
        {
          flowCode: '01.1',
          classification: 'LEGACY_PARITY',
          legacyFeatureCode: '01',
        },
        null,
        2
      ),
      'utf8'
    );

    // Act
    const result = verifyLegacyParity(root);

    // Assert
    expect(result.ok).toBe(true);
    expect(result.checked).toBeGreaterThan(0);
  });

  test('fails if classification is missing or invalid', () => {
    // Arrange
    const root = fixtureRoot('invalid-class');
    writeFileSync(
      join(root, 'modules', 'sample', 'src', 'flows', '01.1-test', 'flow.contract.json'),
      JSON.stringify(
        {
          flowCode: '01.1',
          classification: 'INVALID_BUCKET',
        },
        null,
        2
      ),
      'utf8'
    );

    // Act
    const result = verifyLegacyParity(root);

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('missing or invalid classification'))).toBe(true);
  });

  test('fails if LEGACY_PARITY flow is missing legacyFeatureCode', () => {
    // Arrange
    const root = fixtureRoot('missing-legacy-code');
    writeFileSync(
      join(root, 'docs', '19-legacy-to-enterprise-master-feature-migration-registry.md'),
      '| `01.1` | تسجيل | HR | 🟢 مكتمل | `modules/sample/src/flows/01.1-test` | `abc` |\n',
      'utf8'
    );
    writeFileSync(
      join(root, 'modules', 'sample', 'src', 'flows', '01.1-test', 'flow.contract.json'),
      JSON.stringify(
        {
          flowCode: '01.1',
          classification: 'LEGACY_PARITY',
        },
        null,
        2
      ),
      'utf8'
    );

    // Act
    const result = verifyLegacyParity(root);

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('missing "legacyFeatureCode"'))).toBe(true);
  });

  test('fails if EVOLVED flow references non-existent workPlan', () => {
    // Arrange
    const root = fixtureRoot('missing-work-plan');
    writeFileSync(
      join(root, 'modules', 'sample', 'src', 'flows', '01.1-test', 'flow.contract.json'),
      JSON.stringify(
        {
          flowCode: '01.1',
          classification: 'EVOLVED',
          workPlan: 'PLAN-99',
        },
        null,
        2
      ),
      'utf8'
    );

    // Act
    const result = verifyLegacyParity(root);

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('no corresponding file found in docs/work-plans/'))).toBe(true);
  });

  test('passes on valid EVOLVED flow with matching workPlan file', () => {
    // Arrange
    const root = fixtureRoot('valid-evolved');
    writeFileSync(join(root, 'docs', 'work-plans', '10-plan-admin-assignment.md'), '# Plan 10\n', 'utf8');
    writeFileSync(
      join(root, 'modules', 'sample', 'src', 'flows', '01.1-test', 'flow.contract.json'),
      JSON.stringify(
        {
          flowCode: '01.1',
          classification: 'EVOLVED',
          workPlan: 'PLAN-10',
        },
        null,
        2
      ),
      'utf8'
    );

    // Act
    const result = verifyLegacyParity(root);

    // Assert
    expect(result.ok).toBe(true);
  });

  test('fails if NOVEL flow is missing from docs/19', () => {
    // Arrange
    const root = fixtureRoot('missing-novel');
    writeFileSync(
      join(root, 'docs', '19-legacy-to-enterprise-master-feature-migration-registry.md'),
      '# Empty registry\n',
      'utf8'
    );
    writeFileSync(
      join(root, 'modules', 'sample', 'src', 'flows', '01.1-test', 'flow.contract.json'),
      JSON.stringify(
        {
          flowCode: '01.1',
          classification: 'NOVEL',
        },
        null,
        2
      ),
      'utf8'
    );

    // Act
    const result = verifyLegacyParity(root);

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('not documented in docs/19'))).toBe(true);
  });

  test('passes on valid NOVEL flow documented in docs/19', () => {
    // Arrange
    const root = fixtureRoot('valid-novel');
    writeFileSync(
      join(root, 'docs', '19-legacy-to-enterprise-master-feature-migration-registry.md'),
      '| `01.1` | NEW-01 | `modules/sample/src/flows/01.1-test` |\n',
      'utf8'
    );
    writeFileSync(
      join(root, 'modules', 'sample', 'src', 'flows', '01.1-test', 'flow.contract.json'),
      JSON.stringify(
        {
          flowCode: '01.1',
          classification: 'NOVEL',
        },
        null,
        2
      ),
      'utf8'
    );

    // Act
    const result = verifyLegacyParity(root);

    // Assert
    expect(result.ok).toBe(true);
  });

  test('fails if DEPRECATED flow is missing deprecationReason or missing from docs/19', () => {
    // Arrange
    const root = fixtureRoot('invalid-deprecated');
    writeFileSync(
      join(root, 'docs', '19-legacy-to-enterprise-master-feature-migration-registry.md'),
      '# Empty registry\n',
      'utf8'
    );
    writeFileSync(
      join(root, 'modules', 'sample', 'src', 'flows', '01.1-test', 'flow.contract.json'),
      JSON.stringify(
        {
          flowCode: '01.1',
          classification: 'DEPRECATED',
        },
        null,
        2
      ),
      'utf8'
    );

    // Act
    const result = verifyLegacyParity(root);

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('missing "deprecationReason"'))).toBe(true);
  });

  test('passes on valid DEPRECATED flow with reason and documented in docs/19', () => {
    // Arrange
    const root = fixtureRoot('valid-deprecated');
    writeFileSync(
      join(root, 'docs', '19-legacy-to-enterprise-master-feature-migration-registry.md'),
      '| `01.1` | DEPRECATED | `modules/sample/src/flows/01.1-test` |\n',
      'utf8'
    );
    writeFileSync(
      join(root, 'modules', 'sample', 'src', 'flows', '01.1-test', 'flow.contract.json'),
      JSON.stringify(
        {
          flowCode: '01.1',
          classification: 'DEPRECATED',
          deprecationReason: 'Replaced by sovereign wizard flow',
        },
        null,
        2
      ),
      'utf8'
    );

    // Act
    const result = verifyLegacyParity(root);

    // Assert
    expect(result.ok).toBe(true);
  });
});
