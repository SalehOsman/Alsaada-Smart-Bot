import type { FeatureContract } from './types.js';

export const FEATURE_CATALOG: Record<string, FeatureContract> = {
  // -------------------------------------------------------------
  // 01. Workforce Module
  // -------------------------------------------------------------
  'workforce.worker.view': {
    flowCode: '01.5',
    nameAr: 'دليل وبطاقة العامل 360°',
    permissionKey: 'workforce.worker.view',
    module: 'workforce',
    delegatable: false,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    allowedActions: ['view', 'export', 'print'],
    dataScope: 'assigned-site',
    dashboardRoute: '/admin/workforce/directory',
    botCommand: '/workers',
    analytics: {
      kpiKeys: ['totalWorkers', 'activeWorkers', 'siteWorkerCount'],
      hasDrilldown: true,
    },
  },
  'workforce.worker.create': {
    flowCode: '01.1',
    nameAr: 'تعيين عامل جديد',
    permissionKey: 'workforce.worker.create',
    module: 'workforce',
    delegatable: false,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    allowedActions: ['create', 'submit'],
    dataScope: 'assigned-site',
    dashboardRoute: '/admin/workforce/new',
    botCommand: '/hire',
  },
  'workforce.compensation.view': {
    flowCode: '01.2',
    nameAr: 'عرض المستحقات التعاقدية',
    permissionKey: 'workforce.compensation.view',
    module: 'workforce',
    delegatable: false,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'WORKER', 'WORKER_SUPERVISOR'],
    allowedActions: ['view'],
    dataScope: 'self',
    sensitiveFields: ['basicSalary', 'overtimeRate', 'allowances', 'totalCompensation'],
  },
  'workforce.compensation.edit': {
    flowCode: '01.2.E',
    nameAr: 'تعديل المستحقات التعاقدية',
    permissionKey: 'workforce.compensation.edit',
    module: 'workforce',
    delegatable: false,
    allowedRoles: ['SUPER_ADMIN'],
    allowedActions: ['edit'],
    dataScope: 'all-sites',
    sensitiveFields: ['basicSalary', 'overtimeRate', 'allowances', 'totalCompensation'],
  },
  'workforce.worker.edit': {
    flowCode: '01.5.E',
    nameAr: 'تعديل بيانات العامل',
    permissionKey: 'workforce.worker.edit',
    module: 'workforce',
    delegatable: false,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    allowedActions: ['edit', 'view'],
    dataScope: 'assigned-site',
    dashboardRoute: '/admin/workforce/[id]/edit',
  },
  'workforce.clearance.create': {
    flowCode: '01.8',
    nameAr: 'مخالصات إنهاء الخدمة',
    permissionKey: 'workforce.clearance.create',
    module: 'workforce',
    delegatable: false,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    allowedActions: ['create', 'submit', 'settle'],
    dataScope: 'assigned-site',
    dashboardRoute: '/admin/workforce/clearances',
    botCommand: '/offboard',
  },
  'workforce.clearance.view': {
    flowCode: '01.8.V',
    nameAr: 'استعراض مخالصات الخدمة',
    permissionKey: 'workforce.clearance.view',
    module: 'workforce',
    delegatable: false,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    allowedActions: ['view', 'export', 'print'],
    dataScope: 'assigned-site',
    dashboardRoute: '/admin/workforce/clearances',
  },

  // -------------------------------------------------------------
  // 02. Advances Module
  // -------------------------------------------------------------
  'advances.cash.create': {
    flowCode: '02.1',
    nameAr: 'تسجيل سلفة نقدية',
    permissionKey: 'advances.cash.create',
    module: 'advances',
    delegatable: false,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    allowedActions: ['create', 'submit'],
    dataScope: 'assigned-site',
    botCommand: '/advance',
    analytics: {
      kpiKeys: ['totalCashAdvances', 'advanceCount'],
      hasDrilldown: true,
    },
  },
  'advances.in_kind.create': {
    flowCode: '02.2',
    nameAr: 'تسجيل مسحوب عيني',
    permissionKey: 'advances.in_kind.create',
    module: 'advances',
    delegatable: true,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'WORKER_SUPERVISOR'],
    allowedActions: ['create', 'submit'],
    dataScope: 'assigned-site',
  },
  'advances.withdrawals.view': {
    flowCode: '02.5',
    nameAr: 'كشف مسحوبات وسلف العامل',
    permissionKey: 'advances.withdrawals.view',
    module: 'advances',
    delegatable: false,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'WORKER', 'WORKER_SUPERVISOR'],
    allowedActions: ['view'],
    dataScope: 'self',
  },

  // -------------------------------------------------------------
  // 03. Canteen Module
  // -------------------------------------------------------------
  'canteen.sale.create': {
    flowCode: '03.1',
    nameAr: 'تسجيل مسحوب كانتين',
    permissionKey: 'canteen.sale.create',
    module: 'canteen',
    delegatable: true,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'WORKER_SUPERVISOR'],
    allowedActions: ['create', 'submit'],
    dataScope: 'assigned-site',
    analytics: {
      kpiKeys: ['totalCanteenSales', 'canteenTransactionsCount'],
      hasDrilldown: true,
    },
  },
  'canteen.sale.view': {
    flowCode: '03.2',
    nameAr: 'استعراض مبيعات الكانتين',
    permissionKey: 'canteen.sale.view',
    module: 'canteen',
    delegatable: true,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'WORKER_SUPERVISOR'],
    allowedActions: ['view', 'export'],
    dataScope: 'assigned-site',
    dashboardRoute: '/admin/logistics/canteen',
  },

  // -------------------------------------------------------------
  // 04. Custody Module
  // -------------------------------------------------------------
  'custody.expense.create': {
    flowCode: '04.1',
    nameAr: 'تسجيل مصروف عهدة',
    permissionKey: 'custody.expense.create',
    module: 'custody',
    delegatable: false,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    allowedActions: ['create', 'submit'],
    dataScope: 'assigned-site',
  },
  'custody.settlement.create': {
    flowCode: '04.2',
    nameAr: 'تسوية وتصفية عهدة',
    permissionKey: 'custody.settlement.create',
    module: 'custody',
    delegatable: false,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    allowedActions: ['create', 'submit', 'settle'],
    dataScope: 'assigned-site',
  },

  // -------------------------------------------------------------
  // 05. Inventory Module (Delegatable Operations)
  // -------------------------------------------------------------
  'inventory.fuel.level.create': {
    flowCode: '05.1',
    nameAr: 'تسجيل منسوب السولار',
    permissionKey: 'inventory.fuel.level.create',
    module: 'inventory',
    delegatable: true,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'WORKER_SUPERVISOR'],
    allowedActions: ['create', 'view'],
    dataScope: 'assigned-resource',
    analytics: {
      kpiKeys: ['dailyFuelConsumption', 'fuelStockLevel'],
      hasDrilldown: true,
    },
  },
  'inventory.kitchen.issue.create': {
    flowCode: '05.2',
    nameAr: 'صرف مخزن المطبخ',
    permissionKey: 'inventory.kitchen.issue.create',
    module: 'inventory',
    delegatable: true,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'WORKER_SUPERVISOR'],
    allowedActions: ['create', 'view'],
    dataScope: 'assigned-resource',
    analytics: {
      kpiKeys: ['kitchenDisbursements', 'criticalStockItems'],
      hasDrilldown: true,
    },
  },
  'inventory.housing.manage': {
    flowCode: '05.3',
    nameAr: 'إدارة وتسكين العمالة الميدانية',
    permissionKey: 'inventory.housing.manage',
    module: 'inventory',
    delegatable: true,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'WORKER_SUPERVISOR'],
    allowedActions: ['view', 'manage', 'create'],
    dataScope: 'assigned-resource',
  },

  // -------------------------------------------------------------
  // 06. Requests & Approvals
  // -------------------------------------------------------------
  'requests.bonus.submit': {
    flowCode: '06.1',
    nameAr: 'طلب مكافأة أو خصم أو جزاء',
    permissionKey: 'requests.bonus.submit',
    module: 'approvals',
    delegatable: false,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    allowedActions: ['submit', 'withdraw', 'view'],
    dataScope: 'assigned-site',
    dashboardRoute: '/admin/approvals',
  },
  'requests.bonus.approve': {
    flowCode: '06.2',
    nameAr: 'اعتماد طلب مكافأة أو جزاء',
    permissionKey: 'requests.bonus.approve',
    module: 'approvals',
    delegatable: false,
    allowedRoles: ['SUPER_ADMIN'],
    allowedActions: ['approve', 'reject'],
    dataScope: 'all-sites',
    dashboardRoute: '/admin/approvals',
  },

  // -------------------------------------------------------------
  // 00. System Governance & Settings (Sovereign)
  // -------------------------------------------------------------
  'system.users.manage': {
    flowCode: '00.12',
    nameAr: 'إدارة المستخدمين والمشرفين',
    permissionKey: 'system.users.manage',
    module: 'settings',
    delegatable: false,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
    allowedActions: ['manage', 'view', 'edit'],
    dataScope: 'system',
    dashboardRoute: '/admin/settings/users',
  },
  'system.roles.manage': {
    flowCode: '00.12.R',
    nameAr: 'إدارة الأدوار والصلاحيات',
    permissionKey: 'system.roles.manage',
    module: 'settings',
    delegatable: false,
    allowedRoles: ['SUPER_ADMIN'],
    allowedActions: ['manage', 'view', 'edit'],
    dataScope: 'system',
    dashboardRoute: '/admin/settings/users',
  },
  'system.matrix.manage': {
    flowCode: '00.12.M',
    nameAr: 'مصفوفة الصلاحيات المتوارثة',
    permissionKey: 'system.matrix.manage',
    module: 'settings',
    delegatable: false,
    allowedRoles: ['SUPER_ADMIN'],
    allowedActions: ['manage', 'view', 'edit'],
    dataScope: 'system',
    dashboardRoute: '/admin/settings/matrix',
  },
  'system.telegram_groups.manage': {
    flowCode: '00.11',
    nameAr: 'إدارة مجموعات وتوبيكات تيليجرام',
    permissionKey: 'system.telegram_groups.manage',
    module: 'settings',
    delegatable: false,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
    allowedActions: ['manage', 'view', 'edit'],
    dataScope: 'system',
    dashboardRoute: '/admin/settings/telegram-groups',
  },
  'system.supervisors.lifecycle': {
    flowCode: '00.5',
    nameAr: 'أتمتة دورة حياة المشرفين ومجموعات المواقع',
    permissionKey: 'system.supervisors.lifecycle',
    module: 'settings',
    delegatable: false,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
    allowedActions: ['manage', 'view', 'edit'],
    dataScope: 'system',
    dashboardRoute: '/admin/settings/users',
  },
  'system.delegations.manage': {
    flowCode: '00.13',
    nameAr: 'إدارة تفويضات العمال المشرفين',
    permissionKey: 'system.delegations.manage',
    module: 'settings',
    delegatable: false,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
    allowedActions: ['manage', 'create', 'approve', 'reject'],
    dataScope: 'all-sites',
    dashboardRoute: '/admin/settings/users',
  },
  'system.audit.view': {
    flowCode: '00.14',
    nameAr: 'خزانة الحوادث الجنائية والتدقيق',
    permissionKey: 'system.audit.view',
    module: 'settings',
    delegatable: false,
    allowedRoles: ['SUPER_ADMIN'],
    allowedActions: ['view', 'export'],
    dataScope: 'system',
    dashboardRoute: '/admin/settings/audit-vault',
    analytics: {
      kpiKeys: ['incidentCount', 'p95Latency', 'activeSessionsCount'],
      hasDrilldown: true,
    },
  },
  'system.telemetry.view': {
    flowCode: '00.10',
    nameAr: 'مؤشرات الأداء ورصد النظام',
    permissionKey: 'system.telemetry.view',
    module: 'settings',
    delegatable: false,
    allowedRoles: ['SUPER_ADMIN'],
    allowedActions: ['view', 'export'],
    dataScope: 'system',
    dashboardRoute: '/admin/settings/telemetry',
  },
};

export function getFeatureContract(keyOrFlowCode: string): FeatureContract | undefined {
  if (FEATURE_CATALOG[keyOrFlowCode]) {
    return FEATURE_CATALOG[keyOrFlowCode];
  }
  for (const contract of Object.values(FEATURE_CATALOG)) {
    if (contract.flowCode === keyOrFlowCode || contract.permissionKey === keyOrFlowCode) {
      return contract;
    }
  }
  return undefined;
}

export function listFeaturesByModule(module: string): FeatureContract[] {
  return Object.values(FEATURE_CATALOG).filter((f) => f.module === module);
}
