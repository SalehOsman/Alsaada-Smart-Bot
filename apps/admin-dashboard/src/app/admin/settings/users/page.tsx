import React from 'react';
import { getCurrentUser } from '@/lib/auth';
import { getUsersManagementData, getDelegationsManagementData } from '@/lib/data-fetchers';
import { UsersClient } from './users-client';

export default async function UsersManagementPage() {
  const user = await getCurrentUser();
  const [users, delegations] = await Promise.all([
    getUsersManagementData(),
    getDelegationsManagementData(user),
  ]);

  const canManageDelegations = ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(user.role);

  return (
    <UsersClient
      initialUsers={users}
      initialDelegations={delegations}
      currentUserRole={user.role}
      canManageDelegations={canManageDelegations}
    />
  );
}
