import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '@alsaada/database';
import { TelemetryLogger } from '@alsaada/telemetry';

const logger = new TelemetryLogger({
  service: 'admin-dashboard',
  defaultComponent: 'prisma-studio-manager',
});

export interface StudioStatus {
  isRunning: boolean;
  port: number;
  remainingSeconds: number;
  expiresAt: string | null;
  startedAt: string | null;
  lastActivityAt: string | null;
  targetUrl: string;
  tunnelUrl?: string | null;
}

export class StudioProcessManager {
  private childProcess: ChildProcess | null = null;
  private startedAtTime: number | null = null;
  private lastActivityTime: number | null = null;
  private watchdogTimer: NodeJS.Timeout | null = null;
  private lastActorTelegramId: string | null = null;
  private lastIpAddress: string | null = null;

  // 15 minutes of inactivity threshold (Pillar 4 SSOT)
  public readonly IDLE_TIMEOUT_MS = 15 * 60 * 1000;
  public readonly DEFAULT_PORT = 5555;

  public findDatabasePackageDir(): string {
    const candidates = [
      path.resolve(process.cwd(), 'packages/database'),
      path.resolve(process.cwd(), '../../packages/database'),
      path.resolve(process.cwd(), '../packages/database'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(path.join(candidate, 'prisma', 'schema.prisma'))) {
        return candidate;
      }
    }
    return path.resolve(process.cwd(), 'packages/database');
  }

  public getTargetUrl(): string {
    if (this.childProcess) {
      return `http://127.0.0.1:${this.getPort()}`;
    }
    return process.env.PRISMA_STUDIO_URL || `http://127.0.0.1:${this.DEFAULT_PORT}`;
  }

  public getPort(): number {
    const url = process.env.PRISMA_STUDIO_URL || `http://127.0.0.1:${this.DEFAULT_PORT}`;
    try {
      const parsed = new URL(url);
      return Number(parsed.port) || this.DEFAULT_PORT;
    } catch {
      return this.DEFAULT_PORT;
    }
  }

  /**
   * Resets the 15-minute inactivity watchdog timer.
   * Kept for internal activity tracking.
   */
  public touch(): void {
    if (!this.isActive()) {
      return;
    }
    this.lastActivityTime = Date.now();
    this.armWatchdog();
  }

  /**
   * Extends the Prisma Studio session by resetting the 15-minute watchdog timer
   * and recording an interactive extension audit event.
   * Attaches and arms the watchdog if Prisma Studio is running or listening.
   */
  public async extendSession(actorTelegramId: string, ipAddress: string): Promise<StudioStatus> {
    const isRunning = this.isActive() || (await this.isHealthy());
    if (!isRunning) {
      return this.getStatus();
    }

    this.lastActorTelegramId = actorTelegramId;
    this.lastIpAddress = ipAddress;
    this.startedAtTime = this.startedAtTime || Date.now();
    this.lastActivityTime = Date.now();
    this.armWatchdog();

    await this.recordAuditLog(actorTelegramId, 'PRISMA_STUDIO_EXTEND', ipAddress, {
      remainingSeconds: Math.ceil(this.IDLE_TIMEOUT_MS / 1000),
      url: this.getTargetUrl(),
    });

    return this.getStatus();
  }

  public isActive(): boolean {
    return this.startedAtTime !== null || this.childProcess !== null;
  }

