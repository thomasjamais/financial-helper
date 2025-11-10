FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.12.0

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json tsconfig.base.json ./
COPY scripts scripts
COPY packages packages
COPY apps/api apps/api

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the API and its dependencies using turbo from root
# This ensures all workspace dependencies are built first
WORKDIR /app
RUN pnpm exec turbo run build --filter=@apps/api

# Verify that the dist directory was created
RUN test -d /app/apps/api/dist || (echo "ERROR: dist directory not found after build" && exit 1)

# Production image
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.12.0

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json tsconfig.base.json ./
COPY scripts scripts
COPY packages packages
COPY apps/api apps/api

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files from packages (they are dependencies of the API)
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/shared-kernel/dist ./packages/shared-kernel/dist
COPY --from=builder /app/packages/exchange-adapters/dist ./packages/exchange-adapters/dist
COPY --from=builder /app/packages/risk-engine/dist ./packages/risk-engine/dist
COPY --from=builder /app/packages/trade-monitor/dist ./packages/trade-monitor/dist

# Copy built API files
COPY --from=builder /app/apps/api/dist ./apps/api/dist

WORKDIR /app/apps/api

EXPOSE 8080

CMD ["node", "dist/index.js"]



