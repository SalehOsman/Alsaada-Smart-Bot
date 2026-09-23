/**
 * Flow Registry for Module: sandbox
 * Provides metadata and dynamic keyboard registration for all active flows.
 */

export interface SandboxFlowDescriptor {
  id: string;
  flowCode: string;
  titleArabic: string;
  buttonLabel: string;
  callbackData: string;
  descriptionArabic?: string;
}

export const SANDBOX_REGISTERED_FLOWS: SandboxFlowDescriptor[] = [
  {
    id: '99.1',
    flowCode: '99.1',
    titleArabic: 'فحص النبض والاستجابة',
    buttonLabel: '⚡ فحص النبض',
    callbackData: 'action:sandbox:flow:ping',
  },
  {
    id: '99.2',
    flowCode: '99.2',
    titleArabic: 'العمليات الحسابية والقناع المالي',
    buttonLabel: '🧮 الحساب والقناع',
    callbackData: 'action:sandbox:flow:calc',
  },
];

export const SANDBOX_FLOWS = SANDBOX_REGISTERED_FLOWS;
export type RegisteredFlowItem = SandboxFlowDescriptor;
