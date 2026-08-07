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

## EVD-014

```yaml
id: EVD-014
type: conversation
source: Client feedback relayed by the product owner, 2026-08-06
received: 2026-08-06
summary: >
  Client has confirmed COD will not be offered. The owner concludes fraud risk
  scoring is not required. Amends DISC-003 (Frozen) — see its Amendments
  section.
pipeline: vision
processed: true
claims:
  - id: KC-109
    statement: >
      Cash on Delivery will not be available. The client has decided against
      it, making the storefront prepaid-only by intent rather than by
      omission.
    status: fact
    confidence: 100
    evidence_ids: [EVD-014]
    investigation: business-vision
    notes: >
      Resolves the ambiguity in KC-105: the system's prepaid-only behaviour was
      correct and the FAQ copy was wrong, not the reverse.
  - id: KC-110
    statement: >
      Fraud risk scoring is not required. With COD ruled out, the fraud vector
      ADR-0004 was written against — COD abuse and RTO — cannot occur.
    status: fact
    confidence: 100
    evidence_ids: [EVD-014]
    investigation: feature-inventory
    notes: >
      Supersedes KC-106's "deferred pending client feedback" for the fraud half:
      the feedback arrived and the answer is no. The subscription half of
      KC-106 is unaffected and remains deferred-pending.
  - id: KC-111
    statement: >
      The FAQ's COD claim is now a confirmed factual error on the storefront
      rather than an unresolved discrepancy, since the client has ruled COD out.
    status: fact
    confidence: 100
    evidence_ids: [EVD-014, EVD-011]
    investigation: hidden-business-rules
    notes: >
      One of the four launch-gating promises in DISC-003. Unlike the others it
      needs no feature to resolve it — only a copy correction.
  - id: KC-112
    statement: >
      Prepaid-only removes the COD/RTO fraud vector but not all fraud exposure:
      refund abuse through the returns flow, coupon abuse, account takeover and
      card chargebacks remain possible, and chargeback liability sits partly
      with the merchant even on gateway-processed payments.
    status: inference
    confidence: 80
    evidence_ids: [EVD-014, EVD-011]
    investigation: technical-debt
    notes: >
      Recorded for completeness, not as dissent from KC-110. These residual
      vectors are volume-dependent and none justifies building the DOM-RISK
      engine now; ADR-0004's remaining revisit triggers still stand.
```

---

## EVD-015

```yaml
id: EVD-015
type: repository
source: >
  Journey-level read of the current tree for DISC-004 — storefront route
  behaviour, checkout auth gating, cart persistence, and an exhaustive
  comparison of API endpoints against the paths the web app actually calls.
  2026-08-06.
received: 2026-08-06
summary: >
  Establishes how customers and admins actually move through the product, and
  finds a systematic gap between built API capability and reachable UI.
pipeline: repository
processed: true
claims:
  - id: KC-113
    statement: >
      Checkout requires authentication. An unauthenticated visitor reaching
      /checkout sees "Please log in to continue to checkout" and a link to
      /login?next=/checkout — a deliberate, graceful gate, not a failure.
    status: fact
    confidence: 100
    evidence_ids: [EVD-015]
    investigation: user-journeys
    notes: >
      Contradicts PRODUCT.md FR-1, which specifies guest checkout. The gate is
      intentional; the requirement is unmet.
  - id: KC-114
    statement: >
      The cart is client-side only — a zustand store persisted to
      localStorage. The web app never calls the API's cart endpoints, and
      cart-store.ts records the reason: "Backend (apps/api) has no persisted
      Cart API yet ... so no server-side cart round-trip is needed for MVP."
    status: fact
    confidence: 100
    evidence_ids: [EVD-015]
    investigation: user-journeys
    notes: >
      The comment is now stale: the API does have a cart module with five
      endpoints and Cart/CartItem models. The consequence stands regardless —
      carts do not survive a device change or a cleared browser store.
  - id: KC-115
    statement: >
      Five built API capabilities have no storefront UI reaching them —
      wishlist (4 endpoints incl. share token), recommendations (6 endpoints),
      customer-initiated returns, the server-side cart (5 endpoints), and the
      Elasticsearch-backed search endpoints (3).
    status: fact
    confidence: 95
    evidence_ids: [EVD-015]
    investigation: feature-inventory
    notes: >
      Verified by enumerating every apiFetch path in apps/web/lib/api and
      comparing against the controller route inventory (KC-093), then
      confirming absence of any component or storefront route referencing the
      capability. This is the strongest correction to DISC-003, whose FR table
      read endpoint existence as capability — a limitation that document
      recorded explicitly as a Hidden Assumption.
  - id: KC-116
    statement: >
      Storefront search does not use the search module. The search page calls
      getProducts with a `q=` parameter against /products, whose DTO documents
      that path as the "Postgres trigram fallback — Elasticsearch is the
      primary search path". There is no autocomplete surface.
    status: fact
    confidence: 95
    evidence_ids: [EVD-015]
    investigation: user-journeys
    notes: >
      FR-3 specifies typo-tolerant Elasticsearch search with autosuggest. The
      capability is built and the UI reaches the fallback instead.
  - id: KC-117
    statement: >
      Customers cannot initiate a return. The returns API exists and admin
      returns management is wired, but no storefront route or component calls
      it — the only storefront occurrences of "returns" are static copy pages.
    status: fact
    confidence: 95
    evidence_ids: [EVD-015]
    investigation: user-journeys
    notes: >
      The FAQ tells customers to "Start a return from your order history",
      which is not possible. A seventh entry for the launch-gating table, and
      the FAQ placeholder marker's item 3 understated this as "partly backed".
  - id: KC-118
    statement: >
      Recommendations have no storefront surface. Six endpoints exist —
      trending, frequently-bought-together, personalised, recently-viewed —
      and no component or page calls any of them.
    status: fact
    confidence: 95
    evidence_ids: [EVD-015]
    investigation: feature-inventory
    notes: >
      FR-15 is the single AI differentiator PRODUCT.md designated for MVP, and
      the wireframe reserved homepage and PDP slots for it. Fully built
      server-side, entirely invisible to customers.
  - id: KC-119
    statement: >
      The admin journey is fully wired end to end: admin pages call ~14
      distinct admin API paths covering products, categories, collections,
      coupons, orders, returns, users, inventory, CMS and analytics.
    status: fact
    confidence: 95
    evidence_ids: [EVD-015]
    investigation: user-journeys
    notes: >
      The API/UI gap is a storefront phenomenon, not a system-wide one.
```

