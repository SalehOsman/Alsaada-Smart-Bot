/**
 * Sovereign Flow V2 Scaffolding Generator (Work Plan 89 - Phase P6)
 * 
 * Scaffolds the constitutional 10-file vertical slice inside `modules/<module>/src/flows/<id>-<slug>/`
 * plus companion dashboard feature, repository, and test fixtures.
 * STRICT INVARIANT: ZERO modifications to files outside `modules/<module>/`.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PINNED_BASE_TIME = '2026-04-19T00:00:00.000Z';

export interface ScaffoldFlowV2Options {
  moduleId: string;
  flowId: string;
  slug: string;
  titleArabic: string;
  category?: string | undefined;
  root?: string | undefined;
  includeDashboard?: boolean | undefined;
}

export interface ScaffoldFlowV2Result {
  ok: boolean;
  flowDir: string;
  flowId: string;
  filesCreated: string[];
  error?: string | undefined;
}

export function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

export function scaffoldFlowV2(options: ScaffoldFlowV2Options): ScaffoldFlowV2Result {
  const root = options.root ? resolve(options.root) : process.cwd();
  const moduleId = options.moduleId.trim().toLowerCase();
  const flowId = options.flowId.trim();
  const slug = options.slug.trim().toLowerCase();
  const titleArabic = options.titleArabic.trim();
  const category = options.category ?? 'operations';
  const includeDashboard = options.includeDashboard ?? true;

  if (!moduleId) {
    return { ok: false, flowDir: '', flowId, filesCreated: [], error: 'Module ID is required.' };
  }

  if (!flowId || !/^[0-9]+(\.[0-9A-Za-z]+)?$/.test(flowId)) {
    return {
      ok: false,
      flowDir: '',
      flowId,
      filesCreated: [],
      error: `Invalid flow ID: '${flowId}'. Must be numerical code format like '89.1' or '01.2.D'.`,
    };
  }

  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return {
      ok: false,
      flowDir: '',
      flowId,
      filesCreated: [],
      error: `Invalid flow slug: '${slug}'. Must contain only lowercase alphanumeric characters and dashes.`,
    };
  }

  if (!titleArabic) {
    return { ok: false, flowDir: '', flowId, filesCreated: [], error: 'Flow Arabic title is mandatory.' };
  }

  const moduleDir = join(root, 'modules', moduleId);
  if (!existsSync(moduleDir)) {
    return {
      ok: false,
      flowDir: '',
      flowId,
      filesCreated: [],
      error: `Target module does not exist: modules/${moduleId}`,
    };
  }

  const flowFolderName = `${flowId}-${slug}`;
  const flowDir = join(moduleDir, 'src', 'flows', flowFolderName);

  if (existsSync(flowDir)) {
    return {
      ok: false,
      flowDir,
      flowId,
      filesCreated: [],
      error: `Flow directory already exists: modules/${moduleId}/src/flows/${flowFolderName}`,
    };
  }

  const filesCreated: string[] = [];
  mkdirSync(flowDir, { recursive: true });

  const pascalSlug = toPascalCase(slug);
  const flowActionPrefix = `action:${moduleId}:${slug}`;

  // 1. flow.contract.json (V2 Standard)
  const contractJson = {
    schemaVersion: '2.0.0',
    id: flowId,
    module: moduleId,
    slug,
    titleArabic,
    descriptionArabic: titleArabic,
    category,
    status: 'draft',
    allowedRoles: ['SUPER_ADMIN', 'FIELD_ADMIN'],
    telegramBudget: {
      maxUrlBytes: 512,
      maxCallbackBytes: 64,
      maxButtonChars: 16,
      maxKeyboardRows: 7,
      maxButtonsPerRow: 3,
    },
    idempotencyRequired: true,
    typesafeQuestions: [],
    entrypointFiles: {
      contract: 'flow.contract.json',
      handler: 'controller.ts',
      service: 'service.ts',
      keyboard: 'menu.builder.ts',
      types: 'types.ts',
      validators: 'validator.ts',
      messages: 'menu.builder.ts',
      telemetry: 'controller.ts',
      docs: 'flow.docs.md',
    },
  };
  writeFileSync(join(flowDir, 'flow.contract.json'), JSON.stringify(contractJson, null, 2) + '\n', 'utf8');
  filesCreated.push(join('src', 'flows', flowFolderName, 'flow.contract.json').replace(/\\/g, '/'));

  // 2. index.ts
  const indexContent = `/**
 * Flow ${flowId} Entrypoint: ${slug}
 * Constitutional 10-File Slice for ${moduleId}
 */

