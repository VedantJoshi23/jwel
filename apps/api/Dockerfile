# syntax=docker/dockerfile:1
#
# Build context = monorepo root (npm workspaces; the lockfile lives there).
#   docker build -f apps/api/Dockerfile -t jwel-api:<git-sha> .
#
# npm, against package-lock.json — the only lockfile this repo has. It used
# to carry a second, stale pnpm-lock.yaml alongside a `packageManager: pnpm`
# field while every install that actually ran (locally, in CI, and here) used
# npm. That split bit exactly once: a dependency added with `pnpm add` updated
# only the pnpm side, package.json then listed a package package-lock.json had
# never heard of, and this stage failed on `npm ci` while every local check
# stayed green. The pnpm lockfile and the field are gone; there is now one
# lockfile and no way for the two to disagree.

# ---------- deps ----------
FROM node:22-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

# Only manifests, so this layer caches until a dependency actually changes.
# npm workspaces needs every workspace's package.json present (even ones this
# image never uses) or `npm ci` errors that it can't find them. The root
# package.json globs `apps/*` and `packages/*`, but `packages/` does not exist
# in this repo — apps/api and apps/web are the only two workspaces, and they
# are all package-lock.json records. Don't add `COPY packages/…` lines back
# unless that directory actually exists; a COPY of a missing path fails the
# build outright.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
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

# /app/uploads — matching UPLOADS_DIR and the `uploads:` volume mount in
# deploy/docker-compose.api.yml, NOT the repo-relative apps/api/uploads. The
# path must exist in the image before the chown: Docker seeds an empty named
# volume from the image's directory (contents and ownership), but when the
# mount path is absent it creates it root:root instead — and this container
# runs as `node`, so the filesystem storage adapter's mkdir/writeFile would
# fail EACCES on the first product image upload.
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

EXPOSE 4000
CMD ["node", "dist/main.js"]
