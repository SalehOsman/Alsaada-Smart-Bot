import type { NextConfig } from 'next';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Automatically locate and load root .env into process.env if available
(() => {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate, override: false });
      break;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
})();

const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  reactStrictMode: true,
  serverExternalPackages: ['@prisma/client', 'prisma', '@alsaada/database'],
  transpilePackages: [
    '@alsaada/core-components',
    '@alsaada/regional-engine',
    '@alsaada/national-id-engine',
    '@alsaada/settings',
    '@alsaada/workforce',
    '@alsaada/telemetry',
  ],
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer, nextRuntime }) => {
    if (!isServer || nextRuntime === 'edge') {
      config.resolve = config.resolve || {};
      const targetAdapter = path.resolve(
        process.cwd(),
        process.cwd().endsWith('admin-dashboard')
          ? '../../packages/telemetry/dist/adapters/next.js'
          : 'packages/telemetry/dist/adapters/next.js'
      );
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        '@alsaada/telemetry$': targetAdapter,
        '@alsaada/telemetry': targetAdapter,
      };
    }
    return config;
  },
  async redirects() {
    const botUsername = (process.env.TELEGRAM_BOT_USERNAME || 'Al_Saada_smart_bot').replace(/^@/, '').trim();
    return [
      {
        source: '/login',
        destination: `https://t.me/${botUsername}?start=dashboard_access`,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
