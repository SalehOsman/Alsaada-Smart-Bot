import { PrismaClient, BotNodeType, BotNodeStatus, DisabledBehavior } from '../../src/generated/client/index.js';
import fs from 'node:fs';
import path from 'node:path';

// Helper to determine module and section from flow target ID
interface FlowMappingRule {
  moduleCode: string;
  sectionCode: string;
}

function resolveFlowHierarchy(flowId: string): FlowMappingRule {
  // Settings & System Governance
  if (flowId.startsWith('00.') || flowId.startsWith('10.')) {
    return { moduleCode: 'mod:governance', sectionCode: 'sec:settings' };
  }
  // HR & Workforce
  if (flowId.startsWith('01.') || flowId === '01.2.D' || flowId === '01.4.D') {
    return { moduleCode: 'mod:hr', sectionCode: 'sec:workforce' };
  }
  if (flowId.startsWith('03.')) {
    return { moduleCode: 'mod:hr', sectionCode: 'sec:leaves' };
  }
  if (flowId.startsWith('06.')) {
    return { moduleCode: 'mod:hr', sectionCode: 'sec:ppe' };
  }
  // Finance & Treasury
  if (flowId.startsWith('02.')) {
    return { moduleCode: 'mod:finance', sectionCode: 'sec:advances' };
  }
  if (flowId.startsWith('04.')) {
    return { moduleCode: 'mod:finance', sectionCode: 'sec:custody' };
  }
  if (flowId.startsWith('05.')) {
    return { moduleCode: 'mod:finance', sectionCode: 'sec:payroll' };
  }
  // Operations & Field
  if (flowId.startsWith('07.') || flowId.startsWith('08.')) {
    return { moduleCode: 'mod:operations', sectionCode: 'sec:equipment' };
  }
  // Logistics & Procurement & Camp
  if (flowId.startsWith('09.')) {
    return { moduleCode: 'mod:logistics', sectionCode: 'sec:procurement' };
  }
  if (flowId.startsWith('11.')) {
    return { moduleCode: 'mod:logistics', sectionCode: 'sec:canteen' };
  }
  if (flowId.startsWith('13.')) {
    return { moduleCode: 'mod:logistics', sectionCode: 'sec:inventory' };
  }

  // Fallback defaults
  if (flowId.includes('audit') || flowId.includes('ledger') || flowId.includes('hash')) {
    return { moduleCode: 'mod:governance', sectionCode: 'sec:audit' };
  }
  return { moduleCode: 'mod:governance', sectionCode: 'sec:settings' };
}

const PROTECTED_FLOW_CODES = new Set([
  'flow:00.1', // /dashboard
  'flow:00.2', // /start & /menu
  'flow:00.3', // /cancel
  'flow:00.4', // /ping
  'flow:00.5', // /unghost
  'flow:10.1', // dashboard
  'flow:10.2', // start
  'flow:10.3', // cancel
  'flow:10.5', // ping
  'flow:10.6', // unghost
]);

