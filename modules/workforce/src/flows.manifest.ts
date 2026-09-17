import type { Bot, Context } from 'grammy';
import type { UserRole, WorkforceModuleContext } from './shared/module.types.js';
import type { WorkerExportHandler } from './flows/01.4-worker-export/flow.handler.js';
import type { WorkerExportService } from './flows/01.4-worker-export/flow.service.js';
import type { WorkerExportRepository } from './flows/01.4-worker-export/flow.repository.js';
import type { WorkerRegistrationHandler } from './flows/01.1-worker-registration/flow.handler.js';
import type { WorkerRegistrationService } from './flows/01.1-worker-registration/flow.service.js';
import type { WorkerDirectoryHandler } from './flows/01.5-worker-directory/flow.handler.js';
import type { WorkerDocumentsHandler } from './flows/01.5-worker-directory/flow.documents-handler.js';
import type { WorkerDirectoryService } from './flows/01.5-worker-directory/flow.service.js';
import type { WorkerEditHandler } from './flows/01.2.D-worker-edit/flow.handler.js';
import type { WorkerEditService } from './flows/01.2.D-worker-edit/flow.service.js';
import type { WorkerSelfEditHandler } from './flows/01.6-worker-self-edit/flow.handler.js';
import type { GuestJoinHandler } from './flows/01.7-guest-join-and-linking/flow.handler.js';
import type { WorkerOffboardingHandler } from './flows/01.8-worker-offboarding/flow.handler.js';
import type { WorkerCommitmentHandler } from './flows/01.9-worker-commitment-index/flow.handler.js';
import { createWorkerCommitmentPlugin } from './flows/01.9-worker-commitment-index/flow.plugin.js';
import type { WorkerProfileTab } from './flows/01.2.D-worker-edit/flow.types.js';
import type {
  FlowMenuButton,
  FlowContractMetadata as CoreFlowContractMetadata,
  FlowPlugin as CoreFlowPlugin,
} from '@alsaada/core-components';

export type FlowContractMetadata = CoreFlowContractMetadata<UserRole>;
export type FlowPlugin<C extends Context = WorkforceModuleContext> = CoreFlowPlugin<C, UserRole>;
export type { FlowMenuButton };

export interface WorkforceFlowDeps {
  exportHandler: WorkerExportHandler;
  exportService: WorkerExportService;
  exportRepo?: WorkerExportRepository | undefined;
  regHandler: WorkerRegistrationHandler;
  regService: WorkerRegistrationService;
  dirHandler: WorkerDirectoryHandler;
  docsHandler: WorkerDocumentsHandler;
  dirService: WorkerDirectoryService;
  editHandler: WorkerEditHandler;
  editService: WorkerEditService;
  selfEditHandler: WorkerSelfEditHandler;
  guestJoinHandler: GuestJoinHandler;
  offboardHandler: WorkerOffboardingHandler;
  wcsHandler?: WorkerCommitmentHandler | undefined;
}

export const WORKFORCE_FLOW_METADATA: FlowContractMetadata[] = [
  {
    flowCode: '01.1',
    flowName: 'تسجيل وتعيين عامل / موظف جديد',
    module: 'workforce',
    status: 'Implemented',
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    menuButton: {
      label: '➕ تسجيل وتعيين عامل جديد',
      callbackData: 'action:worker:add_single',
      subSection: 'onboarding',
      order: 1,
    },
  },
  {
    flowCode: '01.5',
    flowName: 'دليل وسجل العاملين (360°)',
    module: 'workforce',
    status: 'Implemented',
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    menuButton: {
      label: '📋 دليل وسجل العاملين (360°)',
      callbackData: 'action:worker:directory',
      subSection: 'onboarding',
      order: 2,
    },
  },
  {
    flowCode: '01.2.D',
    flowName: 'تعديل وتحديث بيانات عامل',
    module: 'workforce',
    status: 'Implemented',
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    menuButton: {
      label: '✏️ تعديل بيانات عامل',
      callbackData: 'action:worker_edit:pick',
      subSection: 'onboarding',
      order: 3,
    },
  },
  {
    flowCode: '01.8',
    flowName: 'إنهاء خدمة ومخالصة عامل',
    module: 'workforce',
    status: 'Implemented',
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    menuButton: {
      label: '🚪 إنهاء خدمة عامل',
      callbackData: 'wizard:worker_offboard:start',
      subSection: 'onboarding',
      order: 4,
    },
  },
  {
    flowCode: '01.4',
    flowName: 'استيراد وتصدير كشف العمال',
    module: 'workforce',
    status: 'Implemented',
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    menuButton: {
      label: '📥📤 استيراد وتصدير كشف العمال',
      callbackData: 'menu:hr_sub:worker_excel',
      subSection: 'onboarding',
      order: 5,
    },
  },
  {
    flowCode: '01.6',
    flowName: 'التحديث الذاتي لبيانات العامل',
    module: 'workforce',
    status: 'Implemented',
    allowedRoles: ['WORKER', 'SUPER_ADMIN'],
  },
  {
    flowCode: '01.7',
    flowName: 'التحاق العاملين وربط واتساب المشفر',
    module: 'workforce',
    status: 'Implemented',
    allowedRoles: ['GUEST', 'SUPER_ADMIN'],
  },
  {
    flowCode: '01.9',
    flowName: 'مؤشر التزام وموثوقية العمال الشامل (NEW-80)',
    module: 'workforce',
    status: 'Implemented',
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'ACCOUNTANT', 'EXECUTIVE', 'WORKER'],
    menuButton: {
      label: '⭐ مؤشر التزام العمال',
      callbackData: 'menu:wcs:main',
      subSection: 'onboarding',
      order: 6,
    },
  },
];

