import React from 'react';
import { requireDashboardUser } from '@/lib/auth';
import { getWorkforceEvaluations } from '@/lib/data-fetchers';
import { WorkforceEvaluationsClient } from './evaluations-client';

export const dynamic = 'force-dynamic';

export default async function WorkforceEvaluationsPage() {
  const user = await requireDashboardUser();
  const data = await getWorkforceEvaluations(user);

  return (
    <WorkforceEvaluationsClient
      initialEvaluations={data.evaluations}
      initialStats={data.stats}
      sites={data.sites}
      userRole={user.role}
    />
  );
}
