export class NotificationPoliciesTelemetry {
  static logPolicyToggle(actorId: string, scope: string, featureKey: string, newState: boolean): void {
    console.log(`[TELEMETRY] Policy toggled by ${actorId}: [${scope}] ${featureKey} -> ${newState}`);
  }

  static logPolicyReset(actorId: string, scope: string): void {
    console.log(`[TELEMETRY] Policies reset to default by ${actorId} for scope ${scope}`);
  }
}
