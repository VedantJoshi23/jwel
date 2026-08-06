# Go-Live — Cutting Over to the Client's Real Domain

This is the **single ordered checklist** for the day this deployment moves
off `whisperingorion.dev` (or wherever it's currently staged) onto the
client's actual production domain, with real Razorpay payments turned on.

It does not repeat the detailed mechanics already written elsewhere in this
directory — each step links to the section that explains *why*, and this
file's job is only to put them in the right **order**, with the parts that
are easy to miss called out explicitly. Read the linked section before
running its commands the first time; this checklist assumes you already
have.

**Work top to bottom. Do not skip ahead to payments (Phase 3) before the
domain (Phase 1) is fully verified** — the storefront must never be
reachable at the new domain while still pointing at the old API host, and it
must never take real card details while still showing the demo banner.

---

## Phase 0 — Client-side prerequisites (get these before starting)

None of these are yours to create — chase them down first, since Phase 1–3
each block on one of them:

- [ ] **Domain purchased**, registrar access (or DNS delegated to someone who
      has it) to add A records.
- [ ] **Razorpay live account**, activated, in the client's legal entity's
      name — see RUNBOOK §13 step 1 for why this must be the client's
      account, not yours.
- [ ] **Sign-off on every customer-facing claim** — FAQ answers, shipping and
      dispatch promises, subscription and WhatsApp copy. These are commitments
      the client makes to their customers, so only the client can approve
      them, and several are currently **known to be false**. Full list and
      current status: RUNBOOK §13 **step 0**. This is a Phase 0 item because
      chasing copy approval takes longer than any technical step in this
      checklist, and Phase 3 cannot complete without it.
- [ ] Decide **now**, not during the cutover, what happens to the ops
      subdomains (`grafana.`, `metabase.`) — see the callout in Phase 1.
- [ ] *(Optional)* A Sentry account/project if error tracking is wanted on
      the new domain (`deploy/README.md`, "Optional — error tracking").
- [ ] *(Optional)* A client email address for Grafana alert notifications,
      if that's being wired up around the same time
      (`docs/milestones/milestone-13-observability.md`, Tasks Remaining).

---

## Phase 1 — Domain cutover

Full mechanics, the hostname table, and rollback: **RUNBOOK §12 "Changing
the domain."** Follow that section's numbered procedure for the apex +
`api.` pair. Summary of the order:

1. DNS A records for apex + `api.` → wait for `dig` to confirm both.
2. `certbot` for both new hostnames.
3. Rebuild the **web image** with the new `NEXT_PUBLIC_*` build args — these
   are baked in at build time, not read from `.env.production`. Verify the
   new hostname actually landed in the bundle (RUNBOOK §12 step 4) before
   deploying it.
4. Update `.env.production` (`PUBLIC_BASE_URL`, `FRONTEND_URL`,
   `CORS_ALLOWED_ORIGINS`) and `.env` (`WEB_TAG`).
5. Render + install the new nginx config, `nginx -t`, reload.
6. `docker compose -f docker-compose.api.yml up -d`.
7. Verify per RUNBOOK §12 "Verify" — including opening the storefront in a
   real browser and confirming XHR calls hit the new API host, not just
   that `curl` returns 200.

### Callout: what happens to `grafana.` and `metabase.`?

RUNBOOK §12's hostname table only covers the apex + `api.` pair — it predates
the Grafana (M13) and Metabase (M14) subdomains, and was never updated when
those were added. Decide one of two ways before starting, since this affects
whether you need certs/DNS for two more hostnames on the new domain:

- **Move them too** — same procedure as any other subdomain (see RUNBOOK's
  "Optional: Monitoring" and "Optional: Metabase" sections' own "Putting X
  behind a real domain" subsections): new A record, `certbot`, render +
  install that service's own nginx template. Nothing in Grafana's or
  Metabase's own config references the storefront/API hostnames, so this is
  independent of Phase 1 and can happen before, during, or after it.
- **Leave them where they are** — these are internal ops tooling, not
  customer-facing, so there's no functional requirement they share the
  client's domain. If left on the staging host's domain, keep that domain's
  DNS/cert renewal alive indefinitely (don't let it lapse thinking the
  migration is "done") and make sure whoever administers the client's domain
  knows the ops tooling intentionally lives elsewhere, so it doesn't get
  "helpfully" pointed at the new domain by someone unaware of the split.

Nothing in this repo mandates one answer — pick based on whether the client
wants their own team to eventually access Grafana/Metabase (in which case
their domain is friendlier) versus keeping it purely an engineering-team
tool (in which case the staging host is simpler and this step is a no-op).

---

## Phase 2 — Observability on the new domain (optional, do anytime after Phase 1)

- [ ] Sentry: if a client Sentry project now exists, add `SENTRY_DSN` and
      rebuild the web image with `NEXT_PUBLIC_SENTRY_DSN` (`deploy/README.md`
      "Optional — error tracking"). This does **not** require a new web
      image build on its own if bundled into the same rebuild Phase 1 already
      did — check both build args are present in one build, not two.
- [ ] Grafana alert notification channel (email/Slack), if a client email
      was obtained per Phase 0 — see
      `docs/milestones/milestone-13-observability.md`'s Tasks Remaining for
      the current state; not yet built as of M14.

---

## Phase 3 — Payments go-live

**Full checklist: RUNBOOK §13 "Going live: the checklist."** A step 0 plus
nine numbered steps — content review (every customer-facing claim is true;
the demo banner is what currently stands between shoppers and copy known to
be wrong), gateway account, webhook registration, credential swap, web image
rebuild *without* the demo-mode build arg, a bundle-content verification
that actually works (RUNBOOK §13 step 5 explains why the naive version of
this check is worthless), deploy, confirm the simulated-payments flag is
gone from the logs, re-enable search indexing, and **one real transaction**
followed by a refund.

Do not skip step 9 (the real transaction). A payment gateway that has never
moved real money through this exact deployment is a hypothesis, not a
verified integration — the same standard this project has held every other
piece of infrastructure to (see `docs/milestones/milestone-12-ci-and-payments.md`
and `milestone-14-hybrid-admin.md` for what "verified for real, not assumed"
has meant in practice here).

If HTTP basic auth was added to keep the demo private (RUNBOOK §13
"Restricting access while in demo mode"), removing it is part of this phase,
not a separate task — RUNBOOK §13 step 8 is the natural place.

---

## Phase 4 — Final combined verification

Everything below should be run **after** Phases 1 and 3 are both complete,
as one pass — individual phase verification proves each piece works in
isolation, this proves nothing regressed across the whole cutover:

```bash
# Storefront + API on the new domain
curl -s -o /dev/null -w '%{http_code}\n' https://<new-domain>/                    # 200
curl -fsS https://api.<new-domain>/health/ready                                    # {"status":"ok","database":"ok"}

# Search indexing re-enabled (not still disallow-all from demo mode)
curl -s https://<new-domain>/robots.txt

# Simulated-payments flag is gone
docker compose -f docker-compose.api.yml logs api | grep -c 'CHECKOUT IS SIMULATED'   # 0

# Any ops subdomains that moved with the domain (skip if left on the old host)
curl -s -o /dev/null -w '%{http_code}\n' https://grafana.<new-domain>/login
curl -s -o /dev/null -w '%{http_code}\n' https://metabase.<new-domain>/
```

Then, in a real browser:

- [ ] Place one real order start to finish (this is Phase 3 step 9 — don't
      duplicate the transaction, just confirm it's the one being checked
      here too).
- [ ] Log into `/admin` and confirm the order appears, RBAC still works, and
      (if it moved) Grafana/Metabase are reachable at their new URLs.
- [ ] Check the browser's Network tab on at least one storefront page — API
      calls must go to the new `api.` host, not the old one. A stale
      `CORS_ALLOWED_ORIGINS` or a web image built against the old API host
      both look fine until this specific check.

## Rollback

Domain: RUNBOOK §12 "Rolling back" — the old certs/DNS/nginx config are
untouched throughout Phase 1, so reverting is fast. Keep the old domain
registered and pointed at the server for a few weeks after cutover; DNS
caches and existing links keep arriving there.

Payments: there is no clean rollback from real transactions back to demo
mode once Phase 3 has processed a real order — that order is real money that
moved. If Phase 3 needs to be aborted mid-way, stop before step 9 (the real
transaction) and revert steps 3–4 (credentials, web image) to restore
`PAYMENTS_MODE=simulated`.
