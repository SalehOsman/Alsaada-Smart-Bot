import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface DockerStepMetric {
  stepIndex: number;
  totalSteps?: number;
  description: string;
  durationSeconds: number;
  isCached: boolean;
  status: 'CACHED' | 'DONE' | 'ERROR';
}

export interface FailureAnalysis {
  failedStep?: string | undefined;
  errorMessage?: string | undefined;
  detectedCategory: 'TYPE_ERROR' | 'MEMORY_LIMIT' | 'TIMEOUT' | 'DEPENDENCY_ERROR' | 'BUILD_ERROR';
  recommendation: string;
}

export interface DockerBuildTelemetryReport {
  timestamp: string;
  command: string;
  totalDurationSeconds: number;
  success: boolean;
  exitCode: number;
  cachedStepsCount: number;
  executedStepsCount: number;
  bottlenecks: DockerStepMetric[];
  steps: DockerStepMetric[];
  failureAnalysis?: FailureAnalysis | undefined;
}

export function parseDockerBuildOutput(rawOutput: string): {
  steps: DockerStepMetric[];
  failureAnalysis?: FailureAnalysis | undefined;
} {
  const steps: DockerStepMetric[] = [];
  const lines = rawOutput.split(/\r?\n/);

  // Regex patterns for BuildKit outputs
  // e.g., "#12 [builder 8/12] RUN pnpm --filter @alsaada/admin-dashboard... build 42.5s"
  // e.g., "=> [internal] load build definition from Dockerfile.dashboard 0.0s"
  // e.g., "=> CACHED [builder 2/12] WORKDIR /app 0.0s"
  // e.g., "=> ERROR [builder 10/12] RUN pnpm ... 15.3s"
  const stepRegex = /(?:#(\d+)|\=\>)\s+(?:(CACHED|ERROR)\s+)?\[([^\]]+)\]\s+(.+?)(?:\s+([0-9.]+)s)?$/;

  let stepCounter = 1;
  const failureLines: string[] = [];
  let isCapturingFailure = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.includes('ERROR') || trimmed.includes('failed to solve:') || trimmed.includes('Type error:')) {
      isCapturingFailure = true;
    }

    if (isCapturingFailure) {
      failureLines.push(trimmed);
    }

    const match = trimmed.match(stepRegex);
    if (match) {
      const statusModifier = match[2]; // CACHED or ERROR
      const stageName = match[3];
      const detail = match[4];
      const durationStr = match[5];

      const isCached = statusModifier === 'CACHED' || trimmed.includes('CACHED');
      const isError = statusModifier === 'ERROR' || trimmed.includes('ERROR');
      const duration = durationStr ? parseFloat(durationStr) : 0;

      steps.push({
        stepIndex: stepCounter++,
        description: `[${stageName}] ${detail}`,
        durationSeconds: isNaN(duration) ? 0 : duration,
        isCached,
        status: isError ? 'ERROR' : isCached ? 'CACHED' : 'DONE',
      });
    }
  }

  let failureAnalysis: FailureAnalysis | undefined;
  if (failureLines.length > 0) {
    const fullFailureText = failureLines.join('\n');
    let detectedCategory: FailureAnalysis['detectedCategory'] = 'BUILD_ERROR';
    let recommendation = 'راجع سجلات البناء وتحقق من الأخطاء الناتجة';

    if (fullFailureText.includes('Type error:') || fullFailureText.includes('TS')) {
      detectedCategory = 'TYPE_ERROR';
      recommendation = 'خلل في توافق الأنواع البرمجية (TypeScript Prop Mismatch)؛ تحقق من الواجهات بين الحزم وNext.js';
    } else if (fullFailureText.includes('JavaScript heap out of memory') || fullFailureText.includes('ENOMEM')) {
      detectedCategory = 'MEMORY_LIMIT';
      recommendation = 'نفاد ذاكرة Node.js؛ قم بزيادة NODE_OPTIONS="--max-old-space-size=4096" داخل الـ Dockerfile';
    } else if (fullFailureText.includes('ETIMEDOUT') || fullFailureText.includes('timeout')) {
      detectedCategory = 'TIMEOUT';
      recommendation = 'انتهاء مهلة الاتصال بالشبكة؛ تحقق من اتصال الإنترنت أو استخدم التخزين المؤقت المحلي';
    } else if (fullFailureText.includes('ERR_PNPM_') || fullFailureText.includes('lockfile')) {
      detectedCategory = 'DEPENDENCY_ERROR';
      recommendation = 'تعارض في تبعيات pnpm أو ملف pnpm-lock.yaml؛ نفذ pnpm install لتحديث القفل';
    }

    // Extract primary error line
    const primaryErrorLine = failureLines.find(
      (l) => l.startsWith('Type error:') || l.includes('failed to solve:') || l.includes('ERROR:')
    ) || failureLines[0] || 'Unknown build failure';

    failureAnalysis = {
      failedStep: steps.find((s) => s.status === 'ERROR')?.description,
      errorMessage: primaryErrorLine,
      detectedCategory,
      recommendation,
    };
  }

  return { steps, failureAnalysis };
}

