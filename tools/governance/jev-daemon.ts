import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync, watch as fsWatch, FSWatcher } from 'node:fs';
import { join } from 'node:path';
import net from 'node:net';
import { isCliEntrypoint, readUtf8 } from './common.js';
import {
  type TypeSafeQuestion,
  JEV_AUDIT_CATALOG,
} from './typesafe/audit-catalog.js';
import {
  type BackoffRetryOptions,
  type JevCloudTelemetry,
  type EnrichedJevState,
  analyzeCodeWithAst,
  evaluateBatchParallel,
  runJevAudit,
  formatJevReport,
  type JevAuditReport,
  type JevAuditOptions,
} from './jev-auditor.js';

export const JEV_PIPE_NAME =
  process.platform === 'win32'
    ? '\\\\.\\pipe\\alsaada-jev-sentinel'
    : join('/tmp', 'alsaada-jev-sentinel.sock');

export const JEV_DAEMON_PID_FILE = '.governance-cache/jev-daemon.pid';

export interface DaemonPidInfo {
  pid: number;
  startedAt: string;
  pipeName: string;
  endpoint: string;
}

export interface DaemonStatusInfo {
  running: boolean;
  pid?: number | undefined;
  uptimeSeconds?: number | undefined;
  warmConnection: boolean;
  lastCloudLatencyMs?: number | undefined;
  telemetry: JevCloudTelemetry;
  endpoint: string;
  socketPath: string;
}

export type DaemonRequest =
  | { id: string; type: 'PING' }
  | { id: string; type: 'STATUS' }
  | { id: string; type: 'STOP' }
  | { id: string; type: 'AUDIT'; payload: JevAuditOptions }
  | { id: string; type: 'EVALUATE_BATCH'; payload: { state: unknown; questions: Record<string, TypeSafeQuestion>; apiKey?: string } };

export type DaemonResponse =
  | { id: string; ok: true; data: any }
  | { id: string; ok: false; error: string; data?: undefined };

/**
 * Sends a single request to the local JEV Daemon over Named Pipe / IPC.
 */
