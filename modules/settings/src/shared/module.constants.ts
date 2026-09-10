export const SETTINGS_REDIS_KEYS = {
  MAINTENANCE_MODE: 'system:maintenance_mode',
  ALERT_POLICY: 'system:alert_policy',
  IMPERSONATED_ROLE_PREFIX: 'impersonated_role:',
  USER_BREADCRUMBS_PREFIX: 'user_breadcrumbs:',
} as const;

export const SETTINGS_ACTIONS = {
  MENU_ROOT: 'menu:super_admin_settings',
  MAIN_MENU: 'action:main_menu',
  SUB_CORPORATE: 'action:settings_sub:corporate',
  SUB_IDENTITY: 'action:settings_sub:identity',
  SUB_SYSTEM: 'action:settings_sub:system',
  EXIT_IMPERSONATE: 'action:exit_impersonate',
} as const;
