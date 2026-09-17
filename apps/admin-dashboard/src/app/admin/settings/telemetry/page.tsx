import React from 'react';
import { getApmTelemetryData } from '@/lib/data-fetchers';
import { getServerPreferences } from '@/lib/formatters';
import TelemetryClient from './telemetry-client';

export const dynamic = 'force-dynamic';

export default async function TelemetryPage() {
  const [telemetry, { numberFormat, timezone }] = await Promise.all([
    getApmTelemetryData({ timeRange: '24h' }),
    getServerPreferences(),
  ]);

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100 dark:bg-slate-950/20 border-transparent dark:border-transparent">
      <TelemetryClient
        initialData={telemetry}
        userPreferences={{
          numberFormat,
          timezone,
        }}
      />
    </div>
  );
}
