import React from 'react';
import { requireDashboardUser } from '@/lib/auth';
import { getClearancesData } from '@/lib/data-fetchers';
import { ClearancesClient } from './clearances-client';

export default async function ClearancesHubPage() {
  const user = await requireDashboardUser();

  const data = await getClearancesData(user);

  return (
    <ClearancesClient
      initialClearances={data.clearances}
      initialDecisions={data.decisions}
    />
  );
}
