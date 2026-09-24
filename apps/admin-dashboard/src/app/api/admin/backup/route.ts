import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { SystemBackupRecoveryService } from '@alsaada/settings';

const backupService = new SystemBackupRecoveryService();

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

    const stats = await backupService.getBackupStatus();
    const backups = await backupService.listRecentBackups();

    return NextResponse.json({
      success: true,
      stats: {
        totalBackups: stats.totalBackups,
        latestBackupAt: stats.latestBackupAt,
        rpoStatus: stats.rpoStatus,
        cloudSyncEnabled: stats.cloudSyncEnabled,
        encryptionType: stats.encryptionType,
        zeroBloatLimitMb: stats.zeroBloatLimitMb,
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
      const drillResult = await backupService.runDrill();
      return NextResponse.json({
        success: drillResult.ok,
        action: 'drill',
        drillResult,
      });
    }

    // Default action: create full backup
    const manifest = await backupService.executeBackupNow();

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
