import type { Redis } from 'ioredis';
import {
  NotificationPolicyEngine,
  FEATURE_POLICIES_CATALOG,
  type PolicyStorageAdapter,
} from '@alsaada/core-components';
import type { DepartmentDetailDto, DepartmentPolicySummaryDto, PolicyScope } from './flow.types.js';
import { NotificationPoliciesRepository } from './flow.repository.js';

export class NotificationPoliciesService {
  private readonly engine: NotificationPolicyEngine;
  private readonly repo: NotificationPoliciesRepository;

  constructor(repoOrRedis?: NotificationPoliciesRepository | Redis) {
    if (repoOrRedis && 'getPolicy' in repoOrRedis) {
      this.repo = repoOrRedis;
    } else {
      this.repo = new NotificationPoliciesRepository(repoOrRedis);
    }

    const adapter: PolicyStorageAdapter = {
      get: (key: string) => this.repo.getPolicy(key),
      set: (key: string, val: string) => this.repo.setPolicy(key, val),
    };

    this.engine = new NotificationPolicyEngine(adapter);
  }

  async getScopeDepartmentSummaries(scope: PolicyScope): Promise<DepartmentPolicySummaryDto[]> {
    const departmentsMap = new Map<string, { label: string; features: string[] }>();

    for (const item of FEATURE_POLICIES_CATALOG) {
      if (!departmentsMap.has(item.departmentKey)) {
        departmentsMap.set(item.departmentKey, {
          label: item.departmentLabel,
          features: [],
        });
      }
      departmentsMap.get(item.departmentKey)!.features.push(item.featureKey);
    }

    const summaries: DepartmentPolicySummaryDto[] = [];

    for (const [deptKey, dept] of departmentsMap.entries()) {
      let enabledCount = 0;
      for (const fKey of dept.features) {
        const isEnabled =
          scope === 'site'
            ? await this.engine.isSiteNotificationEnabled(fKey)
            : await this.engine.isHqNotificationEnabled(fKey);
        if (isEnabled) enabledCount++;
      }

      summaries.push({
        departmentKey: deptKey,
        departmentLabel: dept.label,
        totalFeatures: dept.features.length,
        enabledFeatures: enabledCount,
      });
    }

    return summaries;
  }

  async getDepartmentDetail(
    scope: PolicyScope,
    departmentKey: string
  ): Promise<DepartmentDetailDto> {
    const items = FEATURE_POLICIES_CATALOG.filter((f) => f.departmentKey === departmentKey);
    const label = items[0]?.departmentLabel ?? departmentKey;

    const features = await Promise.all(
      items.map(async (item) => {
        const enabled =
          scope === 'site'
            ? await this.engine.isSiteNotificationEnabled(item.featureKey)
            : await this.engine.isHqNotificationEnabled(item.featureKey);
        const isSilent = await this.engine.isSilentNotification(item.featureKey);

        return {
          featureKey: item.featureKey,
          label: item.label,
          enabled,
          isSilent,
        };
      })
    );

    return {
      departmentKey,
      departmentLabel: label,
      scope,
      features,
    };
  }

  async toggleFeaturePolicy(scope: PolicyScope, featureKey: string): Promise<boolean> {
    if (scope === 'site') {
      return this.engine.toggleSitePolicy(featureKey);
    }
    return this.engine.toggleHqPolicy(featureKey);
  }

  async toggleFeatureSilent(featureKey: string): Promise<boolean> {
    return this.engine.toggleSilentPolicy(featureKey);
  }

  async resetScopeToDefaults(scope: PolicyScope): Promise<void> {
    const pattern = `notif:policy:${scope}:*`;
    await this.repo.clearKeysByPattern(pattern);
  }
}
