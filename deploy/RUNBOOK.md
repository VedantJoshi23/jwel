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

**This is the step most likely to surface a problem nobody has seen yet** —
the API and web Dockerfiles were rewritten to use npm workspaces (matching
what CI and local dev actually use) but have not been built end-to-end on
real Docker before now. If either `docker build` fails, stop and read the
error rather than working around it — likely causes are a missing
`packages/*/package.json` in the build context or an npm workspace
resolution issue. Do not `docker build --no-cache` repeatedly as a first
troubleshooting step; read what npm/tsc/next actually printed first.

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

See `deploy/README.md`'s Backups section for the matching uploads-volume
backup command — back up both together, never just one.

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
