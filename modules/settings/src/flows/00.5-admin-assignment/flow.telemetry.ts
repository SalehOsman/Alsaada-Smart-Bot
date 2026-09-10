export class AdminAssignmentTelemetry {
  static logStart(actorId: string, flowKey: string): void {
    console.log(`[TELEMETRY] Flow ${flowKey} initiated by ${actorId}`);
  }

  static logCompletion(actorId: string, refId: string): void {
    console.log(`[TELEMETRY] Flow completed with ${refId} by ${actorId}`);
  }
}