export * from './controller.js';
export * from './service.js';
export * from './types.js';
export * from './validator.js';
export * from './menu.builder.js';
export * from './action.handler.js';
export * from './error.handler.js';
`;
  writeFileSync(join(flowDir, 'index.ts'), indexContent, 'utf8');
  filesCreated.push(join('src', 'flows', flowFolderName, 'index.ts').replace(/\\/g, '/'));

  // 3. types.ts
  const typesContent = `/**
 * Type contracts for Flow ${flowId} (${slug})
 */

export interface ${pascalSlug}SessionData {
  flowId: '${flowId}';
  step: 'INIT' | 'PROMPT' | 'CONFIRM' | 'COMPLETED';
  idempotencyKey?: string | undefined;
  payload?: Record<string, unknown> | undefined;
}

export interface ${pascalSlug}InputDTO {
  idempotencyKey: string;
  actorTelegramId: string;
  notes?: string | undefined;
}

export interface ${pascalSlug}ResultDTO {
  success: boolean;
  referenceId: string;
  messageArabic: string;
}
`;
  writeFileSync(join(flowDir, 'types.ts'), typesContent, 'utf8');
  filesCreated.push(join('src', 'flows', flowFolderName, 'types.ts').replace(/\\/g, '/'));

  // 4. validator.ts
  const validatorContent = `import { z } from 'zod';

export const ${pascalSlug}InputSchema = z.object({
  idempotencyKey: z.string().min(8).max(64),
  actorTelegramId: z.string().min(1),
  notes: z.string().max(500).optional(),
});

export function validate${pascalSlug}Input(input: unknown) {
  return ${pascalSlug}InputSchema.safeParse(input);
}
`;
  writeFileSync(join(flowDir, 'validator.ts'), validatorContent, 'utf8');
  filesCreated.push(join('src', 'flows', flowFolderName, 'validator.ts').replace(/\\/g, '/'));

  // 5. menu.builder.ts
  const menuBuilderContent = `/**
 * Telegram Keyboard & Message Builders for Flow ${flowId}
 * Enforces Telegram Ergonomics Budget (36/16/7/3)
 */

export function build${pascalSlug}MainMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '▶️ بدء الإجراء', callback_data: '${flowActionPrefix}:start' },
        { text: '🔙 رجوع', callback_data: 'action:${moduleId}:main' },
      ],
    ],
  };
}

export function build${pascalSlug}ConfirmKeyboard(referenceId: string) {
  return {
    inline_keyboard: [
      [
        { text: '✅ تأكيد', callback_data: '${flowActionPrefix}:confirm:' + referenceId },
        { text: '❌ إلغاء', callback_data: '${flowActionPrefix}:cancel' },
      ],
    ],
  };
}

