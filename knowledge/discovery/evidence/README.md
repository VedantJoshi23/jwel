# Evidence Log — this project

Running record of evidence supplied for **this project** and the knowledge
claims extracted from it, per `OV-000`. Structure follows
`.oriveda-framework/.oriveda/schemas/evidence.schema.yaml`.

Each entry is one evidence item, appended with the next `EVD-NNN` id. Entries
are never renumbered or deleted — a claim later revised is marked
`superseded_by`, not removed.

This log is scoped to this project only; it shares no ids or entries with the
Oriveda framework's own evidence log.

---

## EVD-001

```yaml
id: EVD-001
type: conversation
source: Discovery kickoff session with the product owner, 2026-08-05
received: 2026-08-05
summary: >
  Product owner's own statement of launch status and the intended customer
  journey, given at the start of Discovery. Establishes prelaunch status and
  the canonical happy path, and explicitly scopes checkout out of the
  supplied UX evidence as "standard Razorpay".
pipeline: vision
processed: true
claims:
  - id: KC-001
    statement: The product is prelaunch — it has not been released to real customers.
    status: fact
    confidence: 100
    evidence_ids: [EVD-001]
    investigation: business-vision
  - id: KC-002
    statement: >
      The intended customer journey is: home (hero banner, sale bar, best
      sellers, category tiles, nav, footer) → category listing with filters →
      product detail with details and reviews → add to cart → checkout.
    status: fact
    confidence: 100
    evidence_ids: [EVD-001]
    investigation: user-journeys
  - id: KC-003
    statement: >
      Checkout is intended to be a standard Razorpay flow, deliberately not
      treated as a differentiating surface by the product owner.
    status: fact
    confidence: 95
    evidence_ids: [EVD-001]
    investigation: user-journeys
    notes: >
      Owner's framing. EVD-002 shows a custom-built checkout form preceding
      the payment step, so "standard" describes the payment handoff, not the
      whole page. See KC-014.
```

---

## EVD-002

```yaml
id: EVD-002
type: screenshot
source: >
  photos/user/ (9 screenshots of the deployed storefront, whisperingorion.dev).
  Source files deleted 2026-08-06 at the owner's instruction after extraction —
  they depicted a superseded iteration. Claims below are the durable record;
  the images are not recoverable.
received: 2026-08-05
summary: >
  Customer-facing storefront as deployed: home (two scroll positions),
  category listing, product detail (two scroll positions), cart, checkout,
  login, and account. Brand presents as "ELYSIAN". A persistent orange bar
  reads "Demo store — orders are for preview only."
pipeline: screenshot
processed: true
claims:
  - id: KC-004
    statement: >
      The storefront's public brand is ELYSIAN; the repository and admin
      portal use the internal name "Jwel".
    status: fact
    confidence: 100
    evidence_ids: [EVD-002, EVD-003]
    investigation: business-vision
  - id: KC-005
    statement: >
      The product is Indian-market jewellery retail — INR pricing, and
      positioning around Kundan chokers, temple jhumkas, pearl sets and
      meenakari rings for festive and everyday wear.
    status: fact
    confidence: 100
    evidence_ids: [EVD-002]
    investigation: business-vision
  - id: KC-006
    statement: >
      Four top-level categories exist: Rings, Earrings, Necklaces & Pendants,
      Bracelets & Anklets.
    status: fact
    confidence: 100
    evidence_ids: [EVD-002, EVD-004]
    investigation: feature-inventory
  - id: KC-007
    statement: >
      Category listing supports filtering by category, price min/max, and
      metal (Gold, Gold Plated, Silver, Platinum, Stainless Steel, Any), plus
      a sort control defaulting to Newest.
    status: fact
    confidence: 100
    evidence_ids: [EVD-002]
    investigation: feature-inventory
  - id: KC-008
    statement: >
      Product detail shows a BIS Hallmark badge, metal, description, price
      with an "Extra ₹300 off at checkout" line, a variant selector, quantity
      stepper, add-to-bag, and a reviews section with a write-a-review form.
    status: fact
    confidence: 100
    evidence_ids: [EVD-002]
    investigation: feature-inventory
  - id: KC-009
    statement: >
      Authentication offers email/password plus Google, Meta and Apple social
      login, with a post-login `next=` redirect.
    status: fact
    confidence: 100
    evidence_ids: [EVD-002]
    investigation: user-journeys
  - id: KC-010
    statement: >
      The customer account area has Overview, Orders and Addresses tabs.
    status: fact
    confidence: 100
    evidence_ids: [EVD-002]
    investigation: user-journeys
  - id: KC-011
    statement: >
      The cart offers a gift-wrapping-with-personal-note option and a
      newsletter opt-in at the line-item review step.
    status: fact
    confidence: 100
    evidence_ids: [EVD-002]
    investigation: hidden-business-rules
    notes: >
      Gift wrapping appears as a cart-level boolean, not a per-item option.
      Whether it carries a price is not visible in the evidence.
  - id: KC-012
    statement: >
      Shipping promises conflict across surfaces: the sale bar promises free
      shipping above ₹999, product detail says "Free standard delivery on all
      orders", and checkout offers a single "Standard delivery — Free".
    status: fact
    confidence: 95
    evidence_ids: [EVD-002]
    investigation: hidden-business-rules
  - id: KC-013
    statement: >
      Checkout states "All pieces are carefully gift-wrapped and dispatched
      within 24 hours" — an unconditional fulfilment promise stated in UI copy
      with no visible backing rule.
    status: fact
    confidence: 90
    evidence_ids: [EVD-002]
    investigation: hidden-business-rules
  - id: KC-014
    statement: >
      Checkout is a custom single-page form (email, full name, address, city,
      zip, coupon, shipping method, order summary) ending in "Place Order",
      not a hosted Razorpay checkout page.
    status: inference
    confidence: 80
    evidence_ids: [EVD-002]
    investigation: user-journeys
    notes: >
      The screenshot shows no card fields, so the Razorpay handoff most
      likely occurs after "Place Order". Needs confirmation — see Open Gaps.
  - id: KC-015
    statement: >
      A product in DRAFT-derived state ("Untitled Draft 1041 — Pending,
      placeholder draft created from an uploaded image. Edit before
      publishing.") is visible to customers on the homepage Best Sellers rail,
      the Rings listing, and its own product page at a ₹2,500 price.
    status: fact
    confidence: 100
    evidence_ids: [EVD-002, EVD-004]
    investigation: technical-debt
    superseded_by: KC-052
    notes: >
      Observation stands, but the interpretation drawn from it at intake — that
      the publish path leaked a placeholder — was wrong. Superseded by KC-052
      per EVD-007: the owner published this item deliberately to exercise the
      payment and refund flow. Retained per OV-000 rather than deleted.
  - id: KC-016
    statement: >
      The storefront footer advertises Subscriptions and WhatsApp contact as
      customer-facing capabilities.
    status: fact
    confidence: 100
    evidence_ids: [EVD-002]
    investigation: feature-inventory
```

