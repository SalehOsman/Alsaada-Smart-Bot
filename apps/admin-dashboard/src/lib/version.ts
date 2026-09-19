/**
 * Release provenance and version metadata helper.
 * Provides non-sensitive build and commit information for observability and health checks.
 * Synchronized with @alsaada/telemetry Living Version Provider.
 * Compliance: Plan 84 - Living Release Engine & Safe Upgrade Architecture
 */

import { getSystemVersion } from '@alsaada/telemetry';

export interface VersionInfo {
  version: string;
  commitSha: string;
  buildTime: string;
  phase: string;
  planNumber?: number;
}

export function getVersionInfo(): VersionInfo {
  const sys = getSystemVersion();
  const version =
    process.env.NEXT_PUBLIC_APP_VERSION ||
    process.env.APP_VERSION ||
    sys.version;

  const commitSha =
    process.env.NEXT_PUBLIC_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    sys.gitCommit;

  const buildTime =
    process.env.NEXT_PUBLIC_BUILD_TIME ||
    process.env.BUILD_TIME ||
    sys.buildTime;

  return {
    version,
    commitSha,
    buildTime,
    phase: sys.phase,
    planNumber: sys.planNumber,
  };
}
