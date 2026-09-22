export interface SampleTelemetryEvent {
  event: string;
  flowCode: '89.1';
  timestamp: string;
  userId: number;
}

export function createSampleEvent(event: string, userId: number): SampleTelemetryEvent {
  return {
    event,
    flowCode: '89.1',
    timestamp: new Date().toISOString(),
    userId,
  };
}
