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
import { WorkerEditHandler } from './flows/01.2.D-worker-edit/flow.handler.js';
import { WorkerEditService } from './flows/01.2.D-worker-edit/flow.service.js';
import { WorkerEditRepository } from './flows/01.2.D-worker-edit/flow.repository.js';
import type { WorkerProfileTab } from './flows/01.2.D-worker-edit/flow.types.js';
import { WorkerSelfEditHandler } from './flows/01.6-worker-self-edit/flow.handler.js';
import { WorkerSelfEditService } from './flows/01.6-worker-self-edit/flow.service.js';
import { WorkerSelfEditRepository } from './flows/01.6-worker-self-edit/flow.repository.js';
import { GuestJoinHandler } from './flows/01.7-guest-join-and-linking/flow.handler.js';
import { GuestJoinService } from './flows/01.7-guest-join-and-linking/flow.service.js';
import { GuestJoinRepository } from './flows/01.7-guest-join-and-linking/flow.repository.js';
import { WorkerOffboardingHandler } from './flows/01.8-worker-offboarding/flow.handler.js';
import { WorkerOffboardingService } from './flows/01.8-worker-offboarding/flow.service.js';
import { WorkerOffboardingRepository } from './flows/01.8-worker-offboarding/flow.repository.js';
import { PrismaClient } from '@alsaada/database';

