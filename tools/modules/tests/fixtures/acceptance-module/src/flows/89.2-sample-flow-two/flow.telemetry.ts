export interface QueryTelemetryEvent {
  event: string;
  flowCode: '89.2';
  timestamp: string;
  userId: number;
}

export function createQueryEvent(event: string, userId: number): QueryTelemetryEvent {
  return {
    event,
    flowCode: '89.2',
    timestamp: new Date().toISOString(),
    userId,
  };
}
