import React from 'react';
import { getJobMatrixData } from '@/lib/data-fetchers';
import { JobsClient } from './jobs-client';

export default async function JobsHubPage() {
  const jobs = await getJobMatrixData();

  return <JobsClient initialJobs={jobs} />;
}