export function registerWorkforceRoutes(
  bot: Bot<WorkforceModuleContext>,
  prisma: PrismaClient,
  encryptionKey?: string,
  onWorkerDemoted?: (demotedTelegramId: bigint) => Promise<void>
) {
  const exportRepo = new WorkerExportRepository(prisma);
  const exportService = new WorkerExportService(exportRepo, encryptionKey);
  const exportHandler = new WorkerExportHandler(exportService);

  const regRepo = new WorkerRegistrationRepository(prisma);
  const regService = new WorkerRegistrationService(regRepo, undefined, encryptionKey);
  const regHandler = new WorkerRegistrationHandler(regService, regRepo);

  const dirRepo = new WorkerDirectoryRepository(prisma);
  const dirService = new WorkerDirectoryService(dirRepo, encryptionKey);
  const dirHandler = new WorkerDirectoryHandler(dirService);

  const editRepo = new WorkerEditRepository(prisma);
  const editService = new WorkerEditService(editRepo, encryptionKey);
  const editHandler = new WorkerEditHandler(editService, editRepo);

  const selfEditRepo = new WorkerSelfEditRepository(prisma);
  const selfEditService = new WorkerSelfEditService(selfEditRepo, encryptionKey);
  const selfEditHandler = new WorkerSelfEditHandler(selfEditService);
  selfEditHandler.registerRoutes(bot);

  const guestJoinRepo = new GuestJoinRepository(prisma);
  const guestJoinService = new GuestJoinService(guestJoinRepo, encryptionKey || 'alsaada-default-key');
  const guestJoinHandler = new GuestJoinHandler(guestJoinService);
  guestJoinHandler.registerRoutes(bot);

  const offboardRepo = new WorkerOffboardingRepository(prisma);
  const offboardService = new WorkerOffboardingService(offboardRepo, onWorkerDemoted);
  const offboardHandler = new WorkerOffboardingHandler(offboardService);
  offboardHandler.registerRoutes(bot);

  // Flow 01.2.D Worker Edit
  bot.callbackQuery('action:worker_edit:pick', async (ctx) => {
    await dirHandler.handleDirectory(ctx, 1);
  });

  bot.callbackQuery(/^(?:action:worker_edit:pick:|we:menu:)(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1]) await editHandler.handlePickWorker(ctx, match[1]);
  });

  bot.callbackQuery(/^action:w_edit:tab:([A-Z]+):(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1] && match?.[2]) {
      await editHandler.handleSwitchTab(ctx, match[1] as WorkerProfileTab, match[2]);
    }
  });

  bot.callbackQuery(/^action:w_edit:f:([a-zA-Z0-9_]+):(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1] && match?.[2]) {
      await editHandler.handleSelectField(ctx, match[1], match[2]);
    }
  });

  bot.callbackQuery(/^action:w_edit:pk:([a-zA-Z0-9_]+):(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1] && match?.[2]) {
      await editHandler.handleOpenPicker(ctx, match[1], match[2]);
    }
  });

  bot.callbackQuery(/^action:w_edit:pv:([a-zA-Z0-9_]+):(\d+):(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1] && match?.[2] && match?.[3]) {
      await editHandler.handleSelectPickerValue(ctx, match[1], match[2], match[3]);
    }
  });

  bot.callbackQuery(/^action:w_edit:cg_start:(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1]) await editHandler.handleCigaretteStart(ctx, match[1]);
  });

  bot.callbackQuery(/^action:w_edit:cgp:([a-zA-Z0-9_]+):(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1] && match?.[2]) {
      await editHandler.handleCigaretteSelectPolicy(ctx, match[1], match[2]);
    }
  });

  bot.callbackQuery(/^action:w_edit:cgb:(\d+):(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1] && match?.[2]) {
      await editHandler.handleCigaretteSelectBrand(ctx, match[1], match[2]);
    }
  });

  // Salary Wizard & Timelines
  bot.callbackQuery(/^action:w_edit:sal_wiz:(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1]) await editHandler.handleSalaryWizardStart(ctx, match[1]);
  });

  bot.callbackQuery(/^action:w_edit:sal_eff:([A-Z]+):(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1] && match?.[2]) {
      await editHandler.handleSalaryEffectiveDate(ctx, match[1], match[2]);
    }
  });

  bot.callbackQuery(/^action:w_edit:sal_conf:(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1]) await editHandler.handleSalaryConfirm(ctx, match[1]);
  });

  bot.callbackQuery(/^action:w_edit:sal_hist:(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1]) await editHandler.handleSalaryHistory(ctx, match[1]);
  });

  bot.callbackQuery(/^action:w_edit:chg_hist:(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1]) await editHandler.handleWorkerChangeLog(ctx, match[1]);
  });

  // Entity Pickers: Job, Site, Department
  bot.callbackQuery(/^action:w_edit:pk_job:(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1]) await editHandler.handleOpenJobPicker(ctx, match[1]);
  });

  bot.callbackQuery(/^action:w_edit:set_job:(.+):(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1] && match?.[2]) await editHandler.handleSetJob(ctx, match[1], match[2]);
  });

  bot.callbackQuery(/^action:w_edit:pk_site:(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1]) await editHandler.handleOpenSitePicker(ctx, match[1]);
  });

  bot.callbackQuery(/^action:w_edit:set_site:(.+):(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1] && match?.[2]) await editHandler.handleSetSite(ctx, match[1], match[2]);
  });

  bot.callbackQuery(/^action:w_edit:pk_dept:(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1]) await editHandler.handleOpenDeptPicker(ctx, match[1]);
  });

  bot.callbackQuery(/^action:w_edit:set_dept:(.+):(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1] && match?.[2]) await editHandler.handleSetDept(ctx, match[1], match[2]);
  });

  bot.callbackQuery('action:w_edit:cancel', async (ctx) => {
    await editHandler.handleCancel(ctx);
  });

  bot.callbackQuery('action:worker_edit:pending_list', async (ctx) => {
    await editHandler.handlePendingTicketsList(ctx);
  });

  bot.callbackQuery(/^action:w_edit:rev:(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1]) await editHandler.handleReviewTicket(ctx, match[1]);
  });

  bot.callbackQuery(/^action:w_edit:appr:(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1]) await editHandler.handleApproveTicket(ctx, match[1]);
  });

  bot.callbackQuery(/^action:w_edit:rejc:(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1]) await editHandler.handleRejectTicket(ctx, match[1]);
  });

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

  bot.callbackQuery(/^action:worker:call:(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1]) await dirHandler.handleCallWorker(ctx, match[1]);
  });

  bot.callbackQuery(/^action:worker:tid:(.+):([01])$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1] && match?.[2]) {
      await dirHandler.handleToggleNationalId(ctx, match[1], match[2] === '1');
    }
  });

  bot.callbackQuery(/^action:worker:mwa:(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (match?.[1]) await dirHandler.handleMissingDataWhatsApp(ctx, match[1]);
  });

  bot.callbackQuery(/^action:worker:nophone:(.+)$/, async (ctx) => {
    await dirHandler.handleNoPhoneAlert(ctx);
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

  // Text input routing for workforce flows (directory search, registration wizard, worker edit)
  bot.on('message:text', async (ctx, next) => {
    if (!ctx.message?.text || ctx.message.text.startsWith('/')) {
      return next();
    }
    const isNav = /القائمة الرئيسية|إعدادات النظام|ملفي (الشخصي|وإعداداتي)|فحص الكفاءة|التبديل لحسابي كعامل|العودة لبوابة الإشراف|بطاقة معرفي|قسيمة راتبي|كشف حسابي|لوحة المؤشرات|فواتيري ومستخلصاتي/.test(ctx.message.text);
    if (isNav) {
      if (ctx.from) {
        editHandler.clearDraft(String(ctx.from.id));
      }
      return next();
    }
    const text = ctx.message.text;
    if (ctx.from) {
      const uid = String(ctx.from.id);
      const telegramId = BigInt(ctx.from.id);

      if (dirHandler.isSearching(uid)) {
        await dirHandler.handleSearchInput(ctx, text);
        return;
      }

      const wizardDraft = await regService.getDraft(telegramId);
      if (wizardDraft) {
        await regHandler.handleTextInput(ctx, text);
        return;
      }

      if (editHandler.hasActiveDraft(uid)) {
        await editHandler.handleTextInput(ctx, text);
        return;
      }

      if (await selfEditHandler.handleTextInput(ctx, text)) {
        return;
      }

      if (await guestJoinHandler.handleTextInput(ctx, text)) {
        return;
      }
    }
    return next();
  });

  // Photo input routing for worker registration
  bot.on('message:photo', async (ctx, next) => {
    if (ctx.from) {
      const telegramId = BigInt(ctx.from.id);
      const draft = await regService.getDraft(telegramId);
      if (draft && (draft.currentStep === 'PHOTO_FRONT' || draft.currentStep === 'PHOTO_BACK')) {
        const photos = ctx.message?.photo;
        if (photos && photos.length > 0) {
          const fileId = photos[photos.length - 1]?.file_id;
          if (fileId) {
            await regHandler.handlePhotoInput(ctx, fileId);
            return;
          }
        }
      }
    }
    return next();
  });

  // Document input routing for worker bulk Excel import
  bot.on('message:document', async (ctx, next) => {
    if (ctx.from && exportHandler.isWaitingForUpload(String(ctx.from.id))) {
      const doc = ctx.message?.document;
      if (doc && (doc.file_name?.endsWith('.xlsx') || doc.file_name?.endsWith('.xls'))) {
        try {
          const file = await ctx.api.getFile(doc.file_id);
          if (file.file_path) {
            const token = ctx.api.token;
            const downloadUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
            const response = await fetch(downloadUrl);
            if (response.ok) {
              const arrayBuffer = await response.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              await exportHandler.handleDocumentUpload(ctx, buffer);
              return;
            }
          }
        } catch (err) {
          console.error('Failed to download Excel file for workforce import:', err);
        }
      }
    }
    return next();
  });

  return {
    exportHandler,
    regHandler,
    dirHandler,
    editHandler,
    selfEditHandler,
    guestJoinHandler,
    offboardHandler,
    guestJoinService,
    guestJoinRepo,
    selfEditService,
    offboardService,
  };
}
