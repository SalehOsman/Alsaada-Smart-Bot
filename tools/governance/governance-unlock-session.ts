import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  PROTECTED_GOVERNANCE_FILES,
  PROTECTED_GOVERNANCE_DIRECTORIES,
} from './verify-governance-lock.js';

export interface ActiveGovernanceUnlock {
  entityId: string;
  target: string;
  challengeNonce: string;
  unlockedAt: string;
  allowedPaths: string[];
}

export interface GovernanceUnlockStore {
  schemaVersion: 1;
  activeUnlocks: ActiveGovernanceUnlock[];
}

const CACHE_DIR = '.governance-cache';
const UNLOCK_STORE_FILE = 'active-governance-unlocks.json';

function getStorePath(root = process.cwd()): string {
  return join(root, CACHE_DIR, UNLOCK_STORE_FILE);
}

function normalizedPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
}

export function isProtectedGovernancePath(filePath: string): boolean {
  const norm = normalizedPath(filePath);
  if ((PROTECTED_GOVERNANCE_FILES as readonly string[]).includes(norm)) {
    return true;
  }
  for (const dir of PROTECTED_GOVERNANCE_DIRECTORIES) {
    if (norm === dir || norm.startsWith(`${dir}/`)) {
      return true;
    }
  }
  return false;
}

let inMemoryStore: ActiveGovernanceUnlock[] = [];

export function loadGovernanceUnlockStore(root = process.cwd()): ActiveGovernanceUnlock[] {
  const storePath = getStorePath(root);
  if (existsSync(storePath)) {
    try {
      const data = JSON.parse(readFileSync(storePath, 'utf8')) as GovernanceUnlockStore;
      if (Array.isArray(data.activeUnlocks)) {
        inMemoryStore = data.activeUnlocks;
        return inMemoryStore;
      }
    } catch {
      // ignore parse error, fallback to memory
    }
  }
  return inMemoryStore;
}

export function saveGovernanceUnlockStore(
  activeUnlocks: ActiveGovernanceUnlock[],
  root = process.cwd()
): void {
  inMemoryStore = activeUnlocks;
  const storePath = getStorePath(root);
  try {
    const dir = dirname(storePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const store: GovernanceUnlockStore = {
      schemaVersion: 1,
      activeUnlocks,
    };
    writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
  } catch {
    // ignore filesystem write errors in read-only / test contexts
  }
}

export function registerActiveGovernanceUnlock(
  unlock: ActiveGovernanceUnlock,
  root = process.cwd()
): void {
  const list = loadGovernanceUnlockStore(root);
  const normalizedTarget = normalizedPath(unlock.target);
  const normalizedPaths = unlock.allowedPaths.map(normalizedPath);

  const existingIdx = list.findIndex(
    (u) => normalizedPath(u.target) === normalizedTarget || u.entityId === unlock.entityId
  );

  const entry: ActiveGovernanceUnlock = {
    ...unlock,
    target: normalizedTarget,
    allowedPaths: normalizedPaths,
  };

  if (existingIdx >= 0) {
    list[existingIdx] = entry;
  } else {
    list.push(entry);
  }

  saveGovernanceUnlockStore(list, root);
}

export function isPathAuthorizedByActiveUnlock(filePath: string, root = process.cwd()): boolean {
  const list = loadGovernanceUnlockStore(root);
  const norm = normalizedPath(filePath);

  for (const unlock of list) {
    for (const allowed of unlock.allowedPaths) {
      const normAllowed = normalizedPath(allowed);
      if (norm === normAllowed || norm.startsWith(`${normAllowed}/`)) {
        return true;
      }
    }
  }
  return false;
}

export function consumeActiveGovernanceUnlockForPath(
  targetOrFilePath: string,
  root = process.cwd()
): boolean {
  const list = loadGovernanceUnlockStore(root);
  const norm = normalizedPath(targetOrFilePath);

  const idx = list.findIndex((u) => {
    const uTarget = normalizedPath(u.target);
    if (uTarget === norm || norm.startsWith(`${uTarget}/`)) {
      return true;
    }
    return u.allowedPaths.some((p) => {
      const normP = normalizedPath(p);
      return norm === normP || norm.startsWith(`${normP}/`);
    });
  });

  if (idx >= 0) {
    list.splice(idx, 1);
    saveGovernanceUnlockStore(list, root);
    return true;
  }

  return false;
}

export function clearActiveGovernanceUnlocks(root = process.cwd()): void {
  inMemoryStore = [];
  saveGovernanceUnlockStore([], root);
}
