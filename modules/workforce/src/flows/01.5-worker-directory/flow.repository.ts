import { PrismaClient, Prisma } from '@alsaada/database';
import type { WorkerDirectoryQuery, WorkerDirectoryResult, WorkerDirectoryItem } from './flow.types.js';

export class WorkerDirectoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findWorkers(query: WorkerDirectoryQuery): Promise<WorkerDirectoryResult> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.max(1, query.pageSize || 10);
    const status = query.status || 'ACTIVE';

    const where: Prisma.WorkerWhereInput = {
      isDeleted: false,
      status,
    };

    if (query.siteId) {
      where.siteId = query.siteId;
    }

    const cleanSearch = query.searchQuery?.trim();
    if (cleanSearch) {
      where.OR = [
        { name: { contains: cleanSearch, mode: 'insensitive' } },
        { nickname: { contains: cleanSearch, mode: 'insensitive' } },
        { code: { contains: cleanSearch, mode: 'insensitive' } },
        { legacyCode: { contains: cleanSearch, mode: 'insensitive' } },
        { jobTitle: { contains: cleanSearch, mode: 'insensitive' } },
      ];
    }

    const [totalCount, workers] = await Promise.all([
      this.prisma.worker.count({ where }),
      this.prisma.worker.findMany({
        where,
        include: { site: true },
        orderBy: { code: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const items: WorkerDirectoryItem[] = workers.map((w) => ({
      id: w.id,
      code: w.code,
      legacyCode: w.legacyCode,
      aliases: w.aliases || [],
      name: w.name,
      nickname: w.nickname,
      jobTitle: w.jobTitle,
      siteName: w.site?.name || undefined,
      status: w.status,
    }));

    const totalPages = Math.ceil(totalCount / pageSize) || 1;

    return {
      items,
      totalCount,
      page,
      totalPages,
    };
  }

  async findWorkerById(workerId: string) {
    return this.prisma.worker.findUnique({
      where: { id: workerId },
      include: {
        site: true,
        department: true,
        jobRef: true,
      },
    });
  }
}
