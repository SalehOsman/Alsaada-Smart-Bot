export interface MaintenanceStatusDto {
  isMaintenanceActive: boolean;
  toggledAt: Date | null;
  toggledById: bigint | null;
}

export interface PrewarmResultDto {
  durationMs: number;
  workersLoaded: number;
  sitesLoaded: number;
  departmentsLoaded: number;
  jobsLoaded: number;
  memoryUsedMb: number;
}
