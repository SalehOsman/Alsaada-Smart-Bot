export function validateMaintenanceToggle(current: boolean, requested: boolean): boolean {
  return current !== requested;
}
