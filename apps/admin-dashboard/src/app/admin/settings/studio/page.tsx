import React from 'react';
import { getStudioRecordsData } from '@/lib/data-fetchers';
import { StudioClient } from './studio-client';

export default async function DataGovernanceStudioPage() {
  const records = await getStudioRecordsData();
  return <StudioClient initialRecords={records} />;
}
