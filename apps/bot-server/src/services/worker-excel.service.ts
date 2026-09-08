import { prisma } from '../db.js';
import { config } from '../config/env.js';
import {
  WorkerExportRepository,
  WorkerExportService,
  type WorkerExportFilter,
  type WorkerExportResult,
  type WorkerRowData,
  type WorkerImportResult,
} from '@alsaada/workforce';

export type { WorkerExportFilter, WorkerExportResult, WorkerRowData, WorkerImportResult };

const repository = new WorkerExportRepository(prisma);
export const workerExcelService = new WorkerExportService(repository, config.databaseEncryptionKey);
export { WorkerExportService as WorkerExcelService };
