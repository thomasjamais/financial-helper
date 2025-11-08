FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.12.0

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json tsconfig.base.json ./
COPY scripts scripts
COPY packages packages
COPY apps/bot apps/bot

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the bot and its dependencies using turbo from root
# This ensures all workspace dependencies are built first
WORKDIR /app
RUN pnpm exec turbo run build --filter=@apps/bot

# Verify that the dist directory was created
RUN test -d /app/apps/bot/dist || (echo "ERROR: dist directory not found after build" && exit 1)

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
COPY apps/bot apps/bot

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files from packages (they are dependencies of the bot)
COPY --from=builder /app/packages/event-bus/dist ./packages/event-bus/dist
COPY --from=builder /app/packages/exchange-adapters/dist ./packages/exchange-adapters/dist

# Copy built bot files
COPY --from=builder /app/apps/bot/dist ./apps/bot/dist

WORKDIR /app/apps/bot

CMD ["node", "dist/bot.js"]