export async function seedBotMenuCatalog(prisma = new PrismaClient()): Promise<{
  modulesCount: number;
  sectionsCount: number;
  flowsCount: number;
}> {
  console.log('================================================================');
  console.log('🤖 Seeding/Updating Enterprise Bot Menu Catalog (Plan-71)...');
  console.log('================================================================');

  // 1. Top-Level Domain Modules
  const domainModules = [
    {
      code: 'mod:hr',
      type: BotNodeType.MODULE,
      title: 'الموارد البشرية وشؤون العاملين',
      icon: '👥',
      callbackData: 'menu:domain:hr',
      sortOrder: 10,
      isProtected: false,
      allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    },
    {
      code: 'mod:finance',
      type: BotNodeType.MODULE,
      title: 'الإدارة المالية والخزينة',
      icon: '💰',
      callbackData: 'menu:domain:finance',
      sortOrder: 20,
      isProtected: false,
      allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    },
    {
      code: 'mod:operations',
      type: BotNodeType.MODULE,
      title: 'التشغيل الميداني والمواقع',
      icon: '🚜',
      callbackData: 'menu:domain:operations',
      sortOrder: 30,
      isProtected: false,
      allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    },
    {
      code: 'mod:logistics',
      type: BotNodeType.MODULE,
      title: 'المشتريات واللوجستيات والمخازن',
      icon: '📦',
      callbackData: 'menu:domain:logistics',
      sortOrder: 40,
      isProtected: false,
      allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
    },
    {
      code: 'mod:governance',
      type: BotNodeType.MODULE,
      title: 'الحوكمة وإعدادات النظام السيادية',
      icon: '⚙️',
      callbackData: 'menu:domain:governance',
      sortOrder: 50,
      isProtected: true, // Sovereign module cannot be disabled
      allowedRoles: ['SUPER_ADMIN'],
    },
  ];

  const moduleMap = new Map<string, string>(); // code -> uuid id
  for (const mod of domainModules) {
    const node = await prisma.botMenuNode.upsert({
      where: { code: mod.code },
      update: {
        title: mod.title,
        icon: mod.icon,
        callbackData: mod.callbackData,
        sortOrder: mod.sortOrder,
        isProtected: mod.isProtected,
        allowedRoles: mod.allowedRoles,
      },
      create: {
        code: mod.code,
        type: mod.type,
        title: mod.title,
        icon: mod.icon,
        callbackData: mod.callbackData,
        sortOrder: mod.sortOrder,
        isProtected: mod.isProtected,
        status: BotNodeStatus.ACTIVE,
        disabledBehavior: DisabledBehavior.LOCK_WITH_ALERT,
        allowedRoles: mod.allowedRoles,
      },
    });
    moduleMap.set(mod.code, node.id);
  }
  console.log(`✅ Upserted ${domainModules.length} core domain modules.`);

  // 2. Sections
  const domainSections = [
    // HR Sections
    { code: 'sec:workforce', moduleCode: 'mod:hr', title: 'شؤون العاملين والتوظيف', icon: '👷‍♂️', callbackData: 'node:sec:workforce', sortOrder: 1, isProtected: false },
    { code: 'sec:leaves', moduleCode: 'mod:hr', title: 'الإجازات والمأموريات', icon: '🏖️', callbackData: 'node:sec:leaves', sortOrder: 2, isProtected: false },
    { code: 'sec:ppe', moduleCode: 'mod:hr', title: 'مهمات الوقاية والسلامة (PPE)', icon: '🦺', callbackData: 'node:sec:ppe', sortOrder: 3, isProtected: false },
    { code: 'sec:disciplinary', moduleCode: 'mod:hr', title: 'الجزاءات والمكافآت', icon: '⚖️', callbackData: 'node:sec:disciplinary', sortOrder: 4, isProtected: false },

    // Finance Sections
    { code: 'sec:advances', moduleCode: 'mod:finance', title: 'السلف والمسحوبات', icon: '💵', callbackData: 'node:sec:advances', sortOrder: 1, isProtected: false },
    { code: 'sec:custody', moduleCode: 'mod:finance', title: 'العهد والمصروفات النثرية', icon: '📑', callbackData: 'node:sec:custody', sortOrder: 2, isProtected: false },
    { code: 'sec:payroll', moduleCode: 'mod:finance', title: 'الرواتب ومسيرات الأجور', icon: '💳', callbackData: 'node:sec:payroll', sortOrder: 3, isProtected: false },

    // Operations Sections
    { code: 'sec:attendance', moduleCode: 'mod:operations', title: 'الحضور والانصراف والورديات', icon: '⏱️', callbackData: 'node:sec:attendance', sortOrder: 1, isProtected: false },
    { code: 'sec:equipment', moduleCode: 'mod:operations', title: 'حركة المعدات والمحروقات', icon: '🚜', callbackData: 'node:sec:equipment', sortOrder: 2, isProtected: false },
    { code: 'sec:production', moduleCode: 'mod:operations', title: 'الإنتاجية ومستخلصات الموقع', icon: '📊', callbackData: 'node:sec:production', sortOrder: 3, isProtected: false },

    // Logistics Sections
    { code: 'sec:procurement', moduleCode: 'mod:logistics', title: 'المشتريات والموردين', icon: '🛒', callbackData: 'node:sec:procurement', sortOrder: 1, isProtected: false },
    { code: 'sec:canteen', moduleCode: 'mod:logistics', title: 'الكانتين وإعاشة المواقع', icon: '🍽️', callbackData: 'node:sec:canteen', sortOrder: 2, isProtected: false },
    { code: 'sec:inventory', moduleCode: 'mod:logistics', title: 'المخازن والمستودعات', icon: '📦', callbackData: 'node:sec:inventory', sortOrder: 3, isProtected: false },

    // Governance Sections
    { code: 'sec:settings', moduleCode: 'mod:governance', title: 'إعدادات النظام السيادية', icon: '🛡️', callbackData: 'node:sec:settings', sortOrder: 1, isProtected: true },
    { code: 'sec:audit', moduleCode: 'mod:governance', title: 'الرقابة والنزاهة الجنائية', icon: '🔍', callbackData: 'node:sec:audit', sortOrder: 2, isProtected: false },
  ];

  const sectionMap = new Map<string, string>(); // code -> uuid id
  for (const sec of domainSections) {
    const parentId = moduleMap.get(sec.moduleCode) ?? null;
    const node = await prisma.botMenuNode.upsert({
      where: { code: sec.code },
      update: {
        parentId,
        title: sec.title,
        icon: sec.icon,
        callbackData: sec.callbackData,
        sortOrder: sec.sortOrder,
        isProtected: sec.isProtected,
      },
      create: {
        code: sec.code,
        parentId,
        type: BotNodeType.SECTION,
        title: sec.title,
        icon: sec.icon,
        callbackData: sec.callbackData,
        sortOrder: sec.sortOrder,
        isProtected: sec.isProtected,
        status: BotNodeStatus.ACTIVE,
        disabledBehavior: DisabledBehavior.LOCK_WITH_ALERT,
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
      },
    });
    sectionMap.set(sec.code, node.id);
  }
  console.log(`✅ Upserted ${domainSections.length} domain sections.`);

  // 3. Load flows from crosswalk JSON
  let crosswalkPath = path.resolve(process.cwd(), 'docs/migration/flow-crosswalk.json');
  if (!fs.existsSync(crosswalkPath)) {
    crosswalkPath = path.resolve(process.cwd(), '../../docs/migration/flow-crosswalk.json');
  }

  interface CrosswalkFlow {
    targetFlowId: string;
    legacyFlowId: string;
    name: string;
    domain: string;
    targetModule: string;
    status: string;
  }

  let flows: CrosswalkFlow[] = [];
  if (fs.existsSync(crosswalkPath)) {
    const raw = fs.readFileSync(crosswalkPath, 'utf8');
    const parsed = JSON.parse(raw);
    flows = parsed.flows || [];
  }

  // Ensure sovereign anchor flows are always present even if crosswalk is empty
  const standardSovereignFlows: CrosswalkFlow[] = [
    {
      targetFlowId: '00.1',
      legacyFlowId: '10.1',
      name: 'فتح لوحة التحكم الإدارية السحابية (/dashboard)',
      domain: 'إدارة النظام والتحكم السيادي',
      targetModule: 'modules/settings',
      status: 'IMPLEMENTED',
    },
    {
      targetFlowId: '00.2',
      legacyFlowId: '10.2',
      name: 'القائمة الرئيسية والعودة للبداية (/start, /menu)',
      domain: 'إدارة النظام والتحكم السيادي',
      targetModule: 'modules/settings',
      status: 'IMPLEMENTED',
    },
    {
      targetFlowId: '00.3',
      legacyFlowId: '10.3',
      name: 'إلغاء المعاملة الحالية والتراجع السريع (/cancel)',
      domain: 'إدارة النظام والتحكم السيادي',
      targetModule: 'modules/settings',
      status: 'IMPLEMENTED',
    },
    {
      targetFlowId: '00.4',
      legacyFlowId: '10.5',
      name: 'فحص الجاهزية والنبض الحي للنظام (/ping)',
      domain: 'إدارة النظام والتحكم السيادي',
      targetModule: 'modules/settings',
      status: 'IMPLEMENTED',
    },
    {
      targetFlowId: '00.5',
      legacyFlowId: '10.6',
      name: 'الخروج من وضع المحاكاة والشبح (/unghost)',
      domain: 'إدارة النظام والتحكم السيادي',
      targetModule: 'modules/settings',
      status: 'IMPLEMENTED',
    },
  ];

  for (const sov of standardSovereignFlows) {
    if (!flows.some((f) => f.targetFlowId === sov.targetFlowId)) {
      flows.unshift(sov);
    }
  }

  let flowsCount = 0;
  for (let i = 0; i < flows.length; i++) {
    const f = flows[i];
    if (!f) continue;
    const code = `flow:${f.targetFlowId}`;
    const hierarchy = resolveFlowHierarchy(f.targetFlowId);
    const parentId = sectionMap.get(hierarchy.sectionCode) || moduleMap.get(hierarchy.moduleCode) || null;
    const isProtected = PROTECTED_FLOW_CODES.has(code) || f.name.includes('/dashboard') || f.name.includes('/start') || f.name.includes('/cancel') || f.name.includes('/ping');

    await prisma.botMenuNode.upsert({
      where: { code },
      update: {
        parentId,
        title: f.name,
        sortOrder: i + 1,
        isProtected,
        callbackData: `${code}:start`,
        metadata: {
          legacyFlowId: f.legacyFlowId,
          targetModule: f.targetModule,
          status: f.status,
          domain: f.domain,
        },
      },
      create: {
        code,
        parentId,
        type: BotNodeType.FLOW,
        title: f.name,
        icon: isProtected ? '🛡️' : '⚡',
        sortOrder: i + 1,
        isProtected,
        callbackData: `${code}:start`,
        status: BotNodeStatus.ACTIVE,
        disabledBehavior: DisabledBehavior.LOCK_WITH_ALERT,
        maintenanceMessage: 'عذراً، هذه الوظيفة تحت الصيانة الدورية المجدولة حالياً وسيتم تفعيلها قريباً.',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
        metadata: {
          legacyFlowId: f.legacyFlowId,
          targetModule: f.targetModule,
          status: f.status,
          domain: f.domain,
        },
      },
    });
    flowsCount++;
  }

  console.log(`✅ Upserted ${flowsCount} operational and sovereign bot flows.`);
  console.log('================================================================');
  console.log('🎉 Bot Menu Catalog Seeded Successfully!');
  console.log('================================================================');

  return {
    modulesCount: domainModules.length,
    sectionsCount: domainSections.length,
    flowsCount,
  };
}

// Direct execution
if (process.argv[1]?.includes('bot-menu-catalog.seed')) {
  seedBotMenuCatalog()
    .then((res) => {
      console.log('Summary:', res);
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Failed to seed bot menu catalog:', err);
      process.exit(1);
    });
}
