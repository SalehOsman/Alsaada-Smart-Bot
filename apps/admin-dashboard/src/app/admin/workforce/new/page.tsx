import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import {
  getActiveSites,
  getActiveJobTitles,
  getCanteenCigaretteItems,
  getSiteAccommodations,
} from '@/lib/workforce-lookups';
import { NewWorkerClient } from './new-worker-client';

export const dynamic = 'force-dynamic';

export default async function NewWorkerPage() {
  const user = await getCurrentUser({ nullable: true });
  if (!user) {
    redirect('/session-expired');
  }

  // Fetch real dynamic database lookups concurrently
  const [sites, jobTitles, canteenCigarettes, accommodations] = await Promise.all([
    getActiveSites(),
    getActiveJobTitles(),
    getCanteenCigaretteItems(),
    getSiteAccommodations(),
  ]);

  return (
    <NewWorkerClient
      sites={sites}
      jobTitles={jobTitles}
      canteenCigarettes={canteenCigarettes}
      accommodations={accommodations}
      userRole={user.role}
    />
  );
}