---

## EVD-003

```yaml
id: EVD-003
type: repository
source: This repository (pnpm/turbo monorepo) at branch feat/cms-image-uploads
received: 2026-08-05
summary: >
  Two-app monorepo: apps/api (NestJS + Prisma) and apps/web (Next.js App
  Router). Surveyed at directory/module/route/schema level for this intake —
  not read line by line.
pipeline: repository
processed: true
claims:
  - id: KC-017
    statement: >
      The system is a pnpm + Turborepo monorepo with two deployables:
      apps/api (NestJS) and apps/web (Next.js App Router), both Dockerised.
    status: fact
    confidence: 100
    evidence_ids: [EVD-003]
    investigation: technical-architecture
  - id: KC-018
    statement: >
      The API is organised as 22 NestJS modules: analytics, audit-log, auth,
      cart, cms, collections, coupons, health, inventory, metrics,
      notifications, orders, payments, products, recommendations, returns,
      reviews, search, storage, uploads, users, wishlist.
    status: fact
    confidence: 100
    evidence_ids: [EVD-003]
    investigation: repo-structure
  - id: KC-019
    statement: >
      Persistence is Prisma with 27 models — User, OAuthAccount, Address,
      Category, Collection, CollectionProduct, Product, ProductVariant,
      ProductMedia, Inventory, Cart, CartItem, Coupon, CouponRedemption,
      Order, OrderItem, OrderStatusHistory, Payment, ReturnRequest,
      ReturnStatusHistory, Review, Wishlist, WishlistItem, ProductView,
      ProductCoOccurrence, Banner, AuditLog.
    status: fact
    confidence: 100
    evidence_ids: [EVD-003]
    investigation: data-model
  - id: KC-020
    statement: >
      Product is modelled as an aggregate: Product → ProductVariant →
      Inventory, with ProductMedia attached and stock tracked per variant.
    status: inference
    confidence: 85
    evidence_ids: [EVD-003, EVD-004]
    investigation: data-model
    notes: Inferred from model names and the admin Inventory page keying on variant id.
  - id: KC-021
    statement: >
      Order state is event-sourced alongside the aggregate via
      OrderStatusHistory and ReturnStatusHistory rather than status fields
      alone.
    status: inference
    confidence: 75
    evidence_ids: [EVD-003]
    investigation: data-model
  - id: KC-022
    statement: >
      The NestJS module list maps closely onto candidate bounded contexts —
      catalog, cart/checkout, orders, payments, inventory, returns, reviews,
      search, recommendations, notifications, CMS, identity.
    status: inference
    confidence: 70
    evidence_ids: [EVD-003]
    investigation: domain-discovery
    notes: >
      Module boundaries are a proxy for domain boundaries, not proof of them.
      A real context map requires reading coupling between modules — deferred
      to the domain-discovery investigation.
  - id: KC-023
    statement: >
      The web app separates route groups (storefront) and (admin), so the
      admin portal is served by the same Next.js deployment as the storefront.
    status: fact
    confidence: 100
    evidence_ids: [EVD-003]
    investigation: technical-architecture
  - id: KC-024
    statement: >
      Observability is Sentry-based, with instrumentation on both client and
      server plus a dedicated metrics module.
    status: fact
    confidence: 95
    evidence_ids: [EVD-003]
    investigation: technical-architecture
  - id: KC-025
    statement: >
      Testing infrastructure exists at three levels — Vitest (web unit),
      Playwright (web e2e), and a Jest test directory in the API — and the
      API has a coverage/ artifact checked into the working tree.
    status: fact
    confidence: 90
    evidence_ids: [EVD-003]
    investigation: technical-debt
    notes: Infrastructure presence only. Actual coverage/pass rate not assessed.
  - id: KC-026
    statement: >
      apps/api/uploads/ exists in the repository, indicating at least some
      media is written to local disk rather than object storage.
    status: inference
    confidence: 70
    evidence_ids: [EVD-003]
    investigation: technical-debt
    notes: >
      A storage module also exists. Whether local disk is a dev-only fallback
      or the production path is unresolved — see Open Gaps.
  - id: KC-027
    statement: >
      A recommendations capability is backed by ProductView and
      ProductCoOccurrence models — i.e. behavioural co-occurrence, not a
      third-party recommender.
    status: inference
    confidence: 85
    evidence_ids: [EVD-003, EVD-005]
    investigation: feature-inventory
```

---

## EVD-004

```yaml
id: EVD-004
type: screenshot
source: >
  photos/admin/ (9 screenshots of the deployed admin portal). Source files
  deleted 2026-08-06 at the owner's instruction after extraction — they
  depicted a superseded iteration. Claims below are the durable record; the
  images are not recoverable.
received: 2026-08-05
summary: >
  Admin portal at /admin, titled "Jwel Admin", with nine sections: Reports,
  Products, Categories, Inventory, Orders, Returns, Customers, Coupons, CMS.
pipeline: screenshot
processed: true
claims:
  - id: KC-028
    statement: >
      The admin portal has nine sections — Reports, Products, Categories,
      Inventory, Orders, Returns, Customers, Coupons, CMS — rendered inside
      the storefront chrome (customer nav, search, cart badge and sale bars
      remain visible above the admin UI).
    status: fact
    confidence: 100
    evidence_ids: [EVD-004]
    investigation: feature-inventory
  - id: KC-029
    statement: >
      Reports shows revenue, order count, average order value, new customers,
      low-stock SKUs, pending reviews, orders-by-status, and top products over
      a selectable window defaulting to Last 30 days.
    status: fact
    confidence: 100
    evidence_ids: [EVD-004]
    investigation: feature-inventory
  - id: KC-030
    statement: >
      The catalog holds 1,047 products, of which the overwhelming majority are
      auto-generated "Untitled Draft NNNN" rows at ₹0 in DRAFT status; only
      two are PUBLISHED.
    status: fact
    confidence: 95
    evidence_ids: [EVD-004]
    investigation: technical-debt
  - id: KC-031
    statement: >
      Reports counts 1,047 low-stock SKUs — i.e. every product — and the
      Inventory page lists variants with 0 on hand, 0 reserved, 0 available
      against a threshold of 5.
    status: fact
    confidence: 100
    evidence_ids: [EVD-004]
    investigation: technical-debt
  - id: KC-032
    statement: >
      The Inventory page displays truncated variant UUIDs instead of variant
      names, with in-page copy stating names "aren't available from this
      endpoint; cross-reference with the Products page if needed."
    status: fact
    confidence: 100
    evidence_ids: [EVD-004]
    investigation: technical-debt
  - id: KC-033
    statement: >
      Order lifecycle is a state machine advanced manually by an admin:
      CONFIRMED → PROCESSING or CANCELLED, with DELIVERED and CANCELLED marked
      "final state".
    status: fact
    confidence: 90
    evidence_ids: [EVD-004]
    investigation: hidden-business-rules
  - id: KC-034
    statement: >
      Returns carry their own lifecycle ending in REFUNDED with a refunded
      amount recorded against the item price.
    status: fact
    confidence: 95
    evidence_ids: [EVD-004]
    investigation: feature-inventory
  - id: KC-035
    statement: >
      Customer administration supports viewing role and join date and
      suspending an account.
    status: fact
    confidence: 100
    evidence_ids: [EVD-004]
    investigation: feature-inventory
  - id: KC-036
    statement: >
      Coupons are campaigns with a code, a type (percentage or other), a
      value, and a validity window.
    status: fact
    confidence: 95
    evidence_ids: [EVD-004]
    investigation: feature-inventory
  - id: KC-037
    statement: >
      The CMS section covers homepage banners only, and says so in its own UI:
      "FR-23's full scope (category landing content, lookbook/editorial pages)
      isn't implemented."
    status: fact
    confidence: 100
    evidence_ids: [EVD-004]
    investigation: feature-inventory
  - id: KC-038
    statement: >
      Products supports per-product photo management, inline edit, archive,
      publish, single-product creation, and CSV bulk import.
    status: fact
    confidence: 100
    evidence_ids: [EVD-004]
    investigation: feature-inventory
  - id: KC-039
    statement: >
      The order and customer data visible in the deployed environment is
      synthetic test data — customer emails follow rzp-live-/rzp-refund-/
      rzp-stockcheck-/rzp-validation-NNN@test.invalid patterns, and the only
      non-synthetic account is the owner's own administrator login.
    status: fact
    confidence: 95
    evidence_ids: [EVD-004]
    investigation: business-vision
    notes: Corroborates KC-001 — the deployment is a prelaunch demo, not a live store.
  - id: KC-040
    statement: >
      The admin screenshots predate the current branch: the sidebar has no
      Collections entry and the CMS banner form takes a typed "Image ref
      (storage path)" rather than an upload, while the repository contains
      /admin/collections and a commit adding banner/collection image upload.
    status: inference
    confidence: 85
    evidence_ids: [EVD-003, EVD-004]
    investigation: repo-structure
```

