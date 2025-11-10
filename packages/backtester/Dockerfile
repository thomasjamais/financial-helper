FROM node:20-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app

# Install deps (monorepo)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps

RUN pnpm install --frozen-lockfile

# Build only backtester
RUN pnpm --filter @pkg/backtester build

FROM node:20-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=base /app/packages/backtester/dist ./dist
COPY --from=base /app/packages/backtester/package.json ./package.json
RUN corepack enable && pnpm install --prod --frozen-lockfile || true

EXPOSE 8081
CMD ["node", "dist/server.js"]








