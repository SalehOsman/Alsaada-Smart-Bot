import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { SystemBackupRecoveryService } from '@alsaada/settings';

const backupService = new SystemBackupRecoveryService();

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح - يرجى تسجيل الدخول أولاً' }, { status: 401 });
    }

    const canManage = ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(user.role);
    if (!canManage) {
      return NextResponse.json({ error: 'صلاحية الاستعادة تقتصر حصراً على المشرف العام أو السوبر أدمن' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { backupId, confirmationCode, coldPassphrase } = body;

    if (!backupId) {
      return NextResponse.json({ error: 'معرف النسخة الاحتياطية مطلوب' }, { status: 400 });
    }

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const expectedCode = `RESTORE-${todayStr}`;

    if (!confirmationCode || confirmationCode.trim() !== expectedCode) {
      return NextResponse.json(
        { error: `رمز التأكيد غير صحيح. يجب إدخال الرمز الدستوري لليوم: ${expectedCode}` },
        { status: 400 },
      );
    }

    // Step 1: Automated Safety Snapshot before restoration
    const preRestoreSafetySnapshot = await backupService.executeBackupNow();

    // Step 2: Execute Restore with Post-Restore Verification Gate
    const restoreResult = await backupService.restoreBackup(backupId, coldPassphrase);

    if (!restoreResult.success) {
      return NextResponse.json(
        {
          error: `فشلت عملية الاستعادة: ${restoreResult.error}`,
          restoreResult,
          safetyBackupId: preRestoreSafetySnapshot.backupId,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      restoreResult,
      safetyBackupId: preRestoreSafetySnapshot.backupId,
      message: `تمت استعادة اللقطة (${backupId}) بنجاح واجتياز كافة بوابات التحقق المالي والبرمجي. تم أخذ لقطة أمان مسبقة (${preRestoreSafetySnapshot.backupId}).`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `خطأ جسيم أثناء محاولة الاستعادة: ${err.message}` },
      { status: 500 },
    );
  }
}
