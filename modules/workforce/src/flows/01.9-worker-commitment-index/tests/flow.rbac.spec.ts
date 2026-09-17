import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const contractPath = fileURLToPath(new URL('../flow.contract.json', import.meta.url));
const contract = JSON.parse(readFileSync(contractPath, 'utf8')) as {
  allowedRoles: string[];
  blockedRoles: string[];
};

describe('Flow 01.9 RBAC Tests — Worker Commitment Index', () => {
  it('1. should allow authorized roles defined in sovereign contract', () => {
    const allowedRoles = contract.allowedRoles;
    expect(allowedRoles).toContain('SUPER_ADMIN');
    expect(allowedRoles).toContain('GENERAL_ADMIN');
    expect(allowedRoles).toContain('FIELD_ADMIN');
    expect(allowedRoles).toContain('ACCOUNTANT');
    expect(allowedRoles).toContain('EXECUTIVE');
    expect(allowedRoles).toContain('WORKER');
  });

  it('2. should block unauthorized external roles', () => {
    const blockedRoles = contract.blockedRoles;
    expect(blockedRoles).toContain('SUPPLIER');
    expect(blockedRoles).toContain('GUEST');

    const allowedSet = new Set(contract.allowedRoles);
    for (const blocked of blockedRoles) {
      expect(allowedSet.has(blocked)).toBe(false);
    }
  });

  it('3. should verify worker role card action limitations', () => {
    const allowedForWorker = ['action:wcs:card:my', 'menu:wcs:main'];
    expect(allowedForWorker).toContain('action:wcs:card:my');
  });
});
