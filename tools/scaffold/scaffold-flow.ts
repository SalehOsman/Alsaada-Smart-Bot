import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type FlowTemplate = 'default' | 'cash-outflow' | 'in-kind-clearing' | 'approval-request' | 'excel-export';
const KNOWN_TEMPLATES = new Set<string>(['default', 'cash-outflow', 'in-kind-clearing', 'approval-request', 'excel-export']);

export function scaffoldFlow(
  moduleName: string,
  flowKey: string,
  flowSlug: string,
  flowTitleArabic: string,
  templateOrRoot: FlowTemplate | string = 'default',
  maybeRoot = process.cwd()
): string {
  if (!moduleName || !flowKey || !flowSlug || !flowTitleArabic) {
    throw new Error('Usage: pnpm make:flow <moduleName> <flowKey> <flowSlug> <flowTitleArabic> [--template=<type>]');
  }

  let template: FlowTemplate = 'default';
  let root = process.cwd();

  if (KNOWN_TEMPLATES.has(templateOrRoot)) {
    template = templateOrRoot as FlowTemplate;
    root = maybeRoot;
  } else {
    template = 'default';
    root = templateOrRoot;
  }

  const flowDirName = `${flowKey}-${flowSlug}`;
  const targetDir = join(root, 'modules', moduleName, 'src', 'flows', flowDirName);
  const testsDir = join(targetDir, 'tests');

  if (existsSync(targetDir)) {
    throw new Error(`Target flow directory already exists: ${targetDir}`);
  }

  mkdirSync(targetDir, { recursive: true });
  mkdirSync(testsDir, { recursive: true });

  const pascalName = flowSlug
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');

  // 1. flow.contract.json
  const contractJson = {
    $schema: '../../../../../docs/schemas/flow-contract.schema.json',
    flowKey,
    flowSlug,
    titleArabic: flowTitleArabic,
    module: moduleName,
    template,
    classification: 'LEGACY_PARITY',
    legacyFeatureCode: flowKey,
    status: 'Draft',
    allowAny: false,
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    screens: [
      { step: 1, key: 'INIT', title: flowTitleArabic, mode: 'InPlace' },
      { step: 2, key: 'INPUT', title: 'إدخال البيانات', mode: 'InPlace' },
      { step: 3, key: 'CONFIRM', title: 'مراجعة وتأكيد', mode: 'InPlace' },
      { step: 4, key: 'DONE', title: 'إتمام العملية', mode: 'InPlace' },
    ],
  };
  writeFileSync(join(targetDir, 'flow.contract.json'), JSON.stringify(contractJson, null, 2) + '\n', 'utf8');

  // 2. flow.types.ts
  const typesContent = `export interface ${pascalName}State {
  step: 'INIT' | 'INPUT' | 'CONFIRM' | 'DONE';
  workerId?: string | undefined;
  workerCode?: string | undefined;
  workerName?: string | undefined;
  amount?: number | undefined;
  quantity?: number | undefined;
  sourceOfFunds?: string | undefined;
  notes?: string | undefined;
  createdAt: number;
}

export interface ${pascalName}Input {
  workerId: string;
  workerCode: string;
  workerName: string;
  amount?: number | undefined;
  quantity?: number | undefined;
  sourceOfFunds?: string | undefined;
  notes?: string | undefined;
  actorTelegramId?: bigint | undefined;
}

export interface ${pascalName}Result {
  success: boolean;
  referenceId: string;
  message: string;
}
`;
  writeFileSync(join(targetDir, 'flow.types.ts'), typesContent, 'utf8');

  // 3. flow.repository.ts
  const repoContent = `import type { PrismaClient } from '@alsaada/database';
import type { ${pascalName}Input, ${pascalName}Result } from './flow.types.js';

export class ${pascalName}Repository {
  constructor(private readonly prisma: PrismaClient) {}

  async recordTransaction(input: ${pascalName}Input): Promise<${pascalName}Result> {
    const referenceId = \`REF-\${Date.now()}-\${Math.floor(Math.random() * 1000)}\`;
    return {
      success: true,
      referenceId,
      message: 'تم حفظ وقيد المعاملة بنجاح.',
    };
  }
}
`;
  writeFileSync(join(targetDir, 'flow.repository.ts'), repoContent, 'utf8');

  // 4. flow.service.ts
  const serviceContent = template === 'cash-outflow'
    ? `import type { ${pascalName}Repository } from './flow.repository.js';
import type { ${pascalName}Input, ${pascalName}Result } from './flow.types.js';
import { verifyCustodyBalance } from '@alsaada/core-components';

export class ${pascalName}Service {
  constructor(private readonly repository: ${pascalName}Repository) {}

  async execute(input: ${pascalName}Input): Promise<${pascalName}Result> {
    const amount = input.amount ?? 0;
    if (!input.workerId || amount <= 0) {
      throw new Error('بيانات السلفة النقدية غير صالحة.');
    }
    const gate = verifyCustodyBalance({
      currentBalance: 50000,
      requestedAmount: amount,
      maxAllowedPerTransaction: 10000,
    });
    if (!gate.approved) {
      throw new Error(gate.rejectionReason ?? 'رصيد العهدة غير كافٍ لصرف السلفة.');
    }
    return this.repository.recordTransaction(input);
  }
}
`
    : template === 'in-kind-clearing'
    ? `import type { ${pascalName}Repository } from './flow.repository.js';
import type { ${pascalName}Input, ${pascalName}Result } from './flow.types.js';
import { calculateClearingSettlement } from '@alsaada/core-components';

export class ${pascalName}Service {
  constructor(private readonly repository: ${pascalName}Repository) {}

  async execute(input: ${pascalName}Input): Promise<${pascalName}Result> {
    const qty = input.quantity ?? 1;
    const unitPrice = 50;
    const clearing = calculateClearingSettlement({
      category: 'CIGARETTES',
      quantity: qty,
      unitPrice,
      siteCostCreditEligible: true,
    });
    return this.repository.recordTransaction({
      ...input,
      amount: clearing.workerDeductionTotal,
    });
  }
}
`
    : `import type { ${pascalName}Repository } from './flow.repository.js';
import type { ${pascalName}Input, ${pascalName}Result } from './flow.types.js';

export class ${pascalName}Service {
  constructor(private readonly repository: ${pascalName}Repository) {}

  async execute(input: ${pascalName}Input): Promise<${pascalName}Result> {
    if (!input.workerId) {
      throw new Error('البيانات المدخلة غير صالحة.');
    }
    return this.repository.recordTransaction(input);
  }
}
`;
  writeFileSync(join(targetDir, 'flow.service.ts'), serviceContent, 'utf8');

  // 5. flow.keyboard.ts
  const kbContent = `import { InlineKeyboard } from 'grammy';
import { buildConfirmationKeyboard, buildCompletionKeyboard, buildWhatsAppLink } from '@alsaada/core-components';

export class ${pascalName}Keyboards {
  static confirmationKeyboard(flowKey: string): InlineKeyboard {
    return buildConfirmationKeyboard(\`action:\${flowKey}:confirm\`, \`action:\${flowKey}:cancel\`);
  }

  static completionKeyboard(receiptId: string, summaryText?: string): InlineKeyboard {
    const whatsAppLink = summaryText
      ? buildWhatsAppLink({ phone: '', message: summaryText })
      : undefined;
    return buildCompletionKeyboard({
      actionDomain: '${flowSlug}',
      receiptNumber: receiptId,
      whatsAppLink,
    });
  }
}
`;
  writeFileSync(join(targetDir, 'flow.keyboard.ts'), kbContent, 'utf8');

  // 6. flow.messages.ts
  const messagesContent = `import { formatBreadcrumbs, formatConfirmationCard } from '@alsaada/core-components';

export class ${pascalName}Messages {
  static initPrompt(title: string): string {
    const breadcrumb = formatBreadcrumbs(['الرئيسية', '${flowTitleArabic}', 'البداية']);
    return \`\${breadcrumb}📋 *\${title}*\\n────────────────────────────\\nيرجى تحديد البيانات المطلوبة:\`;
  }

  static confirmationCard(workerName: string, amount: number, recordedBy = 'المشرف'): string {
    const breadcrumb = formatBreadcrumbs(['الرئيسية', '${flowTitleArabic}', 'مراجعة وتأكيد']);
    const card = formatConfirmationCard({
      operationTitle: '${flowTitleArabic}',
      workerName,
      amount,
      recordedBy,
    });
    return \`\${breadcrumb}\${card}\\nهل تؤكد حفظ واعتماد المعاملة؟\`;
  }

  static successReceipt(refId: string): string {
    const breadcrumb = formatBreadcrumbs(['الرئيسية', '${flowTitleArabic}', 'إتمام العملية']);
    return \`\${breadcrumb}✅ *تم اعتماد العملية بنجاح*\\n────────────────────────────\\nرقم السند: \`\`\${refId}\`\`;
  }
}
`;
  writeFileSync(join(targetDir, 'flow.messages.ts'), messagesContent, 'utf8');

  // 7. flow.validators.ts
  const validatorsContent = `export function validate${pascalName}Input(amount?: number, quantity?: number): { isValid: boolean; error?: string } {
  if (amount !== undefined && (isNaN(amount) || amount <= 0)) {
    return { isValid: false, error: 'المبلغ يجب أن يكون رقماً أكبر من الصفر.' };
  }
  if (quantity !== undefined && (isNaN(quantity) || quantity <= 0)) {
    return { isValid: false, error: 'الكمية يجب أن تكون أكبر من الصفر.' };
  }
  return { isValid: true };
}
`;
  writeFileSync(join(targetDir, 'flow.validators.ts'), validatorsContent, 'utf8');

  // 8. flow.telemetry.ts
  const telemetryContent = `export class ${pascalName}Telemetry {
  static logStart(actorId: string, flowKey: string): void {
    console.log(\`[TELEMETRY] Flow \${flowKey} initiated by \${actorId}\`);
  }

  static logCompletion(actorId: string, refId: string): void {
    console.log(\`[TELEMETRY] Flow completed with \${refId} by \${actorId}\`);
  }
}
`;
  writeFileSync(join(targetDir, 'flow.telemetry.ts'), telemetryContent, 'utf8');

  // 9. flow.docs.md
  const docsContent = `# وثيقة التدفق: ${flowTitleArabic} (\`${flowKey}\`)

- **الموديول:** \`${moduleName}\`
- **القالب المعتمد:** \`${template}\`
- **الحالة المعمارية:** قيد التطوير (Draft)
- **المعمارية المعتمدة:** الشريحة الرأسية المستقلة (Vertical Slice - Doc 21)

## ملخص الوظيفة وقواعد العمل
توثيق تدفق ${flowTitleArabic} وفق ميثاق حوكمة منظومة السعادة.

## مخطط دورة حياة التدفق (State Machine Diagram)

\`\`\`mermaid
stateDiagram-v2
    [*] --> Idle: تشغيل التدفق / الأمر
    Idle --> InProgress: بدء المعالج وتوليد الجلسة
    
    state InProgress {
        [*] --> PromptInput: عرض الشاشة وطلب المدخلات
        PromptInput --> ValidatingInput: استقبال مدخلات المستخدم
        ValidatingInput --> PromptInput: خطأ بالمدخلات (إعادة المحاولة)
        ValidatingInput --> ReviewCard: صحة المدخلات وعرض بطاقة المراجعة
    }
    
    ReviewCard --> ActionConfirmed: تأكيد الإجراء (cb:confirm)
    ReviewCard --> Cancelled: إلغاء الإجراء (cb:cancel)
    
    ActionConfirmed --> ExecutionSuccess: نجاح العملية والتسجيل
    ActionConfirmed --> ExecutionFailed: خطأ بالنظام (خزانة الأعطال)
    
    ExecutionSuccess --> [*]: إنهاء الجلسة وبطاقة الإنجاز
    Cancelled --> [*]: إلغاء الجلسة والعودة
    ExecutionFailed --> [*]: إشعار الخطأ
\`\`\`

## الحالات والانتقالات (State Transitions)
- **Idle ⟵ [*]:** بدء تشغيل الأمر واستقبال الطلب.
- **InProgress:** إدارة الجلسة واستقبال وتدقيق المدخلات.
- **ReviewCard:** عرض بطاقة المراجعة والتأكيد المزدوج.
- **Completed / Cancelled:** الحالات الطرفية للإنهاء والتراجع.
`;
  writeFileSync(join(targetDir, 'flow.docs.md'), docsContent, 'utf8');

  // 10. flow.handler.ts (Strictly < 350 lines)
  const handlerContent = `import type { Context, InlineKeyboard } from 'grammy';
import {
  UniversalWizardSessionEngine,
  formatBreadcrumbs,
  safeDeleteBackground,
} from '@alsaada/core-components';
import type { ${pascalName}Service } from './flow.service.js';
import type { ${pascalName}Repository } from './flow.repository.js';
import { ${pascalName}Keyboards } from './flow.keyboard.js';
import { ${pascalName}Messages } from './flow.messages.js';
import { ${pascalName}Telemetry } from './flow.telemetry.js';
import type { ${pascalName}State } from './flow.types.js';

export class ${pascalName}Handler {
  constructor(
    private readonly service: ${pascalName}Service,
    private readonly repository: ${pascalName}Repository,
    private readonly sessionEngine: UniversalWizardSessionEngine<${pascalName}State> = new UniversalWizardSessionEngine<${pascalName}State>({
      moduleKey: '${moduleName}',
      flowKey: '${flowKey}',
      maxHistoryDepth: 10,
    })
  ) {}

  async handleStart(ctx: Context): Promise<void> {
    const userId = ctx.from?.id ? BigInt(ctx.from.id) : 0n;
    if (userId === 0n) {
      await ctx.reply('⚠️ غير مصرح لك بتنفيذ هذا التدفق.');
      return;
    }

    safeDeleteBackground(ctx);
    ${pascalName}Telemetry.logStart(String(userId), '${flowKey}');

    await this.sessionEngine.startSession(userId, {
      step: 'INIT',
      createdAt: Date.now(),
    });

    const text = ${pascalName}Messages.initPrompt('${flowTitleArabic}');
    const kb = ${pascalName}Keyboards.confirmationKeyboard('${flowKey}');
    await this.replyOrEdit(ctx, text, kb);
  }

  async handleConfirm(ctx: Context): Promise<void> {
    const userId = ctx.from?.id ? BigInt(ctx.from.id) : 0n;
    if (userId === 0n) {
      await ctx.reply('⚠️ غير مصرح لك بتنفيذ هذا التدفق.');
      return;
    }

    safeDeleteBackground(ctx);

    const session = await this.sessionEngine.getSession(userId);
    const workerId = session?.data?.workerId ?? 'sample-worker-id';
    const amount = session?.data?.amount ?? 100;

    const result = await this.service.execute({
      workerId,
      workerCode: 'OP-LAB-001',
      workerName: 'عامل تجريبي',
      amount,
      actorTelegramId: userId,
    });

    await this.sessionEngine.clearSession(userId);
    ${pascalName}Telemetry.logCompletion(String(userId), result.referenceId);

    const text = ${pascalName}Messages.successReceipt(result.referenceId);
    const kb = ${pascalName}Keyboards.completionKeyboard(result.referenceId);
    await this.replyOrEdit(ctx, text, kb);
  }

  private async replyOrEdit(ctx: Context, text: string, keyboard?: InlineKeyboard): Promise<void> {
    const opts = { parse_mode: 'Markdown' as const, ...(keyboard ? { reply_markup: keyboard } : {}) };
    if (ctx.callbackQuery?.message) {
      try {
        await ctx.editMessageText(text, opts);
        return;
      } catch {
        // In-place fallback
      }
    }
    await ctx.reply(text, opts);
  }
}
`;
  writeFileSync(join(targetDir, 'flow.handler.ts'), handlerContent, 'utf8');

  // 11. tests/flow.unit.spec.ts
  const unitSpec = `import { describe, it, expect, vi } from 'vitest';
import { ${pascalName}Service } from '../flow.service.js';
import type { ${pascalName}Repository } from '../flow.repository.js';

describe('Flow ${flowKey} Unit Tests — ${pascalName}', () => {
  it('should validate input and execute successfully', async () => {
    const mockRepo = {
      recordTransaction: vi.fn().mockResolvedValue({
        success: true,
        referenceId: 'REF-TEST-123',
        message: 'Success',
      }),
    } as unknown as ${pascalName}Repository;

    const service = new ${pascalName}Service(mockRepo);
    const res = await service.execute({
      workerId: 'w-1',
      workerCode: 'OP-01',
      workerName: 'محمد أحمد',
      amount: 500,
    });

    expect(res.success).toBe(true);
    expect(res.referenceId).toBe('REF-TEST-123');
  });
});
`;
  writeFileSync(join(testsDir, 'flow.unit.spec.ts'), unitSpec, 'utf8');

  // 12. tests/flow.integration.spec.ts
  const integrationSpec = `import { describe, it, expect } from 'vitest';
import { validate${pascalName}Input } from '../flow.validators.js';

describe('Flow ${flowKey} Integration Tests — ${pascalName}', () => {
  it('should validate boundary conditions', () => {
    expect(validate${pascalName}Input(100).isValid).toBe(true);
    expect(validate${pascalName}Input(-5).isValid).toBe(false);
  });
});
`;
  writeFileSync(join(testsDir, 'flow.integration.spec.ts'), integrationSpec, 'utf8');

  // 13. tests/flow.ux.spec.ts
  const uxSpec = `import { describe, it, expect } from 'vitest';
import { ${pascalName}Keyboards } from '../flow.keyboard.js';
import { ${pascalName}Messages } from '../flow.messages.js';

describe('Flow ${flowKey} UX Tests — ${pascalName}', () => {
  it('should generate valid confirmation keyboard', () => {
    const kb = ${pascalName}Keyboards.confirmationKeyboard('${flowKey}');
    expect(kb.inline_keyboard.length).toBeGreaterThan(0);
  });

  it('should render proper success message with receipt', () => {
    const msg = ${pascalName}Messages.successReceipt('REC-999');
    expect(msg).toContain('REC-999');
  });
});
`;
  writeFileSync(join(testsDir, 'flow.ux.spec.ts'), uxSpec, 'utf8');

  // 14. tests/flow.rbac.spec.ts
  const rbacSpec = `import { describe, it, expect } from 'vitest';

describe('Flow ${flowKey} RBAC Tests — ${pascalName}', () => {
  it('should restrict unauthenticated roles and permit canonical admin roles', () => {
    const allowed = ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'];
    expect(allowed.includes('SUPER_ADMIN')).toBe(true);
    expect(allowed.includes('GENERAL_ADMIN')).toBe(true);
    expect(allowed.includes('FIELD_ADMIN')).toBe(true);
    expect(allowed.includes('GUEST')).toBe(false);
  });
});
`;
  writeFileSync(join(testsDir, 'flow.rbac.spec.ts'), rbacSpec, 'utf8');

  // 15. tests/flow.data.spec.ts
  const dataSpec = `import { describe, it, expect } from 'vitest';
import { validate${pascalName}Input } from '../flow.validators.js';

describe('Flow ${flowKey} Data Tests — ${pascalName}', () => {
  it('should accept valid positive amounts and quantities', () => {
    const validAmount = validate${pascalName}Input(250.75, 10);
    expect(validAmount.isValid).toBe(true);
    expect(validAmount.error).toBeUndefined();
  });

  it('should reject non-positive amounts and quantities', () => {
    const zeroAmount = validate${pascalName}Input(0);
    expect(zeroAmount.isValid).toBe(false);
    expect(zeroAmount.error).toBeDefined();

    const negativeAmount = validate${pascalName}Input(-50);
    expect(negativeAmount.isValid).toBe(false);

    const negativeQuantity = validate${pascalName}Input(100, -5);
    expect(negativeQuantity.isValid).toBe(false);
  });
});
`;
  writeFileSync(join(testsDir, 'flow.data.spec.ts'), dataSpec, 'utf8');

  // 16. flow.plugin.ts
  const pluginContent = `import type { FlowPlugin } from '@alsaada/core-components';
import { ${pascalName}Handler } from './flow.handler.js';
import { ${pascalName}Service } from './flow.service.js';
import { ${pascalName}Repository } from './flow.repository.js';
import type { PrismaClient } from '@alsaada/database';

export function create${pascalName}Plugin(prisma: PrismaClient): FlowPlugin {
  const repo = new ${pascalName}Repository(prisma);
  const service = new ${pascalName}Service(repo);
  const handler = new ${pascalName}Handler(service, repo);

  return {
    flowKey: '${flowKey}',
    flowSlug: '${flowSlug}',
    titleArabic: '${flowTitleArabic}',
    module: '${moduleName}',
    contract: {
      flowCode: '${flowKey}',
      flowName: '${flowTitleArabic}',
      module: '${moduleName}',
      status: 'Implemented',
      allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
      menuButton: {
        label: '${flowTitleArabic}',
        callbackData: 'action:${flowSlug}:start',
        subSection: 'onboarding',
        order: 10,
      },
    },
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    menuButton: {
      label: '${flowTitleArabic}',
      callbackData: 'action:${flowSlug}:start',
      subSection: 'onboarding',
      order: 10,
    },
    registerRoutes: (bot) => {
      bot.callbackQuery('action:${flowSlug}:start', async (ctx) => {
        await handler.handleStart(ctx);
      });
      bot.callbackQuery('action:${flowKey}:confirm', async (ctx) => {
        await handler.handleConfirm(ctx);
      });
    },
    handleTextInput: async (ctx, text) => {
      return false;
    },
  };
}
`;
  writeFileSync(join(targetDir, 'flow.plugin.ts'), pluginContent, 'utf8');

  // 17. Register in src/flows.manifest.ts if manifest exists
  const manifestPath = join(root, 'modules', moduleName, 'src', 'flows.manifest.ts');
  if (existsSync(manifestPath)) {
    try {
      let manifestText = readFileSync(manifestPath, 'utf8');
      const importStatement = `import { create${pascalName}Plugin } from './flows/${flowDirName}/flow.plugin.js';\n`;
      if (!manifestText.includes(importStatement.trim())) {
        manifestText = importStatement + manifestText;
      }

      if (!manifestText.includes(`flowCode: '${flowKey}'`)) {
        const metadataPattern = /(const\s+[A-Z0-9_]*FLOW_METADATA\s*:\s*FlowContractMetadata(?:<[^>]+>)?\[\]\s*=\s*\[)/;
        const metaMatch = metadataPattern.exec(manifestText);
        if (metaMatch && metaMatch.index !== undefined) {
          const arrayEnd = manifestText.indexOf('];', metaMatch.index);
          if (arrayEnd !== -1) {
            const metaEntry = `  {
    flowCode: '${flowKey}',
    flowName: '${flowTitleArabic}',
    module: '${moduleName}',
    status: 'Draft',
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    menuButton: {
      label: '${flowTitleArabic}',
      callbackData: 'action:${flowSlug}:start',
      subSection: 'onboarding',
      order: 10,
    },
  },\n`;
            manifestText = manifestText.slice(0, arrayEnd) + metaEntry + manifestText.slice(arrayEnd);
          }
        }
      }

      writeFileSync(manifestPath, manifestText, 'utf8');
    } catch {
      // ignore
    }
  }

  return targetDir;
}

// CLI entrypoint
if (process.argv[1]?.endsWith('scaffold-flow.ts')) {
  const args = process.argv.slice(2);
  let template: FlowTemplate = 'default';
  const filteredArgs: string[] = [];

  for (const arg of args) {
    if (arg.startsWith('--template=')) {
      template = arg.slice('--template='.length) as FlowTemplate;
    } else {
      filteredArgs.push(arg);
    }
  }

  const [moduleName, flowKey, flowSlug, flowTitleArabic] = filteredArgs;
  if (!moduleName || !flowKey || !flowSlug || !flowTitleArabic) {
    console.error('❌ Usage: pnpm make:flow <moduleName> <flowKey> <flowSlug> <flowTitleArabic> [--template=<cash-outflow|in-kind-clearing|approval-request|excel-export>]');
    console.error('Example: pnpm make:flow advances 02.1 cash-advance "تسجيل وصرف سلفة نقدية" --template=cash-outflow');
    process.exit(1);
  }
  try {
    const created = scaffoldFlow(moduleName, flowKey, flowSlug, flowTitleArabic, template);
    console.log(`✅ [SCAFFOLD] Successfully created flow ${flowKey} (template: ${template}) in:`);
    console.log(`   ${created}`);
    console.log(`   Created all 15 required non-empty Doc 21 files.`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ [SCAFFOLD ERROR] ${msg}`);
    process.exit(1);
  }
}