---

## EVD-005

```yaml
id: EVD-005
type: vision
source: >
  Root-level PRODUCT.md, ARCHITECTURE.md, BACKEND.md, DATABASE.md, DESIGN.md,
  FRONTEND.md, SECURITY.md, README.md; docs/architecture/, docs/design/,
  docs/milestones/ (M0–M14); knowledge/ artifacts authored before Oriveda
  adoption (DOM-*, FEAT-*, STD-*, ADR-*).
received: 2026-08-05
summary: >
  Pre-Oriveda planning and specification corpus, ~3,500 lines at root plus 15
  milestone documents and 13 knowledge artifacts. Catalogued at intake;
  PRODUCT.md fully extracted 2026-08-06 for DISC-002 (claims KC-068 onward).
  The remaining root documents and docs/ are still unextracted.
pipeline: vision
processed: partial
claims:
  - id: KC-041
    statement: >
      Development was organised as sequential milestones M0–M14, from scaffold
      through to hybrid admin, with the current branch continuing M14.
    status: fact
    confidence: 95
    evidence_ids: [EVD-005, EVD-003]
    investigation: repo-structure
  - id: KC-042
    statement: >
      Six architecture decisions were recorded pre-Oriveda: Shiprocket as
      shipping provider, an observability stack, a WhatsApp/SMS provider,
      a fraud risk scoring approach, Razorpay as sole payment provider, and a
      hybrid admin strategy.
    status: fact
    confidence: 100
    evidence_ids: [EVD-005]
    investigation: technical-architecture
  - id: KC-043
    statement: >
      Three domains were documented pre-Oriveda — notification, risk,
      shipping — covering far less than the 22 API modules, so domain
      documentation is partial rather than a complete context map.
    status: fact
    confidence: 95
    evidence_ids: [EVD-005, EVD-003]
    investigation: domain-discovery
  - id: KC-044
    statement: >
      Requirements are tracked with FR-NN identifiers that the running
      application references directly in its own UI copy (FR-18 on Inventory,
      FR-23 on CMS).
    status: fact
    confidence: 100
    evidence_ids: [EVD-004, EVD-005]
    investigation: repo-structure
```

---

## EVD-006

```yaml
id: EVD-006
type: conversation
source: Discovery kickoff session with the product owner, 2026-08-05 (second exchange)
received: 2026-08-05
summary: >
  Owner's answers to the two business-vision gaps raised after EVD-001–005
  intake: target buyer, commercial vs. portfolio intent, scope commitment, and
  the status of the draft-product backlog. Closes Gap 2.
pipeline: vision
processed: true
claims:
  - id: KC-045
    statement: >
      The target buyer is a customer shopping for everyday jewellery,
      imitation jewellery especially — not fine or investment jewellery.
    status: fact
    confidence: 100
    evidence_ids: [EVD-006]
    investigation: business-vision
    notes: >
      Materially narrows KC-005, which read festive/heirloom positioning off
      storefront copy. The copy over-indexes on festive framing relative to
      stated intent. See KC-050.
  - id: KC-046
    statement: >
      The product serves two purposes simultaneously: a real commercial
      product and a portfolio build.
    status: fact
    confidence: 100
    evidence_ids: [EVD-006]
    investigation: business-vision
  - id: KC-047
    statement: >
      Every capability currently recorded in the codebase and planning
      documents is a live commitment, not aspirational — including
      Subscriptions, WhatsApp notifications, shipping, and fraud risk scoring.
    status: fact
    confidence: 100
    evidence_ids: [EVD-006]
    investigation: business-vision
  - id: KC-048
    statement: >
      Scope commitment is explicitly revisable: a recorded commitment may be
      renegotiated when it causes a security risk, exceeds budget, or is
      otherwise not in the project's favour — but by explicit navigation, not
      silent drop.
    status: fact
    confidence: 95
    evidence_ids: [EVD-006]
    investigation: business-vision
    notes: >
      Directly relevant to M2 Constitution: this is the owner's own stance on
      amendment vs. silent violation, and should inform how Laws are worded.
  - id: KC-049
    statement: >
      The ~1,045 Untitled Draft products at ₹0 are intentional placeholders
      awaiting correct details from the client; populating them is outside the
      engineering scope, and the team's obligation is to flag them.
    status: fact
    confidence: 100
    evidence_ids: [EVD-006]
    investigation: business-vision
    superseded_by: null
    notes: >
      Reframes KC-030 — the draft backlog is a content-ops state, not
      engineering debt. Does NOT cover KC-015: one draft is PUBLISHED and
      customer-visible, which remains a defect regardless of who fills in the
      details. See Gap 7.
  - id: KC-050
    statement: >
      Storefront copy positions the brand around festive, heirloom and
      handcrafted framing (Kundan, temple jhumkas, meenakari), which sits at
      odds with the stated everyday-imitation-jewellery buyer.
    status: inference
    confidence: 75
    evidence_ids: [EVD-002, EVD-006]
    investigation: business-vision
    notes: >
      Tension between two fact-tier claims (KC-005 observed copy, KC-045
      stated intent). Flagged for the business-vision investigation to
      resolve; may be deliberate aspirational positioning rather than a
      mismatch.
  - id: KC-051
    statement: >
      The admin and storefront screenshots (EVD-002, EVD-004) reflect earlier
      iterations; the owner has continued changing the codebase during this
      Discovery session.
    status: fact
    confidence: 100
    evidence_ids: [EVD-006, EVD-003]
    investigation: repo-structure
    notes: >
      Confirms KC-040. Evidence captured mid-flight: two commits (3e88d5b,
      f8ca951) landed on a new branch during intake. Screenshot-derived claims
      are point-in-time and must be re-checked against source before any of
      them become load-bearing for a frozen spec.
```