---

## EVD-016

```yaml
id: EVD-016
type: repository
source: >
  apps/web/e2e/ — the three Playwright specs (storefront, auth, admin), read
  in full for DISC-004 Question 5. 2026-08-06.
received: 2026-08-06
summary: >
  Independent check on DISC-004's negative claims. The suite corroborates them
  and surfaces a coverage gap of its own.
pipeline: repository
processed: true
claims:
  - id: KC-120
    statement: >
      The e2e suite is 159 lines across three files covering 12 tests —
      storefront browsing (homepage, search, product detail, 404, add-to-bag),
      admin RBAC (three redirect cases), and authentication (register, duplicate
      email, wrong password, re-login). No test is skipped or marked fixme.
    status: fact
    confidence: 100
    evidence_ids: [EVD-016]
    investigation: user-journeys
  - id: KC-121
    statement: >
      No e2e test exercises checkout, payment, order confirmation, returns,
      wishlist or recommendations. The suite stops at add-to-bag.
    status: fact
    confidence: 100
    evidence_ids: [EVD-016]
    investigation: technical-debt
    notes: >
      Corroborates KC-115-118 independently: had a wishlist or recommendations
      journey existed, an e2e spec would have been the likely place to find it.
      Separately, this means the most business-critical path — checkout through
      payment to confirmation — has no automated end-to-end coverage, despite
      CI running an E2E job against a real stack. It was verified manually
      instead (KC-052).
  - id: KC-122
    statement: >
      The e2e search test drives the header search box to /search?q=Diamond,
      which internally resolves through /products?q= — confirming KC-116's
      finding that the storefront search path never touches the search module.
    status: fact
    confidence: 95
    evidence_ids: [EVD-016]
    investigation: user-journeys
```

---

## EVD-017

```yaml
id: EVD-017
type: conversation
source: Discovery session with the product owner, 2026-08-06 (DISC-004 Discussion)
received: 2026-08-06
summary: >
  Owner's decisions on the four unwired capabilities and on guest checkout.
pipeline: vision
processed: true
claims:
  - id: KC-123
    statement: >
      Recommendations and customer-initiated returns are to be made accessible
      from the frontend.
    status: fact
    confidence: 100
    evidence_ids: [EVD-017]
    investigation: user-journeys
  - id: KC-124
    statement: >
      Storefront search is to move to the Elasticsearch path, conditional on
      Elasticsearch being present.
    status: fact
    confidence: 95
    evidence_ids: [EVD-017]
    investigation: user-journeys
    notes: >
      The conditional matters — deploy/docker-compose.elasticsearch.yml exists
      and CI deliberately exercises the Postgres fallback, so the fallback must
      remain a working path, not be removed.
  - id: KC-125
    statement: >
      Guest checkout is explicitly unwanted. Requiring registration before
      checkout is a deliberate decision to grow the customer database and to
      enable post-checkout functionality.
    status: fact
    confidence: 100
    evidence_ids: [EVD-017]
    investigation: business-vision
    notes: >
      Supersedes PRODUCT.md FR-1's guest-checkout clause. The built behaviour
      (KC-113) is correct and the requirement is obsolete — advisory per
      ADR-0007. Accepted trade-off: registration friction before payment,
      against a customer record for every order.
  - id: KC-126
    statement: >
      The cart is to move server-side so it persists across devices, using the
      existing cart API.
    status: fact
    confidence: 100
    evidence_ids: [EVD-017]
    investigation: user-journeys
    notes: Delivers PRODUCT.md Journey C's cross-device continuity and retires KC-114's stale comment.
  - id: KC-127
    statement: >
      No decision was given on surfacing the wishlist, which remains built
      server-side (4 endpoints incl. share token) with no storefront UI.
    status: fact
    confidence: 90
    evidence_ids: [EVD-017]
    investigation: user-journeys
    notes: >
      Recorded as undecided rather than assumed either way. FR-6 also specifies
      a shareable wishlist link, which PRODUCT.md Journey A treats as an
      acquisition channel.
```

---

## EVD-018

```yaml
id: EVD-018
type: conversation
source: Discovery session with the product owner, 2026-08-06 (DISC-004 close-out)
received: 2026-08-06
summary: >
  Owner's decision on the wishlist and on shareable links. Surfaces the first
  genuinely new capability found during Discovery.
pipeline: vision
processed: true
claims:
  - id: KC-128
    statement: >
      The wishlist is to be surfaced in the UI, including its shareable link.
      Both are frontend work against the existing API — 4 endpoints including
      GET /wishlist/shared/:shareToken.
    status: fact
    confidence: 100
    evidence_ids: [EVD-018]
    investigation: user-journeys
    notes: Resolves KC-127. Completes FR-6 as specified, including Journey A's sharing loop.
  - id: KC-129
    statement: >
      A shareable cart is also wanted — a link that opens the sender's shopping
      bag for a recipient.
    status: fact
    confidence: 95
    evidence_ids: [EVD-018]
    investigation: feature-inventory
    notes: >
      NEW CAPABILITY. Unlike every other gap found in Discovery, this is neither
      built-and-unwired nor specified-and-unbuilt — it appears in no FR, no ADR
      and no model. The Cart aggregate has no share token and there is no public
      cart read endpoint. It requires backend work and a FEAT specification
      through PRM-FEATURE; it was not designed here.
  - id: KC-130
    statement: >
      A shareable cart interacts with three decisions already taken: the
      server-side cart move (KC-126) is a prerequisite, since a localStorage
      cart cannot be shared; the no-guest-checkout rule (KC-125) means a
      recipient must register before checking out; and cart contents can drift
      in price or stock between share and open.
    status: inference
    confidence: 85
    evidence_ids: [EVD-018, EVD-017]
    investigation: hidden-business-rules
    notes: >
      Recorded as constraints for whoever specifies the feature, not as a
      design. The merge-or-replace rule when a recipient already has a cart,
      and whether a shared cart is a snapshot or a live view, are open
      questions a FEAT spec must answer.
```

