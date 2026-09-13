# ==============================================================================
# Al-Saada Smart Bot Enterprise — Production Multi-Stage Dockerfile
# ==============================================================================

# -------------------------------------------------------------
# Stage 1: Build & Compile
# -------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm & necessary build tools
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache openssl git

# Copy monorepo manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/database/package.json packages/database/
COPY packages/regional-engine/package.json packages/regional-engine/
COPY packages/national-id-engine/package.json packages/national-id-engine/
COPY packages/core-components/package.json packages/core-components/
COPY packages/telemetry/package.json packages/telemetry/
COPY modules/workforce/package.json modules/workforce/
COPY modules/settings/package.json modules/settings/
COPY apps/bot-server/package.json apps/bot-server/

# Install all dependencies (including devDependencies for build)
ENV GIT_DIR=/tmp/alsaada-build.git
RUN git init --bare "$GIT_DIR" \
    && pnpm install --frozen-lockfile=false

# Copy source without replacing workspace-local node_modules links.
COPY packages/database/prisma/ packages/database/prisma/
COPY packages/database/src/ packages/database/src/
COPY packages/database/tsconfig.json packages/database/
COPY packages/regional-engine/src/ packages/regional-engine/src/
COPY packages/regional-engine/tsconfig.json packages/regional-engine/
COPY packages/national-id-engine/src/ packages/national-id-engine/src/
COPY packages/national-id-engine/tsconfig.json packages/national-id-engine/
COPY packages/core-components/src/ packages/core-components/src/
COPY packages/core-components/tsconfig.json packages/core-components/
COPY packages/telemetry/src/ packages/telemetry/src/
COPY packages/telemetry/tsconfig.json packages/telemetry/
COPY modules/workforce/src/ modules/workforce/src/
COPY modules/workforce/index.ts modules/workforce/
COPY modules/workforce/module.contract.json modules/workforce/
COPY modules/workforce/tsconfig.json modules/workforce/
COPY modules/settings/src/ modules/settings/src/
COPY modules/settings/index.ts modules/settings/
COPY modules/settings/module.contract.json modules/settings/
COPY modules/settings/tsconfig.json modules/settings/
COPY apps/bot-server/src/ apps/bot-server/src/
COPY apps/bot-server/assets/ apps/bot-server/assets/
COPY apps/bot-server/tsconfig.json apps/bot-server/
COPY tsconfig.json ./

# Generate Prisma Client
RUN pnpm --filter @alsaada/database db:generate

# Compile TypeScript across all packages, modules and the bot server
RUN pnpm --filter @alsaada/regional-engine build
RUN pnpm --filter @alsaada/national-id-engine build
RUN pnpm --filter @alsaada/database build
RUN pnpm --filter @alsaada/core-components build
RUN pnpm --filter @alsaada/telemetry build
RUN pnpm --filter @alsaada/workforce build
RUN pnpm --filter @alsaada/settings build
RUN pnpm --filter @alsaada/bot-server build

# -------------------------------------------------------------
# Stage 2: Production Runner
# -------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache openssl dumb-init

ENV NODE_ENV=production
ENV PORT=3000

# Copy node_modules & build artifacts from builder with node ownership
COPY --from=builder --chown=node:node /app /app

USER node

EXPOSE 3000

# Use dumb-init to handle PID 1 signal forwarding (graceful shutdown)
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/bot-server/dist/index.js"]
