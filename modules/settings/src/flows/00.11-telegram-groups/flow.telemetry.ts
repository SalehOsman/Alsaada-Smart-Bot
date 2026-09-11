export class TelegramGroupsTelemetry {
  static logGroupBinding(actorId: string, groupType: 'hq' | 'site', identifier: string): void {
    console.log(`[TELEMETRY] Group bound by ${actorId}: [${groupType}] ${identifier}`);
  }

  static logGroupUnbind(actorId: string, groupType: 'hq' | 'site', identifier: string): void {
    console.log(`[TELEMETRY] Group unbound by ${actorId}: [${groupType}] ${identifier}`);
  }

  static logTopicsCreation(actorId: string, chatId: string): void {
    console.log(`[TELEMETRY] HQ Topics created by ${actorId} in group ${chatId}`);
  }
}
