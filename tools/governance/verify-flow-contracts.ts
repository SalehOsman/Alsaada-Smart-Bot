import { join } from 'node:path';
import { createResult, fail, isCliEntrypoint, listFlowDirs, printAndExit, readUtf8, toRepoPath, type VerificationResult } from './common.js';

const REQUIRED_TOP_LEVEL = [
  'flowCode',
  'flowName',
  'module',
  'classification',
  'status',
  'allowedRoles',
  'blockedRoles',
  'entryPoints',
  'navigationPath',
  'buttons',
  'inputs',
  'outputs',
  'dataImpact',
  'linkedFlows',
  'performanceSlaMs',
  'requiredTests',
  'manualUatRequired',
] as const;

const REQUIRED_DATA_IMPACT = ['database', 'googleSheets', 'exports', 'notifications'] as const;
const REQUIRED_SLA = ['buttonP95', 'stepP95', 'commitP95'] as const;
const REQUIRED_TESTS = ['unit', 'integration', 'ux', 'rbac', 'data'] as const;
const ALLOWED_STATUSES = new Set(['Pending', 'InProgress', 'Implemented', 'UAT_PASS', 'Archived']);
const ALLOWED_CLASSIFICATIONS = new Set(['LEGACY_PARITY', 'EVOLVED', 'NOVEL', 'DEPRECATED']);

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

export function verifyFlowContracts(root = process.cwd()): VerificationResult {
  const result = createResult();
  const flowDirs = listFlowDirs(root);
  result.checked = flowDirs.length;
  const seenCodes = new Set<string>();

  for (const flowDir of flowDirs) {
    const contractPath = join(flowDir, 'flow.contract.json');
    const repoPath = toRepoPath(root, contractPath);
    let contract: Record<string, unknown>;
    try {
      contract = JSON.parse(readUtf8(contractPath)) as Record<string, unknown>;
    } catch (error) {
      fail(result, `${repoPath} is not valid JSON: ${String(error)}`);
      continue;
    }

    for (const field of REQUIRED_TOP_LEVEL) {
      if (isEmpty(contract[field])) fail(result, `${repoPath} is missing required field: ${field}`);
    }

    const flowCode = typeof contract.flowCode === 'string' ? contract.flowCode : '';
    if (flowCode) {
      if (seenCodes.has(flowCode)) fail(result, `${repoPath} duplicates flowCode: ${flowCode}`);
      seenCodes.add(flowCode);
    }

    if (typeof contract.status === 'string' && !ALLOWED_STATUSES.has(contract.status)) {
      fail(result, `${repoPath} has invalid status: ${contract.status}`);
    }

    if (typeof contract.classification === 'string' && !ALLOWED_CLASSIFICATIONS.has(contract.classification)) {
      fail(result, `${repoPath} has invalid classification: ${contract.classification}. Must be one of: ${Array.from(ALLOWED_CLASSIFICATIONS).join(', ')}`);
    }

    const dataImpact = contract.dataImpact as Record<string, unknown> | undefined;
    if (dataImpact && typeof dataImpact === 'object') {
      for (const field of REQUIRED_DATA_IMPACT) {
        if (!Array.isArray(dataImpact[field])) fail(result, `${repoPath} dataImpact.${field} must be an array`);
      }
    }

    const sla = contract.performanceSlaMs as Record<string, unknown> | undefined;
    if (sla && typeof sla === 'object') {
      for (const field of REQUIRED_SLA) {
        if (typeof sla[field] !== 'number' || sla[field] <= 0) fail(result, `${repoPath} performanceSlaMs.${field} must be a positive number`);
      }
    }

    const tests = contract.requiredTests;
    if (Array.isArray(tests)) {
      for (const requiredTest of REQUIRED_TESTS) {
        if (!tests.includes(requiredTest)) fail(result, `${repoPath} requiredTests must include ${requiredTest}`);
      }
    }
  }

  return result;
}

if (isCliEntrypoint(import.meta.url)) {
  printAndExit('flow-contracts:verify', verifyFlowContracts(process.cwd()));
}
