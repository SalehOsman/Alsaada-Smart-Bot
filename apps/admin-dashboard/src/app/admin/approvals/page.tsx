import React from 'react';
import { requireDashboardUser } from '@/lib/auth';
import { getApprovalsData } from '@/lib/data-fetchers';
import { hasAccess } from '@/lib/rbac';
import { ApprovalsClient } from './approvals-client';
import { ZeroStateCard } from '@/components/ui/zero-state-card';
import { ShieldAlert } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage() {
  const user = await requireDashboardUser();


  const canAccess = ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'].includes(user.role);

  if (!canAccess) {
    return (
      <div className="p-6">
        <ZeroStateCard
          title="غير مصرح بالدخول"
          description="صفحة مركز الاعتمادات والقرارات الفورية مخصصة حصراً للإدارة العليا والمديرين التنفيذيين."
          icon={ShieldAlert}
        />
      </div>
    );
  }

  const approvalsData = await getApprovalsData(user);

  return <ApprovalsClient initialData={approvalsData} userRole={user.role} />;
}
