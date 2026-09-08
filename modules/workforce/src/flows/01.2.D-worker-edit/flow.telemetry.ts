import { WorkforceTelemetry } from '../../module.telemetry.js';

export const FLOW_CODE = '01.2.D';

export class WorkerEditTelemetry {
  static measure<T>(action: string, fn: () => Promise<T>, userId?: string): Promise<T> {
    const start = performance.now();
    return fn()
      .then((res) => {
        const durationMs = Math.round(performance.now() - start);
        WorkforceTelemetry.record({
          flowCode: FLOW_CODE,
          action,
          durationMs,
          success: true,
          userId,
        });
        return res;
      })
      .catch((err: unknown) => {
        const durationMs = Math.round(performance.now() - start);
        const errorMsg = err instanceof Error ? err.message : String(err);
        WorkforceTelemetry.record({
          flowCode: FLOW_CODE,
          action,
          durationMs,
          success: false,
          userId,
          error: errorMsg,
        });
        throw err;
      });
  }
}
