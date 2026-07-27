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

    This is a real defect on its own terms. It was **wrongly** credited with
    also fixing the `/product/[slug]` timeout described below — the run after
    it passed, and that was luck. See the next item.
  - **CI uploaded no artifact on E2E failure.** The reporter was `list`, which
    writes no report directory, while the upload step collected only
    `playwright-report/`. So the first failing run produced nothing to debug
    with. Fixed by adding the `html` reporter and widening the upload to
    include `test-results/`, where traces and `error-context.md` live. This
    fix is what made the next item diagnosable at all.
  - **`page.goto('/product/diamond-halo-ring')` intermittently hangs for 30s.**
    The PDP hero image uses next/image `priority`, so it is preloaded and the
    `load` event blocks on it. A trace from a failing run shows the optimizer
    request `/_next/image?url=%2Fimages%2Fjewellery%2Fnewarrival-bracelet.jpg&w=640&q=75`
    as the **single outstanding request, status -1**, with all 33 other
    resources at 200 and the page fully rendered in the snapshot.

    Which image is requested depends on the product's UUID —
    `getProductStockImage` hashes it — and CI creates a fresh database each
    run, so the UUID and therefore the image differ every time. Two of the
    five images in the pool are large (403 KB and 384 KB, both 1400×2100);
    the other three are 273 KB or less. **It failed 3 of the 5 runs that
    reached the E2E step**, which is about what a ~2-in-5 draw predicts.

    That alternating pass/fail is why it was twice mistaken for fixed — once
    credited to `workers: 1`, and once reported as a green docs commit that
    had in fact failed its PR run. A single green run is not evidence about
    an intermittent failure.

    Mitigated by navigating with `waitUntil: 'domcontentloaded'` in the two
    affected tests. The assertions are unchanged and still prove SSR served
    real product data; what is dropped is a dependency on the image optimizer,
    which is not what those tests are about.

    Verified over **3 consecutive green runs**, each against a fresh database
    and therefore a fresh image draw. That is deliberately more than one run,
    given this failure was twice declared fixed off a single pass. The reason
    to expect it holds is structural rather than statistical:
    `domcontentloaded` does not wait on subresources at all, so a preloaded
    image can no longer gate the navigation — the mechanism is removed, not
    made less likely.

    **The optimizer hang itself is unexplained and remains open** (see Tasks
    Remaining). It does not reproduce locally, including with a cold image
    cache pinned to 2 cores, and sharp resizes the largest of these images in
    ~150ms — so plain CPU slowness does not account for a 30s hang.
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
- [x] **Razorpay implemented end to end (ADR-0005).** Stripe is gone from the
      codebase — adapter, spec, and the `stripe` dependency all deleted.
  - `PaymentProviderPort` reshaped off Stripe's `clientSecret`. It now returns
    `{ providerRef, checkout: { keyId, orderId, simulated } }` and gained
    `verifyCheckoutResult` and `refund`. This is a breaking change to
    `POST /api/v1/orders`' response, with exactly one consumer.
  - `RazorpayPaymentProvider`: Orders API in paise (no conversion — Razorpay's
    unit is already this codebase's `*MinorUnits`), `X-Razorpay-Signature`
    verification over the raw body, and refunds resolved via
    `orders.fetchPayments` since Razorpay refunds a *payment* id while the
    `Payment` row stores the *order* id. Signature comparison uses
    `crypto.timingSafeEqual`; Razorpay's own SDK helper compares with `===`,
    which leaks timing, and lives behind an undocumented deep import.
  - `refund()` wired into Returns, closing the M7 bookkeeping-only gap. Money
    moves before the row is marked `REFUNDED`, and Returns refunds before
    restocking — both orderings chosen so a gateway failure leaves nothing
    behind to reconcile.
  - Frontend payment step built from nothing: `lib/razorpay-checkout.ts`
    (on-demand script load, modal, dismiss/failure handling) and
    `lib/api/payments.ts`.
  - `payments.module.ts`'s `isProduction`/`isSimulatedPayments` guards kept
    verbatim — that logic is provider-independent and is what stops a live shop
    marking orders paid without money moving.
- [x] **Found and fixed a bug in this milestone's own design before it
      shipped.** The first cut gated the client's "skip the payment modal"
      branch on `NODE_ENV`, mirroring the server. That is wrong for the one
      deployment that most needs it: `PAYMENTS_MODE=simulated` (RUNBOOK §13)
      serves a *production* web bundle against a mocked API, so the client
      would have concluded payments were real and opened a Razorpay modal with
      the mock's fake key — breaking the client's UAT deployment. Fixed by
      having the server declare it per-order on `checkout.simulated`.
- [x] **Validated in a real browser**, not just by tests: a production web
      build against a simulated-payments API, register → add to bag → checkout
      → confirmation, order reaching `CONFIRMED` with `provider=RAZORPAY` and
      zero page errors. Also verified by hand that `paymentProvider: "STRIPE"`
      is rejected with the order compensated (stock released, order
      `CANCELLED`), that `webhook/stripe` is now a 404, and that both the
      webhook and verify endpoints reject unsigned/forged payloads.

### One thing worth stating plainly

Two of the three CI defects above had been *described in comments in the very
file that contained them* — the `NODE_VERSION` comment named the exact error
message it was misdiagnosing, and the `fullyParallel` comment stated an intent
the setting does not implement. Confident prose next to a setting is not
evidence the setting works. This is the same lesson every milestone since 7 has
recorded, arriving through a new door.

## Tasks Remaining

- [ ] Checkout E2E test in the committed suite — the flow was driven
      end-to-end in a real browser during this milestone (see Tasks Completed)
      but against the mock provider, and that run was manual. A committed spec
      against a real gateway still needs Razorpay test-mode credentials.
- [ ] Admin CRUD E2E coverage (creating a coupon, publishing a product, a bulk
      import) through a real browser — only RBAC redirects are E2E-tested.
- [ ] **`/_next/image` intermittently never responds on the CI runner** —
      root cause unknown, and it is a production concern, not only a test one:
      the same optimizer runs in the deployed app, so a first-time visitor to a
      product page would stall the same way. Evidence is in the trace described
      above. Worth investigating alongside Milestone 14's observability work,
      when there is instrumentation to see it. Two cheap things to try first:
      pre-resize the demo stock images (currently 1400×2100 / up to 403 KB, for
      something that never renders above 640px), and confirm `.next/cache/images`
      is writable in the deployed container.
- [ ] `e2e/admin.spec.ts` hardcodes `http://localhost:3000` in a `toHaveURL`
      assertion instead of using the configured `baseURL`, so it fails against
      any other port. Surfaced while reproducing the CI failure locally.
- [ ] No mutation testing; no load/performance testing of the inventory
      race-safety path under concurrent checkout.
- [ ] `apps/web/test-results/` is committed to git — Playwright's scratch
      output directory should not be tracked.
- [ ] **The storefront serves no Content-Security-Policy at all.** The plan for
      this milestone assumed one existed and needed `checkout.razorpay.com`
      allowed; checking rather than assuming showed there is none anywhere in
      `apps/web` — helmet is applied only to the API. So nothing blocked the
      Checkout script, and nothing else is constrained either. Adding a CSP is
      a real hardening win but a change with genuine breakage risk (Next.js
      inline scripts need nonces), and doing it inside a payments change with
      no way to test it properly would have been reckless. Belongs with the
      Milestone 14 hardening pass.
- [ ] **No Razorpay account or test-mode credentials yet.** Everything above is
      verified against the mock provider, unit tests, and hand-checked
      signature logic — not against Razorpay itself. The webhook endpoint has
      never received a real delivery. This is the single biggest gap between
      "implemented" and "known to work", and it is the client's action: the
      account must be in their legal entity's name (RUNBOOK §13, step 1).

## Updated Roadmap

1. Milestones 0–10 — MVP ✅
2. Milestone 11 — Testing ✅
3. **Milestone 12 — CI proven on Actions ✅; Razorpay implemented ✅ (this
   milestone).** Remaining before it can take real money: Razorpay credentials
   from the client, then one real transaction end to end (RUNBOOK §13, step 9).
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
| Payments are "implemented" but have never touched Razorpay | Stated plainly in Tasks Remaining rather than implied away. The adapter is covered by unit tests including forged/replayed/wrong-secret signatures, and the flow was driven in a real browser — but against the mock. A gateway that has never moved real money is a hypothesis, the same as an unrestored backup (RUNBOOK §13's own words) |
| Refunds now move real money, so a bug here costs the client directly | Ordering is the mitigation and is tested: gateway first, bookkeeping second, and Returns refunds before restocking. A gateway failure therefore leaves the row and the stock untouched and the return retryable. The adapter refuses outright when no captured payment exists rather than reporting a success |
| The port reshape is a breaking change to `POST /api/v1/orders`' response | Only one consumer exists (`checkout/page.tsx`) and it currently discards that field entirely, so the blast radius is smaller than the API-contract change implies |
| Standard Checkout returns a signature to the *browser*, and a browser-supplied result is attacker-controllable | Called out as its own consequence in ADR-0005 and as a rule in `SECURITY.md` §4: verify server-side, and treat the signed webhook — not the handler result — as authoritative |
| `workers: 1` makes the E2E job slower as the suite grows | Accepted for now: correctness over speed while the suite is 12 tests and runs in 10s. Revisit with per-worker isolated accounts rather than by re-enabling cross-file parallelism against shared state |
| One green run proves the workflow, not its stability | Demonstrated the hard way, twice. A run passed and was declared green; the next commit — a README-only change — failed on the same two tests. Separately, a commit was reported green by misreading `gh pr checks`, which interleaves results from several runs, when its own PR run had failed. Read the run, not the aggregated check list, and treat intermittent E2E failures as signal |
| An unexplained hang was mitigated at the test layer, which could hide a real production defect | Called out explicitly rather than closed: the `waitUntil` change is scoped to two navigations and keeps every assertion, and the underlying `/_next/image` hang is filed in Tasks Remaining as a production concern with concrete next steps, not marked resolved |
