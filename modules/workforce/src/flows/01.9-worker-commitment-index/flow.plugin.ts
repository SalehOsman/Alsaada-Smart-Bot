import type { FlowPlugin } from '@alsaada/core-components';
import type { UserRole, WorkforceModuleContext } from '../../shared/module.types.js';
import { WorkerCommitmentHandler } from './flow.handler.js';
import { WorkerCommitmentService } from './flow.service.js';
import { WorkerCommitmentRepository } from './flow.repository.js';
import type { PrismaClient } from '@alsaada/database';

export function createWorkerCommitmentPlugin(
  prismaOrHandler: PrismaClient | WorkerCommitmentHandler
): FlowPlugin<WorkforceModuleContext, UserRole> {
  let handler: WorkerCommitmentHandler;

  if ('registerRoutes' in prismaOrHandler) {
    handler = prismaOrHandler;
  } else {
    const repo = new WorkerCommitmentRepository(prismaOrHandler);
    const service = new WorkerCommitmentService(repo);
    handler = new WorkerCommitmentHandler(service);
  }

  const allowedRoles: UserRole[] = [
    'SUPER_ADMIN',
    'GENERAL_ADMIN',
    'FIELD_ADMIN',
    'ACCOUNTANT',
    'EXECUTIVE',
    'WORKER',
  ];

  return {
    flowKey: '01.9',
    flowSlug: 'worker-commitment-index',
    titleArabic: 'مؤشر التزام وموثوقية العمال الشامل',
    module: 'workforce',
    contract: {
      flowCode: '01.9',
      flowName: 'مؤشر التزام وموثوقية العمال الشامل (NEW-80)',
      module: 'workforce',
      status: 'Implemented',
      allowedRoles,
      menuButton: {
        label: '⭐ مؤشر التزام العمال',
        callbackData: 'menu:wcs:main',
        subSection: 'onboarding',
        order: 6,
      },
    },
    allowedRoles,
    menuButton: {
      label: '⭐ مؤشر التزام العمال',
      callbackData: 'menu:wcs:main',
      subSection: 'onboarding',
      order: 6,
    },
    registerRoutes: (bot) => {
      handler.registerRoutes(bot);
    },
    handleTextInput: async (ctx, text) => {
      return handler.handleTextInput(ctx, text);
    },
  };
}