---

## EVD-019

```yaml
id: EVD-019
type: database
source: >
  apps/api/src/prisma/schema.prisma (761 lines) read in full, plus the six
  migration files' CHECK constraints and the reviews service's aggregate
  write-through. 2026-08-06, for DISC-005.
received: 2026-08-06
summary: >
  Full read of the data model: 27 models, 15 enums, six migrations. The schema
  carries its own design rationale inline, including decisions recorded as
  resolved against DATABASE.md's open questions.
pipeline: database
processed: true
claims:
  - id: KC-131
    statement: >
      Money is stored exclusively as integer minor units (paise) across every
      model — Order, OrderItem, Cart, Coupon, Payment, ReturnRequest — with the
      schema header stating "never Float/Decimal for currency". No monetary
      float or decimal column exists.
    status: fact
    confidence: 100
    evidence_ids: [EVD-019]
    investigation: data-model
  - id: KC-132
    statement: >
      Immutable snapshots are taken at every historical boundary: Order stores
      shippingAddress as a JSON snapshot rather than an FK to Address;
      OrderItem stores productNameSnapshot, variantSnapshot and
      unitPriceMinorUnits; CartItem stores priceSnapshotMinorUnits.
    status: fact
    confidence: 100
    evidence_ids: [EVD-019]
    investigation: data-model
    notes: >
      The Order.shippingAddress choice is annotated "RESOLVED (was open in
      DATABASE.md Milestone 2)" with its rationale — historical accuracy
      survives the user editing or deleting a saved address.
  - id: KC-133
    statement: >
      Five append-only ledgers exist — CouponRedemption, OrderStatusHistory,
      ReturnStatusHistory, ProductView and AuditLog. CouponRedemption is
      explicitly append-only so redemption limits are enforced by COUNT()
      rather than a mutable counter, avoiding races under concurrent checkout.
    status: fact
    confidence: 100
    evidence_ids: [EVD-019]
    investigation: data-model
  - id: KC-134
    statement: >
      Five named DB-level CHECK constraints enforce invariants in Postgres, not
      only in application code — non_negative_stock, positive_quantity,
      reserved_not_exceeding_on_hand, rating_range (1-5), valid_date_range
      (coupon valid_to > valid_from).
    status: fact
    confidence: 100
    evidence_ids: [EVD-019]
    investigation: hidden-business-rules
  - id: KC-135
    statement: >
      Indexes are chosen against stated access patterns, including a BRIN index
      on Order.createdAt for date-range reporting, a GIN trigram index on
      Product.name, and composite indexes matching the PDP review read path and
      the admin low-stock dashboard.
    status: fact
    confidence: 95
    evidence_ids: [EVD-019]
    investigation: data-model
  - id: KC-136
    statement: >
      Wishlist already carries a unique shareToken column, so the shareable
      wishlist decided in KC-128 requires no schema change — the capability is
      fully modelled and exposed at GET /wishlist/shared/:shareToken.
    status: fact
    confidence: 100
    evidence_ids: [EVD-019]
    investigation: data-model
  - id: KC-137
    statement: >
      Cart carries no share token and there is no public cart read path, so the
      shareable cart (KC-129) needs a schema change. Wishlist.shareToken is an
      exact in-repo precedent for the pattern.
    status: fact
    confidence: 100
    evidence_ids: [EVD-019]
    investigation: data-model
  - id: KC-138
    statement: >
      Cart.guestToken exists and is unique-nullable alongside a unique-nullable
      userId, so the model already supports a pre-login guest cart that can
      later be claimed by a user.
    status: fact
    confidence: 95
    evidence_ids: [EVD-019]
    investigation: data-model
    notes: >
      Not made obsolete by the no-guest-checkout decision (KC-125): a visitor
      still fills a cart before registering, and guestToken is how that cart
      survives until they do. It supports guest *carts*, not guest *checkout*.
  - id: KC-139
    statement: >
      Gift wrap is modelled per line item — CartItem.giftWrap and
      CartItem.giftNote — while the storefront presents it as a single
      cart-level toggle.
    status: fact
    confidence: 90
    evidence_ids: [EVD-019, EVD-002]
    investigation: hidden-business-rules
    notes: >
      Latent mismatch, harmless while the cart is client-side. It must be
      resolved when the cart moves server-side (KC-126) — either the UI becomes
      per-item or the write path sets the flag on every line.
  - id: KC-140
    statement: >
      Order.userId is non-nullable, so an order cannot exist without a
      registered user — the schema already encodes the no-guest-checkout rule
      decided in KC-125.
    status: fact
    confidence: 100
    evidence_ids: [EVD-019]
    investigation: data-model
  - id: KC-141
    statement: >
      ReturnRequest.orderItemId is unique, so each order item can have at most
      one return request for its lifetime.
    status: fact
    confidence: 100
    evidence_ids: [EVD-019]
    investigation: hidden-business-rules
    notes: >
      Enables partial returns cleanly. But a REJECTED return is terminal per
      item — the customer cannot re-request, even if the rejection was an error
      or new information appears. Not evidently deliberate.
  - id: KC-142
    statement: >
      Product.avgRating and ratingCount are denormalized aggregates. The schema
      comment says they are recomputed "via trigger or application-layer
      write-through"; no migration creates any trigger or function, and
      reviews.service.ts performs the write-through, so it is application-layer
      only.
    status: fact
    confidence: 95
    evidence_ids: [EVD-019]
    investigation: data-model
    notes: >
      Any path that writes reviews outside that service — a seed script, a bulk
      import, a manual SQL fix — silently desynchronises the aggregates, and
      they feed search ranking's popularity signal.
  - id: KC-143
    statement: >
      Two invariants are documented as enforceable only in the application
      layer because Prisma cannot express them: ProductView's XOR between
      userId and anonymousId, and Coupon.value's type-dependent meaning
      (0-100 for PERCENTAGE, minor units for FLAT/FIRST_ORDER).
    status: fact
    confidence: 95
    evidence_ids: [EVD-019]
    investigation: hidden-business-rules
  - id: KC-144
    statement: >
      Product.searchVector is an Unsupported("tsvector") column whose GIN index
      is created in a hand-authored raw-SQL migration, so part of the schema is
      invisible to Prisma's model and to any drift check Prisma performs.
    status: fact
    confidence: 95
    evidence_ids: [EVD-019]
    investigation: technical-debt
  - id: KC-145
    statement: >
      The Inventory index comment describes a "partial index", but the
      declaration is a plain composite index on (quantityOnHand,
      quantityReserved) — Prisma cannot express partial indexes.
    status: fact
    confidence: 90
    evidence_ids: [EVD-019]
    investigation: technical-debt
    notes: Minor comment/implementation mismatch; the index is real, its description is not.
```

