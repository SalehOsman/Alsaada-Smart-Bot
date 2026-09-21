/**
 * Structured Enterprise Logger — G9 Observability & Zero Console Policy
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogPayload {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  action?: string;
  traceId?: string;
  [key: string]: unknown;
}

export class EnterpriseLogger {
  private formatLog(
    level: LogLevel,
    input: Record<string, unknown> | string,
    msg?: string,
  ): string {
    const timestamp = new Date().toISOString();
    let payload: LogPayload;

    if (typeof input === "string") {
      payload = {
        timestamp,
        level,
        message: input,
      };
    } else {
      const { message, context, action, traceId, ...rest } = input;
      payload = {
        timestamp,
        level,
        message: msg ?? (typeof message === "string" ? message : ""),
        ...(context ? { context: String(context) } : {}),
        ...(action ? { action: String(action) } : {}),
        ...(traceId ? { traceId: String(traceId) } : {}),
        ...rest,
      };
    }

    return JSON.stringify(payload);
  }

  public info(input: Record<string, unknown> | string, msg?: string): void {
    process.stdout.write(this.formatLog("info", input, msg) + "\n");
  }

  public warn(input: Record<string, unknown> | string, msg?: string): void {
    process.stdout.write(this.formatLog("warn", input, msg) + "\n");
  }

  public error(input: Record<string, unknown> | string, msg?: string): void {
    process.stderr.write(this.formatLog("error", input, msg) + "\n");
  }

  public debug(input: Record<string, unknown> | string, msg?: string): void {
    if (process.env.DEBUG || process.env.NODE_ENV === "development") {
      process.stdout.write(this.formatLog("debug", input, msg) + "\n");
    }
  }
}

export const logger = new EnterpriseLogger();
