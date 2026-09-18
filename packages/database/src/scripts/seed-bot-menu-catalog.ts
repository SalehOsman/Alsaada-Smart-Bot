import { PrismaClient, BotNodeType, BotNodeStatus, DisabledBehavior } from '../generated/client/index.js';

try {
  process.loadEnvFile('.env');
} catch {}

const prisma = new PrismaClient();

interface SeedItem {
  code: string;
  parentCode?: string;
  type: BotNodeType;
  title: string;
  icon?: string;
  callbackData?: string;
  sortOrder: number;
  isProtected?: boolean;
  allowedRoles?: string[];
  maintenanceMessage?: string;
}

const CATALOG_ITEMS: SeedItem[] = [
  // -------------------------------------------------------------
  // 0. Sovereign Anchors (Protected - Non-Disablable)
  // -------------------------------------------------------------
  {
    code: 'anchor:dashboard',
    type: BotNodeType.FLOW,
    title: '🖥️ فتح لوحة التحكم',
    icon: '🖥️',
    callbackData: 'cmd:dashboard',
    sortOrder: 1,
    isProtected: true,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },
  {
    code: 'anchor:main_menu',
    type: BotNodeType.FLOW,
    title: '🏠 القائمة الرئيسية',
    icon: '🏠',
    callbackData: 'action:main_menu',
    sortOrder: 2,
    isProtected: true,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'WORKER_SUPERVISOR', 'WORKER', 'SUPPLIER', 'GUEST'],
  },
  {
    code: 'anchor:settings',
    type: BotNodeType.FLOW,
    title: '⚙️ إعدادات النظام',
    icon: '⚙️',
    callbackData: 'action:settings:hub',
    sortOrder: 3,
    isProtected: true,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
  },
  {
    code: 'anchor:cancel',
    type: BotNodeType.FLOW,
    title: '❌ إلغاء والتراجع',
    icon: '❌',
    callbackData: 'cmd:cancel',
    sortOrder: 4,
    isProtected: true,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'WORKER_SUPERVISOR', 'WORKER', 'SUPPLIER', 'GUEST'],
  },
  {
    code: 'anchor:ping',
    type: BotNodeType.FLOW,
    title: '⚡ فحص الكفاءة والسرعة',
    icon: '⚡',
    callbackData: 'cmd:ping',
    sortOrder: 5,
    isProtected: true,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },
  {
    code: 'anchor:exit_ghost',
    type: BotNodeType.FLOW,
    title: '🛡️ إنهاء وضع المحاكاة',
    icon: '🛡️',
    callbackData: 'action:exit_ghost',
    sortOrder: 6,
    isProtected: true,
    allowedRoles: ['SUPER_ADMIN'],
  },

  // -------------------------------------------------------------
  // 1. Modules (Top-Level Domains)
  // -------------------------------------------------------------
  {
    code: 'mod:hr',
    type: BotNodeType.MODULE,
    title: 'الموارد البشرية والعمالة',
    icon: '👥',
    callbackData: 'menu:domain:hr',
    sortOrder: 10,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },
  {
    code: 'mod:finance',
    type: BotNodeType.MODULE,
    title: 'المالية والخزينة',
    icon: '💰',
    callbackData: 'menu:domain:finance',
    sortOrder: 20,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },
  {
    code: 'mod:operations',
    type: BotNodeType.MODULE,
    title: 'تشغيل المواقع والإنتاج',
    icon: '🚜',
    callbackData: 'menu:domain:operations',
    sortOrder: 30,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'WORKER_SUPERVISOR'],
  },
  {
    code: 'mod:logistics',
    type: BotNodeType.MODULE,
    title: 'التعيينات والمخازن',
    icon: '⛽',
    callbackData: 'menu:domain:logistics',
    sortOrder: 40,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'WORKER_SUPERVISOR'],
  },
  {
    code: 'mod:governance',
    type: BotNodeType.MODULE,
    title: 'الحوكمة وإدارة المخاطر',
    icon: '🏛️',
    callbackData: 'menu:domain:governance',
    sortOrder: 50,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
  },

  // -------------------------------------------------------------
  // 2. Sections & Flows within HR Module (`mod:hr`)
  // -------------------------------------------------------------
  {
    code: 'sec:hr:workforce',
    parentCode: 'mod:hr',
    type: BotNodeType.SECTION,
    title: 'شؤون العاملين والتعيينات',
    icon: '👥',
    callbackData: 'menu:hr:workforce',
    sortOrder: 10,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },
  {
    code: 'flow:01.1',
    parentCode: 'sec:hr:workforce',
    type: BotNodeType.FLOW,
    title: 'تسجيل وتعيين عامل جديد',
    icon: '➕',
    callbackData: 'flow:01.1:start',
    sortOrder: 10,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },
  {
    code: 'flow:01.2',
    parentCode: 'sec:hr:workforce',
    type: BotNodeType.FLOW,
    title: 'طلب انضمام وربط حساب ذاتي',
    icon: '📱',
    callbackData: 'action:guest_join:start',
    sortOrder: 20,
    allowedRoles: ['GUEST', 'WORKER'],
  },
  {
    code: 'flow:01.2.D',
    parentCode: 'sec:hr:workforce',
    type: BotNodeType.FLOW,
    title: 'تعديل وتحديث بيانات عامل',
    icon: '✏️',
    callbackData: 'flow:01.2.D:start',
    sortOrder: 30,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },
  {
    code: 'flow:01.3',
    parentCode: 'sec:hr:workforce',
    type: BotNodeType.FLOW,
    title: 'إنهاء خدمة وتصفية مستحقات',
    icon: '🛑',
    callbackData: 'flow:01.8:start',
    sortOrder: 40,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
  },
  {
    code: 'flow:01.4',
    parentCode: 'sec:hr:workforce',
    type: BotNodeType.FLOW,
    title: 'تصدير واستخراج كشوف العمالة',
    icon: '📊',
    callbackData: 'flow:01.4:start',
    sortOrder: 50,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },
  {
    code: 'flow:01.5',
    parentCode: 'sec:hr:workforce',
    type: BotNodeType.FLOW,
    title: 'سجل وأرشيف العاملين 360°',
    icon: '📇',
    callbackData: 'flow:01.5:start',
    sortOrder: 60,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },

  // HR - Leaves Section
  {
    code: 'sec:hr:leaves',
    parentCode: 'mod:hr',
    type: BotNodeType.SECTION,
    title: 'الإجازات والدوام والتواجد',
    icon: '⏱️',
    callbackData: 'menu:hr:leaves',
    sortOrder: 20,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },
  {
    code: 'flow:03.1',
    parentCode: 'sec:hr:leaves',
    type: BotNodeType.FLOW,
    title: 'تسجيل ونزول الإجازات',
    icon: '🏖️',
    callbackData: 'flow:03.1:start',
    sortOrder: 10,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },
  {
    code: 'flow:03.2',
    parentCode: 'sec:hr:leaves',
    type: BotNodeType.FLOW,
    title: 'تقديم طلب إجازة رسمي',
    icon: '📝',
    callbackData: 'flow:03.2:start',
    sortOrder: 20,
    allowedRoles: ['WORKER', 'WORKER_SUPERVISOR'],
  },
  {
    code: 'flow:03.3',
    parentCode: 'sec:hr:leaves',
    type: BotNodeType.FLOW,
    title: 'تمديد موعد عودة إجازة',
    icon: '⏳',
    callbackData: 'flow:03.3:start',
    sortOrder: 30,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },
  {
    code: 'flow:03.4',
    parentCode: 'sec:hr:leaves',
    type: BotNodeType.FLOW,
    title: 'تسجيل عودة واستئناف عمل',
    icon: '🔄',
    callbackData: 'flow:03.4:start',
    sortOrder: 40,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },
  {
    code: 'flow:03.10',
    parentCode: 'sec:hr:leaves',
    type: BotNodeType.FLOW,
    title: 'رصيد الإجازات المتبقي 360°',
    icon: '📅',
    callbackData: 'flow:03.10:start',
    sortOrder: 50,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'WORKER'],
  },
  {
    code: 'flow:03.13',
    parentCode: 'sec:hr:leaves',
    type: BotNodeType.FLOW,
    title: 'كشف التواجد الميداني الفعلي',
    icon: '📋',
    callbackData: 'flow:03.13:start',
    sortOrder: 60,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },

  // HR - PPE Section
  {
    code: 'sec:hr:ppe',
    parentCode: 'mod:hr',
    type: BotNodeType.SECTION,
    title: 'مهمات الوقاية والسلامة (PPE)',
    icon: '🦺',
    callbackData: 'menu:hr:ppe',
    sortOrder: 30,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },
  {
    code: 'flow:06.1',
    parentCode: 'sec:hr:ppe',
    type: BotNodeType.FLOW,
    title: 'صرف وتسليم مهمات وقاية',
    icon: '🦺',
    callbackData: 'flow:06.1:start',
    sortOrder: 10,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },
  {
    code: 'flow:06.2',
    parentCode: 'sec:hr:ppe',
    type: BotNodeType.FLOW,
    title: 'استرداد عهدة مهمات وقاية',
    icon: '📦',
    callbackData: 'flow:06.2:start',
    sortOrder: 20,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },
  {
    code: 'flow:06.3',
    parentCode: 'sec:hr:ppe',
    type: BotNodeType.FLOW,
    title: 'استعلام عهد ومهمات عامل',
    icon: '🔍',
    callbackData: 'flow:06.3:start',
    sortOrder: 30,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'WORKER'],
  },
  {
    code: 'flow:06.4',
    parentCode: 'sec:hr:ppe',
    type: BotNodeType.FLOW,
    title: 'جرد مستودع مهمات الوقاية',
    icon: '📑',
    callbackData: 'flow:06.4:start',
    sortOrder: 40,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },

  // -------------------------------------------------------------
  // 3. Sections & Flows within Finance Module (`mod:finance`)
  // -------------------------------------------------------------
  {
    code: 'sec:fin:advances',
    parentCode: 'mod:finance',
    type: BotNodeType.SECTION,
    title: 'السلف والمسحوبات النقدية',
    icon: '💵',
    callbackData: 'menu:fin:advances',
    sortOrder: 10,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },
  {
    code: 'flow:02.1',
    parentCode: 'sec:fin:advances',
    type: BotNodeType.FLOW,
    title: 'تسجيل سلفة نقدية مباشرة',
    icon: '💵',
    callbackData: 'flow:02.1:start',
    sortOrder: 10,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },
  {
    code: 'flow:02.2',
    parentCode: 'sec:fin:advances',
    type: BotNodeType.FLOW,
    title: 'صرف مسحوبات السجائر',
    icon: '🚬',
    callbackData: 'flow:02.2:start',
    sortOrder: 20,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },
  {
    code: 'flow:02.3',
    parentCode: 'sec:fin:advances',
    type: BotNodeType.FLOW,
    title: 'تسجيل وصرف منحة ومكافأة',
    icon: '🎁',
    callbackData: 'flow:02.3:start',
    sortOrder: 30,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
  },
  {
    code: 'flow:02.4',
    parentCode: 'sec:fin:advances',
    type: BotNodeType.FLOW,
    title: 'الصرف الدوري المجمع للموقع',
    icon: '👥',
    callbackData: 'flow:02.4:start',
    sortOrder: 40,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },
  {
    code: 'flow:02.8',
    parentCode: 'sec:fin:advances',
    type: BotNodeType.FLOW,
    title: 'كشف حساب ومسحوبات عامل 360°',
    icon: '📊',
    callbackData: 'flow:02.8:start',
    sortOrder: 50,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'WORKER'],
  },
  {
    code: 'flow:02.9',
    parentCode: 'sec:fin:advances',
    type: BotNodeType.FLOW,
    title: 'مسحوبات الكانتين والسلع',
    icon: '🛒',
    callbackData: 'flow:02.9:start',
    sortOrder: 60,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },

  // Finance - Custody Section
  {
    code: 'sec:fin:custody',
    parentCode: 'mod:finance',
    type: BotNodeType.SECTION,
    title: 'العهد المالية والتسويات',
    icon: '💼',
    callbackData: 'menu:fin:custody',
    sortOrder: 20,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },
  {
    code: 'flow:04.1',
    parentCode: 'sec:fin:custody',
    type: BotNodeType.FLOW,
    title: 'صرف عهدة مالية جديدة للمشرف',
    icon: '💰',
    callbackData: 'flow:04.1:start',
    sortOrder: 10,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
  },
  {
    code: 'flow:04.2',
    parentCode: 'sec:fin:custody',
    type: BotNodeType.FLOW,
    title: 'تسجيل منصرفات ورفع فواتير العهدة',
    icon: '🧾',
    callbackData: 'flow:04.2:start',
    sortOrder: 20,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },
  {
    code: 'flow:04.3',
    parentCode: 'sec:fin:custody',
    type: BotNodeType.FLOW,
    title: 'تصفية وتسوية العهدة المالية',
    icon: '⚖️',
    callbackData: 'flow:04.3:start',
    sortOrder: 30,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
  },
  {
    code: 'flow:04.5',
    parentCode: 'sec:fin:custody',
    type: BotNodeType.FLOW,
    title: 'مستكشف وسجل العهد والتسويات',
    icon: '🔎',
    callbackData: 'flow:04.5:start',
    sortOrder: 40,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },

  // -------------------------------------------------------------
  // 4. Sections & Flows within Operations Module (`mod:operations`)
  // -------------------------------------------------------------
  {
    code: 'sec:ops:mining',
    parentCode: 'mod:operations',
    type: BotNodeType.SECTION,
    title: 'تشغيل الفوسفات والنقلات',
    icon: '🚜',
    callbackData: 'menu:ops:mining',
    sortOrder: 10,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'WORKER_SUPERVISOR'],
  },
  {
    code: 'flow:07.1',
    parentCode: 'sec:ops:mining',
    type: BotNodeType.FLOW,
    title: 'تسجيل نقلة وبوليصة فوسفات',
    icon: '📄',
    callbackData: 'flow:07.1:start',
    sortOrder: 10,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'WORKER_SUPERVISOR'],
  },
  {
    code: 'flow:07.8',
    parentCode: 'sec:ops:mining',
    type: BotNodeType.FLOW,
    title: 'كشف إنتاج وتشوين الفوسفات',
    icon: '⛰️',
    callbackData: 'flow:07.8:start',
    sortOrder: 20,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },

  // Operations - Fuel Section
  {
    code: 'sec:ops:fuel',
    parentCode: 'mod:operations',
    type: BotNodeType.SECTION,
    title: 'إدارة الوقود والديزل',
    icon: '⛽',
    callbackData: 'menu:ops:fuel',
    sortOrder: 20,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'WORKER_SUPERVISOR'],
  },
  {
    code: 'flow:fuel_level',
    parentCode: 'sec:ops:fuel',
    type: BotNodeType.FLOW,
    title: 'تسجيل منسوب السولار الميداني',
    icon: '⛽',
    callbackData: 'flow:fuel_level',
    sortOrder: 10,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'WORKER_SUPERVISOR'],
  },
  {
    code: 'flow:07.3',
    parentCode: 'sec:ops:fuel',
    type: BotNodeType.FLOW,
    title: 'تفويل المعدات وتزويد السولار',
    icon: '🚜',
    callbackData: 'flow:07.3:start',
    sortOrder: 20,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'WORKER_SUPERVISOR'],
  },
  {
    code: 'flow:07.7',
    parentCode: 'sec:ops:fuel',
    type: BotNodeType.FLOW,
    title: 'وارد بوالص السولار وتفريغ الفنطاس',
    icon: '🚛',
    callbackData: 'flow:07.7:start',
    sortOrder: 30,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },

  // Operations - Equipment Section
  {
    code: 'sec:ops:equipment',
    parentCode: 'mod:operations',
    type: BotNodeType.SECTION,
    title: 'صيانة المعدات وساعات التشغيل',
    icon: '🔧',
    callbackData: 'menu:ops:equipment',
    sortOrder: 30,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },
  {
    code: 'flow:07.4',
    parentCode: 'sec:ops:equipment',
    type: BotNodeType.FLOW,
    title: 'صيانة المعدات والتشحيم',
    icon: '🛠️',
    callbackData: 'flow:07.4:start',
    sortOrder: 10,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },
  {
    code: 'flow:07.9',
    parentCode: 'sec:ops:equipment',
    type: BotNodeType.FLOW,
    title: 'تتبع ساعات عمل المعدات',
    icon: '⌛',
    callbackData: 'flow:07.9:start',
    sortOrder: 20,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },
  {
    code: 'flow:07.11',
    parentCode: 'sec:ops:equipment',
    type: BotNodeType.FLOW,
    title: 'تقرير أعطال المعدات وتوقف العمل',
    icon: '⚠️',
    callbackData: 'flow:07.11:start',
    sortOrder: 30,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },

  // -------------------------------------------------------------
  // 5. Sections & Flows within Logistics Module (`mod:logistics`)
  // -------------------------------------------------------------
  {
    code: 'sec:log:canteen',
    parentCode: 'mod:logistics',
    type: BotNodeType.SECTION,
    title: 'الكانتين والتعيينات الميدانية',
    icon: '🛒',
    callbackData: 'menu:log:canteen',
    sortOrder: 10,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'WORKER_SUPERVISOR'],
  },
  {
    code: 'flow:canteen_dispense',
    parentCode: 'sec:log:canteen',
    type: BotNodeType.FLOW,
    title: 'صرف مهمات وتعيينات',
    icon: '🍱',
    callbackData: 'flow:canteen_dispense',
    sortOrder: 10,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'WORKER_SUPERVISOR'],
  },
  {
    code: 'flow:canteen_inventory',
    parentCode: 'sec:log:canteen',
    type: BotNodeType.FLOW,
    title: 'جرد بوفيه وكانتين الموقع',
    icon: '📦',
    callbackData: 'flow:canteen:inventory',
    sortOrder: 20,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
  },

  // -------------------------------------------------------------
  // 6. Sections & Flows within Governance Module (`mod:governance`)
  // -------------------------------------------------------------
  {
    code: 'sec:gov:sites',
    parentCode: 'mod:governance',
    type: BotNodeType.SECTION,
    title: 'المواقع والمشاريع الميدانية',
    icon: '🏗️',
    callbackData: 'flow:00.2:start',
    sortOrder: 10,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
  },
  {
    code: 'sec:gov:jobs',
    parentCode: 'mod:governance',
    type: BotNodeType.SECTION,
    title: 'مصفوفة الوظائف والأجور',
    icon: '💼',
    callbackData: 'flow:00.3:start',
    sortOrder: 20,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
  },
  {
    code: 'sec:gov:rbac',
    parentCode: 'mod:governance',
    type: BotNodeType.SECTION,
    title: 'المستخدمين والصلاحيات (RBAC)',
    icon: '👥',
    callbackData: 'flow:00.12:start',
    sortOrder: 30,
    allowedRoles: ['SUPER_ADMIN'],
  },
  {
    code: 'sec:gov:vault',
    parentCode: 'mod:governance',
    type: BotNodeType.SECTION,
    title: 'خزينة التدقيق الجنائي وسجل الأخطاء',
    icon: '🛡️',
    callbackData: 'flow:00.7:start',
    sortOrder: 40,
    allowedRoles: ['SUPER_ADMIN'],
  },
  {
    code: 'sec:gov:telemetry',
    parentCode: 'mod:governance',
    type: BotNodeType.SECTION,
    title: 'مرصد الأداء اللحظي (APM)',
    icon: '⚡',
    callbackData: 'flow:00.8:start',
    sortOrder: 50,
    allowedRoles: ['SUPER_ADMIN'],
  },
  {
    code: 'sec:gov:ghost',
    parentCode: 'mod:governance',
    type: BotNodeType.SECTION,
    title: 'محاكي وضع الشبح (Ghost Mode)',
    icon: '👻',
    callbackData: 'flow:00.6:start',
    sortOrder: 60,
    allowedRoles: ['SUPER_ADMIN'],
  },
  {
    code: 'sec:gov:notify',
    parentCode: 'mod:governance',
    type: BotNodeType.SECTION,
    title: 'سياسات الإشعارات والتوبيكات',
    icon: '🔔',
    callbackData: 'flow:00.10:start',
    sortOrder: 70,
    allowedRoles: ['SUPER_ADMIN', 'GENERAL_ADMIN'],
  },
];