---

## EVD-007

```yaml
id: EVD-007
type: conversation
source: Discovery session with the product owner, 2026-08-06
received: 2026-08-06
summary: >
  Owner's correction to the intake reading of the two PUBLISHED products, plus
  confirmation of the deliberate-structure interpretation in DISC-001. Closes
  Gap 7.
pipeline: vision
processed: true
claims:
  - id: KC-052
    statement: >
      Of the two PUBLISHED products, one was added by the client and the other
      ("Untitled Draft 1041") was published by the owner deliberately to test
      the payment flow end to end, including refund.
    status: fact
    confidence: 100
    evidence_ids: [EVD-007]
    investigation: technical-debt
    notes: >
      Supersedes the intake interpretation behind KC-015. The orders, the
      cancelled/delivered spread and the REFUNDED return against this product
      are all deliberate test traffic, consistent with KC-039's synthetic
      customer emails. No publish-path defect is evidenced.
  - id: KC-053
    statement: >
      The uniform NestJS module shape and the (storefront)/(admin) route-group
      split are deliberate decisions, not framework defaults left unrevisited.
    status: fact
    confidence: 100
    evidence_ids: [EVD-007]
    investigation: repo-structure
    notes: Confirms DISC-001's Interpretation section and its reading of ADR-0006.
  - id: KC-054
    statement: >
      The owner considers KC-048's explicit-navigation stance essential to how
      changes to specification documents are made, not only to scope decisions.
    status: fact
    confidence: 95
    evidence_ids: [EVD-007]
    investigation: recommendations
    notes: >
      Widens KC-048 from scope commitments to document amendment generally.
      Direct input to M2 Constitution's amendment rules. First claim logged
      against the recommendations investigation.
```

---

## EVD-008

```yaml
id: EVD-008
type: repository
source: >
  Targeted deep read of this repository (shared types, CI workflow, all 22 API
  modules) plus GitHub Actions run history via `gh run list` / `gh run view`,
  2026-08-06. Commissioned by the owner to close DISC-001's Questions 2, 3, 4
  and 5.
received: 2026-08-06
summary: >
  Answers the four deferred DISC-001 questions with direct observation rather
  than inference, and corrects one inference DISC-001 got wrong.
pipeline: repository
processed: true
claims:
  - id: KC-055
    statement: >
      `packages/` was not vestigial scaffold. apps/web/lib/api/types.ts opens
      with a comment stating its types are "hand-duplicated here rather than
      imported from packages/types, which BACKEND.md §5 already flags as not
      yet wired up across the monorepo — tracked as a follow-up so frontend and
      backend types don't silently drift."
    status: fact
    confidence: 100
    evidence_ids: [EVD-008]
    investigation: repo-structure
    notes: >
      Directly refutes DISC-001's Interpretation that the directory was a
      scaffold default never exercised. It was a planned shared-types package,
      known to be missing, with the duplication accepted as an interim cost.
  - id: KC-056
    statement: >
      Eight of the fifteen Prisma enums are hand-duplicated as string-literal
      unions in apps/web/lib/api/types.ts — MetalType, CertificationType, Role,
      OrderStatus, CollectionType, DiscountType, ReturnStatus, and ProductStatus
      (the last inlined into the Product interface rather than named). All eight
      are byte-for-byte in sync with schema.prisma as of this reading.
    status: fact
    confidence: 100
    evidence_ids: [EVD-008]
    investigation: technical-debt
    notes: >
      No drift exists today. Nothing mechanically prevents it: no test, no
      typecheck and no CI step compares the two definitions.
  - id: KC-057
    statement: >
      The remaining seven Prisma enums — OAuthProvider, MediaType, CartStatus,
      PaymentProvider, PaymentStatus, ReturnReason, ModerationStatus — have no
      web counterpart, indicating duplication tracks what the browser actually
      renders rather than mirroring the schema wholesale.
    status: inference
    confidence: 85
    evidence_ids: [EVD-008]
    investigation: technical-debt
  - id: KC-058
    statement: >
      DTO duplication extends beyond enums: the API declares 34 DTO files
      across its modules, and apps/web/lib/api declares roughly 15 mirroring
      input interfaces (e.g. CreateProductVariantInput mirrors
      CreateProductVariantDto field for field).
    status: fact
    confidence: 90
    evidence_ids: [EVD-008]
    investigation: technical-debt
  - id: KC-059
    statement: >
      CI runs four jobs — backend unit+integration (90% coverage gate, real
      Postgres service), frontend unit (90% coverage gate), typecheck for both
      apps via `tsc --noEmit`, and Playwright E2E against a real stack. All
      four passed on the most recent PR run (#31015972427, 4m38s).
    status: fact
    confidence: 100
    evidence_ids: [EVD-008]
    investigation: technical-debt
  - id: KC-060
    statement: >
      CI never invokes turbo. Every job runs `npm install` and per-app npm
      scripts directly, so the turbo pipeline in turbo.json is used only for
      local development.
    status: fact
    confidence: 100
    evidence_ids: [EVD-008]
    investigation: technical-debt
    notes: >
      Deliberate and documented — ci.yml's header comment states npm is "the
      only path that's actually been validated". Consequence: turbo's task
      graph and caching provide no CI benefit.
  - id: KC-061
    statement: >
      `turbo run typecheck` executes nothing: turbo.json declares a typecheck
      task but neither apps/api nor apps/web defines a typecheck script.
      Verified by running it — "No tasks were executed as part of this run."
    status: fact
    confidence: 100
    evidence_ids: [EVD-008]
    investigation: technical-debt
    notes: >
      CI is unaffected because it calls `npx tsc --noEmit` directly, but a
      developer running the documented root command gets a silent no-op.
  - id: KC-062
    statement: >
      Lint is never run in CI. Both apps define a lint script and turbo.json
      declares a lint task, but no CI job invokes either.
    status: fact
    confidence: 100
    evidence_ids: [EVD-008]
    investigation: technical-debt
  - id: KC-063
    statement: >
      Both package-lock.json (558 KB) and pnpm-lock.yaml (315 KB) are committed
      at the repository root, while package.json declares packageManager
      pnpm@9.0.0 and CI installs with npm.
    status: fact
    confidence: 100
    evidence_ids: [EVD-008]
    investigation: technical-debt
    notes: >
      Two lockfiles can resolve to different dependency trees. CI validates the
      npm tree; the declared package manager resolves the pnpm one.
  - id: KC-064
    statement: >
      17 of 22 API modules conform exactly to the module/controller/service/dto
      shape. The five deviations are structural, not sloppy: health (no service
      or dto — controller-only probe), metrics and uploads (no dto), storage
      (module plus ports/ and providers/ directories — a hexagonal port-adapter
      layout), notifications (no controller — event-consumer, not HTTP surface).
    status: fact
    confidence: 100
    evidence_ids: [EVD-008]
    investigation: repo-structure
    notes: >
      Closes DISC-001's sampling limitation. Every deviation has an evident
      reason; none contradicts the convention.
  - id: KC-065
    statement: >
      Every one of the 22 modules carries at least one co-located .spec.ts;
      counts range from 1 (collections, health, notifications, uploads) to 5
      (auth, payments).
    status: fact
    confidence: 100
    evidence_ids: [EVD-008]
    investigation: repo-structure
  - id: KC-066
    statement: >
      The event bus is functional, not aspirational — confirmed by the owner
      against the live published product, whose order, payment and refund
      lifecycle exercised it end to end.
    status: fact
    confidence: 95
    evidence_ids: [EVD-008, EVD-007]
    investigation: domain-discovery
    notes: >
      Closes DISC-001 Question 5. The six declared events are a real
      integration seam and can be treated as load-bearing input to the context
      map.
  - id: KC-067
    statement: >
      ci.yml and .gitignore both carry extensive per-rule rationale naming the
      specific incident behind each decision — including a comment correcting
      an earlier wrong hypothesis in the same file ("that hypothesis was wrong
      — the run below is pinned to Node 22 and still failed until NODE_ENV was
      fixed").
    status: fact
    confidence: 100
    evidence_ids: [EVD-008]
    investigation: recommendations
    notes: >
      Extends DISC-001's .gitignore observation. Self-correcting rationale
      recorded next to the code is the strongest cultural signal in this
      repository and the practice the Constitution should preserve by name.
```

