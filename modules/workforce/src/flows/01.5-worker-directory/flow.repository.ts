import { PrismaClient, Prisma } from '@alsaada/database';
import type { WorkerDirectoryQuery, WorkerDirectoryResult, WorkerDirectoryItem, WorkerDocumentItem } from './flow.types.js';

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
        commitmentScores: {
          orderBy: { evaluationDate: 'desc' },
          take: 1,
        },
      },
    });
  }

  async getWorkersSummary(): Promise<{ totalActive: number; egyptianCount: number; foreignCount: number }> {
    const [totalActive, egyptianCount, foreignCount] = await Promise.all([
      this.prisma.worker.count({ where: { isDeleted: false, status: 'ACTIVE' } }),
      this.prisma.worker.count({ where: { isDeleted: false, status: 'ACTIVE', idType: 'NATIONAL_ID' } }),
      this.prisma.worker.count({ where: { isDeleted: false, status: 'ACTIVE', idType: 'PASSPORT' } }),
    ]);
    return { totalActive, egyptianCount, foreignCount };
  }

  private cachedTradeName: { name: string; expiresAt: number } | null = null;

  async getCompanyTradeName(): Promise<string> {
    const now = Date.now();
    if (this.cachedTradeName && this.cachedTradeName.expiresAt > now) {
      return this.cachedTradeName.name;
    }
    try {
      const profile = await this.prisma.companyProfile.findFirst();
      let name = 'شركة السعادة للمقاولات العامة';
      if (profile?.tradeName && profile.tradeName.trim().length > 0) {
        name = profile.tradeName.trim();
      } else if (profile?.legalName && profile.legalName.trim().length > 0) {
        name = profile.legalName.trim();
      }
      this.cachedTradeName = { name, expiresAt: now + 300000 };
      return name;
    } catch {
      return 'شركة السعادة للمقاولات العامة';
    }
  }

  async countWorkerDocuments(workerId: string): Promise<number> {
    if (!this.prisma.workerDocument) return 0;
    return this.prisma.workerDocument.count({
      where: { workerId },
    });
  }

  async findWorkerDocuments(workerId: string): Promise<WorkerDocumentItem[]> {
    if (!this.prisma.workerDocument) return [];
    const docs = await this.prisma.workerDocument.findMany({
      where: { workerId },
      orderBy: { createdAt: 'desc' },
    });
    return docs.map((d) => ({
      id: d.id,
      workerId: d.workerId,
      title: d.title,
      category: d.category,
      fileName: d.fileName,
      fileType: d.fileType,
      fileUri: d.fileUri,
      driveFileId: d.driveFileId,
      fileSizeBytes: d.fileSizeBytes,
      uploadedBy: d.uploadedBy,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
  }

  async findDocumentById(docId: string) {
    if (!this.prisma.workerDocument) return null;
    return this.prisma.workerDocument.findUnique({
      where: { id: docId },
      include: { worker: true },
    });
  }

  async createDocument(data: {
    workerId: string;
    title: string;
    category: string;
    fileName: string;
    fileType: string;
    fileUri: string;
    driveFileId?: string | null;
    fileSizeBytes?: bigint | null;
    uploadedBy?: bigint | null;
  }) {
    return this.prisma.workerDocument.create({
      data,
      include: { worker: true },
    });
  }

  async deleteDocument(docId: string) {
    return this.prisma.workerDocument.delete({
      where: { id: docId },
    });
  }
}