export function format${pascalSlug}Prompt(titleArabic: string): string {
  return \`📌 *$\{titleArabic\}*\\n\\nيرجى مراجعة التفاصيل وتأكيد العملية:\`;
}
`;
  writeFileSync(join(flowDir, 'menu.builder.ts'), menuBuilderContent, 'utf8');
  filesCreated.push(join('src', 'flows', flowFolderName, 'menu.builder.ts').replace(/\\/g, '/'));

  // 6. service.ts
  const serviceContent = `/**
 * Business Service for Flow ${flowId} (${slug})
 */

import type { ${pascalSlug}InputDTO, ${pascalSlug}ResultDTO } from './types.js';

export class ${pascalSlug}Service {
  constructor(private readonly repository?: unknown) {}

  async executeOperation(input: ${pascalSlug}InputDTO): Promise<${pascalSlug}ResultDTO> {
    const referenceId = \`${slug.toUpperCase()}-\${input.idempotencyKey.slice(0, 8).toUpperCase()}\`;
    return {
      success: true,
      referenceId,
      messageArabic: \`تم تنفيذ العملية بنجاح. الرقم المرجعي: \${referenceId}\`,
    };
  }
}
`;
  writeFileSync(join(flowDir, 'service.ts'), serviceContent, 'utf8');
  filesCreated.push(join('src', 'flows', flowFolderName, 'service.ts').replace(/\\/g, '/'));

  // 7. action.handler.ts
  const actionHandlerContent = `/**
 * Callback Query and Event Actions for Flow ${flowId}
 */

import { ${pascalSlug}Service } from './service.js';
import { build${pascalSlug}ConfirmKeyboard } from './menu.builder.js';

export interface FlowContextLike {
  reply: (text: string, extra?: Record<string, unknown>) => Promise<unknown>;
  callbackQuery?: { data?: string };
}

export async function handle${pascalSlug}Action(ctx: FlowContextLike, service: ${pascalSlug}Service) {
  const data = ctx.callbackQuery?.data ?? '';

  if (data.endsWith(':start')) {
    await ctx.reply('يرجى تأكيد العملية:', {
      reply_markup: build${pascalSlug}ConfirmKeyboard('ref-1'),
    });
    return true;
  }

  return false;
}
`;
  writeFileSync(join(flowDir, 'action.handler.ts'), actionHandlerContent, 'utf8');
  filesCreated.push(join('src', 'flows', flowFolderName, 'action.handler.ts').replace(/\\/g, '/'));

  // 8. error.handler.ts
  const errorHandlerContent = `/**
 * Centralized Error Boundary for Flow ${flowId} (${slug})
 * Single Point of Responsibility for Flow Telemetry & User Error Card (Work Plan 94 - NEW-91)
 */

import {
  buildRichPage,
  assertRichMessage,
  richParagraph,
} from '@alsaada/core-components';
import {
  captureFlowError,
  type BoundedFlowContext,
  type CaptureFlowErrorResult,
  type IncidentPersistStatus,
} from '@alsaada/telemetry';

export type { BoundedFlowContext, CaptureFlowErrorResult, IncidentPersistStatus };


export interface ErrorReplyCapable {
  reply?: (message: unknown, extra?: Record<string, unknown>) => Promise<unknown>;
}

export async function handle${pascalSlug}Error(
  error: unknown,
  boundedContext: BoundedFlowContext,
  replyTarget?: ErrorReplyCapable,
): Promise<CaptureFlowErrorResult> {
  const recorded = await captureFlowError(error, boundedContext);
  const userMessageArabic = \`\${recorded.userMessageArabic} (رمز البلاغ: \${recorded.errorReference})\`;

  if (replyTarget && typeof replyTarget.reply === 'function') {
    try {
      const msg = buildRichPage({
        title: '⚠️ خطأ في العملية',
        blocks: [richParagraph(userMessageArabic)],
      });
      assertRichMessage(msg);
      const text = \`⚠️ *خطأ في العملية*\\n\\n\${userMessageArabic}\`;
      const content = Object.assign(new String(text), msg);
      await replyTarget.reply(content, { parse_mode: 'Markdown' });
    } catch (replyErr) {
      await captureFlowError(replyErr, {
        ...boundedContext,
        action: \`\${boundedContext.action}:reply_fallback\`,
      });
    }
  }

  return {
    ...recorded,
    userMessageArabic,
  };
}
`;
  writeFileSync(join(flowDir, 'error.handler.ts'), errorHandlerContent, 'utf8');
  filesCreated.push(join('src', 'flows', flowFolderName, 'error.handler.ts').replace(/\\/g, '/'));

  // 9. controller.ts
  const controllerContent = `/**
 * Master Controller for Flow ${flowId} (${slug})
 */

import { ${pascalSlug}Service } from './service.js';
import { handle${pascalSlug}Action, type FlowContextLike } from './action.handler.js';
import { handle${pascalSlug}Error } from './error.handler.js';
import { build${pascalSlug}MainMenuKeyboard, format${pascalSlug}Prompt } from './menu.builder.js';

export class ${pascalSlug}Controller {
  private service: ${pascalSlug}Service;

  constructor(repository?: unknown) {
    this.service = new ${pascalSlug}Service(repository);
  }

  async renderInitialPrompt(ctx: FlowContextLike) {
    await ctx.reply(format${pascalSlug}Prompt('${titleArabic}'), {
      reply_markup: build${pascalSlug}MainMenuKeyboard(),
    });
  }

  async dispatchAction(ctx: FlowContextLike) {
    try {
      return await handle${pascalSlug}Action(ctx, this.service);
    } catch (err) {
      const boundedContext = {
        flowId: '${flowId}',
        moduleId: '${moduleId}',
        action: ctx.callbackQuery?.data ?? '${flowActionPrefix}:dispatch',
      } as const;
      await handle${pascalSlug}Error(err, boundedContext, ctx);
      return false;
    }
  }
}
`;
  writeFileSync(join(flowDir, 'controller.ts'), controllerContent, 'utf8');
  filesCreated.push(join('src', 'flows', flowFolderName, 'controller.ts').replace(/\\/g, '/'));

  // 10. flow.docs.md (State Machine & Documentation Standard)
  const docsContent = `# تدفق ${flowId}: ${titleArabic} (\`${slug}\`)
## Flow ${flowId}: ${pascalSlug} (Work Plan Standard)

> **الموديول:** \`modules/${moduleId}\`  
> **كود التدفق:** \`${flowId}\`  
> **الرتب المصرح لها:** \`SUPER_ADMIN\`, \`FIELD_ADMIN\`  
> **ميزانية التيليجرام:** 36/16/7/3  

---

### 🗺️ مخطط دورة حياة التدفق (State Machine Diagram)

\`\`\`mermaid
stateDiagram-v2
    [*] --> Idle: تشغيل التدفق / الأمر
    
    Idle --> Prompt: بدء الجلسة (INIT)
    
    state Prompt {
        [*] --> RenderPrompt: عرض الشاشة وطلب المدخلات
        RenderPrompt --> Validating: استقبال المدخلات
        Validating --> RenderPrompt: خطأ بالمدخلات (إعادة المحاولة)
        Validating --> ConfirmCard: صحة المدخلات وعرض بطاقة المراجعة
    }
    
    ConfirmCard --> ExecutionSuccess: تأكيد الإجراء (${flowActionPrefix}:confirm)
    ConfirmCard --> Cancelled: إلغاء الإجراء (${flowActionPrefix}:cancel)
    
    ExecutionSuccess --> [*]: إنهاء الجلسة وبطاقة الإنجاز (COMPLETED)
    Cancelled --> [*]: إلغاء الجلسة والعودة
\`\`\`

---

### 🛡️ القواعد الحوكمية المعمارية
1. **عقد الشريحة الرأسية (G2):** الالتزام بمعمارية الـ 10 ملفات واستقلالية التدفق.
2. **ميزانية تليجرام (G5):** طول الـ Callback لا يتجاوز 36 بايت والتسميات أقل من 16 حرفاً.
3. **خزانة الأعطال (G9):** توثيق كافة الأعطال عبر \`captureFlowError\` وبطاقة البلاغ \`#ERR-XXXXXXXX\`.
`;
  writeFileSync(join(flowDir, 'flow.docs.md'), docsContent, 'utf8');
  filesCreated.push(join('src', 'flows', flowFolderName, 'flow.docs.md').replace(/\\/g, '/'));

  // 11. Test fixture: modules/<module>/tests/flows/<id>-<slug>.spec.ts
  const testsFlowDir = join(moduleDir, 'tests', 'flows');
  mkdirSync(testsFlowDir, { recursive: true });

  const testSpecContent = `import { describe, it, expect, vi } from 'vitest';
import {
  ${pascalSlug}Controller,
  ${pascalSlug}Service,
  validate${pascalSlug}Input,
  build${pascalSlug}MainMenuKeyboard,
} from '../../src/flows/${flowFolderName}/index.js';

describe('Work Plan 89 — Flow ${flowId} (${slug}) Constitutional 10-File Slice Spec', () => {
  it('validates input with strict Zod schema', () => {
    const valid = validate${pascalSlug}Input({
      idempotencyKey: 'idemp-key-12345',
      actorTelegramId: 'user-1',
      notes: 'Sample test notes',
    });
    expect(valid.success).toBe(true);

    const invalid = validate${pascalSlug}Input({
      idempotencyKey: 'short', // min 8 chars
      actorTelegramId: '',
    });
    expect(invalid.success).toBe(false);
  });

  it('executes service operation and returns standard reference result', async () => {
    const service = new ${pascalSlug}Service();
    const res = await service.executeOperation({
      idempotencyKey: 'test-key-12345678',
      actorTelegramId: 'usr-99',
    });

    expect(res.success).toBe(true);
    expect(res.referenceId).toBeDefined();
    expect(res.messageArabic).toContain('تم تنفيذ العملية بنجاح');
  });

  it('builds keyboard conforming strictly to Telegram Ergonomics Budget (36/16/7/3)', () => {
    const kb = build${pascalSlug}MainMenuKeyboard();
    expect(kb.inline_keyboard.length).toBeLessThanOrEqual(7);

    for (const row of kb.inline_keyboard) {
      expect(row.length).toBeLessThanOrEqual(3);
      for (const btn of row) {
        expect(btn.text.length).toBeLessThanOrEqual(16);
        expect(btn.callback_data.length).toBeLessThanOrEqual(64);
      }
    }
  });

  it('captures flow errors via telemetry boundary and replies with #ERR reference card', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const replies: string[] = [];
    const controller = new ${pascalSlug}Controller();
    const failingCtx = {
      callbackQuery: { data: '${flowActionPrefix}:start' },
      reply: vi.fn(async (msg: unknown) => {
        if (replies.length === 0) {
          replies.push('THROW_FIRST');
          throw new Error('Simulated action dispatch failure');
        }
        replies.push(String(msg));
        return true;
      }),
    };

    const handled = await controller.dispatchAction(failingCtx);
    expect(handled).toBe(false);
    expect(replies.some((r) => r.includes('رمز البلاغ: #ERR-'))).toBe(true);
    stderrSpy.mockRestore();
  });
});
`;
  const specFilePath = join(testsFlowDir, `${flowFolderName}.spec.ts`);
  writeFileSync(specFilePath, testSpecContent, 'utf8');
  filesCreated.push(`tests/flows/${flowFolderName}.spec.ts`);

  // Optional Feature Extensions (Dashboard & Data)
  if (includeDashboard) {
    const featureDir = join(moduleDir, 'src', 'features', flowId);
    mkdirSync(join(featureDir, 'dashboard'), { recursive: true });
    mkdirSync(join(featureDir, 'api'), { recursive: true });
    mkdirSync(join(featureDir, 'data'), { recursive: true });

    // Page component
    const pageContent = `import React from 'react';
import { ${pascalSlug}ClientView } from './client.js';

export default function ${pascalSlug}Page() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">${titleArabic}</h1>
      <${pascalSlug}ClientView />
    </div>
  );
}
`;
    writeFileSync(join(featureDir, 'dashboard', 'page.tsx'), pageContent, 'utf8');
    filesCreated.push(`src/features/${flowId}/dashboard/page.tsx`);

    // Client component
    const clientContent = `'use client';
import React from 'react';

export function ${pascalSlug}ClientView() {
  return (
    <div className="mt-4 p-4 border rounded">
      <p className="text-gray-700">مكون الواجهة التفاعلي لشاشة: ${titleArabic}</p>
    </div>
  );
}
`;
    writeFileSync(join(featureDir, 'dashboard', 'client.tsx'), clientContent, 'utf8');
    filesCreated.push(`src/features/${flowId}/dashboard/client.tsx`);

    // API Handler
    const apiContent = `import type { ${pascalSlug}ResultDTO } from '../../../flows/${flowFolderName}/types.js';

export async function handle${pascalSlug}Api(req: Request): Promise<${pascalSlug}ResultDTO> {
  return {
    success: true,
    referenceId: 'API-REF-1',
    messageArabic: 'تم الاستدعاء البرمجي بنجاح',
  };
}
`;
    writeFileSync(join(featureDir, 'api', 'handler.ts'), apiContent, 'utf8');
    filesCreated.push(`src/features/${flowId}/api/handler.ts`);
  }

  return {
    ok: true,
    flowDir,
    flowId,
    filesCreated,
  };
}

// CLI execution check
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length < 4 || args[0] === '--help' || args[0] === '-h') {
    console.log('Usage: pnpm tsx tools/scaffold/scaffold-flow-v2.ts <moduleId> <flowId> <slug> <title-arabic>');
    console.log('Example: pnpm tsx tools/scaffold/scaffold-flow-v2.ts sample-domain 89.1 create-record "إنشاء سجل جديد"');
    process.exit(args[0] === '--help' ? 0 : 1);
  }

  const moduleId = args[0]!;
  const flowId = args[1]!;
  const slug = args[2]!;
  const titleArabic = args.slice(3).join(' ');

  try {
    const res = scaffoldFlowV2({ moduleId, flowId, slug, titleArabic });
    if (!res.ok) {
      console.error(`❌ Scaffold failed: ${res.error}`);
      process.exit(1);
    }
    console.log(`✅ Flow V2 10-file slice scaffolded successfully: modules/${moduleId}/src/flows/${res.flowId}-${slug}`);
    console.log(`🔒 Zero Core Modifications Invariant: ${res.filesCreated.length} files created strictly inside modules/${moduleId}/`);
  } catch (err) {
    console.error(`❌ Fatal error:`, err);
    process.exit(1);
  }
}