export async function seedBotMenuCatalog(): Promise<void> {
  console.log('================================================================');
  console.log('🤖 Seeding Enterprise Bot Menu Hierarchy Catalog (Plan-71)...');
  console.log('================================================================');

  const codeToIdMap = new Map<string, string>();

  // 1. Seed Top-Level (Anchors & Modules)
  const topLevels = CATALOG_ITEMS.filter((item) => !item.parentCode);
  for (const item of topLevels) {
    const upserted = await prisma.botMenuNode.upsert({
      where: { code: item.code },
      update: {
        title: item.title,
        icon: item.icon ?? null,
        callbackData: item.callbackData ?? null,
        sortOrder: item.sortOrder,
        isProtected: item.isProtected ?? false,
        allowedRoles: item.allowedRoles ?? ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
      },
      create: {
        code: item.code,
        type: item.type,
        title: item.title,
        icon: item.icon ?? null,
        callbackData: item.callbackData ?? null,
        sortOrder: item.sortOrder,
        isProtected: item.isProtected ?? false,
        allowedRoles: item.allowedRoles ?? ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
        status: BotNodeStatus.ACTIVE,
        disabledBehavior: DisabledBehavior.LOCK_WITH_ALERT,
      },
    });
    codeToIdMap.set(item.code, upserted.id);
  }

  // 2. Seed Sections (Children of Modules)
  const sections = CATALOG_ITEMS.filter((item) => item.type === BotNodeType.SECTION);
  for (const item of sections) {
    const parentId = item.parentCode ? (codeToIdMap.get(item.parentCode) ?? null) : null;
    const upserted = await prisma.botMenuNode.upsert({
      where: { code: item.code },
      update: {
        parentId,
        title: item.title,
        icon: item.icon ?? null,
        callbackData: item.callbackData ?? null,
        sortOrder: item.sortOrder,
        isProtected: item.isProtected ?? false,
        allowedRoles: item.allowedRoles ?? ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
      },
      create: {
        code: item.code,
        parentId,
        type: item.type,
        title: item.title,
        icon: item.icon ?? null,
        callbackData: item.callbackData ?? null,
        sortOrder: item.sortOrder,
        isProtected: item.isProtected ?? false,
        allowedRoles: item.allowedRoles ?? ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
        status: BotNodeStatus.ACTIVE,
        disabledBehavior: DisabledBehavior.LOCK_WITH_ALERT,
      },
    });
    codeToIdMap.set(item.code, upserted.id);
  }

  // 3. Seed Flows (Children of Sections or Standalone)
  const flows = CATALOG_ITEMS.filter((item) => item.type === BotNodeType.FLOW && item.parentCode);
  for (const item of flows) {
    const parentId = item.parentCode ? (codeToIdMap.get(item.parentCode) ?? null) : null;
    await prisma.botMenuNode.upsert({
      where: { code: item.code },
      update: {
        parentId,
        title: item.title,
        icon: item.icon ?? null,
        callbackData: item.callbackData ?? null,
        sortOrder: item.sortOrder,
        isProtected: item.isProtected ?? false,
        allowedRoles: item.allowedRoles ?? ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
      },
      create: {
        code: item.code,
        parentId,
        type: item.type,
        title: item.title,
        icon: item.icon ?? null,
        callbackData: item.callbackData ?? null,
        sortOrder: item.sortOrder,
        isProtected: item.isProtected ?? false,
        allowedRoles: item.allowedRoles ?? ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'],
        status: BotNodeStatus.ACTIVE,
        disabledBehavior: DisabledBehavior.LOCK_WITH_ALERT,
      },
    });
  }

  const total = await prisma.botMenuNode.count();
  console.log(`✅ [SEED COMPLETE] Bot Menu Catalog initialized with ${total} nodes.`);

  // 4. Create Initial Snapshot for Rollback protection
  const existingSnapshot = await prisma.botMenuSnapshot.findFirst({
    where: { title: 'الترتيب الافتراضي المعتمد للمنظومة' },
  });

  if (!existingSnapshot) {
    const allNodes = await prisma.botMenuNode.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    await prisma.botMenuSnapshot.create({
      data: {
        title: 'الترتيب الافتراضي المعتمد للمنظومة',
        data: allNodes as any,
        createdById: 'SYSTEM_BOOTSTRAP',
      },
    });
    console.log('✅ [SNAPSHOT] Default baseline snapshot created successfully.');
  }

  await prisma.$disconnect();
}

if (process.argv[1]?.endsWith('seed-bot-menu-catalog.ts')) {
  seedBotMenuCatalog()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ [SEED FATAL]:', err);
      process.exit(1);
    });
}
