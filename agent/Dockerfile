FROM node:20-alpine
WORKDIR /app
COPY agent/package.json agent/package-lock.json* ./
RUN corepack enable && npm ci --only=production
COPY agent/index.js ./index.js
CMD ["node", "index.js"]
