export interface FlowTelemetryEvent {
  flowCode: string;
  action: string;
  durationMs: number;
  success: boolean;
  userId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export class WorkforceTelemetry {
  private static events: FlowTelemetryEvent[] = [];

  static record(event: FlowTelemetryEvent): void {
    this.events.push({
      ...event,
      metadata: event.metadata ? { ...event.metadata } : undefined,
    });
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
