import React from 'react';
import { requireDashboardUser } from '@/lib/auth';
import { getWorkforceDirectory, getSitesHub } from '@/lib/data-fetchers';
import { WorkforceDirectoryClient } from './directory-client';

export default async function WorkerDirectoryPage() {
  const user = await requireDashboardUser();

  const [workers, sites] = await Promise.all([
    getWorkforceDirectory(user),
    getSitesHub(user),
  ]);

  const canViewFinances = ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(user.role);

  return (
    <WorkforceDirectoryClient
      initialWorkers={workers}
      sites={sites.map((s) => s.name)}
      canViewFinances={canViewFinances}
    />
  );
}
