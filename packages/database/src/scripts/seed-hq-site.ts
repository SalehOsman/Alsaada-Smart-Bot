import { disconnectDatabase } from '../client.js';

export async function seedHqSite(): Promise<void> {
  console.log('ℹ️ [seedHqSite] Deprecated: Hardcoded site STE-HQ and project PRJ-MAIN-01 have been permanently removed.');
  console.log('   All operational sites and projects are dynamically provisioned via modules and administrative dashboard.');
  await disconnectDatabase();
}

if (process.argv[1]?.includes('seed-hq-site')) {
  seedHqSite()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
