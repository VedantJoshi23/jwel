# syntax=docker/dockerfile:1
# Build context = monorepo root (pnpm lockfile + workspace manifest live there).
#   docker build -f apps/api/Dockerfile -t jwel-api:latest .

# ---------- deps ----------
FROM node:20-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /repo
# Only the manifests, so this layer caches until a dependency actually changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @jwel/api...

# ---------- build ----------
FROM deps AS build
WORKDIR /repo
COPY apps/api apps/api
WORKDIR /repo/apps/api
# Prisma client must be generated before tsc; schema is NOT at the default path.
RUN pnpm prisma:generate && pnpm build

# ---------- runtime ----------
FROM node:20-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

ENV NODE_ENV=production
WORKDIR /app

# NOTE: we carry the full node_modules (devDeps included) rather than doing a
# prod-only reinstall. Reason: the generated Prisma client lives inside
# node_modules/.prisma, and pnpm's symlinked layout makes cherry-picking it
# across stages fragile. Costs ~200MB of image size and buys correctness plus
# a working `prisma migrate deploy` in the same image. Revisit with
# `pnpm deploy --prod` once the deploy is otherwise stable.
COPY --from=build /repo/apps/api/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/package.json ./package.json

# Prisma schema + migrations: needed by `prisma migrate deploy`, which runs
# from this same image as a one-shot before the API starts.
COPY --from=build /repo/apps/api/src/prisma ./src/prisma

# scripts/ and tsconfig.json are required by the create-admin one-shot, which
# runs through ts-node rather than the compiled bundle.
COPY --from=build /repo/apps/api/scripts ./scripts
COPY --from=build /repo/apps/api/tsconfig.json ./tsconfig.json

# Uploads dir must be a mount point owned by the app user, or the filesystem
# storage adapter fails on first write.
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

EXPOSE 4000
CMD ["node", "dist/main.js"]
