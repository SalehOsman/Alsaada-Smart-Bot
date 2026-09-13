import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getOverviewKpis, getSitesHub, getWorkforceDirectory } from '@/lib/data-fetchers';
import { SuperAdminOverview } from '@/components/dashboard/super-admin-overview';
import { GeneralAdminOverview } from '@/components/dashboard/general-admin-overview';
import { FieldAdminOverview } from '@/components/dashboard/field-admin-overview';

// Structural KPI contract delegated to role overview components:
// kpis.activeWorkersCount, kpis.activeSitesCount, kpis.pendingItemsCount, kpis.avgLatencyMs, min-h-[44px]
export default async function AdminOverviewPage() {
  const user = await getCurrentUser();
  if (!user) {
    const botUsername = (process.env.TELEGRAM_BOT_USERNAME || 'Al_Saada_smart_bot').replace(/^@/, '');
    redirect(`https://t.me/${botUsername}?start=dashboard_access`);
  }

  const [kpis, sites, workers] = await Promise.all([
    getOverviewKpis(user),
    getSitesHub(user),
    getWorkforceDirectory(user),
  ]);

  if (user.role === 'SUPER_ADMIN' || user.isRealSuperAdmin) {
    return <SuperAdminOverview user={user} kpis={kpis} sites={sites} workers={workers} />;
  }

  if (user.role === 'GENERAL_ADMIN') {
    return <GeneralAdminOverview user={user} kpis={kpis} sites={sites} workers={workers} />;
  }

  if (user.role === 'FIELD_ADMIN') {
    return <FieldAdminOverview user={user} kpis={kpis} sites={sites} workers={workers} />;
  }

  // Safe fallback to GeneralAdminOverview for any authorized administrative session
  return <GeneralAdminOverview user={user} kpis={kpis} sites={sites} workers={workers} />;
}