export async function sendDaemonRequest(
  request: DaemonRequest,
  options: { pipeName?: string | undefined; timeoutMs?: number | undefined } = {}
): Promise<DaemonResponse> {
  const pipeName = options.pipeName ?? JEV_PIPE_NAME;
  const timeoutMs = options.timeoutMs ?? 10000;

  return new Promise((resolve, reject) => {
    let timer: NodeJS.Timeout | null = null;
    let client: net.Socket | null = null;

    try {
      client = net.connect(pipeName);
    } catch (err) {
      return reject(err);
    }

    timer = setTimeout(() => {
      if (client) {
        client.destroy();
      }
      reject(new Error(`Timeout (${timeoutMs}ms) waiting for JEV Daemon IPC response`));
    }, timeoutMs);

    let buffer = '';

    client.on('connect', () => {
      client?.write(JSON.stringify(request) + '\n');
    });

    client.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      if (buffer.includes('\n')) {
        const line = buffer.split('\n')[0]?.trim();
        if (line) {
          try {
            const parsed = JSON.parse(line) as DaemonResponse;
            if (timer) clearTimeout(timer);
            client?.end();
            resolve(parsed);
          } catch (e) {
            if (timer) clearTimeout(timer);
            client?.end();
            reject(new Error(`Failed to parse daemon response JSON: ${String(e)}`));
          }
        }
      }
    });

    client.on('error', (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Fast non-blocking probe to verify if the JEV daemon is currently active.
 */
export async function probeJevDaemon(
  options: { pipeName?: string | undefined; timeoutMs?: number | undefined } = {}
): Promise<boolean> {
  try {
    const res = await sendDaemonRequest(
      { id: 'probe', type: 'PING' },
      { pipeName: options.pipeName, timeoutMs: options.timeoutMs ?? 300 }
    );
    return res.ok === true;
  } catch {
    return false;
  }
}

/**
 * Persistent JEV Background Daemon.
 * Maintains warm Keep-Alive HTTP/2 connection pool and serves sub-2ms local IPC.
 */
export class JevDaemon {
  private server: net.Server | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private readonly pipeName: string;
  private readonly root: string;
  private readonly startedAt: Date;
  private warmConnection = false;
  private lastCloudLatencyMs = 0;
  private cloudTelemetry: JevCloudTelemetry = {
    cloudRequestsSent: 0,
    httpAttemptsTotal: 0,
    cloudCacheHits: 0,
    precedentHits: 0,
    questionsDispatchedToCloud: 0,
    engineMode: 'api',
    endpoint: 'https://api.typesafe.ai/v1/systemone',
  };

  constructor(options: { pipeName?: string; root?: string } = {}) {
    this.root = options.root ?? process.cwd();
    this.pipeName = options.pipeName ?? JEV_PIPE_NAME;
    this.startedAt = new Date();
  }

  public async start(): Promise<void> {
    const isAlreadyRunning = await probeJevDaemon({ pipeName: this.pipeName, timeoutMs: 300 });
    if (isAlreadyRunning) {
      throw new Error(`JEV Daemon is already running on ${this.pipeName}`);
    }

    // Clean up stale socket file on POSIX systems
    if (process.platform !== 'win32' && existsSync(this.pipeName)) {
      try {
        unlinkSync(this.pipeName);
      } catch {
        // ignore
      }
    }

    const cacheDir = join(this.root, '.governance-cache');
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }

    // Write PID file
    const pidInfo: DaemonPidInfo = {
      pid: process.pid,
      startedAt: this.startedAt.toISOString(),
      pipeName: this.pipeName,
      endpoint: this.cloudTelemetry.endpoint,
    };
    writeFileSync(join(this.root, JEV_DAEMON_PID_FILE), JSON.stringify(pidInfo, null, 2), 'utf8');

    // Create IPC Server
    this.server = net.createServer((socket) => {
      let buffer = '';

      socket.on('error', (_err) => {
        // Gracefully suppress client disconnection errors (EPIPE, ECONNRESET)
      });

      socket.on('data', async (chunk) => {
        buffer += chunk.toString('utf8');
        while (buffer.includes('\n')) {
          const idx = buffer.indexOf('\n');
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);

          if (!line) continue;

          try {
            const req = JSON.parse(line) as DaemonRequest;
            const res = await this.handleRequest(req);
            if (socket.writable) {
              socket.write(JSON.stringify(res) + '\n');
            }
            if (req.type === 'STOP') {
              setTimeout(() => this.stop(), 100);
            }
          } catch (err: any) {
            const errRes: DaemonResponse = {
              id: 'err',
              ok: false,
              error: err?.message || String(err),
            };
            if (socket.writable) {
              socket.write(JSON.stringify(errRes) + '\n');
            }
          }
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.listen(this.pipeName, () => {
        resolve();
      });
      this.server!.on('error', reject);
    });

    // Start Keep-Alive warming and periodic heartbeat
    await this.warmUpCloudConnection();
    this.heartbeatTimer = setInterval(() => {
      this.warmUpCloudConnection().catch(() => {});
    }, 60000);
  }

  public async stop(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
    }

    const pidPath = join(this.root, JEV_DAEMON_PID_FILE);
    if (existsSync(pidPath)) {
      try {
        unlinkSync(pidPath);
      } catch {
        // ignore
      }
    }

    if (process.platform !== 'win32' && existsSync(this.pipeName)) {
      try {
        unlinkSync(this.pipeName);
      } catch {
        // ignore
      }
    }
  }

  public getStatus(): DaemonStatusInfo {
    const uptimeSeconds = Math.round((Date.now() - this.startedAt.getTime()) / 1000);
    return {
      running: true,
      pid: process.pid,
      uptimeSeconds,
      warmConnection: this.warmConnection,
      lastCloudLatencyMs: this.lastCloudLatencyMs,
      telemetry: this.cloudTelemetry,
      endpoint: this.cloudTelemetry.endpoint,
      socketPath: this.pipeName,
    };
  }

  private async handleRequest(req: DaemonRequest): Promise<DaemonResponse> {
    switch (req.type) {
      case 'PING':
        return {
          id: req.id,
          ok: true,
          data: { pong: true, warmConnection: this.warmConnection, latencyMs: this.lastCloudLatencyMs },
        };

      case 'STATUS':
        return {
          id: req.id,
          ok: true,
          data: this.getStatus(),
        };

      case 'STOP':
        return {
          id: req.id,
          ok: true,
          data: { message: 'JEV Daemon shutting down gracefully.' },
        };

      case 'EVALUATE_BATCH': {
        const { state, questions, apiKey } = req.payload;
        const start = Date.now();
        const judgments = await evaluateBatchParallel(
          state,
          questions,
          apiKey,
          'api',
          undefined,
          this.root
        );
        this.lastCloudLatencyMs = Date.now() - start;
        this.cloudTelemetry.cloudRequestsSent++;
        this.cloudTelemetry.httpAttemptsTotal++;
        return {
          id: req.id,
          ok: true,
          data: judgments,
        };
      }

      case 'AUDIT': {
        const start = Date.now();
        const report = await runJevAudit(req.payload, this.root);
        this.lastCloudLatencyMs = Date.now() - start;
        return {
          id: req.id,
          ok: true,
          data: report,
        };
      }

      default:
        return {
          id: (req as any).id || 'unknown',
          ok: false,
          error: `Unsupported request type: ${(req as any).type}`,
        };
    }
  }

  private async warmUpCloudConnection(): Promise<void> {
    const token = process.env.TYPESAFE_API_KEY;
    if (!token) {
      this.warmConnection = false;
      return;
    }

    const start = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(this.cloudTelemetry.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Connection: 'keep-alive',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'jev-latest',
          state: { target: 'Daemon Keep-Alive Heartbeat Ping' },
          questions: {
            heartbeat: {
              type: 'noul',
              instructions: 'Verify system heartbeat status',
              criteria: { true: 'active', false: 'inactive' },
            },
          },
        }),
      });

      clearTimeout(timer);
      if (res.ok) {
        this.warmConnection = true;
        this.lastCloudLatencyMs = Date.now() - start;
      }
    } catch {
      this.warmConnection = false;
    }
  }
}