---

## EVD-020

```yaml
id: EVD-020
type: conversation
source: Discovery session with the product owner, 2026-08-06 (DISC-005 Discussion)
received: 2026-08-06
summary: >
  Owner's decisions on return-request lifecycle and gift-wrap granularity.
pipeline: vision
processed: true
claims:
  - id: KC-146
    statement: >
      A return request cannot be cancelled by the customer, and a rejected
      return cannot be re-requested. Both are deliberate. Exceptions are handled
      out of band — the customer contacts the business by email or WhatsApp.
    status: fact
    confidence: 100
    evidence_ids: [EVD-020]
    investigation: hidden-business-rules
    notes: >
      Confirms KC-141's unique constraint on ReturnRequest.orderItemId as
      intentional rather than incidental. Adds a rule the schema does not
      encode: no customer-side cancellation. The returns UI to be wired under
      KC-123 must therefore expose request and status only — never a cancel
      control.
  - id: KC-147
    statement: >
      Gift wrap is per line item, matching CartItem.giftWrap and
      CartItem.giftNote as modelled.
    status: fact
    confidence: 100
    evidence_ids: [EVD-020]
    investigation: hidden-business-rules
    notes: >
      Resolves KC-139 in the data model's favour. The storefront's single
      cart-level toggle is the side that must change, and it must change as part
      of the server-side cart move (KC-126), not after it.
  - id: KC-148
    statement: >
      The stated out-of-band channel for return exceptions is email or
      WhatsApp, and WhatsApp notifications are not yet implemented (KC-097,
      KC-102) — so email is the only working channel for this fallback today.
    status: inference
    confidence: 85
    evidence_ids: [EVD-020, EVD-011]
    investigation: hidden-business-rules
    notes: >
      Not an objection to the policy, which is sound for the volume expected.
      Recorded because the policy's viability depends on a channel that is
      currently one of two promised and one delivered.
```

---

## EVD-021

```yaml
id: EVD-021
type: repository
source: >
  Coupling analysis of apps/api/src/modules for DISC-006 — cross-module
  imports, event publish/subscribe call sites, and the set of Prisma models
  each module's service reads or writes. 2026-08-06.
received: 2026-08-06
summary: >
  Establishes the real bounded-context map by measuring coupling three ways:
  compile-time imports, runtime events, and table access.
pipeline: repository
processed: true
claims:
  - id: KC-149
    statement: >
      Direct cross-module imports form a shallow graph. Orders is the hub,
      importing audit-log, coupons, inventory and payments. Returns imports
      audit-log, inventory and payments. Ten modules import nothing from a
      sibling.
    status: fact
    confidence: 100
    evidence_ids: [EVD-021]
    investigation: domain-discovery
  - id: KC-150
    statement: >
      The full event map is - publishers - payments emits payment.succeeded;
      orders emits order.confirmed; returns emits return.requested and
      return.refunded; products emits product.upserted and product.deleted;
      reviews emits product.upserted. Subscribers - orders consumes
      payment.succeeded; notifications consumes order.confirmed,
      return.requested and return.refunded; recommendations consumes
      order.confirmed; search consumes product.upserted and product.deleted.
    status: fact
    confidence: 100
    evidence_ids: [EVD-021]
    investigation: domain-discovery
    notes: >
      Completes OV-001's mandatory domain/integration-events check with
      producer/consumer pairs, not just a declared list.
  - id: KC-151
    statement: >
      Orders and Payments are coupled in both directions but without a
      compile-time cycle - orders imports PaymentsService synchronously to
      initiate payment, and payments returns control asynchronously by emitting
      payment.succeeded, which orders consumes to confirm the order.
    status: fact
    confidence: 95
    evidence_ids: [EVD-021]
    investigation: domain-discovery
    notes: Command in, event out - a deliberate pattern rather than accidental coupling.
  - id: KC-152
    statement: >
      The Reviews module writes to Product - reviews.service.ts line 86 issues
      prisma.product.update to maintain avgRating and ratingCount - and then
      emits product.upserted so Search reindexes.
    status: fact
    confidence: 100
    evidence_ids: [EVD-021]
    investigation: domain-discovery
    notes: >
      The clearest boundary breach found - a cross-context write plus emission
      of another context's event. Explains KC-142's fragility - the aggregate
      column is owned by Catalog but its value is owned by Reviews.
  - id: KC-153
    statement: >
      Seventeen modules touch Prisma directly. Eight own exactly one aggregate
      cleanly - audit-log, cms, inventory, payments, wishlist, search
      read-only, auth and users. The rest read across boundaries.
    status: fact
    confidence: 95
    evidence_ids: [EVD-021]
    investigation: domain-discovery
  - id: KC-154
    statement: >
      Recommendations has the widest table reach of any module - order,
      orderItem, product, productCoOccurrence, productVariant and productView,
      spanning Ordering and Catalog as well as its own models.
    status: fact
    confidence: 100
    evidence_ids: [EVD-021]
    investigation: domain-discovery
  - id: KC-155
    statement: >
      Ports-and-adapters structure exists in exactly two modules - payments and
      storage - each with ports/ and providers/ directories, and these are the
      two boundaries where an external vendor sits.
    status: fact
    confidence: 100
    evidence_ids: [EVD-021]
    investigation: technical-architecture
    notes: Implements NFR-9's no-vendor-lock-in requirement precisely where it applies.
  - id: KC-156
    statement: >
      Three modules are shared infrastructure rather than domains - audit-log,
      metrics and storage are imported by many modules and own no business
      concept. Health is an operational probe.
    status: inference
    confidence: 90
    evidence_ids: [EVD-021]
    investigation: domain-discovery
  - id: KC-157
    statement: >
      Coupons reads the Order table directly to count a user's prior orders
      when enforcing FIRST_ORDER eligibility and per-user redemption limits.
    status: fact
    confidence: 100
    evidence_ids: [EVD-021]
    investigation: domain-discovery
```

