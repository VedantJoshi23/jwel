# Deploying Jwel to a self-hosted server

Two independent compose stacks sharing one external Docker network. The split is
deliberate: `docker compose down` on the app stack can never touch the database,
and the `pgdata` volume is declared only in the Postgres file so a stray
`down -v` on the app side cannot delete it.

```
deploy/
  docker-compose.postgres.yml   data stack   — brought up once, rarely touched
  docker-compose.api.yml        app stack    — api + web + Caddy, redeployed on every release
  Caddyfile                     TLS + reverse proxy for both api.* and shop.*
```

The app stack runs two images: `jwel-api` (`apps/api/Dockerfile`) and `jwel-web`
(`apps/web/Dockerfile`, Next.js standalone build). Both need real domains —
Caddy's automatic HTTPS cannot issue a Let's Encrypt certificate for a bare IP
address, so you need at least two DNS A records (e.g. `api.yourdomain.com` and
`shop.yourdomain.com`) pointed at the host before step 6 will work.

---

## 0. One-time host setup

```bash
docker network create jwel-net
mkdir -p backups        # from the deploy/ directory — see RUNBOOK.md §4 and §11
```

Create two env files next to the compose files, both `chmod 600`:

**`.env`** (read by the Postgres stack)

```ini
POSTGRES_USER=jwel
POSTGRES_PASSWORD=<generate: openssl rand -base64 32>
POSTGRES_DB=jwel
```

**`.env.production`** (read by the API stack) — see `apps/api/.env.example` for
the annotated full list. At minimum:

```ini
NODE_ENV=production
GH_OWNER=<your github org/user>
API_TAG=<git sha, never "latest">
WEB_TAG=<same git sha>

POSTGRES_USER=jwel
POSTGRES_PASSWORD=<same as above>
POSTGRES_DB=jwel

JWT_SECRET=<generate: openssl rand -base64 48>
CORS_ALLOWED_ORIGINS=https://shop.example.com
PUBLIC_BASE_URL=https://api.example.com
FRONTEND_URL=https://shop.example.com

STORAGE_PROVIDER=filesystem
UPLOADS_DIR=/app/uploads
```

The API validates all of these at boot (`src/config/env.validation.ts`) and
refuses to start if any are missing or still pointing at localhost. That is
intentional — every one of them fails silently otherwise.

---

## 1. Build and publish both images

```bash
# from the repo root
GIT_SHA=$(git rev-parse --short HEAD)
echo $GITHUB_TOKEN | docker login ghcr.io -u $GH_OWNER --password-stdin

docker build -f apps/api/Dockerfile -t ghcr.io/$GH_OWNER/jwel-api:$GIT_SHA .
docker push ghcr.io/$GH_OWNER/jwel-api:$GIT_SHA

# NEXT_PUBLIC_* vars are baked into the JS bundle at build time, not read at
# container start — get the domains right here or you're rebuilding the image.
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1 \
  --build-arg NEXT_PUBLIC_API_ORIGIN=https://api.yourdomain.com \
  -t ghcr.io/$GH_OWNER/jwel-web:$GIT_SHA .
docker push ghcr.io/$GH_OWNER/jwel-web:$GIT_SHA
```

Tag both with the same git SHA. Deploying `latest` means you cannot roll back,
because the tag you would roll back *to* now points at the broken build.

---

## 2. Bring up the database

```bash
docker compose -f docker-compose.postgres.yml up -d
docker compose -f docker-compose.postgres.yml ps      # wait for healthy
```

Postgres is bound to `127.0.0.1:5432` — reachable over an SSH tunnel for admin
work, invisible to the internet.

---

## 3. Migrate, then start

```bash
docker compose -f docker-compose.api.yml run --rm migrate
docker compose -f docker-compose.api.yml up -d
docker compose -f docker-compose.api.yml ps           # api and web both "healthy"
docker compose -f docker-compose.api.yml logs -f api web
```

Migrations run as a one-shot from the same image being deployed, so the schema
always matches the code. Kept out of the API container's `CMD` so two replicas
could never race. `up -d` starts `api`, `web`, and `caddy` together — `migrate`
and `create-admin` are one-shot profiles and don't start with it.

---

## 4. Create the admin account

Nothing else in the codebase can produce an `ADMIN`; registration hardcodes
`CUSTOMER` and there is no role-change endpoint.

```bash
ADMIN_EMAIL=owner@example.com \
ADMIN_PASSWORD='<20+ random chars>' \
docker compose -f docker-compose.api.yml run --rm create-admin
```

Idempotent — re-running promotes the account and resets its password, so it
doubles as the lockout recovery path.

> **Never run `prisma db seed` against this database.** The seed script
> (`apps/api/src/prisma/seed.ts`) resets the catalogue and `deleteMany`s
> `product_media`, which would orphan every image the client has uploaded. It
> refuses to run when `NODE_ENV=production`; do not work around that.

---

## 5. Migrate the existing uploads

There are ~1,046 files already in `apps/api/uploads/products/`, with matching
`product_media` rows. They must be moved into the volume or every image 404s.

```bash
docker compose -f docker-compose.api.yml cp \
  ../apps/api/uploads/products/. api:/app/uploads/products/
docker compose -f docker-compose.api.yml exec api sh -c 'ls /app/uploads/products | wc -l'
```

Cross-check that count against the database:

```bash
docker compose -f docker-compose.postgres.yml exec postgres \
  psql -U jwel -d jwel -c 'select count(*) from product_media;'
```

The two numbers should match. A row without a file renders as a broken image;
a file without a row is invisible but wastes disk.

---

## 6. Verify

```bash
curl -fsS https://api.yourdomain.com/health            # {"status":"ok",…}
curl -fsS https://api.yourdomain.com/health/ready      # {"status":"ok","database":"ok"}
curl -s -o /dev/null -w '%{http_code}\n' https://api.yourdomain.com/docs   # 404 in prod
curl -s -o /dev/null -w '%{http_code}\n' https://shop.yourdomain.com/      # 200
```

Then log into `https://shop.yourdomain.com/admin` with the account from step 4,
open a product, and confirm its photos render — that exercises the web
container, the API container, Postgres, and the uploads volume all at once.

---

## Backups

Postgres and the uploads volume must be backed up **together** — restoring one
without the other leaves dangling image references.

Both commands below are run from `deploy/` and write into `deploy/backups`
(created in §0). RUNBOOK.md §11 schedules the first one via cron.

```bash
docker compose -f docker-compose.postgres.yml exec -T postgres \
  pg_dump -U jwel jwel | gzip > backups/db-$(date +%F).sql.gz

docker run --rm -v jwel_uploads:/data -v "$PWD/backups":/out alpine \
  tar czf /out/uploads-$(date +%F).tar.gz -C /data .
```

`exec -T` disables TTY allocation — without it the redirect above produces a
`pg_dump` archive with CR bytes injected, which restores as a corrupt file.
That matters most from cron, where there is no TTY at all.

## Rolling back

```bash
API_TAG=<previous-sha> WEB_TAG=<previous-sha> docker compose -f docker-compose.api.yml up -d
```

Note this rolls back code only. If the release included a migration, roll that
back deliberately — `prisma migrate deploy` has no automatic down path.

## Known constraints

Single replica only, for both containers. The API's rate limiter and event bus
are in-process, and uploads live on a local volume, so running two API
containers would give each its own rate-limit budget and its own set of
images. Redis-backed throttling and either S3 or a shared volume are
prerequisites for scaling out. The web container has no such constraint itself
but was validated as a single instance behind Caddy — same recommendation
applies until you actually need to scale.
