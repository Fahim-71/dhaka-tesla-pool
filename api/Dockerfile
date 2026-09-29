# API image: Node 20 + Prisma.
# On start it applies migrations, runs the (idempotent) seed, then serves.
FROM node:20-alpine

# Prisma's query engine needs OpenSSL.
RUN apk add --no-cache openssl

WORKDIR /app
ENV NODE_ENV=production

# Install dependencies first so this layer is cached between code changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

# Run as the unprivileged user that ships with the node image.
USER node

EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

# `exec` makes node PID 1, so it receives Docker's SIGTERM and shuts down cleanly.
CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed.js && exec node src/server.js"]