---

## EVD-022

```yaml
id: EVD-022
type: conversation
source: Discovery session with the product owner, 2026-08-06 (DISC-006 Discussion)
received: 2026-08-06
summary: >
  Owner accepts both engineering recommendations on cross-context aggregate
  ownership and on domain-specification sequencing.
pipeline: vision
processed: true
claims:
  - id: KC-158
    statement: >
      Rating-aggregate ownership moves to Catalog. Reviews will call a
      Catalog-owned recompute command synchronously; Catalog performs the write
      and emits product.upserted. Reviews stops writing prisma.product and stops
      emitting a Catalog event.
    status: fact
    confidence: 100
    evidence_ids: [EVD-022]
    investigation: domain-discovery
    notes: >
      Resolves KC-152 by mirroring the Orders-Payments seam (KC-151) rather
      than inventing a second pattern. Kept synchronous deliberately - an
      eventually-consistent rating would be a visible regression on a value
      read on every PDP and PLP.
  - id: KC-159
    statement: >
      The recompute operation is to be idempotent and derive the aggregate from
      scratch rather than incrementing, so the same function can be run in bulk
      to reconcile every product.
    status: fact
    confidence: 100
    evidence_ids: [EVD-022]
    investigation: technical-debt
    notes: >
      This is the fix for KC-142, and it is independent of the boundary fix.
      Ownership makes the value correct by construction; bulk reconciliation
      makes it recoverable when construction is bypassed by a seed script, bulk
      import or manual SQL.
  - id: KC-160
    statement: >
      Domain specifications are to be written when a context is about to be
      worked on, not when it is discovered. Two are authored now - Shopping
      (cart and wishlist) and Returns - with the remaining twelve contexts
      deferred until work reaches them.
    status: fact
    confidence: 100
    evidence_ids: [EVD-022]
    investigation: recommendations
    notes: >
      Resolves KC-149's documentation gap. The rationale is the project's own
      history - two of three existing DOM- specs describe capabilities that do
      not exist, having been written ahead of work.
  - id: KC-161
    statement: >
      PRM-DOMAIN is authorised to run out of milestone order for Shopping and
      Returns, ahead of M2 Constitution and M3 Architecture, because imminent
      implementation work reaches both contexts first.
    status: fact
    confidence: 100
    evidence_ids: [EVD-022]
    investigation: recommendations
    notes: >
      Explicit navigation per KC-048, recorded as ADR-0009 rather than taken
      silently.
  - id: KC-162
    statement: >
      DOM-SHIPPING and DOM-RISK are to be annotated as specifying contexts that
      are not implemented - shipping blocked on the client's Shiprocket account,
      risk superseded by the closure of fraud scoring.
    status: fact
    confidence: 100
    evidence_ids: [EVD-022]
    investigation: recommendations
```

---

## EVD-023

