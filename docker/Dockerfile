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
RUN apk add --no-cache openssl

# Copy monorepo manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/database/package.json packages/database/
COPY packages/regional-engine/package.json packages/regional-engine/
COPY packages/national-id-engine/package.json packages/national-id-engine/
COPY packages/core-components/package.json packages/core-components/
COPY modules/workforce/package.json modules/workforce/
COPY modules/settings/package.json modules/settings/
COPY apps/bot-server/package.json apps/bot-server/

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile=false

# Copy source code across packages, modules and apps
COPY packages/ packages/
COPY modules/ modules/
COPY apps/ apps/
COPY tsconfig.json ./

# Generate Prisma Client
RUN pnpm --filter @alsaada/database db:generate

# Compile TypeScript across all packages, modules and the bot server
RUN pnpm --filter @alsaada/regional-engine build
RUN pnpm --filter @alsaada/national-id-engine build
RUN pnpm --filter @alsaada/database build
RUN pnpm --filter @alsaada/core-components build
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
