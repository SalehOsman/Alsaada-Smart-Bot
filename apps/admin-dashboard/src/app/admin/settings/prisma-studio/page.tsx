import React from 'react';
import { redirect } from 'next/navigation';
import { requireDashboardUser } from '../../../../lib/auth';
import { PrismaStudioClient } from './prisma-studio-client';

export const metadata = {
  title: 'مركز أدوات المطور والمعمارية والتوثيق (Developer & Architecture Cockpit) | منظومة السعادة',
  description: 'قمرة أدوات المطور واستوديو قاعدة البيانات وبوابة التوثيق والمعمارية الحية الحصرية للسوبر أدمن',
};

export default async function PrismaStudioPage() {
  const user = await requireDashboardUser();

  // Strict Sovereign RBAC: Exclusively for SUPER_ADMIN
  if (user.role !== 'SUPER_ADMIN') {
    redirect('/admin');
  }

  return <PrismaStudioClient user={user} />;
}
