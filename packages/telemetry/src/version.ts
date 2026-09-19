/**
 * @alsaada/telemetry - Living Version Provider & Runtime Telemetry
 * Synchronized atomically by tools/release/release-engine.ts
 * Compliance: Plan 84 - Living Release Engine & Safe Upgrade Architecture
 */

export type ReleasePhase = 'alpha' | 'beta' | 'rc' | 'stable';

export interface SystemVersionInfo {
  version: string;
  phase: ReleasePhase;
  planNumber?: number;
  gitCommit: string;
  buildTime: string;
  nodeVersion: string;
  pnpmVersion: string;
}

// Single Source of Truth for Platform Runtime Version (updated by release-engine)
export const PLATFORM_VERSION = '2.0.0-alpha.85';
export const PLATFORM_PHASE: ReleasePhase = 'alpha';
export const COMPLETED_PLANS_COUNT = 85;
export const PLATFORM_BUILD_TIME = '2026-09-19T20:08:45.796Z';

/**
 * Returns complete structured system version metadata for living telemetry injection.
 */
export function getSystemVersion(): SystemVersionInfo {
  const commit =
    (typeof process !== 'undefined' &&
      (process.env.GIT_COMMIT_HASH ||
        process.env.VERCEL_GIT_COMMIT_SHA ||
        process.env.GITHUB_SHA)) ||
    'local-dev';

  const nodeVer =
    typeof process !== 'undefined' && process.version ? process.version : 'unknown';

  return {
    version: PLATFORM_VERSION,
    phase: PLATFORM_PHASE,
    planNumber: COMPLETED_PLANS_COUNT,
    gitCommit: commit,
    buildTime: PLATFORM_BUILD_TIME,
    nodeVersion: nodeVer,
    pnpmVersion: '12.4.2',
  };
}

/**
 * Formats standard terminal/logger startup banner.
 */
export function formatVersionBanner(): string {
  const v = getSystemVersion();
  const shortHash = v.gitCommit.length > 7 ? v.gitCommit.substring(0, 7) : v.gitCommit;
  return `🤖 Al-Saada Smart Bot v${v.version} (Plan ${v.planNumber ?? 'N/A'} | Commit: ${shortHash}) [Node: ${v.nodeVersion} | pnpm: ${v.pnpmVersion}]`;
}
