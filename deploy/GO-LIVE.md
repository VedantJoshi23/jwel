# Go-Live — cutting over to the client's domain and taking real payments

One consolidated, ordered checklist for the two things that have to happen
together at launch: moving off `whisperingorion.dev` (the developer-owned
staging domain this has run on throughout the build) onto the domain the
client actually owns, and switching payments from simulated/test-mode to
real money. `RUNBOOK.md` §12 and §13 cover each in full technical detail;
this file is the "do these in this order, don't skip a step" sequence that
combines them, plus the current state of this specific deployment so
nothing here has to be guessed at go-live time.

**Read this top to bottom before starting anything.** The two halves
interleave — rebuilding the web image, for instance, has to happen once with
both the new domain's build args *and* demo mode removed, not twice.

## Current state (as of this writing)

| Thing | Current value | What go-live changes it to |
|---|---|---|
| Apex domain | `whisperingorion.dev` | client's domain |
| `RAZORPAY_KEY_ID` | `rzp_test_...` (**test mode**) | live key from the client's activated account |
| `PAYMENTS_MODE` | unset (real Razorpay integration active, just in test-mode credentials) | stays unset — this is not the demo-mode flag |
| Web image demo banner (`NEXT_PUBLIC_DEMO_MODE`) | **baked in** — confirmed via `grep -rl "Demo store" .next/server` on the live image | removed, new image built without it |
| `SENTRY_DSN` | **unset** — Sentry is inert | should be set before go-live if a Sentry account exists by then (blocked on the client providing one — see `docs/milestones/milestone-13-observability.md`) |
| Grafana / Metabase subdomains | `grafana.whisperingorion.dev`, `metabase.whisperingorion.dev` | **do not need to move** — see "What stays on whisperingorion.dev" below |
| API/web image tags | `API_TAG`/`WEB_TAG` in `deploy/.env` | new tags from the rebuild in step 3 |

## What stays on `whisperingorion.dev`

Only the **storefront and API** need to move to the client's domain — those
are the customer-facing hostnames baked into the web bundle, CORS config,
and the Razorpay webhook URL. Grafana and Metabase are internal/admin tools
with no customer-facing dependency on the apex domain; leaving them on
`whisperingorion.dev` permanently is fine and simpler than re-issuing certs
and re-pointing DNS for services nobody outside the team logs into. Revisit
only if there's a specific reason (e.g. the developer's own domain lease
lapsing) — not a default part of this checklist.

## Prerequisites (get these before starting)

- [ ] Client has purchased their production domain and can add DNS records
      for it (or has granted registrar/DNS access).
- [ ] Client has an **activated** Razorpay account (their legal entity,
      their business documents — payouts and chargeback liability follow
      the account holder) with live API keys, or has added you as a
      developer so you never hold their live secret key directly.

## The sequence

### 1. DNS — both records, wait for propagation

```bash
dig +short newdomain.com          # must print this server's IP (80.225.213.151)
dig +short api.newdomain.com      # same
```

Confirm via `dig` before touching certbot — failed cert attempts count
against Let's Encrypt's 5-per-hostname-per-hour rate limit. Full detail:
`RUNBOOK.md` §12.

### 2. Certificates for the new names

```bash
sudo certbot certonly --webroot -w /var/www/html -d newdomain.com -d www.newdomain.com
sudo certbot certonly --webroot -w /var/www/html -d api.newdomain.com
```

The old `whisperingorion.dev` certs and DNS stay untouched — nothing is
revoked, so the old domain keeps working throughout the cutover, which is
what makes rollback fast if something goes wrong mid-sequence.

### 3. Razorpay — webhook + credentials

In the Razorpay dashboard (Settings → Webhooks), point the endpoint at
`https://api.newdomain.com/api/v1/payments/webhook/razorpay`, subscribed to
`payment.captured` and `payment.failed` — the only two events
`razorpay-payment.provider.ts` acts on. **Set the webhook secret yourself
when creating the webhook and record it immediately** — Razorpay never
shows it again.

