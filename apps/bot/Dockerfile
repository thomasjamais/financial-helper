FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.12.0

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json tsconfig.base.json ./
COPY packages packages
COPY apps/bot apps/bot

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the bot
WORKDIR /app/apps/bot
RUN pnpm build

# Production image
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.12.0

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json tsconfig.base.json ./
COPY packages packages
COPY apps/bot apps/bot

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files
COPY --from=builder /app/apps/bot/dist ./apps/bot/dist

WORKDIR /app/apps/bot

CMD ["node", "dist/bot.js"]



