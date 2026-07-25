# syntax=docker/dockerfile:1
#
# Build context = monorepo root (npm workspaces; the lockfile lives there).
#   docker build -f apps/web/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api/v1 \
#     --build-arg NEXT_PUBLIC_API_ORIGIN=https://api.example.com \
#     -t jwel-web:<git-sha> .
#
# NEXT_PUBLIC_* vars are inlined into the JS bundle at build time, not read
# at container start — get them right here or you're rebuilding the image.

# ---------- deps ----------
FROM node:22-bookworm-slim AS deps
WORKDIR /repo

# Only manifests, so this layer caches until a dependency actually changes.
# npm workspaces needs every workspace's package.json present (even ones
# this image never uses) or `npm ci` errors that it can't find them.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/utils/package.json packages/utils/package.json
RUN npm ci

# ---------- build ----------
FROM deps AS build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_API_ORIGIN
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_API_ORIGIN=${NEXT_PUBLIC_API_ORIGIN}

COPY apps/web apps/web
WORKDIR /repo/apps/web
RUN npm run build

# ---------- runtime ----------
# `output: 'standalone'` (next.config.mjs) traces only the node_modules this
# app actually needs, so the runtime stage never runs npm install and can be
# alpine — no Prisma engines here, unlike the API image.
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Standalone output mirrors the monorepo path (apps/web/server.js +
# hoisted node_modules at the root) because outputFileTracingRoot points at
# the repo root — see next.config.mjs for why.
COPY --from=build /repo/apps/web/.next/standalone ./
# Static assets and public/ are deliberately excluded from the standalone
# trace and must be copied in by hand, or every asset and image 404s.
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public

RUN chown -R node:node /app
USER node

WORKDIR /app/apps/web
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000
CMD ["node", "server.js"]