export function getWorkforceFlowMetadata(flowCode: string): FlowContractMetadata {
  const meta = WORKFORCE_FLOW_METADATA.find((m) => m.flowCode === flowCode);
  if (!meta) {
    throw new Error(`Flow metadata not found in WORKFORCE_FLOW_METADATA for flowCode: ${flowCode}`);
  }
  return meta;
}

export function buildWorkforceFlowPlugins(deps: WorkforceFlowDeps): FlowPlugin<WorkforceModuleContext>[] {
  const {
    exportHandler,
    exportRepo,
    regHandler,
    regService,
    dirHandler,
    docsHandler,
    editHandler,
    selfEditHandler,
    guestJoinHandler,
    offboardHandler,
  } = deps;

  // 1. Worker Registration Plugin (01.1)
  const regPlugin: FlowPlugin<WorkforceModuleContext> = {
    flowKey: '01.1',
    flowSlug: 'worker-registration',
    titleArabic: 'تسجيل وتعيين عامل / موظف جديد',
    module: 'workforce',
    contract: getWorkforceFlowMetadata('01.1'),
    registerRoutes: (bot) => {
      bot.callbackQuery('action:worker:add_single', async (ctx) => {
        await regHandler.handleStart(ctx);
      });
      bot.callbackQuery('wizard:worker:cancel', async (ctx) => {
        await regHandler.handleCancel(ctx);
      });
      bot.callbackQuery('wizard:worker:back', async (ctx) => {
        await regHandler.handleBack(ctx);
      });
      bot.callbackQuery('wizard:worker:confirm', async (ctx) => {
        await regHandler.handleConfirm(ctx);
      });
      bot.callbackQuery('wizard:worker:noop', async (ctx) => {
        await ctx.answerCallbackQuery({
          text: '⏳ العمل جارٍ بالخلفية، يرجى الانتظار ثوانٍ...',
          show_alert: false,
        }).catch(() => {});
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
      bot.callbackQuery('wizard:worker:ai_approve', async (ctx) => {
        await regHandler.handleAiApprove(ctx);
      });
      bot.callbackQuery(/^wizard:worker:ai_edit:(.+)$/, async (ctx) => {
        const match = ctx.match;
        if (match?.[1]) await regHandler.handleAiEdit(ctx, match[1] as 'name' | 'id' | 'address' | 'expiry');
      });
      bot.callbackQuery(/^wizard:worker:(?:job_page|job_p):(\d+)$/, async (ctx) => {
        const match = ctx.match;
        if (match?.[1]) await regHandler.handleJobPage(ctx, parseInt(match[1], 10));
      });
      bot.callbackQuery(/^wizard:worker:(?:job|set_job):(.+)$/, async (ctx) => {
        const match = ctx.match;
        if (match?.[1]) await regHandler.handleJobChoice(ctx, match[1]);
      });
      bot.callbackQuery(/^wizard:worker:(?:site_page|site_p):(\d+)$/, async (ctx) => {
        const match = ctx.match;
        if (match?.[1]) await regHandler.handleSitePage(ctx, parseInt(match[1], 10));
      });
      bot.callbackQuery(/^wizard:worker:(?:site|set_site):(.+)$/, async (ctx) => {
        const match = ctx.match;
        if (match?.[1]) await regHandler.handleSiteChoice(ctx, match[1]);
      });
      bot.callbackQuery(/^wizard:worker:pick_nick:(.+)$/, async (ctx) => {
        const match = ctx.match;
        if (match?.[1]) await regHandler.handlePickNick(ctx, match[1]);
      });
      bot.callbackQuery('wizard:worker:skip_nick', async (ctx) => {
        await regHandler.handleSkipNickname(ctx);
      });
      bot.callbackQuery(/^wizard:worker:tr_same:(.+)$/, async (ctx) => {
        const match = ctx.match;
        if (match?.[1]) await regHandler.handlePayoutTransferChoice(ctx, match[1]);
      });
      bot.callbackQuery('wizard:worker:skip_wallet', async (ctx) => {
        await regHandler.handleSkipWallet(ctx);
      });
      bot.callbackQuery(/^wizard:worker:payout:(.+)$/, async (ctx) => {
        const match = ctx.match;
        if (match?.[1]) await regHandler.handlePayoutChoice(ctx, match[1]);
      });
      bot.callbackQuery(/^wizard:worker:sdate:(.+)$/, async (ctx) => {
        const match = ctx.match;
        if (match?.[1]) await regHandler.handleStartDateChoice(ctx, match[1]);
      });
      bot.callbackQuery(/^wizard:worker:lic:(.+)$/, async (ctx) => {
        const match = ctx.match;
        if (match?.[1]) await regHandler.handleLicenseChoice(ctx, match[1]);
      });
      bot.callbackQuery(/^wizard:worker:mil:(.+)$/, async (ctx) => {
        const match = ctx.match;
        if (match?.[1]) await regHandler.handleMilitaryChoice(ctx, match[1]);
      });
      bot.callbackQuery('wizard:worker:emg:skip', async (ctx) => {
        await regHandler.handleSkipEmergencyPhone(ctx);
      });
      bot.callbackQuery(/^wizard:worker:ins:(.+)$/, async (ctx) => {
        const match = ctx.match;
        if (match?.[1]) await regHandler.handleInsuranceChoice(ctx, match[1]);
      });
      bot.callbackQuery(/^wizard:worker:mar:(.+)$/, async (ctx) => {
        const match = ctx.match;
        if (match?.[1]) await regHandler.handleMaritalChoice(ctx, match[1]);
      });
      bot.callbackQuery(/^wizard:worker:retry:(.+)$/, async (ctx) => {
        const match = ctx.match;
        if (match?.[1]) await regHandler.handleRetryStep(ctx, match[1]);
      });
    },
    handleTextInput: async (ctx, text) => {
      if (!ctx.from) return false;
      const draft = await regService.getDraft(BigInt(ctx.from.id));
      if (draft) {
        await regHandler.handleTextInput(ctx, text);
        return true;
      }
      return false;
    },
    handlePhotoInput: async (ctx, fileId) => {
      if (!ctx.from) return false;
      const draft = await regService.getDraft(BigInt(ctx.from.id));
      if (draft && (draft.currentStep === 'PHOTO_FRONT' || draft.currentStep === 'PHOTO_BACK')) {
        await regHandler.handlePhotoInput(ctx, fileId);
        return true;
      }
      return false;
    },
    handleDocumentInput: async (ctx, doc) => {
      if (!ctx.from) return false;
      const draft = await regService.getDraft(BigInt(ctx.from.id));
      if (draft && (draft.currentStep === 'PHOTO_FRONT' || draft.currentStep === 'PHOTO_BACK')) {
        if (doc?.file_id && (doc.mime_type?.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(doc.file_name || ''))) {
          await regHandler.handlePhotoInput(ctx, doc.file_id);
          return true;
        }
      }
      return false;
    },
  };

  // 2. Worker Edit Plugin (01.2.D)
  const editPlugin: FlowPlugin<WorkforceModuleContext> = {
    flowKey: '01.2.D',
    flowSlug: 'worker-edit',
    titleArabic: 'تعديل وتحديث بيانات عامل',
    module: 'workforce',
    contract: getWorkforceFlowMetadata('01.2.D'),
    registerRoutes: (bot) => {
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
    },
    handleTextInput: async (ctx, text) => {
      if (!ctx.from) return false;
      const uid = String(ctx.from.id);
      if (editHandler.hasActiveDraft(uid)) {
        await editHandler.handleTextInput(ctx, text);
        return true;
      }
      return false;
    },
  };

  // 3. Worker Export Plugin (01.4)
  const exportPlugin: FlowPlugin<WorkforceModuleContext> = {
    flowKey: '01.4',
    flowSlug: 'worker-export',
    titleArabic: 'تصدير واستيراد كشف العمال',
    module: 'workforce',
    contract: getWorkforceFlowMetadata('01.4'),
    registerRoutes: (bot) => {
      bot.callbackQuery('action:worker_export:start', async (ctx) => {
        await exportHandler.handleExportStart(ctx);
      });
      bot.callbackQuery('action:worker:download_excel', async (ctx) => {
        await exportHandler.handleDownloadTemplate(ctx);
      });
      bot.callbackQuery('action:worker:upload_excel', async (ctx) => {
        await exportHandler.handleStartUpload(ctx);
      });
      bot.callbackQuery('action:worker_export:do:all', async (ctx) => {
        await exportHandler.handleExportExecute(ctx, { type: 'ALL' });
      });
      bot.callbackQuery('action:worker_export:dept_menu', async (ctx) => {
        const depts = exportRepo ? await exportRepo.getDepartments() : [];
        await exportHandler.handleDepartmentMenu(ctx, depts);
      });
      bot.callbackQuery(/^action:worker_export:do:d(?:ept)?:(.+)$/, async (ctx) => {
        const match = ctx.match;
        const deptId = match?.[1];
        if (deptId) {
          await exportHandler.handleExportExecute(ctx, { type: 'DEPARTMENT', departmentId: deptId });
        }
      });
      bot.callbackQuery(/^action:worker_export:job_menu:(\d+)$/, async (ctx) => {
        const match = ctx.match;
        const page = parseInt(match?.[1] || '1', 10);
        const jobs = exportRepo ? await exportRepo.getActiveJobs() : [];
        const pageSize = 10;
        const totalPages = Math.ceil(jobs.length / pageSize) || 1;
        const pagedJobs = jobs.slice((page - 1) * pageSize, page * pageSize);
        await exportHandler.handleJobTitleMenu(ctx, pagedJobs, page, totalPages);
      });
      bot.callbackQuery(/^action:worker_export:do:job:(.+)$/, async (ctx) => {
        const match = ctx.match;
        const jobTitleId = match?.[1];
        if (jobTitleId) {
          await exportHandler.handleExportExecute(ctx, { type: 'JOB_TITLE', jobTitleId });
        }
      });
      bot.callbackQuery('action:worker_export:gov_menu', async (ctx) => {
        await exportHandler.handleGovernorateMenu(ctx);
      });
      bot.callbackQuery(/^action:worker_export:do:gov:(.+)$/, async (ctx) => {
        const match = ctx.match;
        const govCode = match?.[1];
        if (govCode) {
          await exportHandler.handleExportExecute(ctx, { type: 'GOVERNORATE', governorateCode: govCode });
        }
      });
    },
    handleDocumentInput: async (ctx, doc) => {
      if (!ctx.from) return false;
      const uid = String(ctx.from.id);
      if (exportHandler.isWaitingForUpload(uid)) {
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
                return true;
              }
            }
          } catch (err) {
            console.error('Failed to download Excel file for workforce import:', err);
          }
        }
      }
      return false;
    },
  };

  // 4. Worker Directory & Documents Plugin (01.5)
  const dirPlugin: FlowPlugin<WorkforceModuleContext> = {
    flowKey: '01.5',
    flowSlug: 'worker-directory',
    titleArabic: 'دليل وسجل العاملين (360°)',
    module: 'workforce',
    contract: getWorkforceFlowMetadata('01.5'),
    registerRoutes: (bot) => {
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
      // Documents
      bot.callbackQuery(/^action:worker:docs:(.+)$/, async (ctx) => {
        const match = ctx.match;
        if (match?.[1]) await docsHandler.handleListDocuments(ctx, match[1]);
      });
      bot.callbackQuery(/^action:worker:doc_view:(.+)$/, async (ctx) => {
        const match = ctx.match;
        if (match?.[1]) await docsHandler.handleViewDocument(ctx, match[1]);
      });
      bot.callbackQuery(/^action:worker:doc_del:(.+)$/, async (ctx) => {
        const match = ctx.match;
        if (match?.[1]) await docsHandler.handleDeleteDocument(ctx, match[1]);
      });
      bot.callbackQuery(/^action:worker:doc_add:(.+)$/, async (ctx) => {
        const match = ctx.match;
        if (match?.[1]) await docsHandler.handleStartAddDocument(ctx, match[1]);
      });
      bot.callbackQuery(/^act:wdoc:cat:([A-Z_]+)$/, async (ctx) => {
        const match = ctx.match;
        if (match?.[1]) await docsHandler.handleSelectDocCategory(ctx, match[1]);
      });
    },
    handleTextInput: async (ctx, text) => {
      if (!ctx.from) return false;
      const uid = String(ctx.from.id);
      if (dirHandler.isSearching(uid)) {
        await dirHandler.handleSearchInput(ctx, text);
        return true;
      }
      if (docsHandler.isWaitingForDocTitle(uid)) {
        await docsHandler.handleCustomTitleInput(ctx, text);
        return true;
      }
      return false;
    },
    handlePhotoInput: async (ctx, fileId) => {
      if (!ctx.from) return false;
      const uid = String(ctx.from.id);
      if (docsHandler.isWaitingForDocFile(uid) && ctx.api) {
        try {
          const file = await ctx.api.getFile(fileId);
          const token = ctx.api.token || process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
          if (file.file_path && token) {
            const downloadUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
            const res = await fetch(downloadUrl);
            if (res.ok) {
              const arr = await res.arrayBuffer();
              await docsHandler.handleDocumentFileInput(ctx, {
                buffer: Buffer.from(arr),
                fileName: `${fileId}.jpg`,
                mimeType: 'image/jpeg',
              });
              return true;
            }
          }
        } catch (err) {
          console.error('Failed to download photo for worker document:', err);
        }
      }
      return false;
    },
    handleDocumentInput: async (ctx, doc) => {
      if (!ctx.from) return false;
      const uid = String(ctx.from.id);
      if (docsHandler.isWaitingForDocFile(uid) && doc?.file_id && ctx.api) {
        try {
          const file = await ctx.api.getFile(doc.file_id);
          const token = ctx.api.token || process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
          if (file.file_path && token) {
            const downloadUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
            const res = await fetch(downloadUrl);
            if (res.ok) {
              const arr = await res.arrayBuffer();
              await docsHandler.handleDocumentFileInput(ctx, {
                buffer: Buffer.from(arr),
                fileName: doc.file_name || `${doc.file_id}.pdf`,
                mimeType: doc.mime_type || 'application/pdf',
              });
              return true;
            }
          }
        } catch (err) {
          console.error('Failed to download document for worker document:', err);
        }
      }
      return false;
    },
  };

  // 5. Worker Self Edit Plugin (01.6)
  const selfEditPlugin: FlowPlugin<WorkforceModuleContext> = {
    flowKey: '01.6',
    flowSlug: 'worker-self-edit',
    titleArabic: 'التحديث الذاتي لبيانات العامل',
    module: 'workforce',
    contract: getWorkforceFlowMetadata('01.6'),
    registerRoutes: (bot) => {
      selfEditHandler.registerRoutes(bot);
    },
    handleTextInput: async (ctx, text) => {
      const handled = await selfEditHandler.handleTextInput(ctx, text);
      return Boolean(handled);
    },
  };

  // 6. Guest Join Plugin (01.7)
  const guestJoinPlugin: FlowPlugin<WorkforceModuleContext> = {
    flowKey: '01.7',
    flowSlug: 'guest-join-and-linking',
    titleArabic: 'التحاق العاملين وربط واتساب المشفر',
    module: 'workforce',
    contract: getWorkforceFlowMetadata('01.7'),
    registerRoutes: (bot) => {
      guestJoinHandler.registerRoutes(bot);
    },
    handleTextInput: async (ctx, text) => {
      const handled = await guestJoinHandler.handleTextInput(ctx, text);
      return Boolean(handled);
    },
  };

  // 7. Worker Offboarding Plugin (01.8)
  const offboardPlugin: FlowPlugin<WorkforceModuleContext> = {
    flowKey: '01.8',
    flowSlug: 'worker-offboarding',
    titleArabic: 'إنهاء خدمة ومخالصة عامل',
    module: 'workforce',
    contract: getWorkforceFlowMetadata('01.8'),
    registerRoutes: (bot) => {
      offboardHandler.registerRoutes(bot);
    },
    handleTextInput: async (ctx, text) => {
      if (!ctx.from) return false;
      const uid = String(ctx.from.id);
      if (offboardHandler.isWaitingForText(uid)) {
        await offboardHandler.handleTextInput(ctx, text);
        return true;
      }
      return false;
    },
    handlePhotoInput: async (ctx, fileId) => {
      if (!ctx.from) return false;
      const uid = String(ctx.from.id);
      if (offboardHandler.isWaitingForPhoto(uid)) {
        await offboardHandler.handlePhotoInput(ctx, fileId);
        return true;
      }
      return false;
    },
  };

  const plugins: FlowPlugin<WorkforceModuleContext>[] = [
    regPlugin,
    dirPlugin,
    editPlugin,
    offboardPlugin,
    exportPlugin,
    selfEditPlugin,
    guestJoinPlugin,
  ];

  if (deps.wcsHandler) {
    plugins.push(createWorkerCommitmentPlugin(deps.wcsHandler));
  }

  return plugins;
}
