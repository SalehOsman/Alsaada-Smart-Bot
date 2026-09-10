import type { Bot } from 'grammy';
import type { PrismaClient } from '@alsaada/database';
import type { Redis } from 'ioredis';
import type { SettingsModuleContext, SettingsModuleOptions } from './shared/module.types.js';

import { handleSettingsHub, handleSettingsSubCategory } from './shared/settings-hub.js';

// Flow 00.1 Corporate Profile
import { CorporateProfileRepository } from './flows/00.1-corporate-profile/flow.repository.js';
import { CorporateProfileService } from './flows/00.1-corporate-profile/flow.service.js';
import { CorporateProfileHandler } from './flows/00.1-corporate-profile/flow.handler.js';
import type { CompanyFieldKey } from './flows/00.1-corporate-profile/flow.types.js';

// Flow 00.2 Sites Hub
import { SitesHubRepository } from './flows/00.2-sites-hub/flow.repository.js';
import { SitesHubService } from './flows/00.2-sites-hub/flow.service.js';
import { SitesHubHandler } from './flows/00.2-sites-hub/flow.handler.js';
import type { SiteFieldKey } from './flows/00.2-sites-hub/flow.types.js';

// Flow 00.3 Job Matrix
import { JobMatrixRepository } from './flows/00.3-job-matrix/flow.repository.js';
import { JobMatrixService } from './flows/00.3-job-matrix/flow.service.js';
import { JobMatrixHandler } from './flows/00.3-job-matrix/flow.handler.js';

// Flow 00.4 Admin Profile
import { AdminProfileRepository } from './flows/00.4-admin-profile/flow.repository.js';
import { AdminProfileService } from './flows/00.4-admin-profile/flow.service.js';
import { AdminProfileHandler } from './flows/00.4-admin-profile/flow.handler.js';
import type { AdminFieldKey } from './flows/00.4-admin-profile/flow.types.js';

// Flow 00.5 Admin Assignment
import { AdminAssignmentRepository } from './flows/00.5-admin-assignment/flow.repository.js';
import { AdminAssignmentService } from './flows/00.5-admin-assignment/flow.service.js';
import { AdminAssignmentHandler } from './flows/00.5-admin-assignment/flow.handler.js';

// Flow 00.6 Ghost Mode
import { GhostModeRepository } from './flows/00.6-ghost-mode/flow.repository.js';
import { GhostModeService } from './flows/00.6-ghost-mode/flow.service.js';
import { GhostModeHandler } from './flows/00.6-ghost-mode/flow.handler.js';

// Flow 00.7 Audit Incident Vault
import { AuditIncidentVaultRepository } from './flows/00.7-audit-incident-vault/flow.repository.js';
import { AuditIncidentVaultService } from './flows/00.7-audit-incident-vault/flow.service.js';
import { AuditIncidentVaultHandler } from './flows/00.7-audit-incident-vault/flow.handler.js';

// Flow 00.8 APM Telemetry
import { ApmTelemetryRepository } from './flows/00.8-apm-telemetry/flow.repository.js';
import { ApmTelemetryService } from './flows/00.8-apm-telemetry/flow.service.js';
import { ApmTelemetryHandler } from './flows/00.8-apm-telemetry/flow.handler.js';

// Flow 00.9 Emergency Cache
import { EmergencyCacheRepository } from './flows/00.9-emergency-cache/flow.repository.js';
import { EmergencyCacheService } from './flows/00.9-emergency-cache/flow.service.js';
import { EmergencyCacheHandler } from './flows/00.9-emergency-cache/flow.handler.js';