```yaml
id: EVD-023
type: repository
source: >
  Runtime and deployment architecture read for DISC-007 — deploy/ compose
  files, Caddyfile, monitoring provisioning, apps/api main.ts and app.module.ts,
  common/ cross-cutting layers, env validation, and the web app's SEO and
  accessibility surfaces. 2026-08-06.
received: 2026-08-06
summary: >
  Establishes the deployed architecture and measures the ten declared NFRs
  against it.
pipeline: repository
processed: true
claims:
  - id: KC-163
    statement: >
      The system is a modular monolith - one NestJS process containing 22
      modules communicating through an in-process event bus - plus a Next.js
      SSR app, deployed as Docker Compose services on a single VM sharing one
      bridge network (jwel-net), behind Caddy with automatic TLS.
    status: fact
    confidence: 95
    evidence_ids: [EVD-023]
    investigation: technical-architecture
  - id: KC-164
    statement: >
      Deployment is split across five compose files - api (api, web, migrate,
      create-admin), postgres, elasticsearch, metabase and monitoring
      (prometheus, grafana) - each joining the same network, so components can
      be started and stopped independently on one host.
    status: fact
    confidence: 100
    evidence_ids: [EVD-023]
    investigation: technical-architecture
  - id: KC-165
    statement: >
      The event bus is explicitly documented as decoupling publishers from
      subscribers "within a single process (modular monolith)". It is
      fire-and-forget with no persistence, no retry and no dead-letter path.
    status: fact
    confidence: 95
    evidence_ids: [EVD-023, EVD-021]
    investigation: technical-architecture
    notes: >
      Delivery is at-most-once - an event emitted immediately before a crash is
      lost, and its handler never runs. Consequence - a confirmed order whose
      notification or co-occurrence update is dropped has no recovery path.
  - id: KC-166
    statement: >
      Security middleware is layered - helmet, a CORS allowlist from
      CORS_ALLOWED_ORIGINS, a global ValidationPipe, a global ThrottlerGuard at
      120 requests per 60 seconds, plus JWT, optional-JWT and roles guards.
    status: fact
    confidence: 100
    evidence_ids: [EVD-023]
    investigation: technical-architecture
  - id: KC-167
    statement: >
      Swagger is disabled outside development in main.ts, and Caddy
      independently returns 404 for /docs on the API host - the same exposure
      blocked twice, in the application and at the edge.
    status: fact
    confidence: 100
    evidence_ids: [EVD-023]
    investigation: technical-architecture
  - id: KC-168
    statement: >
      Environment configuration is validated at boot, including a minimum JWT
      secret length and explicit rejection of a known placeholder secret.
      Validated vars include DATABASE_URL, JWT_SECRET, CORS_ALLOWED_ORIGINS,
      NODE_ENV, PUBLIC_BASE_URL, STORAGE_PROVIDER and PAYMENTS_MODE.
    status: fact
    confidence: 95
    evidence_ids: [EVD-023]
    investigation: technical-architecture
  - id: KC-169
    statement: >
      Observability is layered and self-hosted - a correlation-id middleware, a
      logging interceptor and a metrics interceptor in the API; a Prometheus
      endpoint reachable only on the internal Docker network; Grafana with
      provisioned datasources, a dashboard and alerting rules; and Sentry in
      both apps.
    status: fact
    confidence: 95
    evidence_ids: [EVD-023]
    investigation: technical-architecture
  - id: KC-170
    statement: >
      NFR-7 SEO is substantially implemented - the web app has robots.ts,
      sitemap.ts and JSON-LD structured data on the product detail page,
      alongside server-rendered category and product pages.
    status: fact
    confidence: 90
    evidence_ids: [EVD-023]
    investigation: technical-architecture
  - id: KC-171
    statement: >
      NFR-5 accessibility has no automated verification - no axe, jest-axe or
      equivalent appears anywhere in the web app's dependencies or tests,
      despite WCAG 2.1 AA being declared non-optional for MVP.
    status: fact
    confidence: 90
    evidence_ids: [EVD-023]
    investigation: technical-debt
  - id: KC-172
    statement: >
      NFR-1 performance targets (P95 under 2.5s on 4G, search under 300ms) and
      NFR-2 availability (99.9%) have no evidence of ever being measured - no
      load test, synthetic check, uptime monitor or performance budget exists
      in the repository.
    status: inference
    confidence: 85
    evidence_ids: [EVD-023]
    investigation: technical-debt
  - id: KC-173
    statement: >
      The deployment cannot structurally meet NFR-2's 99.9% availability - a
      single VM with one Postgres container, one API container and no
      replication or failover has no redundancy, and container restarts during
      deploys are unmasked downtime.
    status: inference
    confidence: 85
    evidence_ids: [EVD-023]
    investigation: technical-architecture
```

---

## EVD-024

```yaml
id: EVD-024
type: conversation
source: Discovery session with the product owner, 2026-08-06 (DISC-007 Discussion)
received: 2026-08-06
summary: >
  Owner's decisions on reliability targets, event-bus durability and
  accessibility verification.
pipeline: vision
processed: true
claims:
  - id: KC-174
    statement: >
      NFR-2 (99.9% availability) and NFR-3 (ECS with Redis caching) are to be
      restated to describe the system actually being built - a single-node
      modular monolith - rather than the system being changed to match them.
    status: fact
    confidence: 100
    evidence_ids: [EVD-024]
    investigation: technical-architecture
    notes: >
      Fourth instance of the same pattern - implementation made the better
      decision and the specification was left describing the abandoned one.
      Previous three - gold-rate pricing (KC-071), guest checkout (KC-125),
      deployment topology (KC-074).
  - id: KC-175
    statement: >
      Event-bus durability is deferred with a named trigger - it will be built
      if and when WhatsApp notifications require it, and not before.
    status: fact
    confidence: 100
    evidence_ids: [EVD-024]
    investigation: technical-architecture
    notes: >
      Conditional commitment rather than open deferral. The reasoning holds -
      a dropped email today is one customer's confirmation; a dropped WhatsApp
      message once that channel is the primary one becomes a support call. Until
      then the preferred mitigation is re-derivable effects (ADR-0008's
      reconciliation pattern), not durability.
  - id: KC-176
    statement: >
      An accessibility check (axe or equivalent) is to be added to the existing
      Playwright suite, giving NFR-5's WCAG 2.1 AA commitment its first
      verification.
    status: fact
    confidence: 100
    evidence_ids: [EVD-024]
    investigation: technical-debt
```

---

## EVD-025

