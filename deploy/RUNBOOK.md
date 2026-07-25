# First go-live runbook — hand this to the agent working on the VM

This is written for someone who has never deployed a web app before. Follow
it in order; don't skip ahead. Each step says what it does and why, so a
mistake is easy to spot before it becomes the next step's problem.

`deploy/README.md` has the exact command reference this runbook walks
through — read this file for the *order* and the *why*, that one for the
precise commands and flags.

---

## 0. Before touching the VM at all: get a domain pointed at it

Caddy (the reverse proxy this stack uses) gets HTTPS certificates from Let's
Encrypt automatically, but Let's Encrypt **will not issue a certificate for a
bare IP address** (`80.225.213.151`) — only for a domain name. Without this
step, nothing past step 6 will work.

1. Buy a domain if you don't have one (any registrar — Namecheap, Google
   Domains, GoDaddy).
2. In the registrar's DNS settings, add two **A records**, both pointing at
   `80.225.213.151`:
   - `api.yourdomain.com`
   - `shop.yourdomain.com`
3. Wait for DNS to propagate (usually minutes, sometimes a few hours). Check
   with `dig api.yourdomain.com +short` — it should print `80.225.213.151`.

If you'd rather launch without a domain first (e.g. to sanity-check the app
works at all), see "Launching without a domain yet" at the bottom — but you
cannot get real HTTPS until you do this step.

---

## 1. Minimum VM specification

If you haven't provisioned the VM yet, or want to confirm the one at
`80.225.213.151` is big enough:

| Resource | Minimum | Comfortable |
|---|---|---|
| vCPU | 2 | 4 |
| RAM | 4 GB | 8 GB |
| Disk | 40 GB SSD | 80 GB SSD |
| OS | Ubuntu 22.04 or 24.04 LTS, x86_64 | same |
| Network | Public IPv4, ports 22/80/443 open | same |

Why: Postgres, the API container, the web container, and Caddy all run on
this one box simultaneously. 4GB is the floor where Postgres doesn't start
swapping under normal catalogue-browsing load. If you later turn
Elasticsearch on (currently optional — the API falls back to Postgres search
without it), budget another 2GB+ for that alone.

If the VM has less than 4GB RAM, add a swap file before doing anything else:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 2. Install Docker on the VM

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# log out and back in for the group change to take effect
docker --version
docker compose version
```

Confirm the firewall (if any, e.g. `ufw` or the cloud provider's security
group) allows inbound TCP on **22** (SSH), **80** and **443** (HTTP/HTTPS),
and nothing else public-facing. Postgres (5432) must never be open to the
internet — the compose file already binds it to `127.0.0.1` only, so this is
just confirming the cloud firewall doesn't override that.

---

## 3. Get the code onto the VM

```bash
git clone <your repo URL> jwel
cd jwel
```

If the repo is private and the VM doesn't have deploy credentials set up,
either add a deploy key/PAT, or `scp` a tarball of the repo instead of
cloning.

---

## 4. One-time host setup

```bash
docker network create jwel-net
mkdir -p deploy/backups
```

Create the two env files described in `deploy/README.md` §0
(`deploy/.env` and `deploy/.env.production`), both `chmod 600`. Generate every
secret fresh on this machine — do not reuse a value from local development:

```bash
openssl rand -base64 32   # for POSTGRES_PASSWORD
openssl rand -base64 48   # for JWT_SECRET
```

Read §0's explanation of which variable goes in which file. The short version:
`GH_OWNER`, `API_TAG`, `WEB_TAG` and the `POSTGRES_*` values go in **`.env`**,
because Compose substitutes them into the compose files and only ever reads
`.env`. Everything else is application config and goes in `.env.production`.
Put `API_TAG` in the wrong file and step 7 fails immediately with `required
variable API_TAG is missing a value`.

`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are also required — the API
deliberately refuses to boot in production without them instead of quietly
using the mock payment provider. For a staging or test deployment, use
Stripe's test-mode keys; there is no supported way to run production mode with
payments disabled.

