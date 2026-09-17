export interface SiteDto {
  id: string;
  code: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'CLOSED';
  governorate: string | null;
  projectId: string | null;
  projectName?: string | null;
  geofenceRadiusMeters: number;
  latitude: number | null;
  longitude: number | null;
  workerCount: number;
}

export type SiteFieldKey = 'name' | 'project' | 'gov' | 'location' | 'geofence';

export interface SiteCreationWizardState {
  step: 'AWAIT_NAME' | 'CONFIRM_CODE' | 'SELECT_GOV' | 'SELECT_GEOFENCE' | 'SELECT_PROJECT' | 'AWAIT_LOCATION';
  name?: string | undefined;
  code?: string | undefined;
  gov?: string | undefined;
  geofenceRadius?: number | undefined;
  projectId?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  promptMessageId?: number | undefined;
  timestamp: number;
}

export interface SiteEditFieldState {
  siteCode: string;
  fieldKey: SiteFieldKey;
  promptMessageId: number;
  timestamp: number;
}
