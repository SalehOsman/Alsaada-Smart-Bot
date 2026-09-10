export function validateSiteScope(siteIdOrGlobal: string): boolean {
  if (siteIdOrGlobal === 'GLOBAL') return true;
  return /^[a-zA-Z0-9_-]{3,50}$/.test(siteIdOrGlobal);
}
