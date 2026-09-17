export type DashboardFeatureStatus = 'Draft' | 'Implemented' | 'Locked';

export interface DashboardFeature<Role extends string = string> {
  id: string;
  module: string;
  title: string;
  href: string;
  allowedRoles: Role[];
  subSection?: string | undefined;
  badge?: string | undefined;
  status: DashboardFeatureStatus;
}

export interface DashboardSubSection<Role extends string = string> {
  title: string;
  allowedRoles: Role[];
  badge?: string | undefined;
  iconName?: string | undefined;
}

export interface DashboardSectionManifest<Role extends string = string> {
  title: string;
  href: string;
  iconName: string;
  allowedRoles: Role[];
  badge?: string | undefined;
  subSections?: DashboardSubSection<Role>[] | undefined;
  features: DashboardFeature<Role>[];
}
