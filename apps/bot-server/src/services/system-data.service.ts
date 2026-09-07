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
      if (match) {
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
      return prisma.companyProfile.findFirst({
        include: { tenant: true },
      });
    });
  }

  /**
   * جلب ملف حساب المدير العام (L1 RAM < 0.1ms)
   */
  async getAdminUser(telegramId: bigint) {
    return fastCache.rememberSWR(`admin_profile:${telegramId}`, 300, async () => {
      return prisma.user.findUnique({
        where: { telegramId },
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
}

export const systemDataService = new SystemDataService();
