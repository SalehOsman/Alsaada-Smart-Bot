import type { Bot } from 'grammy';
import type { WorkforceModuleContext } from './shared/module.types.js';
import { WorkerExportHandler } from './flows/01.4-worker-export/flow.handler.js';
import { WorkerExportService } from './flows/01.4-worker-export/flow.service.js';
import { WorkerExportRepository } from './flows/01.4-worker-export/flow.repository.js';
import { PrismaClient } from '@alsaada/database';

export function registerWorkforceRoutes(
  bot: Bot<WorkforceModuleContext>,
  prisma: PrismaClient,
  encryptionKey?: string
): void {
  const exportRepo = new WorkerExportRepository(prisma);
  const exportService = new WorkerExportService(exportRepo, encryptionKey);
  const exportHandler = new WorkerExportHandler(exportService);

  // Template Download
  bot.callbackQuery('action:worker:download_excel', async (ctx) => {
    await exportHandler.handleDownloadTemplate(ctx);
  });

  // Excel Upload Prompt
  bot.callbackQuery('action:worker:upload_excel', async (ctx) => {
    await exportHandler.handleStartUpload(ctx);
  });

  // Export Start Menu
  bot.callbackQuery('action:worker_export:start', async (ctx) => {
    await exportHandler.handleExportStart(ctx);
  });

  // Export Full Roster
  bot.callbackQuery('action:worker_export:do:all', async (ctx) => {
    await exportHandler.handleExportExecute(ctx, { type: 'ALL' });
  });

  // Export Department Menu
  bot.callbackQuery('action:worker_export:dept_menu', async (ctx) => {
    const depts = await exportRepo.getDepartments();
    await exportHandler.handleDepartmentMenu(ctx, depts);
  });

  // Export Department Execute
  bot.callbackQuery(/^action:worker_export:do:dept:(.+)$/, async (ctx) => {
    const match = ctx.match;
    const deptId = match?.[1];
    if (deptId) {
      await exportHandler.handleExportExecute(ctx, { type: 'DEPARTMENT', departmentId: deptId });
    }
  });

  // Export Job Menu Pagination
  bot.callbackQuery(/^action:worker_export:job_menu:(\d+)$/, async (ctx) => {
    const match = ctx.match;
    const page = parseInt(match?.[1] || '1', 10);
    const jobs = await exportRepo.getActiveJobs();
    const pageSize = 10;
    const totalPages = Math.ceil(jobs.length / pageSize) || 1;
    const pagedJobs = jobs.slice((page - 1) * pageSize, page * pageSize);
    await exportHandler.handleJobTitleMenu(ctx, pagedJobs, page, totalPages);
  });

  // Export Job Title Execute
  bot.callbackQuery(/^action:worker_export:do:job:(.+)$/, async (ctx) => {
    const match = ctx.match;
    const jobTitleId = match?.[1];
    if (jobTitleId) {
      await exportHandler.handleExportExecute(ctx, { type: 'JOB_TITLE', jobTitleId });
    }
  });

  // Export Governorate Menu
  bot.callbackQuery('action:worker_export:gov_menu', async (ctx) => {
    await exportHandler.handleGovernorateMenu(ctx);
  });

  // Export Governorate Execute
  bot.callbackQuery(/^action:worker_export:do:gov:(.+)$/, async (ctx) => {
    const match = ctx.match;
    const govCode = match?.[1];
    if (govCode) {
      await exportHandler.handleExportExecute(ctx, { type: 'GOVERNORATE', governorateCode: govCode });
    }
  });
}
