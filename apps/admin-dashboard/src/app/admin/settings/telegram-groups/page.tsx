import React, { Suspense } from 'react';
import { requireDashboardUser } from '@/lib/auth';
import { getNotificationTopicsData } from '@/lib/data-fetchers';
import { TelegramGroupsClient } from './groups-client';

export default async function TelegramGroupsSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const user = await requireDashboardUser();
  const topics = await getNotificationTopicsData();
  const resolvedParams = searchParams ? await searchParams : undefined;
  const initialTab = resolvedParams?.tab === 'notifications' ? 'notifications' : 'groups';

  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">جاري التحميل...</div>}>
      <TelegramGroupsClient
        currentUserRole={user.role}
        initialTopics={topics}
        initialTab={initialTab}
      />
    </Suspense>
  );
}