```yaml
id: EVD-025
type: repository
source: >
  Business-rule extraction for DISC-008 — service-layer validation and
  transition logic across orders, returns, coupons, inventory, reviews and
  products, read against the DB constraints from EVD-019. 2026-08-07.
received: 2026-08-07
summary: >
  Recovers the rules that govern this system's behaviour and exist only in
  code - transition tables, eligibility checks and validation gaps.
pipeline: repository
processed: true
claims:
  - id: KC-177
    statement: >
      Order status transitions are governed by an explicit table - PLACED to
      CONFIRMED or CANCELLED; CONFIRMED to PROCESSING or CANCELLED; PROCESSING
      to SHIPPED or CANCELLED; SHIPPED to DELIVERED only; DELIVERED, CANCELLED
      and REFUNDED terminal. Invalid transitions are rejected.
    status: fact
    confidence: 100
    evidence_ids: [EVD-025]
    investigation: hidden-business-rules
  - id: KC-178
    statement: >
      OrderStatus.REFUNDED is unreachable through the order state machine - no
      transition targets it, and refunds are handled entirely on the
      ReturnRequest lifecycle. An order containing a refunded item remains
      DELIVERED.
    status: fact
    confidence: 95
    evidence_ids: [EVD-025]
    investigation: hidden-business-rules
    notes: >
      The admin Orders list will therefore never show REFUNDED, while the enum,
      the web type union and the customer's order history all imply it can.
  - id: KC-179
    statement: >
      Return eligibility has exactly two conditions - the order must be
      DELIVERED, and each order item may have at most one return request. There
      is NO time window in code.
    status: fact
    confidence: 100
    evidence_ids: [EVD-025]
    investigation: hidden-business-rules
    notes: >
      The FAQ states returns are accepted "within 7 days of delivery". No such
      check exists - a customer could request a return years later and the
      system would accept it. Eighth entry for the launch-gating promises table.
  - id: KC-180
    statement: >
      Return transitions are REQUESTED to APPROVED or REJECTED; APPROVED to
      REFUND_PROCESSING; REFUND_PROCESSING to REFUNDED; REJECTED and REFUNDED
      terminal. A refund amount is mandatory when marking REFUNDED.
    status: fact
    confidence: 100
    evidence_ids: [EVD-025]
    investigation: hidden-business-rules
    notes: Matches KC-146 exactly - no cancellation path, no re-request after rejection.
  - id: KC-181
    statement: >
      Coupon validation applies six checks in order - coupon exists, is not
      soft-deleted and is active; now falls within validFrom and validTo;
      subtotal meets minOrderAmount; global redemptions below maxRedemptions;
      this user's redemptions below maxRedemptionsPerUser; and for FIRST_ORDER
      type, the user has zero prior orders.
    status: fact
    confidence: 100
    evidence_ids: [EVD-025]
    investigation: hidden-business-rules
  - id: KC-182
    statement: >
      FIRST_ORDER eligibility counts every order the user has ever placed
      regardless of status, so a customer whose only previous order was
      CANCELLED is permanently ineligible for a first-order coupon.
    status: fact
    confidence: 95
    evidence_ids: [EVD-025]
    investigation: hidden-business-rules
    notes: >
      A real customer-facing consequence that appears in no specification. The
      cancelled-order rate in the seeded data is high, so this is reachable.
  - id: KC-183
    statement: >
      Inventory reservation is concurrency-safe by construction - reserve,
      release and commit go through conditional raw UPDATEs whose WHERE clause
      carries the invariant (quantity_on_hand - quantity_reserved >= n), so an
      oversell fails at the database rather than being checked then acted upon.
      Release clamps with GREATEST(...,0) and adjustment is guarded by
      quantity_on_hand + delta >= quantity_reserved.
    status: fact
    confidence: 100
    evidence_ids: [EVD-025]
    investigation: hidden-business-rules
  - id: KC-184
    statement: >
      Anyone may review any product without having bought it. verifiedPurchase
      is a computed badge - true when the user has a DELIVERED order containing
      the product - not a gate. Reviews are created PENDING and only APPROVED
      reviews are displayed or counted in rating aggregates.
    status: fact
    confidence: 100
    evidence_ids: [EVD-025]
    investigation: hidden-business-rules
    notes: >
      Resolves PRODUCT.md's own Open Question 3, which asked whether reviews
      should require purchase verification at launch. The implemented answer is
      no - moderate instead.
  - id: KC-185
    statement: >
      Products are created DRAFT and the storefront reads only PUBLISHED,
      non-deleted products. Publishing has NO validation - status is a plain
      optional field on UpdateProductDto with no check on price, name,
      description, media or variants.
    status: fact
    confidence: 95
    evidence_ids: [EVD-025]
    investigation: hidden-business-rules
    notes: >
      Closes the residual question from DISC-002 - the DRAFT to PUBLISHED
      transition enforces nothing. This is how a zero-priced placeholder named
      "Untitled Draft 1041" became shoppable (KC-015, KC-052). Harmless when
      the publisher is the owner testing; the catalog is about to be handed to
      a client publishing 1,045 placeholders.
```

---

## EVD-026

```yaml
id: EVD-026
type: conversation
source: Discovery session with the product owner, 2026-08-07 (DISC-008 Discussion)
received: 2026-08-07
summary: >
  Owner's decisions on the four hidden-rule questions - return window, publish
  validation, first-order eligibility and refunded order status.
pipeline: vision
processed: true
claims:
  - id: KC-186
    statement: >
      A return window of 10 days from delivery is to be enforced. It is a
      blanket rule - global, not per product or per category - and must be
      editable from the admin panel rather than fixed in code.
    status: fact
    confidence: 100
    evidence_ids: [EVD-026]
    investigation: hidden-business-rules
    notes: >
      Closes KC-179's unbounded liability. Also corrects the FAQ, which claims
      7 days. Note the FAQ figure is now wrong in a second way - both the number
      and the fact that nothing enforced it.
  - id: KC-187
    statement: >
      An admin-editable return window requires a settings store, which does not
      exist. No Setting, Config or AppSetting model appears among the 27 Prisma
      models, and no return-window constant exists anywhere in either app.
    status: fact
    confidence: 95
    evidence_ids: [EVD-026, EVD-019]
    investigation: data-model
    notes: >
      NEW CAPABILITY, the second Discovery has surfaced after the shareable
      cart (KC-129). Needs a persisted settings mechanism, an admin surface and
      a read path in ReturnsService. Requires a FEAT specification through
      PRM-FEATURE - it was not designed here.
  - id: KC-188
    statement: >
      Publish-time completeness validation will NOT be added. Publishing
      remains an unguarded admin action, and correctness of published product
      data is the admin's responsibility rather than the system's.
    status: fact
    confidence: 85
    evidence_ids: [EVD-026]
    investigation: hidden-business-rules
    superseded_by: KC-192
    notes: >
      WRONG - superseded by KC-192. Read from the owner's "all dependent on
      admin", which was confirming the finding rather than accepting it. The
      claim was recorded at 85% with the ambiguity flagged explicitly, and the
      flag did its job. Retained per OV-000.
  - id: KC-189
    statement: >
      FIRST_ORDER eligibility counting cancelled orders is deliberate. A
      customer who cancels their first order does not regain first-order
      benefits on their next one.
    status: fact
    confidence: 100
    evidence_ids: [EVD-026]
    investigation: hidden-business-rules
    notes: >
      Confirms KC-182 as intended rather than incidental. It is an
      anti-abuse rule - place, cancel, repeat would otherwise farm the discount
      indefinitely. Worth stating wherever coupons are documented for the
      client, since it is invisible to the customer who triggers it.
  - id: KC-190
    statement: >
      OrderStatus.REFUNDED is to be made reachable rather than removed from the
      enum.
    status: fact
    confidence: 100
    evidence_ids: [EVD-026]
    investigation: hidden-business-rules
  - id: KC-191
    statement: >
      Making REFUNDED reachable requires a rule that does not yet exist -
      returns are per order item, so an order with some items refunded needs a
      defined condition for the order itself becoming REFUNDED, and whether a
      partially refunded order stays DELIVERED.
    status: inference
    confidence: 90
    evidence_ids: [EVD-026, EVD-025]
    investigation: hidden-business-rules
    notes: >
      Not a design decision taken here. Belongs in DOM-RETURNS per ADR-0009.
      The natural candidate - the order becomes REFUNDED when every order item
      has a REFUNDED return - is stated as a starting point, not a conclusion.
```

