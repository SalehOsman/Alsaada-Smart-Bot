import type { Bot } from 'grammy';
import type { WorkforceModuleContext } from './shared/module.types.js';
import { WorkerExportHandler } from './flows/01.4-worker-export/flow.handler.js';
import { WorkerExportService } from './flows/01.4-worker-export/flow.service.js';
import { WorkerExportRepository } from './flows/01.4-worker-export/flow.repository.js';
import { WorkerRegistrationHandler } from './flows/01.1-worker-registration/flow.handler.js';
import { WorkerRegistrationService } from './flows/01.1-worker-registration/flow.service.js';
import { WorkerRegistrationRepository } from './flows/01.1-worker-registration/flow.repository.js';
import { WorkerDirectoryHandler } from './flows/01.5-worker-directory/flow.handler.js';
import { WorkerDirectoryService } from './flows/01.5-worker-directory/flow.service.js';
import { WorkerDirectoryRepository } from './flows/01.5-worker-directory/flow.repository.js';
import { PrismaClient } from '@alsaada/database';

export function registerWorkforceRoutes(
  bot: Bot<WorkforceModuleContext>,
  prisma: PrismaClient,
  encryptionKey?: string
): void {
  const exportRepo = new WorkerExportRepository(prisma);
  const exportService = new WorkerExportService(exportRepo, encryptionKey);
  const exportHandler = new WorkerExportHandler(exportService);

  const regRepo = new WorkerRegistrationRepository(prisma);
  const regService = new WorkerRegistrationService(regRepo, undefined, encryptionKey);
  const regHandler = new WorkerRegistrationHandler(regService, regRepo);

  const dirRepo = new WorkerDirectoryRepository(prisma);
  const dirService = new WorkerDirectoryService(dirRepo, encryptionKey);
  const dirHandler = new WorkerDirectoryHandler(dirService);

  // Flow 01.5 Worker Directory & 360 Profile
  bot.callbackQuery('action:worker:directory', async (ctx) => {
    await dirHandler.handleDirectory(ctx, 1);
  });

  bot.callbackQuery(/^action:worker:dir:page:(\d+)$/, async (ctx) => {
    const match = ctx.match;
    const page = match?.[1] ? parseInt(match[1], 10) : 1;
    await dirHandler.handleDirectory(ctx, page);
  });

  bot.callbackQuery(/^action:worker:view:(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1]) await dirHandler.handleViewWorker(ctx, match[1]);
  });

  bot.callbackQuery('action:worker:dir:search_prompt', async (ctx) => {
    await dirHandler.handleSearchPrompt(ctx);
  });

  bot.callbackQuery('action:worker:dir:clear_search', async (ctx) => {
    await dirHandler.handleClearSearch(ctx);
  });

  // Flow 01.1 Worker Registration
  bot.callbackQuery('action:worker:add_single', async (ctx) => {
    await regHandler.handleStart(ctx);
  });

  bot.callbackQuery('wizard:worker:doc_type:nat_id', async (ctx) => {
    await regHandler.handleDocType(ctx, 'NATIONAL_ID');
  });

  bot.callbackQuery('wizard:worker:doc_type:passport', async (ctx) => {
    await regHandler.handleDocType(ctx, 'PASSPORT');
  });

  bot.callbackQuery('wizard:worker:ai_skip', async (ctx) => {
    await regHandler.handleSkipPhoto(ctx);
  });

  bot.callbackQuery('wizard:worker:back', async (ctx) => {
    await regHandler.handleBack(ctx);
  });

  bot.callbackQuery('wizard:worker:cancel', async (ctx) => {
    await regHandler.handleCancel(ctx);
  });

  bot.callbackQuery('wizard:worker:confirm', async (ctx) => {
    await regHandler.handleConfirm(ctx);
  });

  bot.callbackQuery(/^wizard:worker:payout:(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1]) await regHandler.handlePayoutChoice(ctx, match[1]);
  });

  bot.callbackQuery(/^wizard:worker:job:(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1]) await regHandler.handleJobChoice(ctx, match[1]);
  });

  bot.callbackQuery(/^wizard:worker:site:(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1]) await regHandler.handleSiteChoice(ctx, match[1]);
  });

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