export interface SettingsModuleHandlers {
  corporateHandler: CorporateProfileHandler;
  sitesHandler: SitesHubHandler;
  jobMatrixHandler: JobMatrixHandler;
  adminProfileHandler: AdminProfileHandler;
  adminAssignmentHandler: AdminAssignmentHandler;
  ghostModeHandler: GhostModeHandler;
  auditVaultHandler: AuditIncidentVaultHandler;
  apmHandler: ApmTelemetryHandler;
  emergencyCacheHandler: EmergencyCacheHandler;
  handleTextInput: (ctx: SettingsModuleContext) => Promise<boolean>;
  handleLocationInput: (ctx: SettingsModuleContext) => Promise<boolean>;
}

export function registerSettingsRoutes(
  bot: Bot<SettingsModuleContext>,
  options: SettingsModuleOptions
): SettingsModuleHandlers {
  const { prisma, redis, encryptionKey } = options;

  // 00.1 Corporate Profile
  const corporateRepo = new CorporateProfileRepository(prisma);
  const corporateService = new CorporateProfileService(corporateRepo, redis);
  const corporateHandler = new CorporateProfileHandler(corporateService);

  // 00.2 Sites Hub
  const sitesRepo = new SitesHubRepository(prisma);
  const sitesService = new SitesHubService(sitesRepo, redis);
  const sitesHandler = new SitesHubHandler(sitesService);

  // 00.3 Job Matrix
  const jobMatrixRepo = new JobMatrixRepository(prisma);
  const jobMatrixService = new JobMatrixService(jobMatrixRepo);
  const jobMatrixHandler = new JobMatrixHandler(jobMatrixService);

  // 00.4 Admin Profile
  const adminProfileRepo = new AdminProfileRepository(prisma);
  const adminProfileService = new AdminProfileService(adminProfileRepo, encryptionKey, redis);
  const adminProfileHandler = new AdminProfileHandler(adminProfileService);

  // 00.5 Admin Assignment
  const adminAssignmentRepo = new AdminAssignmentRepository(prisma);
  const adminAssignmentService = new AdminAssignmentService(adminAssignmentRepo);
  const adminAssignmentHandler = new AdminAssignmentHandler(adminAssignmentService);

  // 00.6 Ghost Mode
  const ghostRepo = new GhostModeRepository(redis);
  const ghostService = new GhostModeService(ghostRepo);
  const ghostModeHandler = new GhostModeHandler(ghostService);

  // 00.7 Audit Incident Vault
  const auditRepo = new AuditIncidentVaultRepository(prisma);
  const auditService = new AuditIncidentVaultService(auditRepo);
  const auditVaultHandler = new AuditIncidentVaultHandler(auditService);

  // 00.8 APM Telemetry
  const apmRepo = new ApmTelemetryRepository(prisma, redis);
  const apmService = new ApmTelemetryService(apmRepo);
  const apmHandler = new ApmTelemetryHandler(apmService);

  // 00.9 Emergency Cache
  const emergencyRepo = new EmergencyCacheRepository(prisma, redis);
  const emergencyService = new EmergencyCacheService(emergencyRepo);
  const emergencyCacheHandler = new EmergencyCacheHandler(emergencyService);

  // --- Central Hub & Navigation Routes ---
  bot.command(['settings', 'admin'], handleSettingsHub);
  bot.callbackQuery('menu:super_admin_settings', handleSettingsHub);
  bot.callbackQuery('action:settings_sub:corporate', (ctx) => handleSettingsSubCategory(ctx, 'corporate'));
  bot.callbackQuery('action:settings_sub:identity', (ctx) => handleSettingsSubCategory(ctx, 'identity'));
  bot.callbackQuery('action:settings_sub:system', (ctx) => handleSettingsSubCategory(ctx, 'system'));

  // --- Flow 00.1 Corporate Profile ---
  bot.command(['company', 'org'], (ctx) => corporateHandler.renderCard(ctx, false));
  bot.callbackQuery('action:settings:company_profile', (ctx) => corporateHandler.renderCard(ctx, true));
  bot.callbackQuery(/^action:edit_comp:(.+)$/, async (ctx) => {
    const fieldKey = ctx.match?.[1] as CompanyFieldKey;
    if (fieldKey) await corporateHandler.handleStartEdit(ctx, fieldKey);
  });

  // --- Flow 00.2 Sites Hub ---
  bot.command(['sites', 'projects'], (ctx) => sitesHandler.renderSitesHub(ctx, false));
  bot.callbackQuery('action:settings:sites_hub', (ctx) => sitesHandler.renderSitesHub(ctx, true));
  bot.callbackQuery(/^action:site:view:(.+)$/, async (ctx) => {
    if (ctx.match?.[1]) await sitesHandler.renderSiteDetail(ctx, ctx.match[1], true);
  });
  bot.callbackQuery(/^action:site:toggle:(.+)$/, async (ctx) => {
    if (ctx.match?.[1]) await sitesHandler.handleToggleSite(ctx, ctx.match[1]);
  });
  bot.callbackQuery('action:site:add_new', (ctx) => sitesHandler.handleStartAddSite(ctx));
  bot.callbackQuery(/^action:site:confirm_code:(.+)$/, async (ctx) => {
    if (ctx.match?.[1]) await sitesHandler.handleConfirmCode(ctx, ctx.match[1]);
  });
  bot.callbackQuery(/^action:site:add:gov:(.+)$/, async (ctx) => {
    if (ctx.match?.[1]) await sitesHandler.handleSelectGov(ctx, ctx.match[1]);
  });
  bot.callbackQuery(/^action:site:add:geofence:(\d+)$/, async (ctx) => {
    if (ctx.match?.[1]) await sitesHandler.handleSelectGeofence(ctx, parseInt(ctx.match[1], 10));
  });
  bot.callbackQuery(/^action:site:edit_menu:(.+)$/, async (ctx) => {
    if (ctx.match?.[1]) await sitesHandler.handleEditMenu(ctx, ctx.match[1]);
  });
  bot.callbackQuery(/^action:site:edit:(.+):(.+)$/, async (ctx) => {
    if (ctx.match?.[1] && ctx.match?.[2]) {
      await sitesHandler.handleStartEditField(ctx, ctx.match[1] as SiteFieldKey, ctx.match[2]);
    }
  });
  bot.callbackQuery(/^action:site:set_gov:(.+):(.+)$/, async (ctx) => {
    if (ctx.match?.[1] && ctx.match?.[2]) await sitesHandler.handleSelectGov(ctx, ctx.match[2], ctx.match[1]);
  });
  bot.callbackQuery(/^action:site:set_geofence:(.+):(\d+)$/, async (ctx) => {
    if (ctx.match?.[1] && ctx.match?.[2]) {
      await sitesHandler.handleSelectGeofence(ctx, parseInt(ctx.match[2], 10), ctx.match[1]);
    }
  });
  bot.callbackQuery(/^action:site:set_project:(.+):(.+)$/, async (ctx) => {
    if (ctx.match?.[1] && ctx.match?.[2]) await sitesHandler.handleSelectProject(ctx, ctx.match[2], ctx.match[1]);
  });
  bot.callbackQuery(/^action:site:sp:(.+):(.+)$/, async (ctx) => {
    if (ctx.match?.[1] && ctx.match?.[2]) await sitesHandler.handleSelectProject(ctx, ctx.match[2], ctx.match[1]);
  });


  // --- Flow 00.3 Job Matrix ---
  bot.command(['jobs', 'departments', 'matrix'], (ctx) => jobMatrixHandler.renderDepartmentsHub(ctx, false));
  bot.callbackQuery('action:settings:job_matrix', (ctx) => jobMatrixHandler.renderDepartmentsHub(ctx, true));
  bot.callbackQuery(/^action:dept:view:(.+)$/, async (ctx) => {
    if (ctx.match?.[1]) await jobMatrixHandler.renderDepartmentDetail(ctx, ctx.match[1], true);
  });
  bot.callbackQuery(/^action:dept:toggle_active:(.+)$/, async (ctx) => {
    if (ctx.match?.[1]) await jobMatrixHandler.handleToggleDept(ctx, ctx.match[1]);
  });
  bot.callbackQuery('action:dept:download_excel', (ctx) => jobMatrixHandler.handleDownloadExcel(ctx));
  bot.callbackQuery(/^action:job:view:(.+):(.+)$/, async (ctx) => {
    if (ctx.match?.[1] && ctx.match?.[2]) {
      await jobMatrixHandler.renderJobDetail(ctx, ctx.match[1], ctx.match[2], true);
    }
  });
  bot.callbackQuery(/^action:job:headcount:(.+):(.+):(inc|dec)$/, async (ctx) => {
    if (ctx.match?.[1] && ctx.match?.[2] && ctx.match?.[3]) {
      await jobMatrixHandler.handleHeadcountDelta(ctx, ctx.match[1], ctx.match[2], ctx.match[3] as 'inc' | 'dec');
    }
  });
  bot.callbackQuery(/^action:job:toggle_active:(.+):(.+)$/, async (ctx) => {
    if (ctx.match?.[1] && ctx.match?.[2]) {
      await jobMatrixHandler.handleToggleJob(ctx, ctx.match[1], ctx.match[2]);
    }
  });
  bot.callbackQuery(/^action:job:edit_cycle:(.+):(.+)$/, async (ctx) => {
    if (ctx.match?.[1] && ctx.match?.[2]) {
      await jobMatrixHandler.handlePromptEditCycle(ctx, ctx.match[1], ctx.match[2]);
    }
  });
  bot.callbackQuery(/^action:job:quick_preset:(.+):(.+):(\d+):(\d+)$/, async (ctx) => {
    if (ctx.match?.[1] && ctx.match?.[2] && ctx.match?.[3] && ctx.match?.[4]) {
      await jobMatrixHandler.handleQuickPreset(
        ctx,
        ctx.match[1],
        ctx.match[2],
        parseInt(ctx.match[3], 10),
        parseInt(ctx.match[4], 10)
      );
    }
  });

  // --- Flow 00.4 Admin Profile ---
  bot.command(['me', 'profile'], (ctx) => adminProfileHandler.renderAdminProfile(ctx, false));
  bot.callbackQuery('action:settings:admin_profile', (ctx) => adminProfileHandler.renderAdminProfile(ctx, true));
  bot.callbackQuery('menu:field_admin_settings', (ctx) => adminProfileHandler.renderFieldAdminProfile(ctx, true));
  bot.callbackQuery(/^action:edit_admin:(.+)$/, async (ctx) => {
    if (ctx.match?.[1]) await adminProfileHandler.handleStartEdit(ctx, ctx.match[1] as AdminFieldKey);
  });

  // --- Flow 00.5 Admin Assignment ---
  bot.callbackQuery('action:settings:admin_assignments', (ctx) => adminAssignmentHandler.renderAdminAssignmentsHub(ctx, true));
  bot.callbackQuery(/^action:admin_assign:user:(\d+)$/, async (ctx) => {
    if (ctx.match?.[1]) await adminAssignmentHandler.renderUserAssignmentCard(ctx, BigInt(ctx.match[1]), true);
  });
  bot.callbackQuery(/^action:admin_assign:set:(\d+):(.+)$/, async (ctx) => {
    if (ctx.match?.[1] && ctx.match?.[2]) {
      await adminAssignmentHandler.handleSetUserSiteAssignment(ctx, BigInt(ctx.match[1]), ctx.match[2]);
    }
  });

  // --- Flow 00.6 Ghost Mode ---
  bot.callbackQuery('action:settings:ghost_mode', (ctx) => ghostModeHandler.renderGhostModeMenu(ctx));
  bot.command(['exit_ghost', 'exit_impersonate'], (ctx) => ghostModeHandler.handleExitImpersonate(ctx));
  bot.callbackQuery('action:exit_impersonate', (ctx) => ghostModeHandler.handleExitImpersonate(ctx));
  bot.callbackQuery(/^action:impersonate:(.+)$/, async (ctx) => {
    if (ctx.match?.[1]) await ghostModeHandler.handleImpersonateRole(ctx, ctx.match[1]);
  });

  // --- Flow 00.7 Audit Incident Vault ---
  bot.callbackQuery('action:settings:audit_vault', (ctx) => auditVaultHandler.renderAuditVaultHub(ctx, true));
  bot.callbackQuery('action:audit:journey_prompt', (ctx) => auditVaultHandler.handlePromptJourney(ctx));
  bot.callbackQuery(/^action:audit:unresolved:page:(\d+)$/, async (ctx) => {
    if (ctx.match?.[1]) await auditVaultHandler.renderUnresolvedErrorsList(ctx, parseInt(ctx.match[1], 10), true);
  });
  bot.callbackQuery(/^action:audit:error_view:(.+)$/, async (ctx) => {
    if (ctx.match?.[1]) await auditVaultHandler.renderErrorDetail(ctx, ctx.match[1], true);
  });
  bot.callbackQuery(/^action:audit:resolve:(.+)$/, async (ctx) => {
    if (ctx.match?.[1]) await auditVaultHandler.handleResolveError(ctx, ctx.match[1]);
  });
  bot.callbackQuery('action:audit:purge_prompt', (ctx) => auditVaultHandler.handlePromptPurge(ctx));
  bot.callbackQuery('action:audit:purge_confirm', (ctx) => auditVaultHandler.handleConfirmPurge(ctx));

  // --- Flow 00.8 APM Telemetry ---
  bot.callbackQuery('action:settings:apm_dashboard', (ctx) => apmHandler.renderApmDashboard(ctx, true));
  bot.callbackQuery('action:apm:slow_ops', (ctx) => apmHandler.renderSlowOperations(ctx, true));
  bot.callbackQuery('action:apm:health_check', (ctx) => apmHandler.renderServicesHealth(ctx, true));
  bot.callbackQuery('action:apm:alert_policy', (ctx) => apmHandler.renderAlertPolicy(ctx, true));
  bot.callbackQuery(/^action:apm:set_policy:(.+)$/, async (ctx) => {
    if (ctx.match?.[1]) await apmHandler.handleSetAlertPolicy(ctx, ctx.match[1]);
  });

  // --- Flow 00.9 Emergency Cache ---
  bot.callbackQuery('action:settings:emergency_cache', (ctx) => emergencyCacheHandler.renderEmergencyCacheHub(ctx, true));
  bot.callbackQuery('action:emergency:confirm_maintenance_prompt', (ctx) => emergencyCacheHandler.handlePromptConfirmMaintenance(ctx));
  bot.callbackQuery('action:emergency:toggle_maintenance', (ctx) => emergencyCacheHandler.handleToggleMaintenance(ctx));
  bot.callbackQuery('action:emergency:prewarm', (ctx) => emergencyCacheHandler.handlePrewarm(ctx));

  // Text input multiplexer
  const handleTextInput = async (ctx: SettingsModuleContext): Promise<boolean> => {
    if (await corporateHandler.handleTextInput(ctx)) return true;
    if (await sitesHandler.handleTextInput(ctx)) return true;
    if (await adminProfileHandler.handleTextInput(ctx)) return true;
    if (await auditVaultHandler.handleJourneyInput(ctx)) return true;
    return false;
  };

  const handleLocationInput = async (ctx: SettingsModuleContext): Promise<boolean> => {
    if (await sitesHandler.handleLocationInput(ctx)) return true;
    return false;
  };

  return {
    corporateHandler,
    sitesHandler,
    jobMatrixHandler,
    adminProfileHandler,
    adminAssignmentHandler,
    ghostModeHandler,
    auditVaultHandler,
    apmHandler,
    emergencyCacheHandler,
    handleTextInput,
    handleLocationInput,
  };
}
