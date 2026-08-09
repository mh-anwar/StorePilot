# StorePilot production image. Two stages: build, then a slim runtime
# that keeps only production dependencies. Prisma generate runs at startup
# (docker-start -> setup), so the prisma CLI is kept in the runtime stage.

# --- Build stage ----------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Enable the pinned pnpm version from package.json's packageManager field.
RUN corepack enable

# Install all deps (incl. dev) so the build can run.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build the app.
COPY . .
RUN pnpm run build

# --- Runtime stage --------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

# Prisma's sqlite engine links against openssl; install it into alpine.
RUN apk add --no-cache openssl

RUN corepack enable

# Copy the lockfile + package.json, install only production deps, then prune.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod && pnpm prune --prod

# Prisma needs the schema and migrations for `prisma generate` / `migrate deploy`.
COPY prisma ./prisma

# Copy the built server output.
COPY --from=build /app/build ./build

# SQLite lives on a mounted volume at /data.
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=file:/data/storepilot.sqlite

# Run as the non-root node user; ensure it can write /data.
RUN mkdir -p /data && chown -R node:node /data
USER node

EXPOSE 3000
CMD ["pnpm", "run", "docker-start"]