export function generateTelemetryReport(params: {
  command: string;
  rawOutput: string;
  totalDurationSeconds: number;
  exitCode: number;
}): DockerBuildTelemetryReport {
  const { steps, failureAnalysis } = parseDockerBuildOutput(params.rawOutput);
  const cachedStepsCount = steps.filter((s) => s.isCached).length;
  const executedStepsCount = steps.filter((s) => !s.isCached).length;

  const bottlenecks = [...steps]
    .filter((s) => s.durationSeconds > 0)
    .sort((a, b) => b.durationSeconds - a.durationSeconds)
    .slice(0, 5);

  return {
    timestamp: new Date().toISOString(),
    command: params.command,
    totalDurationSeconds: Math.round(params.totalDurationSeconds * 100) / 100,
    success: params.exitCode === 0,
    exitCode: params.exitCode,
    cachedStepsCount,
    executedStepsCount,
    bottlenecks,
    steps,
    failureAnalysis: params.exitCode === 0 ? undefined : failureAnalysis,
  };
}

export function saveTelemetrySnapshot(
  report: DockerBuildTelemetryReport,
  root = process.cwd()
): string {
  const evidenceDir = join(root, 'docs', 'ai-execution-evidence');
  if (!existsSync(evidenceDir)) {
    mkdirSync(evidenceDir, { recursive: true });
  }

  const filePath = join(evidenceDir, 'docker-build-telemetry-latest.json');
  writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf8');
  return filePath;
}

export function printTelemetryReport(report: DockerBuildTelemetryReport): void {
  console.log('='.repeat(70));
  console.log(`🐳 تقرير مراقبة وتتبع بناء الحاويات السيادي (Docker Build Telemetry Sentinel)`);
  console.log('='.repeat(70));
  console.log(`- الأمر المنفذ: \`${report.command}\``);
  console.log(`- الحالة النهائية: ${report.success ? '🟢 نجاح تام (Exit 0)' : '🔴 فشل البناء (Exit ' + report.exitCode + ')'}`);
  console.log(`- إجمالي وقت البناء: ${report.totalDurationSeconds}s`);
  console.log(`- الخطوات المخزنة مؤقتاً (Cache Hits): ${report.cachedStepsCount}`);
  console.log(`- الخطوات المعاد تنفيذها (Executed): ${report.executedStepsCount}`);

  if (report.bottlenecks.length > 0) {
    console.log(`\n⏳ أطول الخطوات استهلاكاً للوقت (Top Bottlenecks):`);
    report.bottlenecks.forEach((b, i) => {
      console.log(`   ${i + 1}. [${b.durationSeconds}s] ${b.description} (${b.status})`);
    });
  }

  if (report.failureAnalysis) {
    console.log(`\n🚨 التحليل الجنائي لسبب الفشل (Forensic Root Cause):`);
    console.log(`   - التصنيف: ${report.failureAnalysis.detectedCategory}`);
    console.log(`   - رسالة الخطأ: ${report.failureAnalysis.errorMessage}`);
    if (report.failureAnalysis.failedStep) {
      console.log(`   - الخطوة المتعثرة: ${report.failureAnalysis.failedStep}`);
    }
    console.log(`   - التوصية العلاجية: ${report.failureAnalysis.recommendation}`);
  }
  console.log('='.repeat(70));
}

export async function runProfiledDockerBuild(
  args: string[] = ['build', '-f', 'docker/Dockerfile.dashboard', '-t', 'alsaada-dashboard-test', '.'],
  root = process.cwd()
): Promise<DockerBuildTelemetryReport> {
  const commandStr = `docker ${args.join(' ')}`;
  const startTime = Date.now();

  return new Promise((resolvePromise) => {
    let output = '';
    const child = spawn('docker', args, {
      cwd: root,
      shell: true,
      env: { ...process.env, DOCKER_BUILDKIT: '1' },
    });

    child.stdout?.on('data', (chunk) => {
      const str = chunk.toString();
      output += str;
      process.stdout.write(str);
    });

    child.stderr?.on('data', (chunk) => {
      const str = chunk.toString();
      output += str;
      process.stderr.write(str);
    });

    child.on('close', (code) => {
      const durationSeconds = (Date.now() - startTime) / 1000;
      const report = generateTelemetryReport({
        command: commandStr,
        rawOutput: output,
        totalDurationSeconds: durationSeconds,
        exitCode: code ?? 1,
      });

      saveTelemetrySnapshot(report, root);
      printTelemetryReport(report);
      resolvePromise(report);
    });
  });
}

// CLI direct invocation
const scriptArg = process.argv[1];
if (scriptArg && import.meta.url === `file:///${scriptArg.replace(/\\/g, '/')}`) {
  const cliArgs = process.argv.slice(2);
  const dockerArgs = cliArgs.length > 0 ? cliArgs : ['build', '-f', 'docker/Dockerfile.dashboard', '-t', 'alsaada-dashboard-test', '.'];
  void runProfiledDockerBuild(dockerArgs).then((report) => {
    if (!report.success) {
      process.exit(1);
    }
  });
}

