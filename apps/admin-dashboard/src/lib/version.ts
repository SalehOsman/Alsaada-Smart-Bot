/**
 * Release provenance and version metadata helper.
 * Provides non-sensitive build and commit information for observability and health checks.
 */

export interface VersionInfo {
  version: string;
  commitSha: string;
  buildTime: string;
}

export function getVersionInfo(): VersionInfo {
  const version =
    process.env.NEXT_PUBLIC_APP_VERSION ||
    process.env.APP_VERSION ||
    '2.0.0-alpha.1';

  const commitSha =
    process.env.NEXT_PUBLIC_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    'unknown';

  const buildTime =
    process.env.NEXT_PUBLIC_BUILD_TIME ||
    process.env.BUILD_TIME ||
    'unknown';

  return { version, commitSha, buildTime };
}
