import React from 'react';
import { redirect } from 'next/navigation';
import { requireDashboardUser } from '../../../../lib/auth';
import { PrismaStudioClient } from './prisma-studio-client';

export const metadata = {
  title: 'استوديو قاعدة البيانات (Prisma Studio) | منظومة السعادة',
  description: 'قمرة استوديو قاعدة البيانات الحصرية للسوبر أدمن مع صمام الإغلاق التلقائي والدرع الجنائي',
};

export default async function PrismaStudioPage() {
  const user = await requireDashboardUser();

  // Strict Sovereign RBAC: Exclusively for SUPER_ADMIN
  if (user.role !== 'SUPER_ADMIN') {
    redirect('/admin');
  }

  return <PrismaStudioClient user={user} />;
}
