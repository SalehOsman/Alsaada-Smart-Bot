export interface FlowTelemetryEvent {
  flowCode: string;
  action: string;
  durationMs: number;
  success: boolean;
  userId?: string | undefined;
  error?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export class WorkforceTelemetry {
  private static events: FlowTelemetryEvent[] = [];

  static record(event: FlowTelemetryEvent): void {
    const stored: FlowTelemetryEvent = {
      flowCode: event.flowCode,
      action: event.action,
      durationMs: event.durationMs,
      success: event.success,
    };
    if (event.userId !== undefined) stored.userId = event.userId;
    if (event.error !== undefined) stored.error = event.error;
    if (event.metadata !== undefined) stored.metadata = { ...event.metadata };

    this.events.push(stored);
    // Keep max 1000 in-memory events for metrics analysis
    if (this.events.length > 1000) {
      this.events.shift();
    }
  }

  static getRecentEvents(flowCode?: string): FlowTelemetryEvent[] {
    if (!flowCode) return [...this.events];
    return this.events.filter((e) => e.flowCode === flowCode);
  }

  static clear(): void {
    this.events = [];
  }
}
