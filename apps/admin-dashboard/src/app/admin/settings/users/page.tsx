import React from 'react';
import { prisma } from '@alsaada/database';
import { requireDashboardUser } from '@/lib/auth';
import { getUsersManagementData, getDelegationsManagementData } from '@/lib/data-fetchers';
import { UsersClient } from './users-client';

export default async function UsersManagementPage() {
  const user = await requireDashboardUser();

  const [users, delegations, sites] = await Promise.all([
    getUsersManagementData(),
    getDelegationsManagementData(user),
    prisma.site.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const canManageDelegations = ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(user.role);

  return (
    <UsersClient
      initialUsers={users}
      initialDelegations={delegations}
      availableSites={sites}
      currentUserRole={user.role}
      canManageDelegations={canManageDelegations}
    />
  );
}
