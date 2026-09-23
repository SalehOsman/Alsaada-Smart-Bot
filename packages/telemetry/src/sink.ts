import type { NormalizedIncident } from './incidents.js';

export type IncidentPersistStatus = 'persisted' | 'emergency' | 'failed';

export interface IncidentSinkPersistResult {
  readonly persisted?: boolean | undefined;
  readonly errorReference?: string | undefined;
}

/**
 * Adapter interface for persisting normalized telemetry incidents into a backing store
 * (e.g., ErrorVaultService in bot-server) without introducing runtime dependencies in @alsaada/telemetry.
 */
export interface IncidentSink {
  persist(incident: NormalizedIncident): Promise<IncidentSinkPersistResult | boolean | void>;
  notifyAdmins?(incident: NormalizedIncident, errorReference: string): Promise<void> | void;
}

let registeredIncidentSink: IncidentSink | null = null;

/**
 * Registers or replaces the singleton IncidentSink used by captureFlowError.
 */
export function setIncidentSink(sink: IncidentSink | null): void {
  registeredIncidentSink = sink;
}

/**
 * Retrieves the currently registered IncidentSink, or null if none is wired.
 */
export function getIncidentSink(): IncidentSink | null {
  return registeredIncidentSink;
}

/**
 * Clears the active IncidentSink (primarily for test isolation).
 */
export function clearIncidentSink(): void {
  registeredIncidentSink = null;
}
