export interface AdminRouteDefinition {
  path: string;
  componentName: string;
  requiredRole: string;
}

export const adminRoutes: AdminRouteDefinition[] = [
  {
    path: '/modules/sample-domain',
    componentName: 'SampleDomainOverviewPage',
    requiredRole: 'SUPER_ADMIN',
  },
  {
    path: '/modules/sample-domain/records',
    componentName: 'SampleDomainRecordsPage',
    requiredRole: 'SUPER_ADMIN',
  },
];
