import { NextRequest, NextResponse } from 'next/server';
import { prisma, createBlindIndex } from '@alsaada/database';
import { normalizeDigits } from '@alsaada/regional-engine';
import { getCurrentUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser({ nullable: true });
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { nationalId, phone } = body as { nationalId?: string; phone?: string };

    const configuredSalt = process.env.BLIND_INDEX_SALT || process.env.DATABASE_ENCRYPTION_KEY;
    if (!configuredSalt && process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL_SECURITY_ERROR: BLIND_INDEX_SALT or DATABASE_ENCRYPTION_KEY environment variable is required');
    }
    const salt = configuredSalt || 'alsaada-dev-blind-index-salt-fallback';

    // 1. Check National ID if provided and 14 digits
    if (nationalId) {
      const cleanNatId = normalizeDigits(nationalId.trim().replace(/\D/g, ''));
      if (cleanNatId.length === 14) {
        const blindIndex = createBlindIndex(cleanNatId, salt);
        const existing = await prisma.worker.findFirst({
          where: {
            nationalIdBlindIndex: blindIndex,
            isDeleted: false,
          },
          select: {
            code: true,
            name: true,
            jobTitle: true,
            site: { select: { name: true } },
          },
        });

        if (existing) {
          return NextResponse.json({
            isDuplicate: true,
            field: 'nationalId',
            message: `الرقم القومي مسجل مسبقاً للعامل ${existing.name} (كود: ${existing.code})`,
            worker: {
              code: existing.code,
              name: existing.name,
              jobTitle: existing.jobTitle,
              siteName: existing.site?.name,
            },
          });
        }
      }
    }

    // 2. Check Phone Number if provided and 11 digits
    if (phone) {
      const cleanPhone = normalizeDigits(phone.trim().replace(/\D/g, ''));
      if (cleanPhone.length >= 10) {
        const phoneBlindIndex = createBlindIndex(cleanPhone, salt);
        const existingPhone = await prisma.worker.findFirst({
          where: {
            phoneBlindIndex,
            isDeleted: false,
          },
          select: {
            code: true,
            name: true,
            jobTitle: true,
            site: { select: { name: true } },
          },
        });

        if (existingPhone) {
          return NextResponse.json({
            isDuplicate: true,
            field: 'phone',
            message: `رقم الهاتف مسجل مسبقاً للعامل ${existingPhone.name} (كود: ${existingPhone.code})`,
            worker: {
              code: existingPhone.code,
              name: existingPhone.name,
              jobTitle: existingPhone.jobTitle,
              siteName: existingPhone.site?.name,
            },
          });
        }
      }
    }

    return NextResponse.json({ isDuplicate: false });
  } catch (error) {
    console.error('Error in validate-unique worker route:', error);
    return NextResponse.json({ isDuplicate: false });
  }
}
