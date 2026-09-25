import { prisma } from '../db.js';
import { fastCache } from './fast-cache.service.js';

/**
 * ⚡ خدمة البيانات المركزية الموحدة (Unified System Data & Cache Service)
 * توفر طبقة معمارية مشتركة تمنع تكرار منطق الكاش في المعالجات الفردية،
 * وتضمن استرجاع البيانات فورياً من ذاكرة الوصول العشوائي (L1 RAM < 0.1ms)
 * بنمط التحديث الشفاف في الخلفية (Stale-While-Revalidate - SWR).
 */
export class SystemDataService {
  /**
   * جلب مصفوفة كافة المواقع الميدانية مع المشروع والعمالة (L1 RAM < 0.1ms)
   */
  async getSites() {
    return fastCache.rememberSWR('sites:hub:all', 300, async () => {
      return prisma.site.findMany({
        include: {
          project: true,
          workers: { select: { id: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
    });
  }

  /**
   * جلب تفاصيل موقع محدد بالكود الهيكلي (L1 RAM < 0.1ms)
   */
  async getSiteByCode(siteCode: string) {
    return fastCache.rememberSWR(`site:detail:${siteCode}`, 300, async () => {
      return prisma.site.findUnique({
        where: { code: siteCode },
        include: {
          project: true,
          workers: { select: { id: true } },
        },
      });
    });
  }

  /**
   * حساب الكود المتسلسل القادم للموقع
   */
  async getNextSiteCode(): Promise<string> {
    const sites = await fastCache.rememberSWR('sites:codes:all', 300, async () => {
      return prisma.site.findMany({
        select: { code: true },
      });
    });

    let maxSeq = 0;
    for (const s of sites) {
      const match = s.code.match(/^STE-(\d+)$/i);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }

    const nextNum = maxSeq + 1;
    const padded = nextNum < 10 ? `0${nextNum}` : `${nextNum}`;
    return `STE-${padded}`;
  }

  /**
   * جلب قائمة المشاريع النشطة (L1 RAM < 0.1ms)
   */
  async getActiveProjects() {
    return fastCache.rememberSWR('projects:active:list', 600, async () => {
      return prisma.project.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { name: 'asc' },
      });
    });
  }

  /**
   * جلب الملف الرسمي والقانوني للشركة (L1 RAM < 0.1ms)
   */
  async getCompanyProfile() {
    return fastCache.rememberSWR('company_profile', 600, async () => {
      return prisma.companyProfile.findFirst();
    });
  }

  /**
   * جلب الاسم التجاري الرسمي للمنظومة من قاعدة البيانات مباشرة (L1 RAM < 0.1ms)
   * يعتمد حصراً على ما هو مسجل في ملف الشركة الفردي (Single Company Profile)
   */
  async getCompanyTradeName(): Promise<string> {
    try {
      const profile = await this.getCompanyProfile();
      if (profile?.tradeName && profile.tradeName.trim().length > 0) {
        return profile.tradeName.trim();
      }
      if (profile?.legalName && profile.legalName.trim().length > 0) {
        return profile.legalName.trim();
      }

      return 'شركة السعادة للمقاولات العامة';
    } catch {
      return 'شركة السعادة للمقاولات العامة';
    }
  }

  /**
   * جلب ملف حساب المدير العام (L1 RAM < 0.1ms)
   */
  async getAdminUser(telegramId: bigint) {
    return fastCache.rememberSWR(`admin_profile:${telegramId}`, 300, async () => {
      return prisma.user.findUnique({
        where: { telegramId },
        include: { assignedSite: true },
      });
    });
  }

  /**
   * جلب قائمة المستخدمين لتعيين المواقع (L1 RAM < 0.1ms)
   */
  async getAdminUsersList() {
    return fastCache.rememberSWR('admin_assign:users:list', 300, async () => {
      return prisma.user.findMany({
        include: { assignedSite: true },
        orderBy: { createdAt: 'asc' },
      });
    });
  }

  /**
   * جلب قائمة كافة الأقسام مع عدد الوظائف التابعة لها (L1 RAM < 0.1ms)
   */
  async getDepartments(includeInactive = true) {
    const cacheKey = includeInactive ? 'departments:all:all_status' : 'departments:all:active';
    return fastCache.rememberSWR(cacheKey, 600, async () => {
      if (!prisma?.department?.findMany) return [];
      return prisma.department.findMany({
        ...(includeInactive ? {} : { where: { isActive: true } }),
        include: {
          jobs: includeInactive
            ? { orderBy: [{ order: 'asc' }, { name: 'asc' }] }
            : { where: { isActive: true }, orderBy: [{ order: 'asc' }, { name: 'asc' }] },
        },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      });
    });
  }

  /**
   * جلب تفاصيل قسم محدد بالكود مع كافة وظائفه (L1 RAM < 0.1ms)
   */
  async getDepartmentByCode(code: string, includeInactive = true) {
    const cacheKey = includeInactive ? `department:code:${code}:all` : `department:code:${code}:active`;
    return fastCache.rememberSWR(cacheKey, 600, async () => {
      return prisma.department.findUnique({
        where: { code },
        include: {
          jobs: includeInactive
            ? { orderBy: [{ order: 'asc' }, { name: 'asc' }] }
            : { where: { isActive: true }, orderBy: [{ order: 'asc' }, { name: 'asc' }] },
        },
      });
    });
  }

  /**
   * جلب تفاصيل وظيفة محددة بالمعرف (L1 RAM < 0.1ms)
   */
  async getJobById(jobId: string) {
    return fastCache.rememberSWR(`job:id:${jobId}`, 600, async () => {
      return prisma.jobTitle.findUnique({
        where: { id: jobId },
        include: { department: true },
      });
    });
  }

  /**
   * جلب تفاصيل وظيفة بكود القسم وكود الوظيفة (L1 RAM < 0.1ms)
   */
  async getJobByDeptAndCode(deptCode: string, jobCode: string) {
    return fastCache.rememberSWR(`job:code:${deptCode}:${jobCode}`, 600, async () => {
      const dept = await prisma.department.findUnique({ where: { code: deptCode } });
      if (!dept) return null;
      return prisma.jobTitle.findUnique({
        where: {
          departmentId_code: {
            departmentId: dept.id,
            code: jobCode,
          },
        },
        include: { department: true },
      });
    });
  }

  /**
   * جلب كافة الوظائف النشطة في المنظومة (L1 RAM < 0.1ms)
   */
  async getAllJobs() {
    return fastCache.rememberSWR('jobs:all', 600, async () => {
      if (!prisma?.jobTitle?.findMany) return [];
      return prisma.jobTitle.findMany({
        where: { isActive: true },
        include: { department: true },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      });
    });
  }

  /**
   * تطهير فوري لكاش الأقسام والوظائف من L1 و L2
   */
  async invalidateDepartmentsAndJobs() {
    await fastCache.invalidatePattern('department*');
    await fastCache.invalidatePattern('job*');
    await fastCache.invalidate('departments:all');
    await fastCache.invalidate('jobs:all');
  }

  /**
   * تطهير فوري لكاش المواقع والمشاريع من L1 و L2
   */
  async invalidateSites() {
    await fastCache.invalidatePattern('site*');
    await fastCache.invalidatePattern('project*');
  }

  /**
   * تطهير فوري لبيانات الشركة
   */
  async invalidateCompanyProfile() {
    await fastCache.invalidate('company_profile');
  }

  /**
   * تطهير كاش مستخدم محدد بالكامل
   */
  async invalidateUser(telegramId: bigint) {
    await fastCache.invalidate(`auth:user:${telegramId}`);
    await fastCache.invalidate(`auth:imp:${telegramId}`);
    await fastCache.invalidate(`admin_profile:${telegramId}`);
    await fastCache.invalidate(`admin_assign:user:${telegramId}`);
    await fastCache.invalidate('admin_assign:users:list');
  }

  /**
   * الإحماء المسبق لكافة البيانات الأساسية في الذاكرة عند بدء تشغيل البوت
   */
  async warmup() {
    console.log('⚡ [SystemDataService] Priming L1 in-memory cache...');
    try {
      await Promise.all([
        this.getSites(),
        this.getActiveProjects(),
        this.getCompanyProfile(),
        this.getDepartments(),
        this.getAllJobs(),
      ]);
      console.log('✅ [SystemDataService] L1 Cache primed successfully (Sub-millisecond ready).');
    } catch (err) {
      console.warn('⚠️ [SystemDataService] Cache warmup note:', err);
    }
  }

  /**
   * دالة مساعدة عامة قابلة لإعادة الاستخدام في أي وظيفة لحفظ أي استعلام في كاش L1/L2 بنمط SWR
   */
  async cached<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
    return fastCache.rememberSWR(key, ttlSeconds, fetcher);
  }

  /**
   * فحص الاتصال بقاعدة البيانات وقياس زمن الاستجابة (Database Ping)
   */
  async pingDatabase(): Promise<void> {
    await prisma.$queryRawUnsafe('SELECT 1');
  }
}

export const systemDataService = new SystemDataService();
