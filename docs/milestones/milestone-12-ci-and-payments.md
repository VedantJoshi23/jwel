# Milestone 12 — CI Proven on a Real Runner; Razorpay Swap

## Architecture Document

No change to `ARCHITECTURE.md`'s structure, but two client decisions are now
recorded as ADRs and the payment-provider references throughout the docs have
been inverted to match:

- [`ADR-0005`](../../knowledge/decisions/ADR-0005-razorpay-as-sole-payment-provider.md)
  — Razorpay is the sole payment provider; Stripe is dropped.
- [`ADR-0006`](../../knowledge/decisions/ADR-0006-hybrid-admin-strategy.md)
  — hybrid admin: custom for workflows, AdminJS for CRUD, Metabase for
  reporting, a headless CMS for content.

## Tasks Completed

- [x] **CI has now run on a real GitHub Actions runner, and passes.** This
      closes the item Milestone 11 named as its own blocking gap
      (`milestone-11-testing.md` §Tasks Remaining) — the workflow file existed
      since M11 but had only ever been verified command-by-command locally.
      All 4 jobs green on `ubuntu-latest`: backend unit+integration against a
      real `postgres:16` service container, frontend unit, typecheck, and
      **12/12 Playwright E2E** against a real built API and database.
- [x] **Found and fixed 3 real CI-only defects** in the process — none of which
      static review or local runs had surfaced:
  - **`next build` ran under `NODE_ENV=development`.** The E2E job set
    `NODE_ENV: development` at job level; under it, `next build` pulls Next's
    dev-mode error-page machinery into the production export path and aborts
    prerendering `/404` and `/500` with `<Html> should not be imported outside
    of pages/_document`. Reproduced locally on this tree (fails with the var
    set, succeeds with it unset) and fixed by scoping `NODE_ENV: production`
    onto the build and E2E steps only — the API steps still need a
    non-production value to resolve `MockPaymentProvider`.

    Note this invalidates a hypothesis recorded in `ci.yml` itself: the
    `NODE_VERSION: '22'` comment blamed this same error on a silent
    Node-version fallback. The failing run was pinned to Node 22.
  - **`fullyParallel: false` never did what its comment claimed.** It
    serializes tests *within* a file; spec files still run concurrently across
    workers. The first run reported "Running 12 tests using 2 workers" and
    interleaved `auth.spec` with `storefront.spec` against the shared seeded
    accounts the comment said it was protecting. Fixed with `workers: 1`.

    This also turned out to be the cause of a 30s `page.goto` timeout on
    `/product/diamond-halo-ring` that did **not** reproduce locally under a
    matched production build, matched worker count, or matched seed data —
    two workers plus `next start` plus the API on a 2-core runner starved the
    heaviest page (sharp image optimization) past the per-test timeout. The
    same test now runs in 339ms. The commit that introduced `workers: 1`
    explicitly predicted it was *not* the fix; that prediction was wrong.
  - **CI uploaded no artifact on E2E failure.** The reporter was `list`, which
    writes no report directory, while the upload step collected only
    `playwright-report/`. So the first failing run produced nothing to debug
    with. Fixed by adding the `html` reporter and widening the upload to
    include `test-results/`, where traces and `error-context.md` live.
- [x] **Fixed the dead push trigger** — `on.push.branches` listed `Phase-II`,
      which has never existed on the remote, so pushes never triggered CI and
      every run came from the `pull_request` trigger.
- [x] **Razorpay-only documentation pass** — `README.md`, `ARCHITECTURE.md`
      (deployment diagram, bounded-context table, checkout sequence diagram,
      API contract), `PRODUCT.md` (FR-9, NFR-4, NFR-9), `SECURITY.md` §4,
      `DATABASE.md`, `deploy/README.md`, `deploy/RUNBOOK.md` §13,
      `docs/architecture/architecture.md`, `FRONTEND.md` §4, `BACKEND.md`.
- [x] **Corrected two stale claims** the docs had drifted into:
      `milestone-10-admin-portal.md` still listed "no product create/edit form"
      when `components/admin/product-form.tsx` and the `new`/`edit` pages
      exist; `README.md` still said Phase 2 was "next" after M11 and the whole
      `deploy/` stack had landed.

### One thing worth stating plainly

Two of the three CI defects above had been *described in comments in the very
file that contained them* — the `NODE_VERSION` comment named the exact error
message it was misdiagnosing, and the `fullyParallel` comment stated an intent
the setting does not implement. Confident prose next to a setting is not
evidence the setting works. This is the same lesson every milestone since 7 has
recorded, arriving through a new door.

## Tasks Remaining

