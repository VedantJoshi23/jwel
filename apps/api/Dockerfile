# syntax=docker/dockerfile:1
#
# Build context = monorepo root (npm workspaces; the lockfile lives there).
#   docker build -f apps/api/Dockerfile -t jwel-api:<git-sha> .
#
# npm, not pnpm: the project's package.json still says
# `"packageManager": "pnpm@9.0.0"` and there is a pnpm-lock.yaml on disk, but
# every install that has actually been run against this repo — locally and
# in CI — uses `npm install` against package-lock.json (see ci.yml's own
# comment on this). The pnpm lockfile is stale. Building against it here
# would resolve a different dependency tree than the one every test in this
# repo has ever run against.

# ---------- deps ----------
FROM node:22-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

# Only manifests, so this layer caches until a dependency actually changes.
# npm workspaces needs every workspace's package.json present (even ones
# this image never uses) or `npm ci` errors that it can't find them.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/utils/package.json packages/utils/package.json
RUN npm ci

# ---------- build ----------
FROM deps AS build
COPY apps/api apps/api
WORKDIR /repo/apps/api
# Prisma client must be generated before tsc; the schema is not at Prisma's
# default path (src/prisma/schema.prisma, not prisma/schema.prisma).
RUN npx prisma generate --schema=src/prisma/schema.prisma && npm run build

# ---------- runtime ----------
FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app

# npm workspaces hoist deps into the root node_modules, so the runtime image
# keeps the same /app/apps/api layout as the repo — node's module resolution
# walks up from apps/api looking for node_modules and finds it at /app.
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json

# Prisma schema + migrations: needed by `prisma migrate deploy`, which runs
# from this same image as a one-shot before the API starts.
COPY --from=build /repo/apps/api/src/prisma ./apps/api/src/prisma

# scripts/ and tsconfig.json are required by the create-admin one-shot, which
# runs through ts-node rather than the compiled bundle.
COPY --from=build /repo/apps/api/scripts ./apps/api/scripts
COPY --from=build /repo/apps/api/tsconfig.json ./apps/api/tsconfig.json

WORKDIR /app/apps/api

# Uploads dir must be a mount point owned by the app user, or the filesystem
# storage adapter fails on first write.
RUN mkdir -p /app/apps/api/uploads && chown -R node:node /app
USER node

EXPOSE 4000
CMD ["node", "dist/main.js"]