  /**
   * Checks whether the upstream Prisma Studio is listening and responding.
   */
  public async isHealthy(): Promise<boolean> {
    const url = this.getTargetUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });
      return res.status < 500;
    } catch {
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Arm or re-arm the 15-minute watchdog countdown.
   */
  private armWatchdog(): void {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }

    this.watchdogTimer = setTimeout(async () => {
      logger.warn('Prisma Studio 15-minute inactivity watchdog triggered auto-shutdown', {
        action: 'studio.watchdog.idle_timeout',
      });
      await this.stop(this.lastActorTelegramId || '0', this.lastIpAddress || '127.0.0.1', 'IDLE_TIMEOUT_15_MINUTES');
    }, this.IDLE_TIMEOUT_MS);

    // Unref timer so it does not block Node process exit if needed
    if (this.watchdogTimer && typeof this.watchdogTimer.unref === 'function') {
      this.watchdogTimer.unref();
    }
  }

  /**
   * Reaps any zombie or dead process occupying the port before starting.
   */
  public async reapZombieProcess(): Promise<void> {
    const port = this.getPort();
    const isOccupied = await new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(500);
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
      socket.connect(port, '127.0.0.1');
    });

    if (isOccupied && !this.childProcess) {
      logger.warn(`Port ${port} is occupied by an external or zombie process. Reaping/attaching.`, {
        action: 'studio.process.reap',
        payload: { port },
      });
    }
  }

  /**
   * Start Prisma Studio session with watchdog timer and forensic audit log.
   */
  public async start(actorTelegramId: string, ipAddress: string): Promise<StudioStatus> {
    this.lastActorTelegramId = actorTelegramId;
    this.lastIpAddress = ipAddress;

    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      this.startedAtTime = Date.now();
      this.lastActivityTime = Date.now();
      this.armWatchdog();

      await this.recordAuditLog(actorTelegramId, 'PRISMA_STUDIO_START', ipAddress, {
        status: 'SPAWNED',
        url: this.getTargetUrl(),
      });

      return this.getStatus();
    }

    const healthy = await this.isHealthy();
    if (healthy) {
      // Already running (e.g. docker container or background process)
      this.startedAtTime = this.startedAtTime || Date.now();
      this.lastActivityTime = Date.now();
      this.armWatchdog();

      await this.recordAuditLog(actorTelegramId, 'PRISMA_STUDIO_START', ipAddress, {
        status: 'ATTACHED_EXISTING',
        url: this.getTargetUrl(),
      });

      return this.getStatus();
    }

    // Check & reap zombie processes before spawn
    await this.reapZombieProcess();

    // If we need to spawn locally (outside container)
    try {
      const port = this.getPort();
      const dbDir = this.findDatabasePackageDir();
      const schemaPath = path.join(dbDir, 'prisma', 'schema.prisma');
      const configPath = path.join(dbDir, 'prisma.config.ts');

      const args = [
        'prisma',
        'studio',
        '--schema',
        schemaPath,
        '--port',
        String(port),
        '--browser',
        'none',
        '--hostname',
        '0.0.0.0',
      ];

      if (fs.existsSync(configPath)) {
        args.push('--config', configPath);
      }

      const child = spawn(
        process.platform === 'win32' ? 'npx.cmd' : 'npx',
        args,
        {
          cwd: dbDir,
          env: {
            ...process.env,
            PORT: String(port),
          },
          stdio: 'pipe',
          detached: false,
        }
      );

      child.on('error', (err) => {
        logger.error('Failed to spawn Prisma Studio child process', {
          action: 'studio.process.spawn_error',
          error: err,
        });
      });

      child.on('exit', (code, signal) => {
        logger.info(`Prisma Studio process exited with code ${code}, signal ${signal}`, {
          action: 'studio.process.exit',
          payload: { code, signal },
        });
        this.childProcess = null;
        this.startedAtTime = null;
        if (this.watchdogTimer) {
          clearTimeout(this.watchdogTimer);
          this.watchdogTimer = null;
        }
      });

      this.childProcess = child;
      this.startedAtTime = Date.now();
      this.lastActivityTime = Date.now();
      this.armWatchdog();

      // Give it up to 4 seconds to start listening
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (await this.isHealthy()) break;
      }
    } catch (spawnErr) {
      logger.error('Error starting Prisma Studio', {
        action: 'studio.process.start',
        error: spawnErr,
      });
    }

    await this.recordAuditLog(actorTelegramId, 'PRISMA_STUDIO_START', ipAddress, {
      status: 'SPAWNED',
      url: this.getTargetUrl(),
    });

    return this.getStatus();
  }

  /**
   * Stop Prisma Studio session, release resources, and log audit trail.
   */
  public async stop(actorTelegramId: string, ipAddress: string, reason = 'MANUAL_STOP'): Promise<StudioStatus> {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }

    if (this.childProcess) {
      try {
        if (process.platform === 'win32' && this.childProcess.pid) {
          try {
            const killer = spawn('taskkill', ['/pid', String(this.childProcess.pid), '/T', '/F']);
            killer.on('error', () => {
              this.childProcess?.kill('SIGTERM');
            });
          } catch {
            this.childProcess.kill('SIGTERM');
          }
        } else {
          this.childProcess.kill('SIGTERM');
        }
      } catch (err) {
        logger.warn('Error terminating child process with SIGTERM', { error: err });
      }
      this.childProcess = null;
    }

    this.startedAtTime = null;
    this.lastActivityTime = null;

    const action = reason === 'IDLE_TIMEOUT_15_MINUTES' ? 'PRISMA_STUDIO_AUTO_SHUTDOWN' : 'PRISMA_STUDIO_STOP';
    await this.recordAuditLog(actorTelegramId, action, ipAddress, {
      reason,
      url: this.getTargetUrl(),
    });

    return this.getStatus();
  }

  /**
   * Forensic audit logging for studio lifecycle events into audit_logs table.
   */
  private async recordAuditLog(
    actorTelegramId: string,
    action: string,
    ipAddress: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    try {
      const numericTelegramId = /^\d+$/.test(actorTelegramId) ? BigInt(actorTelegramId) : BigInt(0);
      await prisma.auditLog.create({
        data: {
          actorTelegramId: numericTelegramId,
          action,
          entityType: 'PRISMA_STUDIO',
          entityId: `studio:${this.getPort()}`,
          ipAddress: ipAddress || null,
          afterPayload: {
            ...payload,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (auditErr) {
      logger.warn('Failed to record Prisma Studio lifecycle audit log', {
        action: 'studio.audit.log_failed',
        error: auditErr,
      });
    }
  }

  /**
   * Calculates real-time status, health, and remaining seconds until auto-shutdown.
   */
  public async getStatus(): Promise<StudioStatus> {
    const isRunning = this.isActive() || this.childProcess !== null || (await this.isHealthy());
    let remainingSeconds = 0;
    let expiresAt: string | null = null;

    if (isRunning && this.lastActivityTime) {
      const elapsed = Date.now() - this.lastActivityTime;
      const remainingMs = Math.max(0, this.IDLE_TIMEOUT_MS - elapsed);
      remainingSeconds = Math.ceil(remainingMs / 1000);
      expiresAt = new Date(this.lastActivityTime + this.IDLE_TIMEOUT_MS).toISOString();
    }

    return {
      isRunning,
      port: this.getPort(),
      remainingSeconds,
      expiresAt,
      startedAt: this.startedAtTime ? new Date(this.startedAtTime).toISOString() : null,
      lastActivityAt: this.lastActivityTime ? new Date(this.lastActivityTime).toISOString() : null,
      targetUrl: this.getTargetUrl(),
      tunnelUrl: process.env.PRISMA_STUDIO_TUNNEL_URL || null,
    };
  }
}

// Global singleton pattern to survive Next.js module reloads
declare global {
  // eslint-disable-next-line no-var
  var __alsaadaStudioProcessManager: StudioProcessManager | undefined;
}

export const studioProcessManager: StudioProcessManager =
  globalThis.__alsaadaStudioProcessManager ?? (globalThis.__alsaadaStudioProcessManager = new StudioProcessManager());