Use `api.yourdomain.com` / `shop.yourdomain.com` (your real domain from step
0) everywhere the env files ask for a URL — `CORS_ALLOWED_ORIGINS`,
`PUBLIC_BASE_URL`, `FRONTEND_URL`.

---

## 5. Build both images, directly on the VM

For a single-server setup like this one, there's no need for an image
registry (GHCR/Docker Hub) — build the images locally on the VM from the
cloned source:

```bash
cd jwel   # repo root — both Dockerfiles need the monorepo as build context
GIT_SHA=$(git rev-parse --short HEAD)

docker build -f apps/api/Dockerfile -t ghcr.io/local/jwel-api:$GIT_SHA .

docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1 \
  --build-arg NEXT_PUBLIC_API_ORIGIN=https://api.yourdomain.com \
  -t ghcr.io/local/jwel-web:$GIT_SHA .
```

The `ghcr.io/local/...` naming is arbitrary here — it just has to match
`GH_OWNER=local` and `API_TAG=$GIT_SHA` / `WEB_TAG=$GIT_SHA` in
`deploy/.env.production`, so Compose finds the image you just built instead
of trying to pull one. Set `GH_OWNER=local` in that file.

(If you later want to build on a laptop and ship to multiple servers, push to
a real registry instead — `deploy/README.md` §1 covers that path.)

Both of these have now been built end-to-end on real Docker (Docker 29.6.2,
Ubuntu 24.04, `npm ci` against `package-lock.json`) and both succeed from a
clean context. That was not previously true — two defects were fixed to get
there, and they are worth knowing about if you ever edit the Dockerfiles:

- Both Dockerfiles used to `COPY packages/config/package.json` and three
  siblings. There is no `packages/` directory in this repo — `apps/api` and
  `apps/web` are the only two npm workspaces — so every build failed on the
  first `COPY`. The root `package.json` still globs `packages/*`; that glob
  matching nothing is fine, but a `COPY` of a missing path is not.
- The API image created `/app/apps/api/uploads`, while `UPLOADS_DIR` and the
  compose volume both point at `/app/uploads`. Docker seeds an empty named
  volume from the image's directory, but when the mount path doesn't exist in
  the image it creates it `root:root` — and the container runs as `node`, so
  the first product-image upload would have failed `EACCES`.

If a build still fails, stop and read the error rather than working around
it. Do not `docker build --no-cache` repeatedly as a first troubleshooting
step; read what npm/tsc/next actually printed first.

Sanity-check the images before deploying them — a successful build does not
prove a working container:

```bash
docker run --rm ghcr.io/local/jwel-api:$GIT_SHA ls -la dist/main.js
docker run --rm ghcr.io/local/jwel-api:$GIT_SHA ls -ld /app/uploads   # must be node-owned
docker run --rm ghcr.io/local/jwel-web:$GIT_SHA sh -c 'ls .next/static >/dev/null && ls public >/dev/null && echo assets ok'
```

An empty `dist/` is the failure mode to watch for on the API image: it builds
and tags successfully, then the container dies immediately on "Cannot find
module dist/main". Confirm the `NEXT_PUBLIC_*` values really made it into the
web bundle, since they are inlined at build time and a wrong one means a
rebuild:

```bash
docker run --rm ghcr.io/local/jwel-web:$GIT_SHA \
  sh -c 'grep -rl "api.yourdomain.com" .next/static | head -1'
```

That must print a chunk filename. If it prints nothing, the build args didn't
take and the bundle is pointing somewhere else.

---

## 6. Bring up the database

```bash
cd deploy
docker compose -f docker-compose.postgres.yml up -d
docker compose -f docker-compose.postgres.yml ps      # wait until "healthy"
```

---

## 7. Migrate the schema, then create the admin account

```bash
docker compose -f docker-compose.api.yml run --rm migrate

ADMIN_EMAIL=owner@yourdomain.com \
ADMIN_PASSWORD="$(openssl rand -base64 24)" \
docker compose -f docker-compose.api.yml run --rm create-admin
```

