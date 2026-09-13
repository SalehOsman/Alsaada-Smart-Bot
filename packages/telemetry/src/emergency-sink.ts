import { stderr } from 'node:process';
import { scrubString } from './redaction.js';

export function writeEmergencyIncident(traceId: string, reason = 'INCIDENT_PIPELINE_FAILURE'): void {
  const safeTraceId = scrubString(traceId).slice(0, 64);
  const safeReason = scrubString(reason).slice(0, 120);
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'fatal',
    service: 'telemetry-emergency-sink',
    traceId: safeTraceId,
    reason: safeReason,
  });

  stderr.write(`${entry.slice(0, 500)}\n`);
}
