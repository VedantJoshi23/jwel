# Deploying Jwel to a self-hosted server

Two independent compose stacks sharing one external Docker network. The split is
deliberate: `docker compose down` on the app stack can never touch the database,
and the `pgdata` volume is declared only in the Postgres file so a stray
`down -v` on the app side cannot delete it.

Each file pins its own Compose project name — `jwel` for the app stack,
`jwel-data` for the data stack. Both are required for that isolation to be
real. Without them Compose derives one shared project name from the directory
(`deploy`), which makes each stack see the other's containers as orphans, so a
`down --remove-orphans` on the app side would stop the database container too.
Pinned names also keep the volumes called `jwel_uploads` and
`jwel-data_pgdata` no matter what the checkout directory is named — the backup
commands below address those volumes by name.

```
deploy/
  docker-compose.postgres.yml       data stack       — brought up once, rarely touched
  docker-compose.api.yml            app stack        — api + web, redeployed on every release
  docker-compose.elasticsearch.yml  search stack     — OPTIONAL; see RUNBOOK.md
  docker-compose.monitoring.yml     Prometheus+Grafana — OPTIONAL; see RUNBOOK.md
  docker-compose.metabase.yml       Metabase (BI)    — OPTIONAL; see RUNBOOK.md
  nginx/jwel.conf.template          TLS + reverse proxy — render.sh fills in
  nginx/render.sh                   the hostnames; see RUNBOOK §12
  nginx/grafana.conf.template       own vhost, rendered/installed manually — RUNBOOK "Optional: Monitoring"
  nginx/metabase.conf.template      own vhost, rendered/installed manually — RUNBOOK "Optional: Metabase"
  Caddyfile                         unused alternative, for a host without nginx
  RUNBOOK.md                        step-by-step first deploy, in order
  GO-LIVE.md                        the client-domain + real-payments cutover checklist
```

The app stack runs two images: `jwel-api` (`apps/api/Dockerfile`) and `jwel-web`
(`apps/web/Dockerfile`, Next.js standalone build). Neither publishes a public
port; both listen on `127.0.0.1` and the host's nginx proxies to them.

Two hostnames are required — the storefront and the API are separate origins,
and Let's Encrypt cannot issue a certificate for a bare IP address. On the
deployed host these are the apex `whisperingorion.dev` (storefront, replacing
the old static portfolio) and `api.whisperingorion.dev`. Both must resolve to
the host before step 6 will work.

---

## 0. One-time host setup

```bash
docker network create jwel-net
mkdir -p backups        # from the deploy/ directory — see RUNBOOK.md §4 and §11
```

Create two env files next to the compose files, both `chmod 600`. **The split
between them is not cosmetic** — they are read by two different mechanisms:

- **`.env`** is what Compose itself reads, to substitute `${...}` in the
  compose files. Compose only ever looks at `.env` in the project directory;
  it does **not** read `.env.production`. Anything appearing as `${VAR}` in a
  compose file must live here or the command fails to start at all.
- **`.env.production`** is passed into the containers via `env_file:`. It is
  the application's runtime configuration and is never used for substitution.

Getting this backwards is the failure mode to expect: putting `API_TAG` in
`.env.production` produces `required variable API_TAG is missing a value` on
the very first `docker compose` command.

**`.env`** — Compose substitution (Postgres stack *and* image selection)

```ini
POSTGRES_USER=jwel
POSTGRES_PASSWORD=<generate: openssl rand -hex 32 — hex, not base64: RUNBOOK §4>
POSTGRES_DB=jwel

GH_OWNER=<your github org/user, or "local" if you built on the VM>
API_TAG=<git sha, never "latest">
WEB_TAG=<same git sha>
```

**`.env.production`** (read by the API container) — see `apps/api/.env.example`
for the annotated full list. At minimum:

```ini
NODE_ENV=production

POSTGRES_USER=jwel
POSTGRES_PASSWORD=<same as above>
POSTGRES_DB=jwel

JWT_SECRET=<generate: openssl rand -base64 48>
CORS_ALLOWED_ORIGINS=https://shop.example.com
PUBLIC_BASE_URL=https://api.example.com
FRONTEND_URL=https://shop.example.com

STORAGE_PROVIDER=filesystem
UPLOADS_DIR=/app/uploads

# Required whenever NODE_ENV=production. payments.module.ts refuses to boot
# without all three, rather than falling back to the mock provider and silently
# marking real orders paid without money moving. Use Razorpay test-mode keys
# (rzp_test_…) for a staging deployment.
#
# KEY_ID is public — it is handed to the browser to open the Checkout modal.
# The other two are server-only and must never become NEXT_PUBLIC_* vars.
RAZORPAY_KEY_ID=<from the Razorpay dashboard>
RAZORPAY_KEY_SECRET=<from the Razorpay dashboard>
RAZORPAY_WEBHOOK_SECRET=<set when creating the webhook, not shown again>
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
  --build-arg NEXT_PUBLIC_SITE_URL=https://yourdomain.com \
  -t ghcr.io/$GH_OWNER/jwel-web:$GIT_SHA .
docker push ghcr.io/$GH_OWNER/jwel-web:$GIT_SHA
```

