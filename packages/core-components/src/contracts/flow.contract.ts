import type { Bot, Context } from 'grammy';

export interface FlowMenuButton {
  label: string;
  callbackData: string;
  subSection: 'onboarding' | 'worker_excel' | 'advances' | 'leaves' | 'payroll' | 'admin_affairs' | string;
  order: number;
  requiresSuperAdmin?: boolean | undefined;
}

export type FlowContractStatus = 'Draft' | 'Implemented' | 'Locked' | 'UAT_PASS';

export interface FlowContractMetadata<Role extends string = string> {
  flowCode: string;
  flowName: string;
  module: string;
  status: FlowContractStatus;
  allowedRoles: Role[];
  menuButton?: FlowMenuButton | undefined;
}

export interface FlowPlugin<C extends Context = Context, Role extends string = string> {
  flowKey: string;
  flowSlug: string;
  titleArabic: string;
  module: string;
  contract: FlowContractMetadata<Role>;
  allowedRoles?: Role[] | undefined;
  menuButton?: FlowMenuButton | undefined;
  registerRoutes: (bot: Bot<C>) => void;
  handleTextInput?: (ctx: C, text: string) => Promise<boolean>;
  handlePhotoInput?: (ctx: C, fileId: string) => Promise<boolean>;
  handleDocumentInput?: (ctx: C, doc: NonNullable<NonNullable<Context['message']>['document']>) => Promise<boolean>;
}
