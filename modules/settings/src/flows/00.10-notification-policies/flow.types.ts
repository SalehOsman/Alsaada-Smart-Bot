export type PolicyScope = 'site' | 'hq';

export interface DepartmentPolicySummaryDto {
  departmentKey: string;
  departmentLabel: string;
  totalFeatures: number;
  enabledFeatures: number;
}

export interface DepartmentDetailDto {
  departmentKey: string;
  departmentLabel: string;
  scope: PolicyScope;
  features: {
    featureKey: string;
    label: string;
    enabled: boolean;
    isSilent: boolean;
  }[];
}