- [ ] **The Razorpay adapter itself is not built.** The docs and ADR-0005 now
      describe Razorpay as the provider, but the code still carries
      `StripePaymentProvider` (live) and `RazorpayPaymentProviderStub` (throws).
      `deploy/README.md` carries an explicit banner saying so. Scope:
  - Reshape `CreatePaymentIntentResult` off Stripe's `clientSecret` to
    `{ providerRef, checkoutOrderId, keyId }` — the load-bearing change; every
    caller moves with it, and it is a breaking change to `POST /api/v1/orders`
  - Implement `RazorpayPaymentProvider` (`X-Razorpay-Signature`, HMAC-SHA256
    over the raw body — `rawBody: true` is already set in `main.ts`)
  - `payments.controller.ts`: `webhook/stripe` → `webhook/razorpay`
  - Delete `stripe-payment.provider.ts` + spec, drop `PAYMENT_PROVIDER_STRIPE`,
    collapse `payments.module.ts`'s lazy factory — **keeping** its
    `isProduction`/`isSimulatedPayments` guards verbatim
  - `orders.service.ts`'s `?? PaymentProvider.STRIPE` default → `RAZORPAY`
  - Add `refund()` to the port (Razorpay Refunds API) and wire it into
    `returns.service.ts`, closing the M7 bookkeeping-only gap
  - Swap `STRIPE_*` → `RAZORPAY_*` in `.env.example` and `ci.yml`
- [ ] **Build the frontend payment step — it has never existed.** There is no
      `apps/web/lib/api/payments.ts`; `checkout/page.tsx` calls `createOrder`
      and routes straight to the confirmation page, discarding what the API
      returns. Load `checkout.js`, open the Standard Checkout modal, verify
      server-side, then confirm. CSP must allow `checkout.razorpay.com`.
      Preserve the `IS_DEV_MODE` branch that keeps the mock demo flow working.
- [ ] Checkout E2E test — blocked since M7, unblocked once real Razorpay
      test-mode credentials exist. Would be the first end-to-end proof that
      checkout works at all.
- [ ] Admin CRUD E2E coverage (creating a coupon, publishing a product, a bulk
      import) through a real browser — only RBAC redirects are E2E-tested.
- [ ] `e2e/admin.spec.ts` hardcodes `http://localhost:3000` in a `toHaveURL`
      assertion instead of using the configured `baseURL`, so it fails against
      any other port. Surfaced while reproducing the CI failure locally.
- [ ] No mutation testing; no load/performance testing of the inventory
      race-safety path under concurrent checkout.
- [ ] `apps/web/test-results/` is committed to git — Playwright's scratch
      output directory should not be tracked.

## Updated Roadmap

1. Milestones 0–10 — MVP ✅
2. Milestone 11 — Testing ✅
3. **Milestone 12 — CI proven on Actions ✅ (this milestone); Razorpay swap in
   progress**
4. Milestone 13 — Hybrid admin per ADR-0006: AdminJS for CRUD, Metabase on a
   read-only user, spike Directus vs Payload for the CMS module. Supersedes
   M10's materialized-views follow-up. Admin audit log lands here.
5. Milestone 14 — Observability per ADR-0002 and `STD-OBSERVABILITY`:
   Prometheus `/metrics`, Grafana dashboards, Sentry. Entirely unbuilt today —
   no `/metrics`, no `prom-client`, no Sentry anywhere in the tree.
6. Milestone 15 — Deployment / go-live. `deploy/` is written and
   reasoned-through but has never been executed end to end.
7. Milestone 16+ — Shipping (`FEAT-SHIPPING`), WhatsApp/SMS
   (`FEAT-WHATSAPP-SMS-NOTIFICATIONS`), Fraud/Risk (`FEAT-FRAUD-RISK-SCORING`)
   — all `Proposal`, none implemented.

Still open and unchanged by this milestone: frontend not wired to the Search
(M8) or Recommendations (M9) endpoints; Auth.js bridge; Redis caching;
Elasticsearch index aliasing; inventory table joining product names.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Docs now say "Razorpay" while the code still says "Stripe" — a reader could deploy against the documented env vars and get a boot failure | Named explicitly in `deploy/README.md` (a banner above the env block), `BACKEND.md`'s gap table, and this doc's Tasks Remaining. Pre-M12-completion deployments use `PAYMENTS_MODE=simulated`, which is provider-independent and unaffected |
| The port reshape is a breaking change to `POST /api/v1/orders`' response | Only one consumer exists (`checkout/page.tsx`) and it currently discards that field entirely, so the blast radius is smaller than the API-contract change implies |
| Standard Checkout returns a signature to the *browser*, and a browser-supplied result is attacker-controllable | Called out as its own consequence in ADR-0005 and as a rule in `SECURITY.md` §4: verify server-side, and treat the signed webhook — not the handler result — as authoritative |
| `workers: 1` makes the E2E job slower as the suite grows | Accepted for now: correctness over speed while the suite is 12 tests and runs in 10s. Revisit with per-worker isolated accounts rather than by re-enabling cross-file parallelism against shared state |
| One green run proves the workflow, not its stability | True, and worth saying: the first run failed twice for reasons no local run reproduced. Flakiness under runner contention is exactly the failure mode found here, so treat intermittent E2E failures as real signal, not noise |
