import { describe, it, expect } from 'vitest';
import {
  parseDockerBuildOutput,
  generateTelemetryReport,
} from '../docker-build-telemetry.js';

describe('Docker Build Telemetry Sentinel (Work Plan 105)', () => {
  it('parses successful build steps, cache hits and durations', () => {
    const mockOutput = `
#1 [internal] load build definition from Dockerfile.dashboard 0.1s
#2 [internal] load metadata for docker.io/library/node:24-alpine 1.2s
#3 CACHED [builder 1/12] WORKDIR /app 0.0s
#4 CACHED [builder 2/12] RUN npm install -g pnpm 0.0s
#5 [builder 3/12] RUN pnpm fetch 14.5s
#6 [builder 4/12] COPY . . 2.1s
#7 [builder 5/12] RUN pnpm --filter @alsaada/admin-dashboard... build 45.2s
    `;

    const { steps, failureAnalysis } = parseDockerBuildOutput(mockOutput);
    expect(failureAnalysis).toBeUndefined();
    expect(steps.length).toBeGreaterThanOrEqual(6);

    const cachedStep = steps.find((s) => s.isCached);
    expect(cachedStep).toBeDefined();
    expect(cachedStep?.status).toBe('CACHED');

    const longStep = steps.find((s) => s.durationSeconds === 45.2);
    expect(longStep).toBeDefined();
    expect(longStep?.status).toBe('DONE');
  });

  it('identifies TypeScript type errors and classifies failure category', () => {
    const mockFailedOutput = `
#9 [builder 8/12] RUN pnpm --filter @alsaada/database db:generate 3.4s
#10 ERROR [builder 9/12] RUN pnpm --filter @alsaada/admin-dashboard... build 28.1s
------
 > [builder 9/12] RUN pnpm --filter @alsaada/admin-dashboard... build:
Type error: Type 'BackupListItemDto[]' is not assignable to type 'BackupItem[]'.
  Types of property 'artifactsCount' are incompatible:
    Type 'number | undefined' is not assignable to type 'number'.
------
failed to solve: process "/bin/sh -c pnpm --filter @alsaada/admin-dashboard... build" did not complete successfully: exit code: 1
    `;

    const report = generateTelemetryReport({
      command: 'docker build -f docker/Dockerfile.dashboard -t alsaada-dashboard-test .',
      rawOutput: mockFailedOutput,
      totalDurationSeconds: 35.5,
      exitCode: 1,
    });

    expect(report.success).toBe(false);
    expect(report.exitCode).toBe(1);
    expect(report.failureAnalysis).toBeDefined();
    expect(report.failureAnalysis?.detectedCategory).toBe('TYPE_ERROR');
    expect(report.failureAnalysis?.errorMessage).toContain("Type error: Type 'BackupListItemDto[]'");
    expect(report.failureAnalysis?.recommendation).toContain('خلل في توافق الأنواع البرمجية');
    expect(report.bottlenecks[0]?.durationSeconds).toBe(28.1);
  });


  it('detects Node.js memory limits and provides actionable advice', () => {
    const mockOomOutput = `
#8 ERROR [builder 7/12] RUN pnpm build 120.0s
<--- Last few GCs --->
[1:0x55d28b0]   119854 ms: Mark-sweep (reduce) 4048.1 (4128.5) -> 4045.2 (4129.5) MB
<--- JS stacktrace --->
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
failed to solve: process did not complete successfully: exit code: 137
    `;

    const report = generateTelemetryReport({
      command: 'docker build .',
      rawOutput: mockOomOutput,
      totalDurationSeconds: 125,
      exitCode: 137,
    });

    expect(report.failureAnalysis?.detectedCategory).toBe('MEMORY_LIMIT');
    expect(report.failureAnalysis?.recommendation).toContain('max-old-space-size');
  });
});