**Write down the generated `ADMIN_PASSWORD` right now** — it's only printed
to your terminal once, nothing stores it. This command is idempotent, so if
you lose it, re-run with a new password to reset it.

Never run `prisma db seed` against this database — see the warning in
`deploy/README.md` §4.

---

## 8. Start the app

```bash
docker compose -f docker-compose.api.yml up -d
docker compose -f docker-compose.api.yml ps   # api, web, caddy all "healthy"/"running"
```

Caddy will now attempt to get Let's Encrypt certificates for both domains.
Watch it happen:

```bash
docker compose -f docker-compose.api.yml logs -f caddy
```

Look for lines mentioning `certificate obtained successfully` for both
domains. If you see repeated failures, it's almost always DNS not having
propagated yet (recheck with `dig`) — don't restart Caddy in a loop, Let's
Encrypt rate-limits repeated failures per domain per hour.

---

## 9. If you have existing product images to migrate

Only relevant if `apps/api/uploads/products/` on your development machine
already has real uploaded files. Copy them to the VM first (`rsync`/`scp`),
then follow `deploy/README.md` §5 to move them into the named volume and
cross-check the count against `product_media` rows in the database.

Do not skip the `chown -R node:node /app/uploads` in that section. `docker
compose cp` writes files as the host uid, and if that isn't 1000 the API ends
up able to serve the migrated images but unable to upload or delete any —
which surfaces much later as a broken admin edit, not as a failed migration.

The count cross-check only means something when the database already has the
matching `product_media` rows. On a freshly migrated, unseeded database that
table is empty, so expect 1046 files against 0 rows until you restore or
import real data.

---

## 10. Verify

```bash
curl -fsS https://api.yourdomain.com/health/ready
curl -s -o /dev/null -w '%{http_code}\n' https://shop.yourdomain.com/
```

Then open `https://shop.yourdomain.com/admin` in a browser, log in with the
account from step 7, open a product, confirm its photo renders. That one
click exercises the entire stack — web, API, Postgres, uploads volume.

---

## 11. Set up backups (do this before calling it done)

```bash
crontab -e
```

Add a daily line (adjust the path to wherever you cloned the repo):

```
0 3 * * * cd /home/<user>/jwel/deploy && docker compose -f docker-compose.postgres.yml exec -T postgres pg_dump -U jwel jwel | gzip > backups/db-$(date +\%F).sql.gz
```

The `\%` escaping is not a typo — cron treats a bare `%` as a newline and would
truncate the command at `$(date +`.

See `deploy/README.md`'s Backups section for the matching uploads-volume
backup command — back up both together, never just one. Both write into
`deploy/backups`, the directory created in step 4.

Once the first run has happened, confirm it actually produced something:

```bash
ls -lh backups/ && gzip -t backups/db-*.sql.gz && echo 'dump is readable'
```

A backup nobody has restored is a hypothesis, not a backup.

---

## Launching without a domain yet

If you want to confirm the containers work before DNS is ready, you can
bypass Caddy temporarily: comment out the `caddy` service in
`docker-compose.api.yml`, add `ports: ["3000:3000"]` under `web` and
`ports: ["4000:4000"]` under `api` temporarily, then hit
`http://80.225.213.151:3000` directly. **Revert this before going live** —
it serves plain HTTP with no TLS and bypasses the `/docs` lockout Caddy
otherwise enforces in depth.

---

## What not to do

- Don't tag images `latest` — always a git SHA, or rollback has nothing to
  roll back *to*.
- Don't run `prisma db seed` in production, ever.
- Don't expose Postgres (5432) publicly.
- Don't lose the `caddy_data` volume — that's where ACME certificates live;
  losing it means re-issuing, and Let's Encrypt rate-limits how often you can
  do that per domain.
- Don't skip step 11. The uploads volume and the database are the only
  things on this VM that can't be rebuilt from git.
