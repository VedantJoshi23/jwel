# Deploying Jwel to a self-hosted server

Two independent compose stacks sharing one external Docker network. The split is
deliberate: `docker compose down` on the app stack can never touch the database,
and the `pgdata` volume is declared only in the Postgres file so a stray
`down -v` on the app side cannot delete it.

```
deploy/
  docker-compose.postgres.yml   data stack   — brought up once, rarely touched
  docker-compose.api.yml        app stack    — redeployed on every release
  Caddyfile                     TLS + reverse proxy
```

---

## 0. One-time host setup

```bash
docker network create jwel-net
mkdir -p /srv/jwel/backups
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

Also set `NEXT_PUBLIC_API_ORIGIN=https://api.example.com` when building the
frontend, so `next/image` allowlists the API host. Without it every product
photo throws at render.

---

## 1. Build and publish the image

```bash
# from the repo root
docker build -f apps/api/Dockerfile -t ghcr.io/$GH_OWNER/jwel-api:$(git rev-parse --short HEAD) .
echo $GITHUB_TOKEN | docker login ghcr.io -u $GH_OWNER --password-stdin
docker push ghcr.io/$GH_OWNER/jwel-api:$(git rev-parse --short HEAD)
```

Tag with the git SHA. Deploying `latest` means you cannot roll back, because the
tag you would roll back *to* now points at the broken build.

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
docker compose -f docker-compose.api.yml logs -f api
```

Migrations run as a one-shot from the same image being deployed, so the schema
always matches the code. Kept out of the API container's `CMD` so two replicas
could never race.

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
curl -fsS https://api.example.com/health            # {"status":"ok",…}
curl -fsS https://api.example.com/health/ready      # {"status":"ok","database":"ok"}
curl -s -o /dev/null -w '%{http_code}\n' https://api.example.com/docs   # 404 in prod
```

Then log into `/admin` with the account from step 4, open a product, and confirm
its photos render.

---

## Backups

Postgres and the uploads volume must be backed up **together** — restoring one
without the other leaves dangling image references.

```bash
docker compose -f docker-compose.postgres.yml exec postgres \
  pg_dump -U jwel jwel | gzip > /srv/jwel/backups/db-$(date +%F).sql.gz

docker run --rm -v jwel_uploads:/data -v /srv/jwel/backups:/out alpine \
  tar czf /out/uploads-$(date +%F).tar.gz -C /data .
```

## Rolling back

```bash
API_TAG=<previous-sha> docker compose -f docker-compose.api.yml up -d
```

Note this rolls back code only. If the release included a migration, roll that
back deliberately — `prisma migrate deploy` has no automatic down path.

## Known constraints

Single replica only. The rate limiter and event bus are in-process, and uploads
live on a local volume, so running two API containers would give each its own
rate-limit budget and its own set of images. Redis-backed throttling and either
S3 or a shared volume are prerequisites for scaling out.
