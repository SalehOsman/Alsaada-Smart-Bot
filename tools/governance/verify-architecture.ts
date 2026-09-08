import { join } from 'node:path';
import { createResult, countLines, fail, fileIsNonEmpty, isCliEntrypoint, listFilesRecursive, listFlowDirs, printAndExit, readUtf8, toRepoPath, type VerificationResult } from './common.js';

const REQUIRED_FLOW_FILES = [
  'flow.contract.json',
  'flow.handler.ts',
  'flow.keyboard.ts',
  'flow.service.ts',
  'flow.repository.ts',
  'flow.types.ts',
  'flow.validators.ts',
  'flow.messages.ts',
  'flow.telemetry.ts',
  'flow.docs.md',
  'tests/flow.unit.spec.ts',
  'tests/flow.integration.spec.ts',
  'tests/flow.ux.spec.ts',
  'tests/flow.rbac.spec.ts',
  'tests/flow.data.spec.ts',
] as const;

const COMPLETED_STATUSES = new Set(['Implemented', 'UAT_PASS']);

interface FlowContractPreview {
  status?: string;
  allowAny?: boolean;
}

function readContract(flowDir: string): FlowContractPreview {
  try {
    return JSON.parse(readUtf8(join(flowDir, 'flow.contract.json'))) as FlowContractPreview;
  } catch {
    return {};
  }
}

export function verifyArchitecture(root = process.cwd()): VerificationResult {
  const result = createResult();
  const flowDirs = listFlowDirs(root);
  result.checked = flowDirs.length;

  for (const flowDir of flowDirs) {
    const repoFlowPath = toRepoPath(root, flowDir);
    for (const requiredFile of REQUIRED_FLOW_FILES) {
      const fullPath = join(flowDir, requiredFile);
      if (!fileIsNonEmpty(fullPath)) {
        fail(result, `${repoFlowPath} is missing non-empty required file: ${requiredFile}`);
      }
    }

    const handlerLines = countLines(join(flowDir, 'flow.handler.ts'));
    if (handlerLines > 350) fail(result, `${repoFlowPath}/flow.handler.ts exceeds 350 lines (${handlerLines})`);

    const serviceLines = countLines(join(flowDir, 'flow.service.ts'));
    if (serviceLines > 500) fail(result, `${repoFlowPath}/flow.service.ts exceeds 500 lines (${serviceLines})`);

    const contract = readContract(flowDir);
    const isCompleted = contract.status ? COMPLETED_STATUSES.has(contract.status) : true;
    const flowFiles = listFilesRecursive(flowDir).filter((file) => /\.(ts|md|json)$/.test(file));
    for (const file of flowFiles) {
      const text = readUtf8(file);
      const repoFilePath = toRepoPath(root, file);
      if (isCompleted && /placeholder/i.test(text)) fail(result, `${repoFilePath} contains placeholder text in a completed flow`);
      if (!contract.allowAny && /\bany\b/.test(text) && file.endsWith('.ts')) fail(result, `${repoFilePath} uses any without a documented exception`);
    }
  }

  return result;
}

if (isCliEntrypoint(import.meta.url)) {
  printAndExit('arch:verify', verifyArchitecture(process.cwd()));
}
