import React from 'react';
import { requireDashboardUser } from '@/lib/auth';
import { MatrixClient } from './matrix-client';

export default async function PermissionsMatrixPage() {
  const user = await requireDashboardUser();

  return (
    <MatrixClient
      currentUserRole={user.role}
      currentUserId={user.id}
    />
  );
}
