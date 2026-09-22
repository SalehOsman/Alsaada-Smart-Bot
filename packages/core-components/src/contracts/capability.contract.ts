/**
 * Service Capability Contract & Cross-Module Dependency Registry
 * 
 * Formalizes capability declaration and boot-time dependency resolution.
 */

import { asCapabilityId, type CapabilityId, type ModuleId } from './typesafe-primitives.contract.js';

export interface ServiceCapability {
  id: CapabilityId;
  version: string;
  titleArabic: string;
  description: string;
  provider: 'core' | ModuleId;
  dependencies?: CapabilityId[];
}

export const CORE_CAPABILITIES: readonly ServiceCapability[] = [
  {
    id: asCapabilityId('storage:attachment'),
    version: '1.0.0',
    titleArabic: 'خدمة المرفقات السحابية والملفات',
    description: 'Multi-part S3/Local attachment upload and MIME validation',
    provider: 'core',
  },
  {
    id: asCapabilityId('ledger:double-entry'),
    version: '1.0.0',
    titleArabic: 'سجل القيد المزدوج المالي المحكم',
    description: 'Double-entry accounting journal and closed-loop transactions',
    provider: 'core',
  },
  {
    id: asCapabilityId('ledger:hash-chain'),
    version: '1.0.0',
    titleArabic: 'سلسلة البصمات المشفرة لمنع التلاعب',
    description: 'Cryptographic SHA-256 rolling hash chain audit ledger',
    provider: 'core',
  },
  {
    id: asCapabilityId('rbac:cascading'),
    version: '1.0.0',
    titleArabic: 'منظومة الصلاحيات المتتالية والأدوار الـ 17',
    description: 'Role-based and site-scoped cascading access control',
    provider: 'core',
  },
  {
    id: asCapabilityId('telemetry:error-vault'),
    version: '1.0.0',
    titleArabic: 'خزينة الأخطاء الجنائية ومراقبة الأداء',
    description: 'Zero console.error telemetry, APM traces, and forensic error logs',
    provider: 'core',
  },
  {
    id: asCapabilityId('cache:fast-memory'),
    version: '1.0.0',
    titleArabic: 'الذاكرة المؤقتة السريعة فائقة الاستجابة',
    description: 'L1 In-memory cache with sub-300ms SLA and Redis 7 synchronization',
    provider: 'core',
  },
  {
    id: asCapabilityId('outbox:transactional'),
    version: '1.0.0',
    titleArabic: 'طابور المعاملات غير المتزامنة الآمن',
    description: 'Transactional outbox queue with exponential backoff and dead-letter queue',
    provider: 'core',
  },
  {
    id: asCapabilityId('regional:egyptian-national-id'),
    version: '1.0.0',
    titleArabic: 'محرك التحقق من الرقم القومي المصري',
    description: 'Egyptian 14-digit National ID validation, DOB extraction, and governorate lookup',
    provider: 'core',
  },
  {
    id: asCapabilityId('regional:governorates'),
    version: '1.0.0',
    titleArabic: 'محرك المحافظات والترميز الإقليمي',
    description: 'Egyptian governorate directory, phone validation, and Arabic normalization',
    provider: 'core',
  },
  {
    id: asCapabilityId('typesafe:system-one-router'),
    version: '1.0.0',
    titleArabic: 'محرك التوجيه الذكي فائق السرعة',
    description: 'TypeSafe Jev-1.13 System One fast cognitive routing and skill suggestion',
    provider: 'core',
  },
] as const;

export interface CapabilityValidationResult {
  valid: boolean;
  missing: CapabilityId[];
  satisfied: CapabilityId[];
}

export function validateModuleCapabilities(
  required: readonly CapabilityId[],
  available: readonly CapabilityId[] = CORE_CAPABILITIES.map((c) => c.id)
): CapabilityValidationResult {
  const availableSet = new Set(available);
  const missing: CapabilityId[] = [];
  const satisfied: CapabilityId[] = [];

  for (const req of required) {
    if (availableSet.has(req)) {
      satisfied.push(req);
    } else {
      missing.push(req);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    satisfied,
  };
}
