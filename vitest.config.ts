import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './apps/admin-dashboard/src'),
      '@alsaada/shared/testing': path.resolve(__dirname, './packages/shared/src/testing/index.ts'),
      '@alsaada/shared/logger': path.resolve(__dirname, './packages/shared/src/logger/index.ts'),
      '@alsaada/shared/domain': path.resolve(__dirname, './packages/shared/src/domain/index.ts'),
      '@alsaada/shared': path.resolve(__dirname, './packages/shared/src/index.ts'),
      '@alsaada/core-components/rich-message': path.resolve(__dirname, './packages/core-components/src/rich-message/index.ts'),
      '@alsaada/core-components': path.resolve(__dirname, './packages/core-components/src/index.ts'),
      '@alsaada/telemetry': path.resolve(__dirname, './packages/telemetry/src/index.ts'),
      '@alsaada/regional-engine': path.resolve(__dirname, './packages/regional-engine/src/index.ts'),
      '@alsaada/national-id-engine': path.resolve(__dirname, './packages/national-id-engine/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    env: {
      DATABASE_ENCRYPTION_KEY: process.env.DATABASE_ENCRYPTION_KEY || 'e5a6821beedded0737dfd5da86eb9a3c0b2b520749d53a50be9f5a97a4e81127',
      DATABASE_URL: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://alsaada_admin:alsaada_secure_pass_2026@127.0.0.1:5432/alsaada_test_db?schema=public',
    },
    include: [
      '**/tests/**/*.spec.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      include: [
        'packages/**/*.ts',
        'modules/**/*.ts',
        'apps/**/*.ts',
      ],
      exclude: [
        '**/tests/**',
        '**/*.spec.ts',
        '**/*.d.ts',
        '**/index.ts',
      ],
    },
    testTimeout: 35000,
  },
});