---

## EVD-005 (continued) — PRODUCT.md extraction

Processed 2026-08-06 for `DISC-002`. `PRODUCT.md` is advisory per `ADR-0007`;
these claims record what it asserts, not what binds.

```yaml
claims:
  - id: KC-068
    statement: >
      PRODUCT.md positions the product as "a premium jewellery e-commerce
      platform for the Indian market" competing with Tanishq, BlueStone and
      CaratLane on trust and confidence, with AI personalization as the
      differentiating whitespace.
    status: fact
    confidence: 100
    evidence_ids: [EVD-005]
    investigation: business-vision
  - id: KC-069
    statement: >
      Four of the five PRD personas target premium buyers — bridal/high-value
      (Anika), gifting (Rohan), luxury self-buyer (Meera) — with only Persona 4
      (Priya, everyday daily-wear, price-sensitive) matching the owner's stated
      target buyer.
    status: fact
    confidence: 100
    evidence_ids: [EVD-005]
    investigation: business-vision
  - id: KC-070
    statement: >
      The PRD's revenue model is premised on precious metal: "margin on
      gold/diamond jewellery sales" as primary, plus making-charge/markup
      tiering described as industry-standard for Indian jewellery.
    status: fact
    confidence: 100
    evidence_ids: [EVD-005]
    investigation: business-vision
  - id: KC-071
    statement: >
      Gold-rate-linked pricing recurs through the PRD — FR-4, FR-17, Persona 5,
      revenue model item 2, and Open Question 1 (which gold-rate data source to
      use) — and has no implementation: no gold-rate identifier appears
      anywhere in either app's source.
    status: fact
    confidence: 95
    evidence_ids: [EVD-005, EVD-008]
    investigation: hidden-business-rules
  - id: KC-072
    statement: >
      FR-2's category taxonomy has already been revised to a client-provided
      one whose subcategories are characteristic of everyday and imitation
      jewellery — Oxidised Silver, Nazariya, Kids' silver, Toe rings,
      Adjustable rings — and the FR text explicitly notes it replaced "the
      placeholder category list this FR originally named".
    status: fact
    confidence: 100
    evidence_ids: [EVD-005]
    investigation: business-vision
    notes: >
      Strong evidence the repositioning toward the real buyer has already begun
      inside the PRD, at the one point where client input landed, without
      propagating to personas, revenue model or competitor framing.
  - id: KC-073
    statement: >
      The PRD declares ten non-functional requirements (NFR-1 to NFR-10)
      covering performance, availability, scalability, security, accessibility,
      mobile-first, SEO, observability, data portability and i18n-readiness,
      and states NFRs 1-8 are non-optional for MVP.
    status: fact
    confidence: 100
    evidence_ids: [EVD-005]
    investigation: business-vision
    notes: Satisfies OV-001's cross-cutting NFR extraction check for business-vision.
  - id: KC-074
    statement: >
      NFR-3's stated infrastructure — NestJS on ECS with Redis caching — does
      not match the built system, which is docker-compose on a single VM behind
      Caddy with no Redis dependency in either app.
    status: fact
    confidence: 95
    evidence_ids: [EVD-005, EVD-008, EVD-003]
    investigation: technical-architecture
  - id: KC-075
    statement: >
      NFR-8 is half-implemented: Prometheus and Grafana exist (deploy/monitoring
      plus an API metrics endpoint exposed only on the internal Docker network),
      but PostHog appears in no dependency manifest. Sentry, which the PRD never
      names, is the error-tracking tool actually wired into both apps.
    status: fact
    confidence: 95
    evidence_ids: [EVD-005, EVD-008]
    investigation: technical-architecture
  - id: KC-076
    statement: >
      CMS (FR-23) was placed in Future Scope by the PRD but has been built
      (milestone M14), so delivered scope has diverged from the PRD's own
      MVP/post-MVP split.
    status: fact
    confidence: 95
    evidence_ids: [EVD-005, EVD-004]
    investigation: feature-inventory
  - id: KC-077
    statement: >
      Three PRD MVP-scope items have no evident implementation — FR-12 Product
      Comparison, FR-13 Gift Recommendation Engine and FR-16 Try-On
      Preparation — though the PRD itself defers all three to Future Scope.
    status: inference
    confidence: 75
    evidence_ids: [EVD-005, EVD-008]
    investigation: feature-inventory
    notes: Grep-level check only; absence of a keyword is weaker than absence of a feature.
```

---

## EVD-009

