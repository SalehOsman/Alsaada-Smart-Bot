import React from 'react';
import { requireDashboardUser } from '@/lib/auth';
import { TelegramGroupsClient } from './groups-client';

export default async function TelegramGroupsSettingsPage() {
  const user = await requireDashboardUser();

  return (
    <TelegramGroupsClient
      currentUserRole={user.role}
    />
  );
}
