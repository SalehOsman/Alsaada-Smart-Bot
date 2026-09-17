import type { Bot } from 'grammy';
import type { WorkforceModuleContext } from './shared/module.types.js';
import { WorkerExportHandler } from './flows/01.4-worker-export/flow.handler.js';
import { WorkerExportService } from './flows/01.4-worker-export/flow.service.js';
import { WorkerExportRepository } from './flows/01.4-worker-export/flow.repository.js';
import { WorkerRegistrationHandler } from './flows/01.1-worker-registration/flow.handler.js';
import { WorkerRegistrationService, RedisWorkerWizardStateStore } from './flows/01.1-worker-registration/flow.service.js';
import { WorkerRegistrationRepository } from './flows/01.1-worker-registration/flow.repository.js';
import { WorkerDirectoryHandler } from './flows/01.5-worker-directory/flow.handler.js';
import { WorkerDirectoryService } from './flows/01.5-worker-directory/flow.service.js';
import { WorkerDirectoryRepository } from './flows/01.5-worker-directory/flow.repository.js';
import { WorkerDocumentsHandler } from './flows/01.5-worker-directory/flow.documents-handler.js';
import { WorkerEditHandler } from './flows/01.2.D-worker-edit/flow.handler.js';
import { WorkerEditService } from './flows/01.2.D-worker-edit/flow.service.js';
import { WorkerEditRepository } from './flows/01.2.D-worker-edit/flow.repository.js';
import { WorkerSelfEditHandler } from './flows/01.6-worker-self-edit/flow.handler.js';
import { WorkerSelfEditService } from './flows/01.6-worker-self-edit/flow.service.js';
import { WorkerSelfEditRepository } from './flows/01.6-worker-self-edit/flow.repository.js';
import { GuestJoinHandler } from './flows/01.7-guest-join-and-linking/flow.handler.js';
import { GuestJoinService } from './flows/01.7-guest-join-and-linking/flow.service.js';
import { GuestJoinRepository } from './flows/01.7-guest-join-and-linking/flow.repository.js';
import { WorkerOffboardingHandler } from './flows/01.8-worker-offboarding/flow.handler.js';
import { WorkerOffboardingService } from './flows/01.8-worker-offboarding/flow.service.js';
import { WorkerOffboardingRepository } from './flows/01.8-worker-offboarding/flow.repository.js';
import { WorkerCommitmentRepository } from './flows/01.9-worker-commitment-index/flow.repository.js';
import { WorkerCommitmentService } from './flows/01.9-worker-commitment-index/flow.service.js';
import { WorkerCommitmentHandler } from './flows/01.9-worker-commitment-index/flow.handler.js';
import { PrismaClient } from '@alsaada/database';
import { buildWorkforceFlowPlugins } from './flows.manifest.js';

export function registerWorkforceRoutes(
  bot: Bot<WorkforceModuleContext>,
  prisma: PrismaClient,
  encryptionKey?: string,
  onWorkerDemoted?: (demotedTelegramId: bigint) => Promise<void>,
  redis?: any
) {
  const exportRepo = new WorkerExportRepository(prisma);
  const exportService = new WorkerExportService(exportRepo, encryptionKey);
  const exportHandler = new WorkerExportHandler(exportService);

  const regRepo = new WorkerRegistrationRepository(prisma);
  const stateStore = redis ? new RedisWorkerWizardStateStore(redis) : undefined;
  const regService = new WorkerRegistrationService(regRepo, stateStore, encryptionKey);
  const regHandler = new WorkerRegistrationHandler(regService, regRepo);

  const dirRepo = new WorkerDirectoryRepository(prisma);
  const dirService = new WorkerDirectoryService(dirRepo, encryptionKey);
  const docsHandler = new WorkerDocumentsHandler(dirService, dirRepo);
  const dirHandler = new WorkerDirectoryHandler(dirService, dirRepo, docsHandler);

  const editRepo = new WorkerEditRepository(prisma);
  const editService = new WorkerEditService(editRepo, encryptionKey);
  const editHandler = new WorkerEditHandler(editService, editRepo);

  const selfEditRepo = new WorkerSelfEditRepository(prisma);
  const selfEditService = new WorkerSelfEditService(selfEditRepo, encryptionKey);
  const selfEditHandler = new WorkerSelfEditHandler(selfEditService);

  const guestJoinRepo = new GuestJoinRepository(prisma);
  const guestJoinService = new GuestJoinService(guestJoinRepo, encryptionKey);
  const guestJoinHandler = new GuestJoinHandler(guestJoinService);

  const offboardRepo = new WorkerOffboardingRepository(prisma);
  const offboardService = new WorkerOffboardingService(offboardRepo, onWorkerDemoted);
  const offboardHandler = new WorkerOffboardingHandler(offboardService);

  const wcsRepo = new WorkerCommitmentRepository(prisma);
  const wcsService = new WorkerCommitmentService(wcsRepo);
  const wcsHandler = new WorkerCommitmentHandler(wcsService);

  // Instantiate flow plugins dynamically
  const plugins = buildWorkforceFlowPlugins({
    exportHandler,
    exportService,
    regHandler,
    regService,
    dirHandler,
    docsHandler,
    dirService,
    editHandler,
    editService,
    selfEditHandler,
    guestJoinHandler,
    offboardHandler,
    wcsHandler,
  });

  // 1. Register all callback and custom routes for each plugin
  for (const plugin of plugins) {
    plugin.registerRoutes(bot);
  }

  return {
    exportHandler,
    regHandler,
    dirHandler,
    docsHandler,
    editHandler,
    selfEditHandler,
    guestJoinHandler,
    offboardHandler,
    guestJoinService,
    guestJoinRepo,
    selfEditService,
    offboardService,
    plugins,
  };
}
