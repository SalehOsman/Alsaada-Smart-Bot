export interface PolicyStorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
}

export interface FeaturePolicyItem {
  featureKey: string;
  departmentKey: string;
  departmentLabel: string;
  label: string;
  defaultSiteGroupEnabled: boolean;
  defaultHqGroupEnabled: boolean;
  defaultSilent: boolean;
}

export interface FeaturePolicyState extends FeaturePolicyItem {
  siteGroupEnabled: boolean;
  hqGroupEnabled: boolean;
  isSilent: boolean;
}

export const FEATURE_POLICIES_CATALOG: FeaturePolicyItem[] = [
  // Canteen
  {
    featureKey: 'canteen:cigarettes',
    departmentKey: 'canteen',
    departmentLabel: '🚬 الكانتين والضيافة',
    label: 'مسحوبات السجائر',
    defaultSiteGroupEnabled: false,
    defaultHqGroupEnabled: true,
    defaultSilent: true,
  },
  {
    featureKey: 'canteen:buffet',
    departmentKey: 'canteen',
    departmentLabel: '🚬 الكانتين والضيافة',
    label: 'مشتريات البوفيه والموقع',
    defaultSiteGroupEnabled: false,
    defaultHqGroupEnabled: true,
    defaultSilent: true,
  },
  {
    featureKey: 'canteen:meals',
    departmentKey: 'canteen',
    departmentLabel: '🚬 الكانتين والضيافة',
    label: 'وجبات الإعاشة والضيافة',
    defaultSiteGroupEnabled: true,
    defaultHqGroupEnabled: true,
    defaultSilent: false,
  },

  // Advances
  {
    featureKey: 'advances:cash',
    departmentKey: 'advances',
    departmentLabel: '💰 السلف والمستحقات',
    label: 'السلف النقدية الميدانية',
    defaultSiteGroupEnabled: true,
    defaultHqGroupEnabled: true,
    defaultSilent: false,
  },
  {
    featureKey: 'advances:emergency',
    departmentKey: 'advances',
    departmentLabel: '💰 السلف والمستحقات',
    label: 'السلف الاستثنائية والطارئة',
    defaultSiteGroupEnabled: true,
    defaultHqGroupEnabled: true,
    defaultSilent: false,
  },
  {
    featureKey: 'advances:installments',
    departmentKey: 'advances',
    departmentLabel: '💰 السلف والمستحقات',
    label: 'استقطاعات وتسويات الأقساط',
    defaultSiteGroupEnabled: true,
    defaultHqGroupEnabled: true,
    defaultSilent: false,
  },

  // Custody
  {
    featureKey: 'custody:funding',
    departmentKey: 'custody',
    departmentLabel: '💵 العهد والمصروفات',
    label: 'فتح وتغذية العهد',
    defaultSiteGroupEnabled: true,
    defaultHqGroupEnabled: true,
    defaultSilent: false,
  },
  {
    featureKey: 'custody:invoices',
    departmentKey: 'custody',
    departmentLabel: '💵 العهد والمصروفات',
    label: 'تسجيل فواتير المصروفات',
    defaultSiteGroupEnabled: true,
    defaultHqGroupEnabled: true,
    defaultSilent: false,
  },
  {
    featureKey: 'custody:settlement',
    departmentKey: 'custody',
    departmentLabel: '💵 العهد والمصروفات',
    label: 'تسوية وإغلاق العهد',
    defaultSiteGroupEnabled: true,
    defaultHqGroupEnabled: true,
    defaultSilent: false,
  },

  // Workforce
  {
    featureKey: 'workforce:register',
    departmentKey: 'workforce',
    departmentLabel: '👥 شؤون العاملين',
    label: 'تسجيل عامل جديد',
    defaultSiteGroupEnabled: true,
    defaultHqGroupEnabled: true,
    defaultSilent: false,
  },
  {
    featureKey: 'workforce:edit',
    departmentKey: 'workforce',
    departmentLabel: '👥 شؤون العاملين',
    label: 'تعديل بيانات عامل',
    defaultSiteGroupEnabled: true,
    defaultHqGroupEnabled: true,
    defaultSilent: true,
  },
  {
    featureKey: 'workforce:offboard',
    departmentKey: 'workforce',
    departmentLabel: '👥 شؤون العاملين',
    label: 'إنهاء خدمة ومخالصة',
    defaultSiteGroupEnabled: true,
    defaultHqGroupEnabled: true,
    defaultSilent: false,
  },
  {
    featureKey: 'workforce:link',
    departmentKey: 'workforce',
    departmentLabel: '👥 شؤون العاملين',
    label: 'ربط حساب تيليجرام',
    defaultSiteGroupEnabled: false,
    defaultHqGroupEnabled: true,
    defaultSilent: true,
  },

  // Logistics
  {
    featureKey: 'logistics:waybills',
    departmentKey: 'logistics',
    departmentLabel: '🚚 النقليات والفوسفات',
    label: 'بوالص شحن خام الفوسفات',
    defaultSiteGroupEnabled: true,
    defaultHqGroupEnabled: true,
    defaultSilent: false,
  },
  {
    featureKey: 'logistics:trucks',
    departmentKey: 'logistics',
    departmentLabel: '🚚 النقليات والفوسفات',
    label: 'كشوف سيارات النقل',
    defaultSiteGroupEnabled: true,
    defaultHqGroupEnabled: true,
    defaultSilent: false,
  },

  // Fuel
  {
    featureKey: 'fuel:tank_dips',
    departmentKey: 'fuel',
    departmentLabel: '⛽ المحروقات والتنكات',
    label: 'قياس مسطرة فناطيس السولار',
    defaultSiteGroupEnabled: true,
    defaultHqGroupEnabled: true,
    defaultSilent: false,
  },
  {
    featureKey: 'fuel:dispense',
    departmentKey: 'fuel',
    departmentLabel: '⛽ المحروقات والتنكات',
    label: 'تفويل المعدات والسيارات',
    defaultSiteGroupEnabled: true,
    defaultHqGroupEnabled: true,
    defaultSilent: false,
  },
  {
    featureKey: 'fuel:maintenance',
    departmentKey: 'fuel',
    departmentLabel: '⛽ المحروقات والتنكات',
    label: 'بلاغات صيانة المعدات',
    defaultSiteGroupEnabled: true,
    defaultHqGroupEnabled: true,
    defaultSilent: false,
  },

  // Inventory
  {
    featureKey: 'inventory:ppe_issue',
    departmentKey: 'inventory',
    departmentLabel: '🦺 المخازن والسلامة',
    label: 'صرف مهمات الوقاية PPE',
    defaultSiteGroupEnabled: false,
    defaultHqGroupEnabled: true,
    defaultSilent: true,
  },
  {
    featureKey: 'inventory:tools',
    departmentKey: 'inventory',
    departmentLabel: '🦺 المخازن والسلامة',
    label: 'عهد العدد والأدوات',
    defaultSiteGroupEnabled: true,
    defaultHqGroupEnabled: true,
    defaultSilent: false,
  },
];