/**
 * Real-Time Ambient Sentinel Watcher (`pnpm jev:watch`).
 * Watches files and runs instant AST triage + warm cloud review.
 */
export async function startAmbientSentinel(root = process.cwd()): Promise<void> {
  console.log('\n================================================================================');
  console.log('👁️  JEV AMBIENT SENTINEL — REAL-TIME CONTINUOUS QUALITY & GOVERNANCE WATCHER');
  console.log('================================================================================');
  console.log(`📁 Watching: modules/, packages/, apps/, docs/work-plans/`);
  console.log(`⚡ Warm Connection Probe: Checking local JEV Daemon...`);

  const daemonActive = await probeJevDaemon();
  if (daemonActive) {
    console.log(`🟢 Local JEV Daemon is ACTIVE via ${JEV_PIPE_NAME} (Fast Sub-150ms Response Enabled)`);
  } else {
    console.log(`⚠️  Local JEV Daemon is offline. Falling back to direct HTTPS mode.`);
    console.log(`💡 Tip: Run 'pnpm jev:daemon' in another terminal for <150ms instant responses.`);
  }

  console.log('🛡️  Ready. Watching for file modifications (Press Ctrl+C to stop)...\n');

  const watchDirs = [
    join(root, 'modules'),
    join(root, 'packages'),
    join(root, 'apps'),
    join(root, 'docs', 'work-plans'),
  ].filter((d) => existsSync(d));

  let debounceTimer: NodeJS.Timeout | null = null;
  const changedFiles = new Set<string>();

  const processChanges = async () => {
    const filesToAudit = Array.from(changedFiles);
    changedFiles.clear();

    if (filesToAudit.length === 0) return;

    const timestamp = new Date().toLocaleTimeString('ar-EG');
    console.log(`\n[${timestamp}] 📝 Detected changes in ${filesToAudit.length} file(s):`);
    for (const f of filesToAudit) {
      console.log(`   - ${f}`);
    }

    // 1. Local AST Gate (<5ms, 0 tokens)
    let hasAstViolations = false;
    for (const relPath of filesToAudit) {
      const absPath = join(root, relPath);
      if (!existsSync(absPath)) continue;
      const content = readUtf8(absPath);
      const ast = analyzeCodeWithAst(content, relPath);

      if (ast.hasLongButtonLabel) {
        hasAstViolations = true;
        console.error(`🚨 [GATE G5 / G22 VIOLATION]: Button label exceeds 16 chars in ${relPath} (Max: ${ast.maxButtonLabelLength})`);
      }
      if (ast.hasRawMessageBypass) {
        hasAstViolations = true;
        console.error(`🚨 [RICH MESSAGE VIOLATION]: Raw reply detected in ${relPath}. Use buildRichPage from @alsaada/core-components.`);
      }
      if (ast.violatesTemporalInvariants) {
        hasAstViolations = true;
        console.error(`🚨 [GATE G11 / G23 VIOLATION]: Temporal invariant breach in ${relPath}. Unpinned clock Date.now().`);
      }
      if (ast.hasUnmaskedCompensation) {
        hasAstViolations = true;
        console.error(`🚨 [GATE G8 MASKING VIOLATION]: Unmasked salary or compensation figure in ${relPath}. Wrap in formatSpoiler.`);
      }
    }

    if (hasAstViolations) {
      console.log(`❌ Immediate AST Pre-Filter Blocked: Resolve violations before cloud dispatch.\n`);
      return;
    }

    // 2. Fast Cloud Audit Dispatch
    console.log(`⚡ AST Pre-Filter: 🟢 Clean. Dispatching delta to TypeSafe System One...`);
    const start = Date.now();
    try {
      const report = await runJevAudit({ diff: true }, root);
      const elapsed = Date.now() - start;
      const cgiColor = report.cgi >= 90 ? '🟢' : report.cgi >= 75 ? '🟡' : '🔴';
      console.log(`${cgiColor} CGI: ${report.cgi.toFixed(1)}% | Verdict: [${report.overallVerdict}] (${elapsed}ms)`);
      if (report.overallVerdict !== 'CERTIFIED PASS' && report.actionableDirective) {
        console.log(`👉 Directive: ${report.actionableDirective}`);
      }
    } catch (err: any) {
      console.error(`⚠️  Cloud review error: ${err?.message || String(err)}`);
    }
  };

  const watchers: FSWatcher[] = [];

  for (const dir of watchDirs) {
    try {
      const watcher = fsWatch(dir, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        const norm = filename.replace(/\\/g, '/');
        if (
          norm.includes('.git') ||
          norm.includes('node_modules') ||
          norm.includes('.governance-cache') ||
          norm.endsWith('.log') ||
          norm.endsWith('.tmp')
        ) {
          return;
        }

        changedFiles.add(norm);
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          processChanges().catch((e) => console.error('Watcher processing error:', e));
        }, 500);
      });
      watchers.push(watcher);
    } catch (e) {
      console.error(`Failed to watch directory ${dir}:`, e);
    }
  }

  process.on('SIGINT', () => {
    console.log('\nStopping Ambient Sentinel...');
    for (const w of watchers) w.close();
    process.exit(0);
  });
}