```yaml
id: EVD-009
type: conversation
source: Discovery session with the product owner, 2026-08-06 (DISC-002 Discussion)
received: 2026-08-06
summary: >
  Owner's resolution of DISC-002's five open questions. Establishes that the
  premium first-party strategy is abandoned and replaced by a multi-vendor
  marketplace with commission revenue — a change of business model, not of
  positioning. Also settles the ELYSIAN/Jwel split and the branding-flexibility
  requirement.
pipeline: vision
processed: true
claims:
  - id: KC-078
    statement: >
      The premium first-party retail strategy in PRODUCT.md is abandoned, not
      merely unbuilt.
    status: fact
    confidence: 100
    evidence_ids: [EVD-009]
    investigation: business-vision
    notes: Resolves DISC-002 Question 1 and lifts its Interpretation to fact tier.
  - id: KC-079
    statement: >
      The business is a MARKETPLACE, not a retailer. Multiple contracted
      jewellers list and sell their own products; the platform does not own
      inventory. It connects those shops with customers.
    status: fact
    confidence: 100
    evidence_ids: [EVD-009]
    investigation: business-vision
    notes: >
      This is a change of business model, not of positioning, and is the single
      most consequential claim in Discovery so far. See KC-082.
  - id: KC-080
    statement: >
      Revenue is intermediation commission taken on sales made through the
      platform — replacing PRODUCT.md's metal-margin and making-charge model
      (KC-070) entirely.
    status: fact
    confidence: 100
    evidence_ids: [EVD-009]
    investigation: business-vision
  - id: KC-081
    statement: >
      ELYSIAN and Jwel are deliberately distinct: Jwel is the portfolio project
      identity used on the owner's resume, ELYSIAN is the client-facing
      commercial brand of the live site. The same codebase serves both.
    status: fact
    confidence: 100
    evidence_ids: [EVD-009]
    investigation: business-vision
    notes: Resolves DISC-002 Question 3. The dual identity is intentional, not drift.
  - id: KC-082
    statement: >
      The data model has no concept of a seller. Across 27 Prisma models there
      is no Seller/Vendor/Merchant entity, Product has no owning-seller
      relation, Role is only CUSTOMER/STAFF/ADMIN, and there are no commission,
      payout or settlement models. Payment is one row per Order with a single
      amount and no split.
    status: fact
    confidence: 100
    evidence_ids: [EVD-009, EVD-003, EVD-008]
    investigation: data-model
    superseded_by: KC-089
    notes: >
      The observation is accurate and stands. The conclusion drawn from it —
      that this was the largest gap between intent and implementation in
      Discovery — was wrong, and is superseded by KC-089 per EVD-010: the
      absence is a deliberate boundary choice, not a gap. Retained per OV-000.
  - id: KC-083
    statement: >
      ELYSIAN is primarily imitation jewellery but may also sell premium
      jewellery with licences or certificates, depending on which jewellers are
      contracted; a Premium Collection is anticipated as a future surface.
    status: fact
    confidence: 100
    evidence_ids: [EVD-009]
    investigation: business-vision
    notes: >
      Resolves DISC-002 Question 5. Product mix is a function of contracted
      supply, not a fixed brand decision — so certification (KC-008's BIS
      Hallmark badge, the CertificationType enum) remains load-bearing rather
      than decorative.
  - id: KC-084
    statement: >
      Branding must stay flexible and must not be restricted to one domain,
      because strategy, product-market fit and customer feedback are expected
      to move over roughly the first year before a stable vision settles.
    status: fact
    confidence: 100
    evidence_ids: [EVD-009]
    investigation: business-vision
    notes: >
      A first-class non-functional requirement stated by the owner, absent from
      PRODUCT.md's NFR-1..10. Carry into M2/M3 as a real constraint.
  - id: KC-085
    statement: >
      A white-label configuration layer already exists at apps/web/lib/brand.ts,
      documented as the single file to edit for a full rebrand — "every string,
      nav item, category, product type, and piece of copy that appears in the
      UI is sourced from this object."
    status: fact
    confidence: 100
    evidence_ids: [EVD-003]
    investigation: technical-architecture
    notes: >
      The branding-flexibility requirement (KC-084) is already architecturally
      supported for the storefront UI layer. Scope limits untested: domain,
      email templates, API-side copy and seeded data are not obviously covered.
  - id: KC-086
    statement: >
      The storefront copy mismatch was already known and deliberately flagged,
      not overlooked. brand.ts records that the rename from placeholder "GLINT"
      to "ELYSIAN" was "mechanical rename only", and carries TODO comments
      stating the festive/Kundan description and brand story are pending a
      positioning decision and were "flagged pending, not silently rewritten".
    status: fact
    confidence: 100
    evidence_ids: [EVD-003]
    investigation: business-vision
    superseded_by: null
    notes: >
      Materially revises KC-050, which read the mismatch as leftover drift. It
      is instead a recorded open decision with the old copy intentionally
      preserved so nothing breaks before the client agrees a narrative — the
      same discipline as ADR-0007's "don't retro-edit advisories".
```

---

## EVD-010

```yaml
id: EVD-010
type: conversation
source: Discovery session with the product owner, 2026-08-06 (DISC-002 Architecture Review)
received: 2026-08-06
summary: >
  Owner's clarification of the system boundary around the marketplace
  arrangement. Establishes that the multi-vendor relationship is a business
  arrangement conducted outside the software, and that the platform models a
  single merchant who owns inventory. Reverses the architectural alarm raised
  in DISC-002 v0.2.0.
pipeline: vision
processed: true
claims:
  - id: KC-087
    statement: >
      The platform provides no digital infrastructure to the contracted shops.
      Transactions, goods and charges between the client and its contracted
      jewellers are conducted outside the system entirely.
    status: fact
    confidence: 100
    evidence_ids: [EVD-010]
    investigation: business-vision
  - id: KC-088
    statement: >
      The software's domain abstraction is "client + contracted shops = one
      client". The website assumes that single aggregated client owns the
      inventory; the contracted shops are an extension of the client, invisible
      to the system.
    status: fact
    confidence: 100
    evidence_ids: [EVD-010]
    investigation: domain-discovery
    notes: >
      This is a bounded-context boundary stated by the owner, and the most
      important architectural constraint recorded in Discovery. It defines what
      the system is deliberately NOT responsible for.
  - id: KC-089
    statement: >
      The single-tenant first-party data model is therefore correct by design,
      not a gap. A Seller/Vendor entity, per-seller inventory, order splitting,
      commission calculation, settlement and payouts are all out of scope by
      deliberate boundary choice.
    status: fact
    confidence: 100
    evidence_ids: [EVD-010, EVD-003]
    investigation: data-model
    notes: >
      Supersedes KC-082's interpretation. The observation in KC-082 — that no
      seller concept exists in the schema — remains accurate; the conclusion
      drawn from it (that this was the largest gap in Discovery) was wrong.
  - id: KC-090
    statement: >
      Commission revenue (KC-080) is settled between the client and its
      contracted jewellers by business arrangement outside the platform, so it
      requires no representation in the data model, no settlement mechanism and
      no payment splitting.
    status: fact
    confidence: 95
    evidence_ids: [EVD-010, EVD-009]
    investigation: business-vision
  - id: KC-091
    statement: >
      Because the aggregated client is the single merchant of record, the
      platform's customer-facing promises — certification claims, dispatch
      timing, free shipping, returns — are the client's to keep, discharged
      against the client as one counterparty rather than enforced across
      multiple sellers.
    status: inference
    confidence: 85
    evidence_ids: [EVD-010]
    investigation: hidden-business-rules
    notes: >
      Follows directly from KC-088 but was not stated in these terms by the
      owner. It resolves the enforcement problem DISC-002 v0.2.0 raised: there
      is one counterparty, not many.
  - id: KC-092
    statement: >
      ADR-0001 (Shiprocket), ADR-0004 (fraud risk scoring) and ADR-0005
      (Razorpay as sole provider) remain valid as decided; the marketplace
      re-examination flagged against them in DISC-002 v0.2.0 is withdrawn.
    status: fact
    confidence: 90
    evidence_ids: [EVD-010]
    investigation: technical-architecture
    notes: >
      All three were sound under first-party assumptions, and KC-088 confirms
      first-party is the correct system model. Single-payee Razorpay,
      client-owned fulfilment and buyer-side fraud scoring all hold.
```

