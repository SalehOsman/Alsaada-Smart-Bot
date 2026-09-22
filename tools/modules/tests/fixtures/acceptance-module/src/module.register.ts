import type { ModuleDefinitionV2 } from '../../../../../../packages/core-components/src/index.js';

export const MODULE_DEFINITION: ModuleDefinitionV2 = {
  schemaVersion: '2.0.0',
  id: 'sample-domain' as any,
  version: '1.0.0',
  titleArabic: 'نطاق العينة التجريبي للقبول',
  descriptionArabic: 'وحدة تجريبية لاختبار دورة حياة الاعتماد والاكتشاف التلقائي بدون تعديل النواة',
  category: 'operations',
  status: 'active',
  requiredCapabilities: ['storage:attachment' as any],
  providedCapabilities: [],
  flows: [],
  callbackPrefixes: ['action:sample:', 'wizard:sample:'],
};

export function createSampleDomainAppModule(runtime?: unknown) {
  return {
    ...MODULE_DEFINITION,
    runtime,
  };
}