In `deploy/.env.production`:
- Delete the `PAYMENTS_MODE` line if present (it currently is not — this
  deployment already runs the real Razorpay integration in test-mode
  credentials, not simulated-payments mode; don't confuse the two).
- Replace `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET`
  with the live values.
- Update `PUBLIC_BASE_URL=https://api.newdomain.com`,
  `FRONTEND_URL=https://newdomain.com`,
  `CORS_ALLOWED_ORIGINS=https://newdomain.com`.

### 4. Rebuild the web image — new domain AND no demo mode, in one build

```bash
cd ~/jwel
GIT_SHA=$(git rev-parse --short HEAD)
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.newdomain.com/api/v1 \
  --build-arg NEXT_PUBLIC_API_ORIGIN=https://api.newdomain.com \
  --build-arg NEXT_PUBLIC_SITE_URL=https://newdomain.com \
  -t ghcr.io/local/jwel-web:$GIT_SHA-golive .
```

No `NEXT_PUBLIC_DEMO_MODE` build arg — this is what actually removes the
demo banner and `noindex`. `NEXT_PUBLIC_*` values are inlined at build time,
never read from the running container's environment, so there is no way to
turn this off with a restart.

**Verify both things actually landed, before deploying — don't trust the
build args silently working:**

```bash
# New domain reached the bundle:
docker run --rm ghcr.io/local/jwel-web:$GIT_SHA-golive \
  sh -c 'grep -rl "api.newdomain.com" .next/static | head -1'
# must print a chunk filename — empty output means the old domain is still baked in

# Demo banner is gone — check .next/server, NOT .next/static (the banner is
# a server component; RUNBOOK.md §13 has the measured proof of why the
# static-only check used to pass silently on a bundle that still shipped it):
docker run --rm ghcr.io/local/jwel-web:$GIT_SHA-golive \
  sh -c 'grep -rl "Demo store" .next/server | head -1'
# must print NOTHING
```

### 5. Deploy

```bash
cd ~/jwel/deploy
# .env:  WEB_TAG=<the $GIT_SHA-golive tag from step 4>
./nginx/render.sh newdomain.com api.newdomain.com > /tmp/jwel.conf
sudo cp /etc/nginx/sites-available/main /etc/nginx/sites-available/main.bak
sudo cp /tmp/jwel.conf /etc/nginx/sites-available/main
sudo nginx -t && sudo systemctl reload nginx
docker compose -f docker-compose.api.yml up -d
```

### 6. Verify — all of it, not just the happy path

```bash
curl -fsS https://api.newdomain.com/health/ready              # {"status":"ok","database":"ok"}
curl -s -o /dev/null -w '%{http_code}\n' https://newdomain.com/       # 200
curl -s https://newdomain.com/robots.txt                       # must NOT be disallow-all
docker compose -f docker-compose.api.yml logs api | grep 'CHECKOUT IS SIMULATED'  # must print nothing
```

Then in a real browser with devtools open: confirm storefront XHRs go to
`api.newdomain.com` (a CORS error means `CORS_ALLOWED_ORIGINS` still lists
the old apex, or the API wasn't restarted), and that product images render
(`PUBLIC_BASE_URL` took effect).

Confirm the services that are staying put are still fine — a domain/image
change to the app stack should never touch these, but verify rather than
assume, same as after every other infra change to this deployment:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://grafana.whisperingorion.dev/login
curl -s -o /dev/null -w '%{http_code}\n' https://metabase.whisperingorion.dev/
```

### 7. One real transaction, then refund it

Place a genuine order with a real card for the smallest-value item.
Confirm: the order reaches `CONFIRMED`, the money appears in the Razorpay
dashboard, the webhook shows a 2xx delivery. Then refund it through the
admin Returns UI (`/admin/returns`) and confirm the refund appears in
Razorpay too. **A gateway that has never moved real money is a hypothesis**,
same as an untested backup — this is the step that turns it into a fact.

### 8. Search indexing

If the demo was ever publicly reachable and indexed, request removal of any
indexed URLs in Google Search Console — `noindex` stops future indexing, not
retroactive removal.

### 9. Tell the client

Once verified: hand over the new URL, confirm they can log into
`/admin` (the account carries over — no new admin account needed), and
point out `metabase.whisperingorion.dev` / `grafana.whisperingorion.dev` as
the reporting/ops URLs, which did not change.

## Rollback

```bash
sudo cp /etc/nginx/sites-available/main.bak /etc/nginx/sites-available/main
sudo nginx -t && sudo systemctl reload nginx
# revert WEB_TAG in deploy/.env to the previous tag, then:
docker compose -f docker-compose.api.yml up -d
```

The old domain's certs and DNS are untouched throughout, so this is fast.
Keep the old domain registered and pointing at the server for a few weeks
after the move — DNS caches, bookmarks, and already-shared links keep
arriving on the old hostname for a while.

## Known gaps to be aware of at go-live (not blockers, but real)

- **No alert notification channel.** Grafana alerts fire and are visible in
  its own UI, but nothing emails or pages anyone yet — deferred pending a
  client-provided email address (`docs/milestones/milestone-13-observability.md`).
  Worth revisiting the priority of this once real money is moving.
- **Sentry is inert** (`SENTRY_DSN` unset) — same blocker, same doc.
- **The admin audit log has no UI** — `GET /api/v1/admin/audit-log` exists
  and works, but there's no page in `/admin` to browse it; API-only for now
  (`docs/milestones/milestone-14-hybrid-admin.md`).
