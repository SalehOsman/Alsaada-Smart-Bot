import { prisma } from '@alsaada/database';
export * from './workforce-constants';
import type { SiteLookup, JobTitleLookup, CanteenCigaretteLookup, AccommodationLookup } from './workforce-constants';

/**
 * جلب المواقع النشطة من قاعدة البيانات
 */
export async function getActiveSites(): Promise<SiteLookup[]> {
  try {
    const sites = await prisma.site.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, code: true, name: true, governorateCode: true },
      orderBy: { name: 'asc' },
    });
    return sites;
  } catch (error) {
    console.error('Error fetching active sites:', error);
    return [];
  }
}

/**
 * جلب الوظائف النشطة مع الراتب الأساسي والإضافي ودورة العمل الميدانية
 */
export async function getActiveJobTitles(): Promise<JobTitleLookup[]> {
  try {
    const jobs = await prisma.jobTitle.findMany({
      where: { isActive: true },
      include: { department: true },
      orderBy: { order: 'asc' },
    });
    return jobs.map((job) => ({
      id: job.id,
      code: job.code,
      name: job.name,
      departmentId: job.departmentId,
      departmentCode: job.department?.code || 'OP',
      baseSalary: Number(job.baseSalary || 0),
      additionalSalary: Number(job.additionalSalary || 0),
      workDays: job.workDays ?? 20,
      restDays: job.restDays ?? 10,
      shiftNature: job.shiftNature || 'دورة قياسية (20+10)',
    }));
  } catch (error) {
    console.error('Error fetching active job titles:', error);
    return [];
  }
}

/**
 * جلب أصناف السجائر المسجلة في مخزن الكانتين
 */
export async function getCanteenCigaretteItems(siteId?: string): Promise<CanteenCigaretteLookup[]> {
  try {
    const items = await prisma.canteenItem.findMany({
      where: {
        category: 'CIGARETTES',
        isActive: true,
        ...(siteId ? { siteId } : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        sellingPrice: true,
        siteId: true,
      },
      orderBy: { name: 'asc' },
    });
    return items.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      sellingPrice: Number(item.sellingPrice || 0),
      siteId: item.siteId,
    }));
  } catch (error) {
    console.error('Error fetching canteen cigarette items:', error);
    return [];
  }
}

/**
 * جلب وحدات السكن والإعاشة بالمواقع
 */
export async function getSiteAccommodations(siteId?: string): Promise<AccommodationLookup[]> {
  try {
    const accommodations = await prisma.siteAccommodation.findMany({
      where: {
        isActive: true,
        ...(siteId ? { siteId } : {}),
      },
      select: {
        id: true,
        unitNumber: true,
        unitType: true,
        capacity: true,
        currentOccupancy: true,
        siteId: true,
      },
      orderBy: { unitNumber: 'asc' },
    });
    return accommodations;
  } catch (error) {
    console.error('Error fetching site accommodations:', error);
    return [];
  }
}
