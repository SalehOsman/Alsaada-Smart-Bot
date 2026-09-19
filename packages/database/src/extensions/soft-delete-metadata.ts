/**
 * Static Soft-Delete Metadata Registry (Zero-Drift Architecture)
 *
 * Replaces removed Prisma.dmmf with a deterministic static metadata map.
 * Guaranteed schema baseline models with isDeleted: Worker, FinancialLedger, User.
 */

export interface RelationMetadata {
  targetModel: string;
  isList: boolean;
  supportsSoftDelete: boolean;
}

export const SOFT_DELETE_MODELS = ['Worker', 'FinancialLedger', 'User'] as const;

export type SoftDeleteModelName = (typeof SOFT_DELETE_MODELS)[number];

let cachedSoftDeleteModels: Set<string> | null = null;

export function getSoftDeleteModels(): Set<string> {
  if (cachedSoftDeleteModels) return cachedSoftDeleteModels;

  const models = new Set<string>();
  for (const name of SOFT_DELETE_MODELS) {
    models.add(name);
    models.add(name.charAt(0).toLowerCase() + name.slice(1));
  }

  cachedSoftDeleteModels = models;
  return cachedSoftDeleteModels;
}

/**
 * Static mapping of relations between models and soft-delete entities.
 * Both PascalCase and camelCase keys are registered for seamless lookups.
 */
export const STATIC_RELATION_REGISTRY: Record<string, Record<string, RelationMetadata>> = {
  Worker: {
    user: { targetModel: 'User', isList: false, supportsSoftDelete: true },
    ledgers: { targetModel: 'FinancialLedger', isList: true, supportsSoftDelete: true },
  },
  FinancialLedger: {
    worker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
  },
  User: {
    worker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
  },
  Site: {
    workers: { targetModel: 'Worker', isList: true, supportsSoftDelete: true },
    users: { targetModel: 'User', isList: true, supportsSoftDelete: true },
  },
  Department: {
    workers: { targetModel: 'Worker', isList: true, supportsSoftDelete: true },
  },
  JobTitle: {
    workers: { targetModel: 'Worker', isList: true, supportsSoftDelete: true },
  },
  CanteenItem: {
    workers: { targetModel: 'Worker', isList: true, supportsSoftDelete: true },
    ledgers: { targetModel: 'FinancialLedger', isList: true, supportsSoftDelete: true },
  },
  SiteAccommodationAssignment: {
    worker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
  },
  SalaryHistory: {
    worker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
  },
  WorkerChangeLog: {
    worker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
  },
  WorkerCustomAllowance: {
    worker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
  },
  PPEAsset: {
    worker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
  },
  DisciplinaryAndBonus: {
    worker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
  },
  WorkerClearance: {
    worker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
  },
  WorkerDelegation: {
    worker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
    user: { targetModel: 'User', isList: false, supportsSoftDelete: true },
  },
  WorkerBalanceSnapshot: {
    worker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
  },
  Leave: {
    worker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
  },
  LeaveAllowance: {
    worker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
  },
  DutyRoster: {
    worker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
  },
  SiteTask: {
    assignedWorker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
  },
  FinancialCustody: {
    custodianWorker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
    ledgers: { targetModel: 'FinancialLedger', isList: true, supportsSoftDelete: true },
  },
  AdvanceRequest: {
    worker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
  },
  AdvanceInstallment: {
    worker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
    financialLedger: { targetModel: 'FinancialLedger', isList: false, supportsSoftDelete: true },
  },
  PayrollRecord: {
    worker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
  },
  MealSurvey: {
    worker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
  },
  FuelDispenseLog: {
    worker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
  },
  Equipment: {
    operatorWorker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
  },
  FuelTank: {
    supervisorWorker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
  },
  HospitalityExpense: {
    worker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
  },
  KitchenMealDispense: {
    worker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
  },
  FoodInboundShipment: {
    receivedBy: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
  },
  WorkerExpenseClaim: {
    worker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
  },
  WorkerEditRequest: {
    worker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
  },
  WorkerDocument: {
    worker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
  },
  WorkerCommitmentScore: {
    worker: { targetModel: 'Worker', isList: false, supportsSoftDelete: true },
  },
  NotificationQueue: {
    user: { targetModel: 'User', isList: false, supportsSoftDelete: true },
  },
  DashboardSession: {
    user: { targetModel: 'User', isList: false, supportsSoftDelete: true },
  },
  SupervisorLifecycleLog: {
    user: { targetModel: 'User', isList: false, supportsSoftDelete: true },
  },
  Supplier: {
    users: { targetModel: 'User', isList: true, supportsSoftDelete: true },
    ledgers: { targetModel: 'FinancialLedger', isList: true, supportsSoftDelete: true },
  },
};

let cachedRelationMap: Map<string, Map<string, RelationMetadata>> | null = null;

export function getRelationMetadataMap(): Map<string, Map<string, RelationMetadata>> {
  if (cachedRelationMap) return cachedRelationMap;

  cachedRelationMap = new Map();

  for (const [modelName, relations] of Object.entries(STATIC_RELATION_REGISTRY)) {
    const relationMap = new Map<string, RelationMetadata>();
    for (const [relName, meta] of Object.entries(relations)) {
      relationMap.set(relName, meta);
    }

    const pascalKey = modelName.charAt(0).toUpperCase() + modelName.slice(1);
    const camelKey = modelName.charAt(0).toLowerCase() + modelName.slice(1);

    cachedRelationMap.set(pascalKey, relationMap);
    cachedRelationMap.set(camelKey, relationMap);
  }

  return cachedRelationMap;
}