Tag both with the same git SHA. Deploying `latest` means you cannot roll back,
because the tag you would roll back *to* now points at the broken build.

**Optional — error tracking (ADR-0002).** Add `SENTRY_DSN=` to
`.env.production` and `--build-arg NEXT_PUBLIC_SENTRY_DSN=<dsn>` to the web
build above once a Sentry project exists for this client. Neither is required:
absent, `Sentry.init` never runs and error reporting is a complete no-op — the
same "inert without secrets" pattern as the Razorpay keys above, just without
a hard boot-time requirement, since losing error tracking isn't the same class
of failure as silently not charging a customer. Source-map upload
(`SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`) is deliberately not wired
into this build command yet — see `apps/web/next.config.mjs` for why.

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
could never race. `up -d` starts `api` and `web` — `migrate` and `create-admin`
are one-shot profiles and don't start with it. Both containers publish only to
`127.0.0.1` (`:3000` and `:4000`); nothing is reachable from the internet until
nginx is configured in step 6.

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

# REQUIRED. `docker compose cp` writes the files with the *host* user's numeric
# uid/gid, not the container's `node` (uid 1000). If the account you deploy
# from is not uid 1000, the API can still read and serve these images but
# cannot write new uploads into the directory or delete existing ones — an
# EACCES that shows up only when someone edits a product, long after the
# migration looked like it succeeded. Harmless to run when the uids do match.
docker compose -f docker-compose.api.yml exec -u root api chown -R node:node /app/uploads

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

## 6. Put nginx in front (TLS + reverse proxy)

The deployed host already runs nginx with a certbot-managed certificate, so
nginx — not Caddy — terminates TLS. `deploy/nginx/jwel.conf.template` holds the
config; `render.sh` substitutes the two hostnames into it, because nginx has no
variables in `server_name` or certificate paths. Changing domains later is
RUNBOOK §12.

**DNS must be in place before certbot will issue anything.** The apex record
already exists; the API subdomain needs a new one:

| Type | Name  | Value            |
|------|-------|------------------|
| A    | `api` | `80.225.213.151` |

Add it at whatever registrar/DNS host serves `whisperingorion.dev`, then wait
for it to propagate before continuing:

```bash
dig +short api.whisperingorion.dev        # must print 80.225.213.151
```

Certbot fails with "DNS problem: NXDOMAIN" if you run it early. That failure is
counted against Let's Encrypt's rate limit of 5 per hostname per hour, so check
`dig` first rather than retrying blind.

```bash
# 1. issue the api.* certificate FIRST. The apex cert already exists and is
#    untouched. --webroot uses the portfolio vhost's :80 block, which is still
#    live at this point, so nothing needs editing twice.
sudo certbot certonly --webroot -w /var/www/html -d api.whisperingorion.dev

# 2. render the config for these two hostnames
cd ~/jwel/deploy
./nginx/render.sh whisperingorion.dev api.whisperingorion.dev > /tmp/jwel.conf

# 3. install it (the old portfolio vhost is also called `main` — back it up)
sudo cp /etc/nginx/sites-available/main /etc/nginx/sites-available/main.portfolio.bak
sudo cp /tmp/jwel.conf /etc/nginx/sites-available/main

# 4. validate and reload — never `restart` a config you have not tested
sudo nginx -t && sudo systemctl reload nginx
```

Order matters: nginx refuses to load a config naming a certificate file that
does not exist, so issuing the `api.*` cert before installing the config avoids
a chicken-and-egg. Do not reach for `certbot --nginx` here — it wants to edit
the config it finds, which is the rendered output rather than the template.

Rollback is `sudo cp /etc/nginx/sites-available/main.portfolio.bak
/etc/nginx/sites-available/main && sudo nginx -t && sudo systemctl reload
nginx`, which restores the portfolio in seconds. The portfolio files under
`/home/ubuntu/portfolio` are never moved or modified — the new config also
keeps serving them at `https://whisperingorion.dev/portfolio/`.

---

## 7. Verify

```bash
curl -fsS https://api.whisperingorion.dev/health         # {"status":"ok",…}
curl -fsS https://api.whisperingorion.dev/health/ready   # {"status":"ok","database":"ok"}
curl -s -o /dev/null -w '%{http_code}\n' https://api.whisperingorion.dev/docs      # 404 in prod
curl -s -o /dev/null -w '%{http_code}\n' https://whisperingorion.dev/              # 200 storefront
curl -s -o /dev/null -w '%{http_code}\n' https://whisperingorion.dev/portfolio/    # 200 portfolio
curl -s -o /dev/null -w '%{http_code}\n' https://whisperingorion.dev/portfolio     # 301
```

Then log into `https://whisperingorion.dev/admin` with the account from step 4,
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
