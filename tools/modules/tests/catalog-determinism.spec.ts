import { describe, it, expect } from 'vitest';
import { scanMonorepoCatalog, hashDirectoryFiles, sha256String } from '../catalog.js';

describe('Work Plan 89 — Catalog Determinism & Immutability (Phase P2)', () => {
  it('produces identical catalogHash across consecutive scans of identical filesystem', () => {
    const scan1 = scanMonorepoCatalog();
    const scan2 = scanMonorepoCatalog();

    expect(scan1.catalogHash).toBe(scan2.catalogHash);
    expect(scan1.modules.length).toBe(scan2.modules.length);
    expect(scan1.flows.length).toBe(scan2.flows.length);

    // Verify ordering is strictly deterministic
    for (let i = 0; i < scan1.modules.length; i++) {
      expect(scan1.modules[i]?.id).toBe(scan2.modules[i]?.id);
      expect(scan1.modules[i]?.moduleHash).toBe(scan2.modules[i]?.moduleHash);
    }
  });

  it('guarantees deterministic SHA-256 hash generation for source strings', () => {
    const input = 'sample-deterministic-contract-content';
    const hash1 = sha256String(input);
    const hash2 = sha256String(input);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('verifies that flow order within catalog is deterministic and sorted by module then ID', () => {
    const catalog = scanMonorepoCatalog();
    for (let i = 1; i < catalog.flows.length; i++) {
      const prev = catalog.flows[i - 1]!;
      const curr = catalog.flows[i]!;

      const modComp = prev.module.localeCompare(curr.module);
      if (modComp === 0) {
        expect(prev.id.localeCompare(curr.id)).toBeLessThanOrEqual(0);
      } else {
        expect(modComp).toBeLessThan(0);
      }
    }
  });
});
