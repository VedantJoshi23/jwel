# Milestone 13 — Observability (Sentry + Prometheus + Grafana)

Reordered ahead of the hybrid-admin milestone mid-M12 (see that milestone's
doc and `ADR-0006`) — a webhook misconfiguration went undetected for hours
during live Razorpay validation, surfaced only by a human reading container
logs by hand. A shop taking real payments needs that from an alert, not a
support email.

## Architecture Document

Implements `ADR-0002`, now `Accepted`. One real deviation from that ADR's
original text, corrected in the ADR itself: alerting is Grafana's built-in
unified alerting, not Prometheus's native `rule_files`/Alertmanager
mechanism — the latter needs a third container to route two rules and a
notification receiver (email/Slack/webhook) that doesn't exist for this
client yet.

## Tasks Completed

- [x] **Sentry** (PR #17) — `apps/api/src/instrument.ts` (imported first in
      `main.ts`, per Sentry's own requirement), `AllExceptionsFilter` reports
      5xx only, tagged with `correlationId`. `apps/web`'s
      `instrumentation.ts` + `instrumentation-client.ts` + per-runtime
      `sentry.*.config.ts`, matching `@sentry/nextjs` 10.x's *current*
      convention — this version expects `instrumentation-client.ts`, not the
      older `sentry.client.config.ts` some docs still show; confirmed by
      reading the installed package's source rather than assuming. Both apps
      verified inert without `SENTRY_DSN` via three real `next build` runs
      (no DSN / DSN only / DSN+token).
- [x] **Prometheus `/metrics`** (PR #18) — `MetricsInterceptor` labels by
      **route pattern**, never raw URL (a product/order/user id in a label
      is unbounded cardinality). Payment-outcome and auth-failure counters
      placed after the real state transition, so the existing idempotency
      guards in `PaymentsService`/`AuthService` suppress duplicate counts
      too. `/metrics` deliberately not exposed through nginx — reached only
      over the internal `jwel-net` network.
  - **A wrong assumption caught by actually booting the app**: an early
    comment claimed the interceptor's `?? 'unmatched'` fallback handles "a
    genuine 404." It doesn't — a URL with no matching controller never
    reaches the interceptor at all; Express's platform layer rejects it
    before Nest's DI-based chain runs. Fixed the comment and the test to say
    what's actually true, not what seemed true.
- [x] **Self-hosted Prometheus + Grafana** — `deploy/docker-compose.monitoring.yml`,
      own project (`jwel-monitoring`) on the existing external `jwel-net`,
      matching the search/data stack isolation pattern. No third-party
      account for either — genuinely free, unlike Sentry.
  - **A real mistake, caught before it shipped, not after**: the first draft
    used `${GRAFANA_ADMIN_PASSWORD}` Compose-substitution syntax with the
    value living in `.env.production` — but Compose substitution only ever
    reads the root `.env`, never `.env.production`. Exactly the "getting
    this backwards is the failure mode to expect" trap `deploy/README.md`
    already warns about for `API_TAG`, made once here despite that warning
    existing, then fixed to use `env_file:` with Grafana's own native
    `GF_*` variable names — same mechanism the API container already uses.
  - Grafana datasource, dashboard (`Jwel API — Overview`: request rate,
    5xx %, p50/p95/p99 latency, payment outcomes, auth failures), and the
    two `SECURITY.md` §A09 alert rules are all provisioned as files under
    `deploy/monitoring/grafana/provisioning/`, not clicked into the UI.
    Verified against a real running instance via Grafana's own API — not
    just "no errors in the logs" — confirming both alert rules loaded with
    `health: ok` and the dashboard actually rendered.
- [x] **Public HTTPS access** at `grafana.whisperingorion.dev` — a
      deliberately **separate** nginx config file
      (`deploy/nginx/grafana.conf.template`), not folded into the
      storefront/API's `jwel.conf.template`. The live storefront and API
      vhosts are load-bearing; a mistake extending that file risks the whole
      site, not one subdomain. Cert issued via the existing
      `default_server` webroot with zero changes to the live config first;
      `nginx -t` validated before every reload; storefront and API confirmed
      unaffected after.
- [x] **Reclaimed 23.4GB of Docker build cache** (80% disk usage → 60%)
      before any of this — self-hosting two more containers on a host
      already at 80% disk would have been reckless without checking first.

## Tasks Remaining

- [ ] **PR #18 (the `/metrics` endpoint) is not yet deployed to production.**
      Prometheus's `jwel-api` scrape target currently shows `down (404)`
      because the live API doesn't have the route yet. Everything else in
      this milestone is verified against a real running Grafana/Prometheus;
      this is the one piece still waiting on a merge + redeploy.
- [ ] **No alert notification channel configured.** Alerts fire and are
      visible in Grafana's own UI, but nothing emails or pages anyone yet —
      no SMTP, no Slack webhook exists for this client. A config addition,
      not new infrastructure, once one is wanted.
- [ ] Only one dashboard exists. Real gaps: nothing per-route beyond the
      aggregate view, nothing on the order-expiry sweep's outcomes
      (`OrdersService.expireStalePendingOrders`, shipped in M12 and
      currently unobserved), nothing on Elasticsearch fallback-mode
      frequency.
- [ ] `docker system df`'s reclaimable build cache should be pruned on a
      cadence, not just once under pressure — no cron job for this exists.

## Updated Roadmap

1. Milestones 0–12 — MVP, testing, CI, Razorpay ✅
2. **Milestone 13 — Observability (this milestone).** Sentry ✅, Prometheus +
   Grafana ✅ and live at `grafana.whisperingorion.dev`, PR #18 deploy
   pending.
3. Milestone 14 — Hybrid admin per `ADR-0006`: AdminJS, Metabase, CMS spike,
   admin audit log, and the admin Returns UI gap found during M12's live
   validation.
4. Milestone 15 — Deployment / go-live.
5. Milestone 16+ — Shipping, WhatsApp/SMS, Fraud/Risk.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Grafana is now public on a real subdomain, with real (if disposable) login credentials | `GF_USERS_ALLOW_SIGN_UP` and `GF_AUTH_ANONYMOUS_ENABLED` both explicitly `false`; a generated 24-char admin password, not a default; the datasource and dashboards are read-only/provisioned-as-code so a compromised login can't quietly rewrite what's monitored without it showing as a git diff |
| `/metrics` has no auth at all | Deliberately not exposed publicly — no nginx location block for it, reachable only over the internal Docker network. The `/health` precedent this follows has no real content to leak; this endpoint does (traffic patterns), which is why it gets a stricter perimeter than `/health` despite the same unversioned-route convention |
| Self-hosting two more containers on a disk already at 80% | Checked first, not assumed: 23.4GB of Docker build cache reclaimed before deploying anything, bringing disk to 60%. Prometheus retention is capped at 30 days so it can't grow unbounded from here |
| Two real mistakes shipped in early drafts of this milestone (a false comment about 404 handling, a Compose-substitution bug) | Both caught by actually running the code against a real instance before calling it done, not by review alone — consistent with the pattern this project has hit every milestone since M7. Recorded here rather than quietly fixed, since the alternative — assuming code is correct because it looks right — is the exact failure mode that produced them |