export class NotificationPolicyEngine {
  constructor(private readonly storage?: PolicyStorageAdapter) {}

  async isSiteNotificationEnabled(featureKey: string): Promise<boolean> {
    if (!this.storage) {
      const def = FEATURE_POLICIES_CATALOG.find((f) => f.featureKey === featureKey);
      return def ? def.defaultSiteGroupEnabled : true;
    }

    // Check master switch first
    const master = await this.storage.get('notif:policy:site:master').catch(() => null);
    if (master === 'false') return false;

    const val = await this.storage.get(`notif:policy:site:${featureKey}`).catch(() => null);
    if (val !== null) return val === 'true';

    const def = FEATURE_POLICIES_CATALOG.find((f) => f.featureKey === featureKey);
    return def ? def.defaultSiteGroupEnabled : true;
  }

  async isHqNotificationEnabled(featureKey: string): Promise<boolean> {
    if (!this.storage) {
      const def = FEATURE_POLICIES_CATALOG.find((f) => f.featureKey === featureKey);
      return def ? def.defaultHqGroupEnabled : true;
    }

    // Check master switch first
    const master = await this.storage.get('notif:policy:hq:master').catch(() => null);
    if (master === 'false') return false;

    const val = await this.storage.get(`notif:policy:hq:${featureKey}`).catch(() => null);
    if (val !== null) return val === 'true';

    const def = FEATURE_POLICIES_CATALOG.find((f) => f.featureKey === featureKey);
    return def ? def.defaultHqGroupEnabled : true;
  }

  async isSilentNotification(featureKey: string): Promise<boolean> {
    if (!this.storage) {
      const def = FEATURE_POLICIES_CATALOG.find((f) => f.featureKey === featureKey);
      return def ? def.defaultSilent : false;
    }

    const val = await this.storage.get(`notif:policy:silent:${featureKey}`).catch(() => null);
    if (val !== null) return val === 'true';

    const def = FEATURE_POLICIES_CATALOG.find((f) => f.featureKey === featureKey);
    return def ? def.defaultSilent : false;
  }

  async toggleSitePolicy(featureKey: string): Promise<boolean> {
    const current = await this.isSiteNotificationEnabled(featureKey);
    const next = !current;
    if (this.storage) {
      await this.storage.set(`notif:policy:site:${featureKey}`, next ? 'true' : 'false');
    }
    return next;
  }

  async toggleHqPolicy(featureKey: string): Promise<boolean> {
    const current = await this.isHqNotificationEnabled(featureKey);
    const next = !current;
    if (this.storage) {
      await this.storage.set(`notif:policy:hq:${featureKey}`, next ? 'true' : 'false');
    }
    return next;
  }

  async toggleSilentPolicy(featureKey: string): Promise<boolean> {
    const current = await this.isSilentNotification(featureKey);
    const next = !current;
    if (this.storage) {
      await this.storage.set(`notif:policy:silent:${featureKey}`, next ? 'true' : 'false');
    }
    return next;
  }

  async getFullPolicyMatrix(): Promise<FeaturePolicyState[]> {
    const list: FeaturePolicyState[] = [];
    for (const item of FEATURE_POLICIES_CATALOG) {
      const siteGroupEnabled = await this.isSiteNotificationEnabled(item.featureKey);
      const hqGroupEnabled = await this.isHqNotificationEnabled(item.featureKey);
      const isSilent = await this.isSilentNotification(item.featureKey);
      list.push({
        ...item,
        siteGroupEnabled,
        hqGroupEnabled,
        isSilent,
      });
    }
    return list;
  }
}
