# syntax=docker/dockerfile:1
# ==============================================================================
# Al-Saada Smart Bot Enterprise — Production Multi-Stage Dockerfile
# ==============================================================================

# -------------------------------------------------------------
# Stage 1: Build & Compile
# -------------------------------------------------------------
FROM node:24-alpine AS builder

ENV DATABASE_URL="postgresql://build_placeholder:dummy@127.0.0.1:5432/build_db?schema=public"

WORKDIR /app

# Install pnpm & necessary build tools
RUN npm install -g pnpm@12.4.2
RUN apk add --no-cache openssl git

# Copy monorepo manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/database/package.json packages/database/
COPY packages/rbac/package.json packages/rbac/
COPY packages/regional-engine/package.json packages/regional-engine/
COPY packages/national-id-engine/package.json packages/national-id-engine/
COPY packages/core-components/package.json packages/core-components/
COPY packages/shared/package.json packages/shared/
COPY packages/telemetry/package.json packages/telemetry/
COPY packages/ai-vision-engine/package.json packages/ai-vision-engine/
COPY packages/google-engine/package.json packages/google-engine/
COPY modules/workforce/package.json modules/workforce/
COPY modules/settings/package.json modules/settings/
COPY modules/sandbox/package.json modules/sandbox/
COPY apps/admin-dashboard/package.json apps/admin-dashboard/
COPY apps/docs/package.json apps/docs/
COPY apps/bot-server/package.json apps/bot-server/

# Install all dependencies (including devDependencies for build)
ENV GIT_DIR=/tmp/alsaada-build.git
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    git init --bare "$GIT_DIR" \
    && pnpm config set package-import-method copy \
    && pnpm config set fetch-retries 5 \
    && pnpm config set fetch-retry-maxtimeout 120000 \
    && pnpm config set network-concurrency 4 \
    && pnpm install --frozen-lockfile=true

# Copy source without replacing workspace-local node_modules links.
COPY packages/database/prisma/ packages/database/prisma/
COPY packages/database/src/ packages/database/src/
COPY packages/database/tsconfig.json packages/database/
COPY packages/database/prisma.config.ts packages/database/
COPY packages/rbac/src/ packages/rbac/src/
COPY packages/rbac/tsconfig.json packages/rbac/
COPY packages/regional-engine/src/ packages/regional-engine/src/
COPY packages/regional-engine/tsconfig.json packages/regional-engine/
COPY packages/national-id-engine/src/ packages/national-id-engine/src/
COPY packages/national-id-engine/tsconfig.json packages/national-id-engine/
COPY packages/core-components/src/ packages/core-components/src/
COPY packages/core-components/tsconfig.json packages/core-components/
COPY packages/shared/src/ packages/shared/src/
COPY packages/shared/tsconfig.json packages/shared/
COPY packages/telemetry/src/ packages/telemetry/src/
COPY packages/telemetry/tsconfig.json packages/telemetry/
COPY packages/ai-vision-engine/src/ packages/ai-vision-engine/src/
COPY packages/ai-vision-engine/tsconfig.json packages/ai-vision-engine/
COPY packages/google-engine/src/ packages/google-engine/src/
COPY packages/google-engine/tsconfig.json packages/google-engine/
COPY modules/workforce/src/ modules/workforce/src/
COPY modules/workforce/database/ modules/workforce/database/
COPY modules/workforce/index.ts modules/workforce/
COPY modules/workforce/module.contract.json modules/workforce/
COPY modules/workforce/tsconfig.json modules/workforce/
COPY modules/settings/src/ modules/settings/src/
COPY modules/settings/database/ modules/settings/database/
COPY modules/settings/index.ts modules/settings/
COPY modules/settings/module.contract.json modules/settings/
COPY modules/settings/tsconfig.json modules/settings/
COPY modules/sandbox/src/ modules/sandbox/src/
COPY modules/sandbox/database/ modules/sandbox/database/
COPY modules/sandbox/index.ts modules/sandbox/
COPY modules/sandbox/module.contract.json modules/sandbox/
COPY modules/sandbox/tsconfig.json modules/sandbox/
COPY tools/modules/compose-database.ts tools/modules/compose-database.ts
COPY apps/bot-server/src/ apps/bot-server/src/
COPY apps/bot-server/assets/ apps/bot-server/assets/
COPY apps/bot-server/tsconfig.json apps/bot-server/
COPY tsconfig.json ./

# Generate Prisma Client
RUN pnpm --filter @alsaada/database db:generate

# Compile TypeScript across all packages, modules and the bot server (parallel topological build)
RUN pnpm --filter @alsaada/bot-server... build

# -------------------------------------------------------------
# Stage 2: Production Runner
# -------------------------------------------------------------
FROM node:24-alpine AS runner

WORKDIR /app

RUN npm install -g pnpm@12.4.2
RUN apk add --no-cache openssl dumb-init tzdata postgresql-client git

ARG APP_VERSION=2.0.0-alpha.1
ARG GIT_COMMIT_SHA=unknown
ARG BUILD_TIME=unknown
ENV APP_VERSION=$APP_VERSION
ENV GIT_COMMIT_SHA=$GIT_COMMIT_SHA
ENV BUILD_TIME=$BUILD_TIME

ENV NODE_ENV=production
ENV PORT=3000
ENV TZ=Africa/Cairo

# Copy node_modules & build artifacts from builder with node ownership
COPY --from=builder --chown=node:node /app /app

USER node

EXPOSE 3000

# Use dumb-init to handle PID 1 signal forwarding (graceful shutdown)
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/bot-server/dist/index.js"]
