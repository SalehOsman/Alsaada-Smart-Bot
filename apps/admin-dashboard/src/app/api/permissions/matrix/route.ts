import { NextResponse } from 'next/server';
import { prisma } from '@alsaada/database';
import { FEATURE_CATALOG } from '@alsaada/rbac';
import { getCurrentUser } from '@/lib/auth';
import { notifyRbacSync } from '@/lib/redis-sync';

const CANONICAL_ROLES = [
  { id: 'SUPER_ADMIN', nameAr: 'سوبر أدمن (إدارة عليا سيادية)' },
  { id: 'GENERAL_ADMIN', nameAr: 'مدير عام المنظومة' },
  { id: 'FIELD_ADMIN', nameAr: 'مدير / مشرف موقع ميداني' },
  { id: 'WORKER_SUPERVISOR', nameAr: 'عامل مشرف (مفوض)' },
  { id: 'WORKER', nameAr: 'عامل ميداني' },
];

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'غير مصرح - يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    if (!['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'].includes(user.role)) {
      return NextResponse.json(
        { error: 'غير مصرح لك باستعراض مصفوفة الصلاحيات' },
        { status: 403 }
      );
    }

    const [sites, permissions, users] = await Promise.all([
      prisma.site.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      prisma.botMenuPermission.findMany({
        orderBy: [{ featureKey: 'asc' }, { scopeType: 'asc' }],
      }),
      prisma.user.findMany({
        where: { isDeleted: false, isActive: true },
        select: { id: true, fullName: true, role: true, telegramId: true },
        orderBy: { fullName: 'asc' },
      }),
    ]);

    const formattedUsers = users.map((u) => ({
      id: u.id,
      name: u.fullName,
      role: u.role,
      telegramId: u.telegramId.toString(),
    }));

    return NextResponse.json({
      roles: CANONICAL_ROLES,
      sites,
      users: formattedUsers,
      catalog: FEATURE_CATALOG,
      permissions,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'فشل جلب بيانات مصفوفة الصلاحيات';
    console.error('Matrix GET error:', err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'غير مصرح - يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    if (!['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(user.role)) {
      return NextResponse.json(
        { error: 'غير مصرح لك بتعديل مصفوفة الصلاحيات' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { scopeType, scopeId, featureKey, action = 'view', policy } = body as {
      scopeType: 'ROLE' | 'SITE' | 'USER' | 'DEPARTMENT';
      scopeId: string;
      featureKey: string;
      action?: string;
      policy: 'ALLOW' | 'DENY' | 'RESET';
    };

    if (!scopeType || !scopeId || !featureKey || !policy) {
      return NextResponse.json(
        { error: 'معلمات الصلاحية غير مكتملة' },
        { status: 400 }
      );
    }

    if (policy === 'RESET') {
      await prisma.botMenuPermission.deleteMany({
        where: {
          scopeType,
          scopeId,
          featureKey,
          action,
        },
      });
    } else {
      await prisma.botMenuPermission.upsert({
        where: {
          scopeType_scopeId_featureKey_action: {
            scopeType,
            scopeId,
            featureKey,
            action,
          },
        },
        create: {
          scopeType,
          scopeId,
          featureKey,
          action,
          policy,
        },
        update: {
          policy,
        },
      });
    }

    await notifyRbacSync({
      eventType: 'PERMISSION_MUTATED',
      scopeType,
      scopeId,
      featureKey,
      policy,
    });

    return NextResponse.json({
      ok: true,
      message: policy === 'RESET' ? 'تمت استعادة الضبط الافتراضي' : `تم تعيين السياسة إلى ${policy}`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'فشل حفظ الصلاحية';
    console.error('Matrix POST error:', err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
