import React from 'react';
import { getCurrentUser } from '@/lib/auth';
import { getTreasuryData } from '@/lib/data-fetchers';
import { hasAccess } from '@/lib/rbac';
import { TreasuryClient } from './treasury-client';
import { ZeroStateCard } from '@/components/ui/zero-state-card';
import { ShieldAlert } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function TreasuryPage() {
  const user = await getCurrentUser();

  // Sovereign financial access for SUPER_ADMIN, GENERAL_ADMIN (canonical roles replacing legacy ACCOUNTANT)
  const canAccess = hasAccess(user.role, ['SUPER_ADMIN', 'GENERAL_ADMIN']);

  if (!canAccess) {
    return (
      <div className="p-6">
        <ZeroStateCard
          title="غير مصرح بالدخول"
          description="شاشة مرصد السيولة والعهد الميدانية مخصصة حصراً للإدارة المالية والإدارة العليا."
          icon={ShieldAlert}
        />
      </div>
    );
  }

  const treasuryData = await getTreasuryData(user);

  return <TreasuryClient initialData={treasuryData} userRole={user.role} />;
}
