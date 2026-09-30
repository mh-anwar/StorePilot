# StorePilot production image. Two stages: build, then a runtime with only
# production dependencies. The Prisma client is generated at build time;
# migrations run at container start against the volume at /data.

# --- Build stage ----------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Enable the pinned pnpm version from package.json's packageManager field.
RUN corepack enable

# Install all deps (incl. dev) so the build can run.
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# Build the app.
COPY . .
RUN pnpm run build

# --- Runtime stage --------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

# Prisma's query engine links against openssl.
RUN apk add --no-cache openssl && corepack enable

# Production dependencies only, then generate the Prisma client here (as root,
# for this image's platform) so nothing has to write to node_modules at runtime.
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --prod
COPY prisma ./prisma
RUN node_modules/.bin/prisma generate

COPY --from=build /app/build ./build

# SQLite lives on a mounted volume at /data.
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=file:/data/storepilot.sqlite

RUN mkdir -p /data && chown -R node:node /data
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
# Apply migrations, then serve. No package manager at runtime.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node_modules/.bin/react-router-serve ./build/server/index.js"]
