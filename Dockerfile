# Build stage
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Schema references env("DATABASE_URL") / env("DIRECT_URL"); generate does not connect
ENV DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/postgres"
ENV DIRECT_URL="postgresql://postgres:postgres@127.0.0.1:5432/postgres"

RUN npm ci
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src

RUN npm run build
RUN npm prune --omit=dev

# Runtime stage
FROM node:20-slim

ENV NODE_ENV=production
ENV PORT=8080

# Prisma engines + TLS for Postgres/HTTPS clients
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Winston writes to logs/ — ensure non-root can write
RUN mkdir -p /app/logs && chown -R node:node /app

USER node

EXPOSE 8080

CMD ["node", "dist/server.js"]
