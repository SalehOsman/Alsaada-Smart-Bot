import type { WorkerSupervisorProfile, WorkerSupervisorProfileKey } from './types.js';

export const WORKER_SUPERVISOR_PROFILES: Record<WorkerSupervisorProfileKey, WorkerSupervisorProfile> = {
  FUEL_SUPERVISOR: {
    key: 'FUEL_SUPERVISOR',
    nameAr: 'مشرف الوقود والمحروقات',
    descriptionAr: 'تسجيل وقراءة مناسيب وخزانات الوقود في الموقع المخصص',
    permissions: [
      {
        permissionKey: 'inventory.fuel.level.create',
        actions: ['create', 'view'],
      },
    ],
  },
  CANTEEN_SUPERVISOR: {
    key: 'CANTEEN_SUPERVISOR',
    nameAr: 'مشرف الكانتين والمقصف',
    descriptionAr: 'تسجيل واستعراض مسحوبات ومبيعات الكانتين للعاملين',
    permissions: [
      {
        permissionKey: 'canteen.sale.create',
        actions: ['create', 'view'],
      },
      {
        permissionKey: 'canteen.sale.view',
        actions: ['view'],
      },
    ],
  },
  HOUSING_SUPERVISOR: {
    key: 'HOUSING_SUPERVISOR',
    nameAr: 'مشرف السكن والإعاشة',
    descriptionAr: 'متابعة وإدارة تسكين العاملين وغرف السكن الميدانية',
    permissions: [
      {
        permissionKey: 'inventory.housing.manage',
        actions: ['view', 'manage', 'create'],
      },
    ],
  },
  SHIFT_SUPERVISOR: {
    key: 'SHIFT_SUPERVISOR',
    nameAr: 'مشرف التشغيل والورديات',
    descriptionAr: 'عرض دليل عمال الموقع وصرفيات المطبخ الميداني للمشروع',
    permissions: [
      {
        permissionKey: 'workforce.worker.view',
        actions: ['view'],
      },
      {
        permissionKey: 'inventory.kitchen.issue.create',
        actions: ['create', 'view'],
      },
    ],
  },
};

export const WORKER_SUPERVISOR_PROFILE_KEYS: WorkerSupervisorProfileKey[] = [
  'FUEL_SUPERVISOR',
  'CANTEEN_SUPERVISOR',
  'HOUSING_SUPERVISOR',
  'SHIFT_SUPERVISOR',
];

export function isWorkerSupervisorProfileKey(key: string): key is WorkerSupervisorProfileKey {
  return WORKER_SUPERVISOR_PROFILE_KEYS.includes(key as WorkerSupervisorProfileKey);
}

export function getWorkerSupervisorProfile(key: WorkerSupervisorProfileKey): WorkerSupervisorProfile | undefined {
  return WORKER_SUPERVISOR_PROFILES[key];
}

export function getAllWorkerSupervisorProfiles(): WorkerSupervisorProfile[] {
  return Object.values(WORKER_SUPERVISOR_PROFILES);
}
