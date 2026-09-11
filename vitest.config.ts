import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      DATABASE_ENCRYPTION_KEY: 'alsaada-default-key-min-32-chars-long!',
    },
    include: [
      '**/tests/**/*.spec.ts',
    ],
  },
});