---

## EVD-011

```yaml
id: EVD-011
type: repository
source: >
  Feature-level read of the current tree for DISC-003 — controller route
  inventory, Prisma model check, notifications/subscriptions implementation,
  and status headers of the pre-Oriveda FEAT-/DOM- specs. 2026-08-06.
received: 2026-08-06
summary: >
  Establishes what the system actually does today, verified in source rather
  than inherited from the superseded screenshots in EVD-002/EVD-004.
pipeline: repository
processed: true
claims:
  - id: KC-093
    statement: >
      The API exposes 83 HTTP endpoints across 22 modules. Products carries the
      most (15), then auth (8), users (7), collections and recommendations (6
      each). Notifications and storage expose none — they are internal
      services.
    status: fact
    confidence: 100
    evidence_ids: [EVD-011]
    investigation: feature-inventory
  - id: KC-094
    statement: >
      Admin capability is delivered through ~30 `admin/`-prefixed endpoints
      covering products (incl. bulk import and media reorder), categories,
      collections, coupons, orders, returns, users, review moderation, CMS
      banners, uploads, search reindex and recommendation backfill.
    status: fact
    confidence: 100
    evidence_ids: [EVD-011]
    investigation: feature-inventory
  - id: KC-095
    statement: >
      Shiprocket shipping has no implementation — no occurrence of "shiprocket"
      anywhere in apps/api or apps/web — despite ADR-0001 selecting it,
      DOM-SHIPPING specifying the domain and FEAT-SHIPPING specifying the
      feature.
    status: fact
    confidence: 95
    evidence_ids: [EVD-011]
    investigation: feature-inventory
  - id: KC-096
    statement: >
      Fraud risk scoring has no implementation, despite ADR-0004, DOM-RISK and
      FEAT-FRAUD-RISK-SCORING specifying it.
    status: fact
    confidence: 90
    evidence_ids: [EVD-011]
    investigation: feature-inventory
  - id: KC-097
    statement: >
      Notifications are email-only via Resend. No WhatsApp or SMS provider
      appears in the module, despite ADR-0003 selecting a provider,
      DOM-NOTIFICATION and FEAT-WHATSAPP-SMS-NOTIFICATIONS specifying the
      capability, and the storefront footer advertising "WhatsApp us".
    status: fact
    confidence: 95
    evidence_ids: [EVD-011, EVD-002]
    investigation: feature-inventory
  - id: KC-098
    statement: >
      All six pre-Oriveda DOM-/FEAT- specifications covering shipping, risk and
      notification carry `status: Proposal` and milestone M5/M6 — they are
      correctly marked as unbuilt rather than overclaiming implementation.
    status: fact
    confidence: 100
    evidence_ids: [EVD-011]
    investigation: feature-inventory
  - id: KC-099
    statement: >
      The /subscriptions storefront page advertises a subscription programme
      with a three-step explainer and a register CTA, while no Subscription
      model exists in schema.prisma and no subscriptions module exists in the
      API. The page directs existing subscribers to "Contact us" to skip, pause
      or cancel.
    status: fact
    confidence: 100
    evidence_ids: [EVD-011]
    investigation: feature-inventory
    notes: >
      Distinct from KC-095–097: those are unbuilt features honestly marked
      Proposal in internal specs. This one is promised to customers on the
      live storefront with a manual-email fallback standing in for the system.
  - id: KC-100
    statement: >
      Seven modules consume or publish on the event bus — notifications,
      metrics, orders, payments, returns, search and products — confirming the
      six declared events connect real producers to real consumers.
    status: fact
    confidence: 95
    evidence_ids: [EVD-011]
    investigation: domain-discovery
    notes: Corroborates KC-066 from the source side rather than the owner's testimony.
```

---

## EVD-012

```yaml
id: EVD-012
type: conversation
source: Discovery session with the product owner, 2026-08-06 (DISC-003 Discussion)
received: 2026-08-06
summary: >
  Owner's answers on the three unbuilt ADR-backed capabilities and the
  subscriptions programme, plus a COD contradiction found while assessing fraud
  exposure.
pipeline: vision
processed: true
claims:
  - id: KC-101
    statement: >
      Shiprocket integration is deferred by an external blocker, not dropped:
      the client's Shiprocket account is blocked and an application to resolve
      it is pending. The module will be integrated once access is restored.
    status: fact
    confidence: 100
    evidence_ids: [EVD-012]
    investigation: feature-inventory
    notes: ADR-0001 stands. FR-10's missing tracking reference is blocked, not descoped.
  - id: KC-102
    statement: >
      WhatsApp/SMS notifications are committed and next in sequence, blocked on
      the client supplying mail and WhatsApp credentials; implementation is
      planned as a separate work session.
    status: fact
    confidence: 100
    evidence_ids: [EVD-012]
    investigation: feature-inventory
  - id: KC-103
    statement: >
      Fraud risk scoring has no decision yet — the owner has not committed to
      or dropped it, and requested an assessment before deciding.
    status: fact
    confidence: 100
    evidence_ids: [EVD-012]
    investigation: feature-inventory
  - id: KC-104
    statement: >
      The subscription programme is real and committed. brand.ts specifies it
      concretely as a monthly "Jewel Box" at 30% saving — a curated festive
      piece delivered every month, with pick-your-style, choose-frequency and
      cancel-anytime, plus a "Manage your Jewel Box" self-service entry point.
    status: fact
    confidence: 100
    evidence_ids: [EVD-012, EVD-003]
    investigation: feature-inventory
    notes: >
      This is a recurring-payment plus recurring-physical-fulfilment product,
      materially larger than the missing model implied. It also requires a
      per-cycle human curation step that no existing admin surface covers.
  - id: KC-105
    statement: >
      The storefront FAQ states "COD is available on most pincodes for orders
      under ₹10,000", while PaymentProvider offers only STRIPE and RAZORPAY,
      checkout exposes no COD option, and no cash-on-delivery logic exists in
      either app.
    status: fact
    confidence: 95
    evidence_ids: [EVD-011]
    investigation: hidden-business-rules
    notes: >
      Fifth instance of the storefront-over-promises pattern, after
      subscriptions, WhatsApp, free shipping and 24-hour dispatch. Materially
      affects fraud exposure: COD abuse and RTO are the dominant fraud vectors
      in Indian e-commerce, and a prepaid-only store carries far less risk than
      the FAQ implies it takes on.
```

