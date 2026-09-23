export { seedBotMenuCatalog } from '../../src/scripts/seed-bot-menu-catalog.js';

import { seedBotMenuCatalog } from '../../src/scripts/seed-bot-menu-catalog.js';

if (process.argv[1]?.includes('bot-menu-catalog.seed')) {
  seedBotMenuCatalog()
    .then((res) => {
      console.log('Summary:', res);
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Failed to seed bot menu catalog:', err);
      process.exit(1);
    });
}