---

## EVD-027

```yaml
id: EVD-027
type: conversation
source: Discovery session with the product owner, 2026-08-07 (DISC-008 correction)
received: 2026-08-07
summary: >
  Owner corrects the publish-validation reading, clarifies the standing of FAQ
  content, and confirms the settings store should be a general mechanism.
pipeline: vision
processed: true
claims:
  - id: KC-192
    statement: >
      Publish-time completeness checks ARE to be added. The owner's earlier
      statement confirmed the finding rather than accepting the current
      behaviour.
    status: fact
    confidence: 100
    evidence_ids: [EVD-027]
    investigation: hidden-business-rules
    notes: >
      Supersedes KC-188, which recorded the opposite at 85% confidence with the
      ambiguity flagged. The flag was warranted and the reading was wrong.
      Proposed check set as a starting point, not a final specification -
      non-zero price on every variant, a name that is not an auto-generated
      placeholder, a non-placeholder description, at least one variant, and at
      least one image.
  - id: KC-193
    statement: >
      The FAQ contents are placeholder copy, not exact question-and-answer
      pairs the business stands behind. Both the questions and the answers are
      subject to replacement.
    status: fact
    confidence: 100
    evidence_ids: [EVD-027]
    investigation: hidden-business-rules
    notes: >
      Reframes four entries in the launch-gating promises table. FAQ-sourced
      claims - COD, the return window, "start a return from your order
      history", customisation, tarnish resistance - are placeholder copy to be
      rewritten rather than commitments to honour or retract. The non-FAQ
      entries are unaffected - the sale bar, checkout copy, footer links and
      /subscriptions page are live product surfaces, not placeholders.
  - id: KC-194
    statement: >
      The settings store required by the admin-editable return window is to be
      built as a general mechanism rather than a single return-window column.
    status: fact
    confidence: 100
    evidence_ids: [EVD-027]
    investigation: technical-architecture
    notes: >
      Confirms KC-187's recommendation. Anticipated early consumers beyond the
      return window - free shipping threshold, dispatch SLA, low-stock
      threshold - each of which is currently hardcoded or unbacked.
```

---

## EVD-028

```yaml
id: EVD-028
type: repository
source: >
  Technical-debt pass for DISC-009 - TODO density, dependency currency,
  coverage-gate configuration and exclusions, dead-code detection, type
  strictness and suppression counts. 2026-08-07.
received: 2026-08-07
summary: >
  Fresh debt scan, complementing the queue inherited from DISC-001 to DISC-008.
pipeline: repository
processed: true
claims:
  - id: KC-195
    statement: >
      TODO/FIXME/HACK density across both apps is three occurrences, all of
      them deliberate pending-decision markers in brand.ts and the FAQ page
      rather than abandoned work.
    status: fact
    confidence: 100
    evidence_ids: [EVD-028]
    investigation: technical-debt
    notes: Unusually low for a codebase of this size - roughly one per 10k lines of source.
  - id: KC-196
    statement: >
      Both apps enable TypeScript strict mode. The API additionally sets
      strictNullChecks and noImplicitAny explicitly, and disables
      strictPropertyInitialization (a normal NestJS accommodation for
      dependency injection).
    status: fact
    confidence: 100
    evidence_ids: [EVD-028]
    investigation: technical-debt
  - id: KC-197
    statement: >
      Type-system suppressions total four occurrences of ts-ignore,
      ts-expect-error or eslint-disable across both apps' source, and
      non-test 'any' usage totals eleven.
    status: fact
    confidence: 95
    evidence_ids: [EVD-028]
    investigation: technical-debt
  - id: KC-198
    statement: >
      Both coverage gates are configured at 90% for statements, branches,
      functions and lines - Jest global thresholds in the API, Vitest
      thresholds in the web app.
    status: fact
    confidence: 100
    evidence_ids: [EVD-028]
    investigation: technical-debt
    notes: >
      The API's are declared under a "global" key, so coverage is aggregate
      across the codebase rather than enforced per file. A well-tested module
      can mask an untested one without failing the gate.
  - id: KC-199
    statement: >
      The web coverage gate excludes components/cinematic/** and
      components/vision/**. The latter does not exist. The former is 3 files
      and 145 lines - macro-scene.tsx, parallax-hero.tsx, scroll-reveal.tsx -
      which no route or component imports.
    status: fact
    confidence: 95
    evidence_ids: [EVD-028]
    investigation: technical-debt
    notes: >
      145 lines of dead code carved out of the coverage gate, plus a stale
      exclusion pointing at a directory that was removed. The exclusion hides
      the fact that the code is unused.
  - id: KC-200
    statement: >
      Framework dependencies are one major version behind current on the API
      side - NestJS 10 and Prisma 5 - while the web app is current with Next 15
      and React 19. Both apps share TypeScript 5.5 and Sentry 10.
    status: fact
    confidence: 90
    evidence_ids: [EVD-028]
    investigation: technical-debt
  - id: KC-201
    statement: >
      No unused runtime dependencies were found in the web app. The only two
      flagged by import scanning - @sentry/nextjs and react-dom - are both
      referenced through instrumentation config files and framework internals
      rather than direct imports.
    status: inference
    confidence: 85
    evidence_ids: [EVD-028]
    investigation: technical-debt
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

Per `OV-000`, the intake gate is met: 28 evidence items logged, 201 claims, and
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
