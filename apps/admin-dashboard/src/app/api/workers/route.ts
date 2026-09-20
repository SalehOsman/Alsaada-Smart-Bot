import { NextRequest, NextResponse } from 'next/server';
import { prisma, Prisma, createBlindIndex, encryptField } from '@alsaada/database';
import { normalizeDigits, extractFirstTwoNames } from '@alsaada/regional-engine';
import { WorkerService } from '@alsaada/workforce';
import { getCurrentUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser({ nullable: true });
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    if (!['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient role permissions' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    if (user.role === 'FIELD_ADMIN' && (!user.assignedSiteId || body.siteId !== user.assignedSiteId)) {
      return NextResponse.json(
        { error: 'غير مصرح: مدير الموقع مقيد بالموقع المخصص له فقط' },
        { status: 403 }
      );
    }
    const {
      name,
      nickname,
      idType = 'NATIONAL_ID',
      idNumber,
      phone,
      siteId,
      jobTitleId,
      birthDate,
      gender,
      governorateCode,
      address,
      hireDate,
      contractType = 'PERMANENT',
      shiftSystem,
      basicSalary = 0,
      additionalSalary = 0,
      customAllowances = [],
      paymentMethod = 'CASH_SITE',
      accountNumber,
      walletType,
      walletOwnerName,
      instaPayHandle,
      canteenCigarettePolicy = 'NONE',
      canteenItemId,
      cigaretteBrand,
      drivingLicense,
      militaryStatus,
      maritalStatus,
      insuranceStatus,
      insuranceNumber,
      ppeShoeSize,
      ppeUniformSize,
      barracksUnit,
      bedNumber,
      emergencyContactName,
      emergencyPhone,
      medicalNotes,
      idCardFrontPath,
      idCardBackPath,
      idCardExpiryDate,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'اسم العامل الرباعي مطلوب.' }, { status: 400 });
    }
    if (!idNumber || !idNumber.trim()) {
      return NextResponse.json({ error: 'رقم بطاقة الهوية / الجواز مطلوب.' }, { status: 400 });
    }
    if (!phone || !phone.trim()) {
      return NextResponse.json({ error: 'رقم الهاتف المحمول مطلوب.' }, { status: 400 });
    }
    if (!siteId) {
      return NextResponse.json({ error: 'يجب اختيار الموقع / المشروع الميداني.' }, { status: 400 });
    }
    if (!jobTitleId) {
      return NextResponse.json({ error: 'يجب تحديد المسمى المهني / الوظيفة.' }, { status: 400 });
    }

    // Fetch site & job details
    const [siteRecord, jobRecord] = await Promise.all([
      prisma.site.findUnique({ where: { id: siteId } }),
      prisma.jobTitle.findUnique({ where: { id: jobTitleId }, include: { department: true } }),
    ]);

    if (!siteRecord) {
      return NextResponse.json({ error: 'الموقع الميداني المختار غير موجود.' }, { status: 400 });
    }
    if (!jobRecord) {
      return NextResponse.json({ error: 'المسمى الوظيفي المختار غير موجود.' }, { status: 400 });
    }

    // Initialize facade service
    const facade = new WorkerService({ prisma });

    // Sum custom allowances
    const totalCustomAllowances = Array.isArray(customAllowances)
      ? customAllowances.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
      : 0;

    const baseSal = Number(basicSalary) || Number(jobRecord.baseSalary || 0);
    const addSal = Number(additionalSalary) || Number(jobRecord.additionalSalary || 0);
    const totalGross = baseSal + addSal + totalCustomAllowances;

    // Call facade to create worker with encryption & smart code
    const result = await facade.createWorker({
      name: name.trim(),
      nickname: nickname?.trim() || undefined,
      idType: idType as 'NATIONAL_ID' | 'PASSPORT',
      idNumber: idNumber.trim(),
      phone: phone.trim(),
      siteId,
      siteName: siteRecord.name,
      jobTitleId,
      jobTitleName: jobRecord.name,
      departmentId: jobRecord.departmentId,
      birthDate: birthDate ? new Date(birthDate) : undefined,
      gender: gender as 'MALE' | 'FEMALE' | undefined,
      governorateCode: governorateCode || siteRecord.governorateCode || '88',
      address: address?.trim() || undefined,
      hireDate: hireDate ? new Date(hireDate) : new Date(),
      contractType,
      shiftSystem: shiftSystem || (jobRecord.shiftNature ? jobRecord.shiftNature : '20_WORK_10_REST'),
      basicSalary: baseSal,
      additionalSalary: addSal,
      fixedAllowances: totalCustomAllowances,
      paymentMethod,
      accountNumber: accountNumber?.trim() || undefined,
      walletType: walletType || undefined,
      drivingLicense: drivingLicense || undefined,
      militaryStatus: militaryStatus || undefined,
      maritalStatus: maritalStatus || undefined,
      previousInsuranceStatus: insuranceStatus || undefined,
      emergencyContactName: emergencyContactName?.trim() || undefined,
      emergencyPhone: emergencyPhone?.trim() || undefined,
      idCardFrontPath: idCardFrontPath || undefined,
      idCardBackPath: idCardBackPath || undefined,
      idCardExpiryDate: idCardExpiryDate ? new Date(idCardExpiryDate) : undefined,
    });

    const createdWorker = result.worker;

    // Update remaining enterprise fields that are not in base CreateWorkerInput
    await prisma.worker.update({
      where: { id: createdWorker.id },
      data: {
        canteenCigarettePolicy: canteenCigarettePolicy || 'NONE',
        canteenItemId: canteenItemId || null,
        cigaretteBrand: cigaretteBrand?.trim() || null,
        insuranceNumber: insuranceNumber?.trim() || null,
        insuranceStatus: insuranceStatus || null,
        ppeShoeSize: ppeShoeSize || null,
        ppeUniformSize: ppeUniformSize || null,
        barracksUnit: barracksUnit?.trim() || null,
        bedNumber: bedNumber?.trim() || null,
        walletOwnerName: walletOwnerName?.trim() || null,
        instaPayHandle: instaPayHandle?.trim() || null,
        medicalNotes: medicalNotes?.trim() || null,
      },
    });

    // Save custom allowances if provided
    if (Array.isArray(customAllowances) && customAllowances.length > 0) {
      await prisma.workerCustomAllowance.createMany({
        data: customAllowances
          .filter((ca: { title?: string; amount?: number }) => ca.title && ca.amount)
          .map((ca: { title: string; amount: number }) => ({
            workerId: createdWorker.id,
            title: ca.title.trim(),
            amount: new Prisma.Decimal(Number(ca.amount) || 0),
            allowanceType: 'FIXED_RECURRING',
            isRecurring: true,
            startDate: createdWorker.hireDate || new Date(),
          })),
      });
    }

    return NextResponse.json({
      success: true,
      worker: {
        id: createdWorker.id,
        code: createdWorker.code,
        name: createdWorker.name,
        nickname: createdWorker.nickname,
        jobTitle: jobRecord.name,
        siteName: siteRecord.name,
        hireDate: createdWorker.hireDate,
        grossSalary: totalGross,
      },
      welcomeWhatsAppUrl: result.welcomeWhatsAppUrl,
    });
  } catch (error: any) {
    console.error('Error creating worker in admin API:', error);
    const errorMessage = error?.message || 'فشل في تسجيل العامل الجديد.';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
