import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { prisma, decryptField } from '@alsaada/database';
import { requireDashboardUser } from '@/lib/auth';
import { getNormalizedEncryptionKey } from '@/lib/data-fetchers';
import { EditWorkerClient, type EditWorkerData } from './edit-worker-client';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditWorkerPage({ params }: PageProps) {
  const user = await requireDashboardUser();

  const { id } = await params;

  if (!['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'].includes(user.role)) {
    redirect('/admin');
  }

  const worker = await prisma.worker.findUnique({
    where: { id, isDeleted: false },
    include: {
      site: true,
      jobRef: true,
    },
  });

  if (!worker) {
    notFound();
  }

  // FIELD_ADMIN scope enforcement: cannot access or edit workers of other sites
  if (user.role === 'FIELD_ADMIN' && user.assignedSiteId && worker.siteId !== user.assignedSiteId) {
    redirect('/admin/workforce/directory');
  }

  const key = getNormalizedEncryptionKey();
  let phone = 'غير مسجل';
  let nationalId = '***';

  if (key) {
    if (worker.phoneEncrypted) {
      try {
        phone = decryptField(worker.phoneEncrypted, key);
      } catch {
        phone = '***';
      }
    }
    if (worker.nationalIdEncrypted) {
      try {
        const raw = decryptField(worker.nationalIdEncrypted, key);
        nationalId = ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(user.role)
          ? raw
          : `**********${raw.slice(-4)}`;
      } catch {
        nationalId = '**********';
      }
    }
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const canViewFinances = ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(user.role);

  const initialWorker: EditWorkerData = {
    id: worker.id,
    code: worker.code,
    name: worker.name,
    nickname: worker.nickname || worker.name.split(' ')[0],
    phone,
    nationalId,
    birthDate: worker.birthDate ? worker.birthDate.toISOString().split('T')[0] : 'غير مسجل',
    gender: worker.gender,
    siteId: worker.siteId,
    siteName: worker.site?.name || 'غير مسند',
    jobTitle: worker.jobRef?.name || worker.jobTitle || 'عامل',
    jobTitleId: worker.jobTitleId,
    status: worker.status,
    contractType: worker.contractType || 'DAILY_LABOR',
    basicSalary: canViewFinances ? Number(worker.basicSalary || 0) : undefined,
    dailyWage: canViewFinances ? Number(worker.dailyWage || 0) : undefined,
    fixedAllowances: canViewFinances ? Number(worker.fixedAllowances || 0) : undefined,
    canteenCigarettePolicy: worker.canteenCigarettePolicy || 'NONE',
    cigaretteBrand: worker.cigaretteBrand || '',
    insuranceNumber: worker.insuranceNumber || '',
    insuranceStatus: worker.insuranceStatus || 'غير مؤمن',
    medicalNotes: worker.medicalNotes || '',
  };

  const [sites, jobs] = await Promise.all([
    prisma.site.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.jobTitle.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <EditWorkerClient
      initialWorker={initialWorker}
      sites={sites}
      jobs={jobs}
      isSuperAdmin={isSuperAdmin}
      canViewFinances={canViewFinances}
    />
  );
}
