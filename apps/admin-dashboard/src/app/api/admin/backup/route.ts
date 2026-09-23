import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createFullBackup, listBackups } from '../../../../../../../tools/backup/backup-manager.js';
import { runDisasterRecoveryDrill } from '../../../../../../../tools/backup/verify-disaster-recovery.js';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح - يرجى تسجيل الدخول أولاً' }, { status: 401 });
    }

    const canManage = ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(user.role);
    if (!canManage) {
      return NextResponse.json({ error: 'غير مصرح لك بإدارة النسخ الاحتياطي واستعادة الكوارث' }, { status: 403 });
    }

    const backups = await listBackups();
    const latest = backups[0] ?? null;

    return NextResponse.json({
      success: true,
      stats: {
        totalBackups: backups.length,
        latestBackupAt: latest?.createdAt ?? null,
        rpoStatus: latest ? 'HEALTHY' : 'NEEDS_BACKUP',
        cloudSyncEnabled: Boolean(process.env.GDRIVE_FOLDER_ID),
        encryptionType: 'AES-256-GCM',
        zeroBloatLimitMb: 30,
      },
      backups,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `فشل استرجاع بيانات النسخ الاحتياطي: ${err.message}` },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح - يرجى تسجيل الدخول أولاً' }, { status: 401 });
    }

    const canManage = ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(user.role);
    if (!canManage) {
      return NextResponse.json({ error: 'غير مصرح لك بإجراء النسخ الاحتياطي' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action ?? 'create';

    if (action === 'drill') {
      const drillResult = await runDisasterRecoveryDrill();
      return NextResponse.json({
        success: drillResult.ok,
        action: 'drill',
        drillResult,
      });
    }

    // Default action: create full backup
    const manifest = await createFullBackup({
      syncCloud: Boolean(process.env.GDRIVE_FOLDER_ID),
    });

    return NextResponse.json({
      success: true,
      action: 'create',
      manifest,
      message: `تم إنشاء النسخة الاحتياطية بنجاح (${manifest.backupId})`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `فشل تنفيذ العملية: ${err.message}` },
      { status: 500 },
    );
  }
}
