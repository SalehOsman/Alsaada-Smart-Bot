import type { Redis } from 'ioredis';
import type { SitesHubRepository } from './flow.repository.js';
import type {
  SiteDto,
  SiteCreationWizardState,
  SiteEditFieldState,
  SiteFieldKey,
} from './flow.types.js';
import { validateSiteName, validateSiteCode } from './flow.validators.js';

export class SitesHubService {
  private localWizard = new Map<string, SiteCreationWizardState>();
  private localEdit = new Map<string, SiteEditFieldState>();

  constructor(
    private readonly repository: SitesHubRepository,
    private readonly redis?: Redis | null
  ) {}

  async listSites(): Promise<SiteDto[]> {
    return this.repository.listSites();
  }

  async getSiteByCode(code: string): Promise<SiteDto | null> {
    return this.repository.getSiteByCode(code);
  }

  async toggleSiteStatus(code: string): Promise<SiteDto> {
    return this.repository.toggleSiteStatus(code);
  }

  async getNextSuggestedCode(): Promise<string> {
    const sites = await this.repository.listSites();
    let maxNum = 0;
    for (const site of sites) {
      const match = site.code.match(/STE-(\d+)/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const next = maxNum + 1;
    return `STE-${next.toString().padStart(2, '0')}`;
  }

  async createSite(data: {
    name: string;
    code: string;
    governorate?: string;
    geofenceRadiusMeters: number;
    projectId?: string;
    latitude?: number;
    longitude?: number;
  }): Promise<{ success: boolean; site?: SiteDto; error?: string }> {
    const nameVal = validateSiteName(data.name);
    if (!nameVal.isValid) return { success: false, error: nameVal.error ?? 'اسم الموقع غير صالح' };

    const codeVal = validateSiteCode(data.code);
    if (!codeVal.isValid) return { success: false, error: codeVal.error ?? 'كود الموقع غير صالح' };

    const existing = await this.repository.getSiteByCode(data.code);
    if (existing) {
      return { success: false, error: `كود الموقع (${data.code}) مستخدم مسبقاً لموقع آخر.` };
    }

    const site = await this.repository.createSite(data);
    return { success: true, site };
  }

  async updateField(
    code: string,
    fieldKey: SiteFieldKey,
    value: string | number
  ): Promise<{ success: boolean; site?: SiteDto; error?: string }> {
    const data: Record<string, unknown> = {};

    if (fieldKey === 'name') {
      const val = validateSiteName(String(value));
      if (!val.isValid) return { success: false, error: val.error ?? 'اسم الموقع غير صالح' };
      data.name = String(value).trim();

    } else if (fieldKey === 'gov') {
      data.governorate = String(value).trim();
    } else if (fieldKey === 'project') {
      data.projectId = String(value);
    } else if (fieldKey === 'geofence') {
      data.geofenceRadiusMeters = Number(value);
    }

    const updated = await this.repository.updateSiteField(code, data);
    return { success: true, site: updated };
  }

  async listProjects(): Promise<Array<{ id: string; name: string }>> {
    return this.repository.listProjects();
  }

  async setWizardState(telegramId: bigint, state: SiteCreationWizardState): Promise<void> {
    if (this.redis) {
      await this.redis.set(`site_wizard:${telegramId}`, JSON.stringify(state), 'EX', 600);
    } else {
      this.localWizard.set(telegramId.toString(), state);
    }
  }

  async getWizardState(telegramId: bigint): Promise<SiteCreationWizardState | null> {
    if (this.redis) {
      const raw = await this.redis.get(`site_wizard:${telegramId}`);
      return raw ? (JSON.parse(raw) as SiteCreationWizardState) : null;
    }
    return this.localWizard.get(telegramId.toString()) || null;
  }

  async clearWizardState(telegramId: bigint): Promise<void> {
    if (this.redis) {
      await this.redis.del(`site_wizard:${telegramId}`);
    } else {
      this.localWizard.delete(telegramId.toString());
    }
  }

  async setEditState(telegramId: bigint, state: SiteEditFieldState): Promise<void> {
    if (this.redis) {
      await this.redis.set(`site_edit:${telegramId}`, JSON.stringify(state), 'EX', 600);
    } else {
      this.localEdit.set(telegramId.toString(), state);
    }
  }

  async getEditState(telegramId: bigint): Promise<SiteEditFieldState | null> {
    if (this.redis) {
      const raw = await this.redis.get(`site_edit:${telegramId}`);
      return raw ? (JSON.parse(raw) as SiteEditFieldState) : null;
    }
    return this.localEdit.get(telegramId.toString()) || null;
  }

  async clearEditState(telegramId: bigint): Promise<void> {
    if (this.redis) {
      await this.redis.del(`site_edit:${telegramId}`);
    } else {
      this.localEdit.delete(telegramId.toString());
    }
  }
}
