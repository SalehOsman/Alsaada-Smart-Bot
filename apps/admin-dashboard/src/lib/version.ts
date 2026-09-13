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
    '20bcd180a05ef25ec9990ad44b9a19f7ce7abff2';

  const buildTime =
    process.env.NEXT_PUBLIC_BUILD_TIME ||
    process.env.BUILD_TIME ||
    '2026-09-13T12:00:00.000Z';

  return { version, commitSha, buildTime };
}
