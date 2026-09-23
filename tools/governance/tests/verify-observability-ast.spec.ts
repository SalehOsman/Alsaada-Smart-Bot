import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  inspectSourceObservabilityAst,
  inspectFlowV2Observability,
} from '../verify-observability-contract.js';
import { scaffoldModuleV2 } from '../../scaffold/scaffold-module-v2.js';
import { scaffoldFlowV2 } from '../../scaffold/scaffold-flow-v2.js';

describe('Work Plan 94 (NEW-91) — Gate G9 Deep TypeScript AST Observability & Telemetry Sentinel', () => {
  const tempRoot = path.resolve(process.cwd(), 'tmp-test-g9-ast-sentinel');

  beforeEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.mkdirSync(tempRoot, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('rejects error.handler.ts when captureFlowError is only inside a comment (Negative Case 1)', () => {
    const code = `
      import { captureFlowError, type BoundedFlowContext } from '@alsaada/telemetry';
      export async function handleOrderError(error: unknown, boundedContext: BoundedFlowContext) {
        // await captureFlowError(error, boundedContext);
        return { handled: true, userMessageArabic: 'خطأ' };
      }
    `;
    const res = inspectSourceObservabilityAst(code, {
      fileName: 'error.handler.ts',
      role: 'error.handler',
    });

    expect(res.ok).toBe(false);
    expect(res.findings.some((f) => f.rule === 'MISSING_CAPTURE_FLOW_ERROR')).toBe(true);
  });

  it('rejects error.handler.ts with a local shadow function named captureFlowError not imported from @alsaada/telemetry (Negative Case 2)', () => {
    const code = `
      async function captureFlowError(err: unknown, ctx: unknown) {
        return { handled: true, errorReference: '#FAKE-1', traceId: 't1', status: 'persisted', userMessageArabic: 'fake' };
      }
      export async function handleOrderError(error: unknown, boundedContext: { flowId: string }) {
        return await captureFlowError(error, boundedContext);
      }
    `;
    const res = inspectSourceObservabilityAst(code, {
      fileName: 'error.handler.ts',
      role: 'error.handler',
    });

    expect(res.ok).toBe(false);
    expect(res.hasImportedCaptureFlowError).toBe(false);
    expect(res.findings.some((f) => f.rule === 'UNIMPORTED_CAPTURE_FLOW_ERROR')).toBe(true);
  });

  it('rejects error.handler.ts when captureFlowError is called without await (Negative Case 3)', () => {
    const code = `
      import { captureFlowError, type BoundedFlowContext } from '@alsaada/telemetry';
      export function handleOrderError(error: unknown, boundedContext: BoundedFlowContext) {
        void captureFlowError(error, boundedContext);
        return { handled: true, userMessageArabic: 'خطأ' };
      }
    `;
    const res = inspectSourceObservabilityAst(code, {
      fileName: 'error.handler.ts',
      role: 'error.handler',
    });

    expect(res.ok).toBe(false);
    expect(res.hasAwaitedCaptureFlowError).toBe(false);
    expect(res.findings.some((f) => f.rule === 'UNAWAITED_CAPTURE_FLOW_ERROR')).toBe(true);
  });

  it('rejects empty catch blocks and comment-only catch blocks (Negative Case 4)', () => {
    const code = `
      export async function executeTask() {
        try {
          throw new Error('boom');
        } catch (err) {
          /* silently swallowed comment only */
        }
      }
    `;
    const res = inspectSourceObservabilityAst(code, {
      fileName: 'service.ts',
      role: 'service',
    });

    expect(res.ok).toBe(false);
    expect(res.findings.some((f) => f.rule === 'EMPTY_CATCH_SWALLOW')).toBe(true);
  });

  it('rejects error.handler.ts using untyped ctx?: unknown parameter instead of BoundedFlowContext (Negative Case 5)', () => {
    const code = `
      import { captureFlowError } from '@alsaada/telemetry';
      export async function handleOrderError(error: unknown, ctx?: unknown) {
        return await captureFlowError(error, { flowId: '01.1', moduleId: 'mod', action: 'act' });
      }
    `;
    const res = inspectSourceObservabilityAst(code, {
      fileName: 'error.handler.ts',
      role: 'error.handler',
    });

    expect(res.ok).toBe(false);
    expect(res.findings.some((f) => f.rule === 'UNBOUNDED_UNKNOWN_CTX')).toBe(true);
  });

  it('rejects controller.ts calling handle*Error without await in catch block (Negative Case 6)', () => {
    const code = `
      import { handleOrderError } from './error.handler.js';
      export class OrderController {
        async dispatchAction(ctx: { callbackQuery?: { data?: string } }) {
          try {
            return true;
          } catch (err) {
            handleOrderError(err, { flowId: '88.1', moduleId: 'orders', action: 'dispatch' });
            return false;
          }
        }
      }
    `;
    const res = inspectSourceObservabilityAst(code, {
      fileName: 'controller.ts',
      role: 'controller',
    });

    expect(res.ok).toBe(false);
    expect(res.findings.some((f) => f.rule === 'UNAWAITED_FLOW_ERROR_HANDLER')).toBe(true);
  });

  it('rejects inner service.ts calling captureFlowError directly, enforcing Single Point of Responsibility (Negative Case 7)', () => {
    const code = `
      import { captureFlowError } from '@alsaada/telemetry';
      export class OrderService {
        async run() {
          try {
            throw new Error('db fail');
          } catch (err) {
            await captureFlowError(err, { flowId: '88.1', moduleId: 'orders', action: 'run' });
          }
        }
      }
    `;
    const res = inspectSourceObservabilityAst(code, {
      fileName: 'service.ts',
      role: 'service',
    });

    expect(res.ok).toBe(false);
    expect(res.findings.some((f) => f.rule === 'INNER_LAYER_DIRECT_VAULT_CALL')).toBe(true);
  });

  it('accepts service.ts that properly rethrows errors in catch block (Positive Case 1)', () => {
    const code = `
      export class OrderService {
        async run() {
          try {
            return await Promise.resolve('ok');
          } catch (err) {
            throw err;
          }
        }
      }
    `;
    const res = inspectSourceObservabilityAst(code, {
      fileName: 'service.ts',
      role: 'service',
    });

    expect(res.ok).toBe(true);
    expect(res.findings).toHaveLength(0);
  });

  it('verifies that scaffoldFlowV2 generates a 10-file V2 flow slice that passes Gate G9 AST inspection 100% (Positive Case 2)', () => {
    scaffoldModuleV2({
      name: 'sample-mod',
      titleArabic: 'موديول الاختبار النموذجي',
      root: tempRoot,
    });

    const scaffoldRes = scaffoldFlowV2({
      moduleId: 'sample-mod',
      flowId: '88.1',
      slug: 'test-flow',
      titleArabic: 'تدفق اختبار الرصد التلقائي',
      root: tempRoot,
      includeDashboard: false,
    });

    expect(scaffoldRes.ok).toBe(true);

    const flowDir = path.join(tempRoot, 'modules', 'sample-mod', 'src', 'flows', '88.1-test-flow');
    const astCheck = inspectFlowV2Observability(flowDir);

    expect(astCheck.ok).toBe(true);
    expect(astCheck.findings).toEqual([]);

    const errorHandlerCode = fs.readFileSync(path.join(flowDir, 'error.handler.ts'), 'utf8');
    const controllerCode = fs.readFileSync(path.join(flowDir, 'controller.ts'), 'utf8');

    expect(errorHandlerCode).toContain("from '@alsaada/telemetry'");
    expect(errorHandlerCode).toContain('await captureFlowError(error, boundedContext)');
    expect(errorHandlerCode).toContain('recorded.errorReference');
    expect(controllerCode).toContain('await handleTestFlowError(err, boundedContext, ctx)');
  });

  it('rejects controller.ts when dispatchAction has no try/catch error boundary at all (Negative Case 8)', () => {
    const code = `
      import { handleOrderAction } from './action.handler.js';
      export class OrderController {
        async dispatchAction(ctx: { callbackQuery?: { data?: string } }) {
          return await handleOrderAction(ctx);
        }
      }
    `;
    const res = inspectSourceObservabilityAst(code, {
      fileName: 'controller.ts',
      role: 'controller',
    });

    expect(res.ok).toBe(false);
    expect(res.findings.some((f) => f.rule === 'UNAWAITED_FLOW_ERROR_HANDLER')).toBe(true);
  });

  it('rejects controller.ts when catch block only logs warning without awaiting handle*Error or captureFlowError (Negative Case 9)', () => {
    const code = `
      export class OrderController {
        async dispatchAction(ctx: { callbackQuery?: { data?: string } }) {
          try {
            return true;
          } catch (err) {
            await logger.warn(err);
            return false;
          }
        }
      }
    `;
    const res = inspectSourceObservabilityAst(code, {
      fileName: 'controller.ts',
      role: 'controller',
    });

    expect(res.ok).toBe(false);
    expect(res.findings.some((f) => f.rule === 'UNAWAITED_FLOW_ERROR_HANDLER')).toBe(true);
  });

  it('rejects inner layer validator.ts calling recordErrorIncident in inspectFlowV2Observability (Negative Case 10)', () => {
    scaffoldModuleV2({
      name: 'sample-mod',
      titleArabic: 'موديول الاختبار النموذجي',
      root: tempRoot,
    });

    scaffoldFlowV2({
      moduleId: 'sample-mod',
      flowId: '88.2',
      slug: 'inner-leak',
      titleArabic: 'تدفق اختبار انتهاك الطبقة الداخلية',
      root: tempRoot,
      includeDashboard: false,
    });

    const flowDir = path.join(tempRoot, 'modules', 'sample-mod', 'src', 'flows', '88.2-inner-leak');
    fs.writeFileSync(
      path.join(flowDir, 'validator.ts'),
      `export function validateInput(x: unknown) { recordErrorIncident(x); return true; }\n`,
      'utf8',
    );

    const astCheck = inspectFlowV2Observability(flowDir);
    expect(astCheck.ok).toBe(false);
    expect(astCheck.findings.some((f) => f.rule === 'INNER_LAYER_DIRECT_VAULT_CALL')).toBe(true);
  });

  it('executes scaffoldFlowV2 generated controller.ts and error.handler.ts at runtime and emits #ERR reference card (Positive Case 3)', async () => {
    fs.writeFileSync(
      path.join(tempRoot, 'tsconfig.base.json'),
      JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true } }),
      'utf8',
    );
    scaffoldModuleV2({
      name: 'sample-mod',
      titleArabic: 'موديول الاختبار النموذجي',
      root: tempRoot,
    });

    scaffoldFlowV2({
      moduleId: 'sample-mod',
      flowId: '88.3',
      slug: 'runtime-exec',
      titleArabic: 'تدفق اختبار التشغيل الفعلي',
      root: tempRoot,
      includeDashboard: false,
    });

    const flowDir = path.join(tempRoot, 'modules', 'sample-mod', 'src', 'flows', '88.3-runtime-exec');
    const { RuntimeExecController } = await import(
      `file://${path.join(flowDir, 'controller.ts').replace(/\\/g, '/')}`
    );
    const { handleRuntimeExecError } = await import(
      `file://${path.join(flowDir, 'error.handler.ts').replace(/\\/g, '/')}`
    );

    const ControllerClass = RuntimeExecController;
    expect(typeof ControllerClass).toBe('function');
    expect(typeof handleRuntimeExecError).toBe('function');

    const replies: string[] = [];
    const controller = new ControllerClass();
    let callCount = 0;
    const ctx = {
      callbackQuery: { data: 'action:sample-mod:runtime-exec:start' },
      reply: async (msg: unknown) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Runtime database connection timeout');
        }
        replies.push(String(msg));
        return true;
      },
    };

    const res = await controller.dispatchAction(ctx);
    expect(res).toBe(false);
    expect(replies.length).toBe(1);
    expect(replies[0]).toContain('⚠️ *خطأ في العملية*');
    expect(replies[0]).toMatch(/رمز البلاغ: #ERR-[0-9A-F]{8}/);
  });
});