---

## EVD-013

```yaml
id: EVD-013
type: conversation
source: Discovery session with the product owner, 2026-08-06 (DISC-003 close-out)
received: 2026-08-06
summary: >
  Owner's disposition of fraud risk scoring and the subscription programme
  after consulting the client. Both are deferred to proposed status pending
  client feedback.
pipeline: vision
processed: true
claims:
  - id: KC-106
    statement: >
      Both fraud risk scoring and the subscription programme are deferred:
      neither will go live for now, both are flagged as proposed features
      awaiting client feedback, and both are to be revisited later.
    status: fact
    confidence: 100
    evidence_ids: [EVD-013]
    investigation: feature-inventory
    notes: >
      Revises KC-104's "committed and next in sequence" — the programme remains
      real and intended, but is not scheduled. Deferral is an explicit recorded
      decision per KC-048, not a silent drop.
  - id: KC-107
    statement: >
      The deferral decision was taken after the client was consulted, so it
      reflects the client's position and not only the engineering assessment.
    status: fact
    confidence: 95
    evidence_ids: [EVD-013]
    investigation: business-vision
  - id: KC-108
    statement: >
      With subscriptions deferred, the /subscriptions storefront page, its
      footer link, the "WhatsApp us" footer link and the FAQ's COD claim all
      remain live promises with no system behind them and no scheduled
      delivery date.
    status: fact
    confidence: 95
    evidence_ids: [EVD-013, EVD-011, EVD-012]
    investigation: hidden-business-rules
    notes: >
      Deferring the features does not resolve the copy. Carried forward as a
      launch-gating item for hidden-business-rules; the demo-store banner is
      the only thing currently preventing customer exposure.
```

---

## Investigation Coverage

Per `OV-000`'s exit checklist — every one of the ten M1 investigation areas
needs at least one fact/inference-tier claim, or an explicit gap entry.

| Investigation | Claims | Strongest tier | Status |
| --- | --- | --- | --- |
| `repo-structure` | KC-018, KC-040, KC-041, KC-044, KC-051, KC-053 | fact | Covered |
| `business-vision` | KC-001, KC-004, KC-005, KC-039, KC-045–KC-050 | fact | Covered |
| `feature-inventory` | KC-006–KC-008, KC-016, KC-027, KC-028–KC-029, KC-034–KC-038 | fact | Covered |
| `user-journeys` | KC-002, KC-003, KC-009, KC-010, KC-014 | fact | Covered |
| `data-model` | KC-019, KC-020, KC-021 | fact | Covered |
| `domain-discovery` | KC-022, KC-043 | inference | Weak — see Gap 4 |
| `technical-architecture` | KC-017, KC-023, KC-024, KC-042 | fact | Covered |
| `hidden-business-rules` | KC-011, KC-012, KC-013, KC-033 | fact | Covered |
| `technical-debt` | KC-025, KC-026, KC-030–KC-032, KC-052 (KC-015 superseded) | fact | Covered |
| `recommendations` | KC-054 | fact | Seeded; mostly produced by the other nine |

All ten investigation areas now carry at least one fact- or inference-tier
claim. `recommendations` remains mostly a synthesis output per `OV-001` —
Keep/Improve/Remove lines roll up from the other nine investigations — but
KC-054 seeds it directly.

Per `OV-000`, the intake gate is met: 13 evidence items logged, 108 claims, and
ten of ten areas covered.

## Open Gaps (per OV-000 gap-detection protocol)

1. ~~**Payment handoff mechanics**~~ — **CLOSED** during DISC-001 by reading
   `apps/web/lib/razorpay-checkout.ts` (EVD-003): the app injects Razorpay's
   hosted `checkout.js` and opens it as an **embedded modal** after "Place
   Order", handling `razorpay_order_id` in a callback. KC-014 stands and is
   upgraded to fact tier by this reading.

2. ~~**Business intent vs. planning documents**~~ — **CLOSED** by EVD-006
   (KC-045–KC-049): everyday/imitation jewellery buyer, commercial and
   portfolio build simultaneously, all recorded capabilities are live
   commitments, revisable only by explicit navigation. Pricing and margin
   reality remain unstated but do not block Discovery.

3. ~~**Media storage path**~~ — **CLOSED** during DISC-001 by `.gitignore`'s
   own rationale (EVD-003): uploaded product media "lives in a Docker named
   volume in production and is moved onto the VM with rsync (see
   deploy/RUNBOOK.md §9)". So local disk **is** the production path, not a dev
   fallback — there is no object store. KC-026 is upgraded to fact tier.
   Durability of all product imagery therefore rests on one VM volume plus
   rsync; carry this to `technical-debt` as a risk, not an open question.

4. **Bounded contexts** (`domain-discovery`). The weakest area: KC-022 infers
   contexts from NestJS module names at 70%, and KC-043 shows only three of a
   plausible twelve documented. A real context map needs inter-module coupling
   read from source. Blocks `PRM-ARCHITECTURE` and every `PRM-DOMAIN` run, so
   it is the highest-value gap to close from evidence already in hand.

5. **Non-functional requirements** (`business-vision`,
   `technical-architecture`). Per `OV-001`'s cross-cutting extraction
   checklist, NFRs must be explicitly checked for. Not yet extracted — EVD-005
   is `processed: false` and may contain them. To be resolved when EVD-005 is
   processed, not assumed absent.

6. **Domain/integration events** (`domain-discovery`). Per the same checklist,
   producer/consumer event pairs must be checked for. KC-021 hints at
   status-history records but no event catalog has been extracted. Deferred to
   the `domain-discovery` investigation.

7. ~~**A DRAFT-labelled product is PUBLISHED and shoppable**~~ — **CLOSED**
   by EVD-007 (KC-052): it was published deliberately by the owner to test the
   payment and refund flow end to end. Not a defect and not a leak in the
   publish path. KC-015 is superseded. The residual question — whether
   DRAFT → PUBLISHED enforces any completeness rule at all (price > 0, real
   title, description) — is a genuine one but is now an open design question
   for `hidden-business-rules`, not evidence of a fault.

8. **Evidence captured mid-flight** (cross-cutting). Per KC-051 the codebase
   moved during intake. Screenshot-derived claims are point-in-time; any that
   become load-bearing for a Frozen spec must be re-verified against source
   first. Not a gap to close so much as a standing caveat on EVD-002/EVD-004.
