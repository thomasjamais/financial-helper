# Dockerfile for Programmer Agent
FROM node:18-alpine

WORKDIR /workspace

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY agent/package*.json ./
RUN pnpm install

# Copy source code
COPY agent/src ./src
COPY agent/tsconfig.json ./
COPY policy.yaml ./

# Build the application
RUN pnpm run build

# Install runtime dependencies
RUN pnpm install --prod

# Set up git
RUN apk add --no-cache git

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S agent -u 1001

# Initialize git for the agent user
RUN git config --global user.name "AI Agent" && \
    git config --global user.email "agent@financial-helper.com" && \
    git config --global init.defaultBranch main

USER agent

CMD ["node", "dist/src/index.js"]