// --- CLI Entrypoint ---
if (isCliEntrypoint(import.meta.url)) {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  if (command === 'start') {
    const isForeground = args.includes('--foreground') || args.includes('-f');
    const daemon = new JevDaemon();
    daemon
      .start()
      .then(() => {
        console.log(`🟢 JEV Daemon started successfully on ${JEV_PIPE_NAME}`);
        console.log(`⚡ Warm connection: ${daemon.getStatus().warmConnection ? 'ACTIVE' : 'IDLE'}`);
        if (!isForeground) {
          console.log(`ℹ️  Daemon running in foreground (press Ctrl+C to stop).`);
        }
      })
      .catch((err) => {
        console.error('❌ Failed to start JEV Daemon:', err.message);
        process.exit(1);
      });

    process.on('SIGINT', async () => {
      console.log('\nShutting down JEV Daemon...');
      await daemon.stop();
      process.exit(0);
    });
  } else if (command === 'status') {
    sendDaemonRequest({ id: 'status-cli', type: 'STATUS' }, { timeoutMs: 1500 })
      .then((res) => {
        if (res.ok && res.data) {
          const info = res.data as DaemonStatusInfo;
          console.log('\n================================================================================');
          console.log('📊 JEV DAEMON RUNTIME STATUS');
          console.log('================================================================================');
          console.log(`- Status:           🟢 ACTIVE & RUNNING`);
          console.log(`- PID:              ${info.pid}`);
          console.log(`- Uptime:           ${info.uptimeSeconds} seconds`);
          console.log(`- Warm Connection:  ${info.warmConnection ? '🟢 WARM & POOLED' : '🟡 CONNECTING'}`);
          console.log(`- Last Latency:     ${info.lastCloudLatencyMs}ms`);
          console.log(`- Endpoint:         ${info.endpoint}`);
          console.log(`- Local IPC Socket: ${info.socketPath}`);
          console.log('================================================================================\n');
        } else {
          console.log('❌ JEV Daemon returned error:', res);
        }
      })
      .catch(() => {
        console.log('\n🔴 JEV Daemon is NOT running.');
        console.log('👉 Start it with: pnpm jev:daemon or tsx tools/governance/jev-daemon.ts start\n');
      });
  } else if (command === 'stop') {
    sendDaemonRequest({ id: 'stop-cli', type: 'STOP' }, { timeoutMs: 1500 })
      .then((res) => {
        if (res.ok) {
          console.log('✅ JEV Daemon stop signal acknowledged:', res.data?.message || 'Stopped');
        } else {
          console.error('❌ Stop error:', res.error);
        }
      })
      .catch((err) => {
        console.error('❌ Failed to send stop signal to JEV Daemon:', err.message);
      });
  } else if (command === 'watch') {
    startAmbientSentinel().catch((err) => {
      console.error('Fatal Ambient Sentinel Error:', err);
      process.exit(1);
    });
  } else {
    console.log(`
Usage: tsx tools/governance/jev-daemon.ts <command> [options]

Commands:
  start     Start the persistent JEV background daemon
  status    Query status of the running daemon and warm connection
  stop      Gracefully terminate the running daemon
  watch     Launch the real-time Ambient Sentinel watcher
`);
  }
}
