# Jwel — Backend Implementation

**Originally Milestone 5 — Backend Development · Validated and extended in Milestone 7 · Search added in Milestone 8 · Recommendation Engine added in Milestone 9 · Admin Portal backend added in Milestone 10**
**Role:** Backend Lead Engineer (Milestones 5/7) / Search Engineer (Milestone 8) / ML Engineer (Milestone 9) / Enterprise Admin Platform Engineer (Milestone 10)
**Inputs:** [`PRODUCT.md`](PRODUCT.md), [`ARCHITECTURE.md`](ARCHITECTURE.md), [`DATABASE.md`](DATABASE.md)
**Location:** [`apps/api`](apps/api) (NestJS)
**Status:** Implemented **and run end-to-end against a real local PostgreSQL +
Elasticsearch stack, including real checkout/order data driving live
recommendations and a real admin-facing dashboard** — see §6 (Milestone 7), §8
(Milestone 8), §9 (Milestone 9), §10 (Milestone 10) for what was actually
verified, not just written.

---

## 1. Scope Delivered

A NestJS backend with 16 modules. The original 8 (Milestone 5), 4 added in
Milestone 7 to close gaps that milestone explicitly named as missing, Search
(Milestone 8), Recommendations (Milestone 9), and CMS + Analytics (Milestone 10):

| Area | Module | Key endpoints |
|---|---|---|
| Authentication | `modules/auth` | `POST /api/v1/auth/register`, `POST /api/v1/auth/login` |
| Users | `modules/users` | `/api/v1/me`, `/api/v1/me/addresses`, `/api/v1/admin/users` |
| Products | `modules/products` | `/api/v1/products`, `/api/v1/products/:slug`, `/api/v1/admin/products` |
| Orders | `modules/orders` | `/api/v1/orders` (checkout), `/api/v1/orders/:id`, `/api/v1/admin/orders/:id/status` |
| Payments | `modules/payments` | `/api/v1/payments/webhook/stripe` |
| Inventory | `modules/inventory` | `/api/v1/admin/inventory/:variantId`, `.../low-stock`, `.../adjust` |
| Reviews | `modules/reviews` | `/api/v1/reviews`, `/api/v1/products/:productId/reviews`, `/api/v1/admin/reviews/...` |
| Coupons | `modules/coupons` | `/api/v1/coupons/validate`, `/api/v1/admin/coupons` |
| Cart | `modules/cart` | `/api/v1/cart`, `/api/v1/cart/items` |
| Wishlist | `modules/wishlist` | `/api/v1/wishlist`, `/api/v1/wishlist/items`, `/api/v1/wishlist/shared/:shareToken` |
| Returns (FR-11) | `modules/returns` | `/api/v1/returns`, `/api/v1/admin/returns/:id/status` |
| Notifications | `modules/notifications` | no HTTP surface — subscribes to domain events (see §3.8) |
| **Search** *(Milestone 8)* | `modules/search` | `/api/v1/search`, `/api/v1/search/autocomplete`, `/api/v1/admin/search/reindex` |
| **Recommendations** *(Milestone 9)* | `modules/recommendations` | `/api/v1/products/:id/views`, `/api/v1/recently-viewed`, `/api/v1/products/:id/recommendations/frequently-bought-together`, `/api/v1/recommendations/trending`, `/api/v1/me/recommendations`, `/api/v1/admin/recommendations/backfill-co-occurrence` |
| **CMS** *(new, Milestone 10)* | `modules/cms` | `/api/v1/cms/banners`, `/api/v1/admin/cms/banners` (CRUD) |
| **Analytics** *(new, Milestone 10)* | `modules/analytics` | `/api/v1/admin/analytics/dashboard` |

Plus `common/event-bus` — a minimal in-process domain event bus (Milestone 7),
now also driving the catalog → search sync ARCHITECTURE.md §5.3 always
specified (see §8.3).

Cross-cutting requirements (unchanged from Milestone 5, still true): Swagger
at `/docs`, global `ValidationPipe`, single `AllExceptionsFilter` error
envelope, correlation-ID request logging, global `JwtAuthGuard`/`RolesGuard`
RBAC with object-level ownership checks in services.

---

## 2. Structural Decision: Pragmatic Modules, Not Full 4-Layer DDD Everywhere

Unchanged from Milestone 5: most modules are flat (`module/controller/service/
dto`); the strict port+adapter pattern is reserved for Payments, the one
dependency with a real, confirmed second implementation (Razorpay). The new
Cart/Wishlist/Returns/Notifications modules follow the same flat pattern —
none of them have a second backing implementation that would justify a port.

---

## 3. Key Implementation Details Worth Knowing

### 3.1 Checkout orchestration (`OrdersService.create`)
Unchanged from Milestone 5: stock reservation + order/coupon writes in one
transaction; payment-intent creation happens after commit, with compensation
(stock released, order `CANCELLED`) if it fails. **This compensation path was
directly observed firing correctly during Milestone 7 validation** — see §6.2.

### 3.2 Race-safe stock reservation (`InventoryService`)
Unchanged. Conditional raw `UPDATE` statements, not SELECT-then-UPDATE.
**Directly observed rejecting a checkout with 409 when stock was insufficient,
then succeeding once restocked** — see §6.2.

### 3.3 Order status machine (`OrdersService.adminUpdateStatus`)
Unchanged. `PLACED → CONFIRMED → PROCESSING → SHIPPED → DELIVERED`, stock
committed only at `SHIPPED`.

### 3.4 Payments webhook idempotency
Unchanged. Idempotent on `providerRef` + status check.

### 3.5 Reviews: verified purchase + moderation
Unchanged. **Directly observed**: a review submitted with no prior delivered
order correctly came back `verifiedPurchase: false`, `moderationStatus: PENDING`.

### 3.6 Coupons: append-only redemption ledger
Unchanged. **Directly observed**: a 10% `PERCENTAGE` coupon against a ₹2,599.00
subtotal returned `discountMinorUnits: 25990` — correct to the paisa.

### 3.7 No `passwordHash` leakage — found *again*, fixed *again*
Milestone 5 already documented one `passwordHash` leak in `UsersService`,
caught and fixed during that implementation pass. **Milestone 7 validation
found the same bug class a second time**, in code that milestone wrote: the
new `ReturnsService`'s nested include —
`orderItem: { include: { order: { include: { user: true } } } }` — pulled the
full `User` row, `passwordHash` included, straight into the `POST /returns`
response. `PaymentsService.markSucceeded` had the identical pattern (lower
severity — that result never reaches an HTTP response, but still wrong to
over-fetch). Both fixed by switching `include: { user: true }` to
`include: { user: { select: { id: true, email: true } } }`. Recorded here
specifically because this is now a *repeated* mistake, not a one-off — any new
Prisma `include` that crosses into `User` needs a `select`, every time, as a
standing rule for this codebase.

### 3.8 Domain event bus (closes a Milestone 5 gap)
`common/event-bus/event-bus.service.ts` is a small typed wrapper around
Node's `EventEmitter`, registered as a `@Global()` module. `PaymentsService`
now `emit('order.confirmed', ...)` instead of doing nothing after confirming
payment; `ReturnsService` emits `return.requested` and `return.refunded`.
`NotificationsService` subscribes to all three in `onModuleInit` and either
calls the Resend API or — if `RESEND_API_KEY` is unset — logs a warning and
skips, without ever throwing. This is a deliberately different failure
posture from the Payments/Razorpay stub (which fails loudly): a missed email
must never roll back or block the business operation that triggered it.
**Directly observed firing**: creating a return with no `RESEND_API_KEY`
configured produced the log line `RESEND_API_KEY not configured — skipping
email "We received your return request" to anika@example.com` (see §6.3).

This closes the gap for these three events specifically. `OrderPlaced` →
Inventory/Analytics from ARCHITECTURE.md §5's full event catalog still happens
via direct service calls (`OrdersService` calling `InventoryService` directly)
— that's a correct direct call for a same-transaction invariant, not a missing
wiring, and is not migrated to the event bus.

### 3.9 Cart module (closes a Milestone 5 gap)
`CartService` is additive, not a breaking change: `OrdersService.create` still
accepts a flat `items[]` array exactly as before (FRONTEND.md's local cart
already submits that shape) — checkout does not require a server-side cart to
exist. `CartService` gives a client an *optional* way to persist a bag across
devices, backed by the `Cart`/`CartItem` models that existed in the schema
since Milestone 4 but had no API surface until now.

### 3.10 Wishlist module (closes a Milestone 5 gap)
Standard CRUD over `Wishlist`/`WishlistItem`, plus one unauthenticated read —
`GET /wishlist/shared/:shareToken` — backing the wishlist-sharing acquisition
loop from PRODUCT.md §10 / Journey A. The share token is a 32-character random
hex string (`crypto.randomBytes(16)`), generated once per wishlist.

### 3.11 Returns module (closes the FR-11 gap)
Eligibility: the order must be `DELIVERED`; one `ReturnRequest` per
`OrderItem` (also a DB unique constraint, per DATABASE.md §3 — the service
checks first to return a clean 409 rather than letting a raw Prisma P2002
surface). Status machine `REQUESTED → APPROVED → REFUND_PROCESSING →
REFUNDED` (or `REQUESTED → REJECTED`), mirroring `OrdersService`'s transition-map
pattern. On reaching `REFUNDED`: inventory is restocked via
`InventoryService.restock`, the associated `Payment` row is marked
`REFUNDED`, and a `return.refunded` event fires.

**Named simplification, not silently done**: marking a `Payment` `REFUNDED`
is bookkeeping only — this does **not** call Stripe's refund API.
`PaymentProviderPort` has no `refund` method yet. A real refund must currently
be issued through the Stripe dashboard/API directly; extending the port is a
follow-up, tracked in §5.

---

## 4. What Milestone 5 Listed as Deferred — Current Status

| Item (as named in the original BACKEND.md) | Status after Milestone 7 |
|---|---|
| No domain event bus | **Closed** for `order.confirmed`/`return.requested`/`return.refunded` — see §3.8 |
| No Notification module | **Closed** — see §3.8 |
| Returns module not implemented | **Closed** — see §3.11 |
| Cart module not implemented | **Closed** — see §3.9 |
| No Wishlist API | **Closed** — see §3.10 |
| No Elasticsearch integration | **Closed in Milestone 8** — see §8. `ProductsService.findAll` is now specifically the documented fallback path, not the primary search |
| No Redis caching layer | Still open |
| Gold-rate-linked pricing | Still open — blocked on PRODUCT.md §11's unresolved data source |
| No CMS module | **Closed in Milestone 10** — see §10.1. Homepage banners only; FR-23's full scope (category landing content, lookbook/editorial) remains open |
| No Analytics module | **Closed in Milestone 10** as a live dashboard summary — see §10.2. No materialized views, no PostHog event forwarding (DATABASE.md §7.3's recommended path is still not built) |
| Auth.js bridging | Still open — backend still issues its own JWT |
| Refund API integration (Stripe) | Still open — `PaymentProviderPort` needs a `refund` method; Returns currently only updates bookkeeping (§3.11) |
| Inventory-triggered search reindex | **New gap surfaced in Milestone 8** — stock changes don't trigger a reindex, so `inStock` in the search index can go stale between content edits (§8.3) |
| No Recommendation/AI module (FR-14/FR-15) | **Closed in Milestone 9** — see §9. Rule-based (co-occurrence + category affinity), not a trained model — see §9.1 for why that's the right scope right now |
| Recommendation co-occurrence backfill is manual | **New gap surfaced in Milestone 9** — `ProductCoOccurrence` only builds going forward from new orders; pre-existing order history needs one manual `POST /admin/recommendations/backfill-co-occurrence` call (§9.5/§9.6) |
| `adminFindAll` (Orders) ignored pagination, no customer info | **Closed in Milestone 10** — see §10.4 |
| No admin product-list endpoint (drafts invisible to admins as a list) | **Closed in Milestone 10** — see §10.4 |
| No bulk import for any admin entity | **Closed in Milestone 10 for Products only** — see §10.3. Single-variant-per-row; no bulk import for coupons, categories, or anything else |

---

## 5. Not Yet Done (Operational) — Updated

- ~~No migration has been run against a real database~~ — **done this
  milestone.** `prisma migrate dev` ran against a local Homebrew PostgreSQL 16
  instance; both the initial schema migration and a hand-authored follow-up
  (CHECK constraints + generated `search_vector` column, per DATABASE.md §8.3)
  applied cleanly. See §6.1.
- ~~No automated or manual verification~~ — **done this milestone**, manually,
  via `curl` against a running server. See §6 for the full list of what was
  exercised.
- **Still no automated test suite.** Everything in §6 was verified by hand
  with `curl`/`psql` this session, not by a repeatable Jest/Playwright suite —
  that gap (named in Milestone 5) is still open. Given how much manual
  exploratory testing it took to find the two real bugs in §6.4, the case for
  writing this suite next is now backed by evidence, not just principle.
- **`packages/types` is still unused.**
- Two payment-related follow-ups newly identified: extending
  `PaymentProviderPort` with a `refund` method (§3.11), and actually testing
  the live Stripe success path with a real test-mode secret key — this
  session only validated the *failure/compensation* path (§6.2), since
  `.env.example`'s placeholder key cannot authenticate with Stripe.

---

## 6. Milestone 7 Validation — What Was Actually Run

### 6.1 Environment
Installed PostgreSQL 16 via Homebrew (none was present), `npm install` in
`apps/api`, `prisma generate` + `prisma migrate dev` against a local `jwel`
database. Two real bugs surfaced and were fixed before the server would even
boot:
1. `previewFeatures = ["fullTextSearchPostgres"]` in `schema.prisma` — not a
   real Prisma preview feature name; corrected to `"fullTextSearch"`.
2. `tsconfig.json` had `strict: true` with no `strictPropertyInitialization:
   false` — every class-validator DTO failed to compile (`TS2564`, property
   has no initializer) because DTOs are populated by `class-transformer` at
   runtime, not a constructor. Added the override.
3. A `Role` enum mismatch: `UserResponseDto`/`AuthUserDto` typed their `role`
   field using a hand-rolled `common/enums/role.enum.ts` enum, but the values
   actually returned came from Prisma's own generated `Role` type — TypeScript
   treats these as incompatible nominal types even though the string values
   match. Fixed by importing `Role` from `@prisma/client` in those two
   response DTOs specifically (the guard/decorator-facing `Role` enum stays
   as-is, since that side of the comparison is against a plain `string`).

### 6.2 Smoke-tested flows (all against the real database)
- Register → login → `GET /me` (confirmed no `passwordHash` in the response)
- Public catalog browse with an empty DB (`{"items":[],"total":0}`, no crash)
- RBAC: admin route correctly returned 401 with no token
- Promoted a user to `ADMIN` directly via SQL, then: created a category
  (no Category endpoint exists — confirmed gap, consistent with FRONTEND.md's
  "Collections aliases Category" note), created a product with a nested
  variant (inventory row auto-created at 0 stock), published it
- Checkout with zero stock → correct `409 Insufficient stock`
- Restocked via `PATCH /admin/inventory/:variantId/adjust` → 10 units
- Checkout with stock available → reached Stripe payment-intent creation,
  failed with `Invalid API Key provided` (expected — `.env.example`'s
  placeholder key), and **the compensation path ran correctly**: order marked
  `CANCELLED`, `quantity_reserved` released back to 0 — confirmed via direct
  SQL query after the failure
- Coupon creation + validation: 10% off ₹2,599.00 → `discountMinorUnits: 25990`
  (exact)
- Review submission with no prior order: `verifiedPurchase: false`,
  `moderationStatus: PENDING` (both correct per the documented policy)

### 6.3 New-module validation (Cart, Wishlist, Returns, Notifications)
- Cart: add item, get cart — variant/product nested correctly
- Wishlist: add item — `shareToken` generated
- Returns full lifecycle, seeded a `DELIVERED` order directly via SQL (since
  a live Stripe key wasn't available to drive a real order to that state):
  `POST /returns` → `409` on a duplicate attempt for the same order item →
  admin `APPROVED` → `REFUND_PROCESSING` → `REFUNDED`, at which point
  inventory was confirmed restocked (10 → 11 on-hand) and the `Payment` row
  flipped to `REFUNDED`
- Confirmed the `return.requested` event reached `NotificationsService` and
  produced the expected skip-log line with no `RESEND_API_KEY` configured

### 6.4 Bugs found and fixed during this validation pass
1. Prisma preview feature typo (§6.1)
2. Missing `strictPropertyInitialization: false` (§6.1)
3. `Role` enum nominal-type mismatch (§6.1)
4. `passwordHash` leak in the new `ReturnsService` (§3.7) — the same bug class
   Milestone 5 had already found once in `UsersService`

None of these four were caught by writing the code carefully the first time;
all four were caught by actually running it. That is the headline result of
this milestone.

---

## 8. Milestone 8 — Search (Elasticsearch)

### 8.1 Why Elasticsearch, and what it replaces
ARCHITECTURE.md/DATABASE.md always specified Elasticsearch as the primary
search path, with Postgres trigram matching as a documented fallback —
`ProductsService.findAll`'s `q` filter (Milestone 5) was always that interim
fallback, never the intended long-term search experience. This milestone
builds the real thing and keeps the fallback as an actual fallback (§8.5),
not a placeholder that gets deleted.

### 8.2 Index design (`modules/search/mappings/products-index.mapping.ts`)
One index, `jwel_products`, one document per Product (not per variant — a
search hit represents "this piece of jewelry," with the variant-level
metal/purity/price spread flattened into arrays and a min/max price range).

- **Autocomplete**: `name` is mapped as `search_as_you_type`, which generates
  `name._2gram`/`name._3gram`/`name._index_prefix` subfields automatically —
  one field gives both prefix-based autocomplete (`bool_prefix` query) and
  strong full-text relevance, with no separate completion-suggester index to
  keep in sync.
- **Typo tolerance**: `fuzziness: AUTO` on the main search query (1-2
  character edit distance depending on term length) plus the n-gram subfields
  already giving partial-match tolerance. Validated directly: `daimond rng`
  (two typos) correctly returned both diamond rings (§8.6).
- **Synonyms**: an inline `synonym_graph` filter (`jewelry_synonyms`),
  grouped by PRODUCT.md's catalog taxonomy plus occasion language buyers
  actually search with — `bridal, wedding, marriage` is the one explicitly
  validated against the milestone's own "bridal necklace" example (§8.6).
  Deliberately **not** applied to the `name` field's autocomplete analysis
  (synonym expansion mid-prefix-query produces confusing partial matches);
  it's applied to `description`/`categoryName` instead, and reached via
  `multi_match` across all three fields at search time.
- **Faceted search**: `terms` aggregations on `metal`/`categorySlug`/
  `certificationType`, plus a `range` aggregation on `priceMinMinorUnits`
  using bands chosen for actual Indian jewelry price spread (sub-₹1,000
  daily-wear through ₹50,000+ bridal sets, per PRODUCT.md's personas).
- **Ranking**: `function_score` — text relevance first, multiplied by a
  log-dampened `ratingCount` popularity signal and a modest 1.15× in-stock
  boost (a perfectly-matching out-of-stock item should still outrank a
  loosely-matching in-stock one, hence a boost weight, not an `inStock`
  filter).

### 8.3 Catalog → Search sync, now actually wired
ARCHITECTURE.md §5.3 always specified `ProductUpserted`/`ProductDeleted`
events syncing Postgres to Elasticsearch. Milestone 7 built the event bus but
had nothing publishing these specific events. This milestone closes that:
`ProductsService.adminCreate/adminUpdate` emit `product.upserted`,
`adminDelete` emits `product.deleted`, and — a connection not in the original
diagram but a real dependency once ranking includes `ratingCount` —
`ReviewsService.adminModerate` also emits `product.upserted` after
recomputing the rating aggregate, since a moderation decision changes a
ranking input. `SearchService` subscribes to both events in `onModuleInit`
and re-fetches current state from Postgres rather than trusting the event
payload, since multiple writers can fire in quick succession.

**Known staleness window, named rather than hidden**: inventory changes
(stock running out, restocking) do **not** trigger a reindex — `inStock` in
the search index is only as fresh as the last product-content edit or rating
change. The admin `POST /admin/search/reindex` endpoint is the manual
correction path until/unless Inventory-triggered reindex events are added.

### 8.4 Resilience: Elasticsearch is allowed to be down
`SearchService.onModuleInit` catches index-creation failures and logs a
warning instead of crashing the app at boot. `SearchController.search`
catches any Elasticsearch error and falls back to
`ProductsService.findAll` (the Postgres path) — **with no facets**, since
Postgres aggregation for facets isn't implemented; that's a real capability
loss in degraded mode, not a transparent equivalent, and is logged as an
error (not a warning) specifically so it's visible in ops. `autocomplete`
degrades to an empty array rather than an error, since a missing typeahead
is a much smaller UX hit than a broken search box. **Both fallback paths were
directly observed working** by killing the local Elasticsearch process mid-
session and re-running the same queries (§8.6).

### 8.5 What's NOT done
- Inventory-triggered reindexing (§8.3) — `inStock` can go stale between
  content edits.
- No synonym tuning from real query logs — the synonym set is a reasonable
  starting taxonomy, not validated against actual user search behavior yet
  (there is no real user traffic yet to validate against).
- No index aliasing / zero-downtime reindex strategy (`reindexAll` writes
  directly to the live `jwel_products` index) — fine at this data volume,
  would need a `jwel_products_v2` + alias swap pattern before this could
  reindex without a brief inconsistency window at production scale.
- Postgres fallback has no facets (§8.4) — a real, accepted gap, not an
  oversight.
- No relevance tuning dashboard/A-B testing — ranking weights
  (`field_value_factor` factor, in-stock boost weight) are reasoned defaults,
  not tuned against click-through data, because none exists yet.

### 8.6 Milestone 8 Validation — What Was Actually Run
Installing Elasticsearch itself surfaced two real environment bugs before any
application code ran:
1. **Disk filled to zero mid-install** on the first attempt (`elasticsearch-
   full`'s bundled JVM is a multi-hundred-MB download) — every tool call
   failed with `ENOSPC` until `brew cleanup -s` freed space. Resolved with
   the user's explicit direction rather than autonomous cleanup, since
   freeing disk space can mean deleting things outside this project's
   control.
2. **Elasticsearch's bundled JDK was missing/broken** after the (now disk-
   safe) reinstall — worked around by pointing `ES_JAVA_HOME` at an existing
   system JDK 17 rather than re-downloading.
3. **X-Pack ML's native code isn't compatible in this environment** —
   `xpack.ml.enabled: false` (this catalog has no use for ML anomaly
   detection regardless).
4. **Disk watermark protection** would have marked the index read-only at
   ~95% disk usage, which this constrained dev machine was close to —
   `cluster.routing.allocation.disk.threshold_enabled: false`, explicitly
   commented in `elasticsearch.yml` as a dev-only setting, never production
   guidance.

Two real **application** bugs were found compiling against the actual
`@elastic/elasticsearch` v7 client types (not just Elasticsearch's own
behavior): `SearchService.toDocument` was typed to possibly return `null`
(to guard a case its only caller already excluded), which broke both
`client.index()`'s and `client.bulk()`'s type inference — fixed by narrowing
the parameter type with `NonNullable<...>` instead of defending against a
case that couldn't occur.

Once the stack was actually up (PostgreSQL + Elasticsearch + NestJS, all
local), seeded a small but deliberately varied catalog (2 diamond rings, 2
gold chains/necklaces, 1 bridal-named necklace, 1 silver "wedding pearl"
necklace) and validated directly against the milestone's own examples:

| Query | Result |
|---|---|
| `diamond ring` | Both diamond rings, correctly ranked, facets populated |
| `gold chain` | Both gold chains top-ranked; broader recall (bridal necklace, an old earring product) also matched via the `necklace ↔ chain` synonym + cross-field text relevance — correct top results, a real recall/precision tradeoff worth tuning later (§8.5) |
| `bridal necklace` | "Bridal Statement Necklace" top result |
| `wedding necklace` (synonym check) | Same top result as `bridal necklace` — confirms the `bridal, wedding, marriage` synonym set is actually doing something, not just declared |
| `daimond rng` (2 typos) | Both diamond rings — typo tolerance confirmed |
| Autocomplete `gold ch` | Both gold chains, prefix-matched mid-word |
| Autocomplete `sol` | "Solitaire Diamond Ring" |
| `category=necklaces` facet filter | Correct 3-item result restricted to that category |
| **Elasticsearch killed mid-session** | `/search` correctly fell back to Postgres (200, results, no facets); `/autocomplete` correctly returned `[]` (200, not an error) — both behaviors logged loudly as designed |

---

## 9. Milestone 9 — Recommendation Engine

### 9.1 Scope and why this is rule-based, not a trained model
FR-14 (Personalized Collections) and FR-15 (AI Product Recommendation —
"Recommended for you" / "Frequently bought together" / "Similar items")
called for a Recommendation/AI module from the start (ARCHITECTURE.md §3,
§5.4). This milestone builds the four surfaces the brief actually asked for —
**Frequently Bought Together**, **Recently Viewed**, **Trending Products**,
**Personalized Suggestions** — as statistical/rule-based logic over real
purchase and view data, not a trained collaborative-filtering or embedding
model. That's a deliberate scope call, not a shortcut: there's no training
pipeline, no labeled data, and — at this catalog/order volume — not enough
purchase history for a learned model to outperform straightforward
co-occurrence counting and category affinity. ARCHITECTURE.md's own note that
"Recommendation/AI module is the most likely first candidate to split out...
if inference load grows disproportionately" already assumes this starts
simple and grows into something heavier later.

### 9.2 Data model (`modules/recommendations`)
Two new tables, plus reuse of existing `Order`/`OrderItem`/`Product` data —
no separate "recommendation database," Postgres stays the single source of
truth (DATABASE.md §1):

- **`ProductView`** — an append-only event log (not a dedup'd "last viewed"
  row), since Recently Viewed needs the full recency history to de-duplicate
  in the application layer. `userId` for logged-in views, `anonymousId` (a
  client-generated id persisted in `localStorage`, never a real identity) for
  guests — exactly one is expected non-null, enforced in the service layer
  since Prisma can't express a portable XOR constraint here.
- **`ProductCoOccurrence`** — the one precomputed piece of the engine.
  Incrementally maintained on every `order.confirmed` event (re-fetching the
  order's items from Postgres by id, the same re-fetch-don't-trust-payload
  pattern `SearchService` uses) rather than computed live, since a live
  "scan every order this product ever appeared in" query gets expensive as
  order volume grows. `productAId` is always the lexicographically smaller
  id of the pair, so each unordered product pair has exactly one row.
- **Trending** and **Personalized** are computed on read (with a short
  in-memory TTL cache on Trending — see §9.5) directly from `OrderItem`/
  `Order`/`Product` — no new table needed.

### 9.3 Per-surface logic
| Surface | Logic | Cold-start fallback |
|---|---|---|
| Frequently Bought Together | `ProductCoOccurrence` rows involving this product, ranked by count | Same-category bestsellers (by `ratingCount`) fill any remaining slots |
| Recently Viewed | Most-recent `ProductView` rows for this identity, de-duplicated by product in the application layer (overfetch + collapse, not a DB-level `DISTINCT ON`, since that would group by recency-of-first-seen rather than true overall recency order) | Empty list if there's no identity (no JWT, no `anonymousId`) at all — not an error |
| Trending | `OrderItem` quantities summed over a 14-day window (excluding `CANCELLED` orders), ranked, mapped variant→product | All-time bestsellers by `ratingCount` if the window has zero recent orders |
| Personalized | Blends `ProductCoOccurrence` expansion from the user's own purchases (excluding anything already bought) with same-category candidates (a smaller, deliberately discounted score — a co-purchase signal from *this specific user's* history should outrank a generic category match) | New users with zero order history get Trending outright; users with some history but too few candidates get Trending used to top up the remainder |

### 9.4 Identity handling — `OptionalJwtAuthGuard`
Recording a view and reading Recently Viewed both need to work for guests
*and* logged-in users on the same endpoint, without ever trusting a
client-supplied `userId` (that would let anyone read or pollute another
user's history by guessing/spoofing an id). The existing `JwtAuthGuard`
couldn't do this — under `@Public()` it skips Passport entirely, so
`req.user` is never populated even with a valid token. Added
`common/guards/optional-jwt-auth.guard.ts`: an `AuthGuard('jwt')` subclass
that overrides `handleRequest` to return `null` instead of throwing on a
missing/invalid token, applied alongside `@Public()`. A valid token
populates `req.user` (and the identity always resolves to that `userId`,
ignoring any `anonymousId` the client also sent); no/invalid token falls
through to the client-supplied `anonymousId`.

### 9.5 What's NOT done
- **Not a trained model** (§9.1) — no embeddings, no matrix factorization, no
  click-through-rate optimization. Re-evaluate once there's enough order
  volume and a reason to believe a learned model would outperform this.
- **Trending's in-memory cache doesn't survive a restart and isn't shared
  across instances** — the same documented gap as Search's lack of a Redis
  layer (BACKEND.md's gap table); fine for a single API instance.
- **No backfill triggered automatically** — `ProductCoOccurrence` only
  builds going forward from `order.confirmed` events. Orders placed before
  this feature existed (or after a fresh seed/restore) contribute nothing
  until `POST /admin/recommendations/backfill-co-occurrence` is run once;
  this was discovered, not assumed, during validation (§9.6) and is why that
  endpoint exists at all rather than being deferred as a "nice to have."
- **"Similar items"** (named in FR-15 alongside FBT and "recommended for
  you") isn't a separate surface — Frequently Bought Together and category
  affinity inside Personalized cover the same need at this scope; a true
  content-similarity surface (by metal/price/style) is future work.
- **No view-spam protection** — a script hitting `POST /products/:id/views`
  repeatedly inflates Recently Viewed and (indirectly) any future
  view-based trending signal. Not exploited by anything today (Trending
  reads from purchases, not views) but worth rate-limiting before this
  becomes a load-bearing signal.

### 9.6 Milestone 9 Validation — What Was Actually Run
Two real bugs surfaced before any of the logic itself was tested:
1. **A pre-existing Prisma migration-generator bug, not something this
   milestone introduced**: running `prisma migrate dev` for the new tables
   made Prisma's diff engine emit a spurious `DROP COLUMN "searchVector" /
   ALTER COLUMN "search_vector" DROP DEFAULT` against the hand-authored
   generated `tsvector` column from DATABASE.md §8.3 — Prisma's
   `Unsupported(...)` type doesn't round-trip cleanly through its diff logic.
   The migration failed entirely (Postgres DDL is transactional, so nothing
   was half-applied); fixed by stripping the bad statement from the
   generated SQL file and resolving it as rolled-back before reapplying.
   `search_vector` was confirmed still a generated column with its GIN index
   intact afterward.
2. **`OptionalJwtAuthGuard.handleRequest`'s override signature didn't satisfy
   `IAuthGuard`'s generic** — TypeScript caught a real type mismatch
   (`{} | null` not assignable to an arbitrary `TUser`) before this ever ran;
   fixed by typing the override against `AuthenticatedUser | null`
   explicitly rather than loosening the type to make the error go away.

Once compiling and booted, validated against the **real local order data**
already in the database (Milestone 7's seed users), which immediately
surfaced the backfill gap named in §9.5: the three pre-existing `DELIVERED`
orders for the test user were each single-item, so no co-occurrence pair
could exist from them regardless of backfill — a real data-shape finding,
not a bug. A genuine two-item order was added (bypassing the Stripe webhook
path, which 500s in this environment on the long-documented placeholder
`STRIPE_SECRET_KEY` — a pre-existing gap, not new) to produce one real
co-occurrence pair, then re-validated:

| Check | Result |
|---|---|
| FBT for Diamond Halo Ring | "Gold Curb Chain" ranked first (real co-occurrence), category bestsellers filling remaining slots |
| FBT for Gold Curb Chain (reverse direction) | "Diamond Halo Ring" ranked first — confirms the unordered-pair lookup works from either side |
| Personalized, user with purchase history | Co-occurrence candidates correctly excluded both ends of the pair the user had already bought (correctly fell through to `category_affinity`, not an empty list) |
| Personalized, brand-new user | Cold-started to Trending, `reason: "trending"` on every item |
| Trending, no recent orders in window | Correctly fell back to all-time bestsellers rather than an empty list |
| Recently Viewed, guest (`anonymousId`) | Two recorded views returned most-recent-first |
| Recently Viewed, logged-in (JWT) | View recorded and returned without any client-supplied id |
| Recently Viewed, no identity at all | `200` with `[]`, not an error |
| `POST .../backfill-co-occurrence` | Rebuilt the table from full order history; re-runnable safely (wipes and recomputes) |

---

## 10. Milestone 10 — Admin Portal Backend

Most of what the Admin Portal needs already existed (Products/Inventory/
Orders/Coupons/Reviews admin CRUD have been there since Milestone 5, RBAC via
`@Roles` + `RolesGuard` since Milestone 5). This milestone's real backend
work was two new modules plus fixing two endpoints that turned out not to be
fit for an actual admin UI to consume — found by building the UI against
them, not by inspection.

### 10.1 CMS module (`modules/cms`) — minimal, named scope
PRODUCT.md §11 explicitly deferred FR-23 CMS out of MVP scope ("admin can
ship banner/content changes via deploys until then"). This milestone's brief
asks for a CMS module regardless, so it implements the smallest real slice —
a `Banner` model (title, image ref, optional link, sort order, active flag,
optional scheduling window) with public `GET /cms/banners` (only active banners
inside their scheduling window) and full admin CRUD. Category landing
content and lookbook/editorial pages — the rest of FR-23 — remain
unimplemented; this is a deliberate scope cut, not a partial attempt at the
whole thing.

### 10.2 Analytics module (`modules/analytics`) — computed live, same pattern as Search/Recommendations
`AnalyticsService.getDashboardSummary` computes everything live against
Postgres on every request: revenue, order count, AOV, and an orders-by-status
breakdown over a configurable window; top products by revenue (fetched and
aggregated in application code, the same pattern `RecommendationsService`
uses for Trending, since Prisma's `groupBy` can't express `quantity ×
unitPrice` as a single aggregated sum); low-stock count (reusing
`InventoryService.listLowStock` rather than duplicating that query); pending
review count; new-customer count. DATABASE.md §7.3 already names
`mv_daily_sales`/`mv_product_performance` materialized views as the
recommended, not-yet-created path for sub-100ms dashboard reads at real
scale — this is the same documented interim every other on-read surface in
this codebase already uses, not a new gap.

### 10.3 Bulk Import (on `modules/products`, not a new module)
`POST /admin/products/bulk-import` accepts a CSV (multipart) where **one row
= one product with exactly one variant** — matching `CreateProductDto`'s
shape exactly, so importing the same product in multiple sizes/metals isn't
supported in this version (each variant needs its own row with a distinct
slug; a real limitation, named rather than worked around). Reuses
`ProductsService.adminCreate` per row rather than a separate bulk-insert
path, so validation, slug uniqueness, and the `product.upserted` event all
stay exactly consistent with a single manual creation — imported products
land as `DRAFT`, same as any other creation, confirmed directly in testing
(not assumed). Per-row failures don't abort the batch; the response reports
`{totalRows, succeeded, failed, errors: [{row, message}]}` so a CSV with 50
good rows and 2 bad ones still imports the 48 good ones. CSV parsing is a
small hand-rolled parser (handles quoted fields with embedded commas, not a
general-purpose library) — adding a dependency for this felt like the wrong
tradeoff for an admin-authored catalog CSV, not an arbitrary user upload.

### 10.4 Two endpoints fixed because the Admin Portal UI couldn't use them as they were
- **`OrdersService.adminFindAll`** accepted `page`/`pageSize` query params
  but silently ignored them, returning every order as a bare array with no
  customer info — every other admin list endpoint (Users, Coupons, Reviews)
  returns a real `{items, page, pageSize, total}` envelope; this one didn't,
  and had no way to show who placed an order. An Orders admin page is
  useless without knowing the customer, so this was fixed to actually
  paginate and include `user: {id, email, name}` — found immediately when
  building the Orders page against it, not by re-reading the code.
- **No `GET /admin/products` list endpoint existed at all** — only
  `GET /admin/products/:id` (single product by id). The public `GET
  /products` is PUBLISHED-only by design (it's the storefront's catalog
  browse path), so there was genuinely no way for an admin to see a list of
  drafts. Added `ProductsService.adminFindAll`/`ProductsController
  .adminFindAll` — paginated, includes all statuses except soft-deleted.

### 10.5 RBAC — applied, not redesigned
Every new admin endpoint in this milestone uses the exact same `@Roles(Role
.ADMIN, Role.STAFF)` / `@Roles(Role.ADMIN)` pattern that's existed since
Milestone 5 — there was no need for a new permission system, and building
one with only 3 roles and no demonstrated need for finer-grained permissions
would have been speculative complexity. The "enterprise" RBAC ask in this
milestone's brief is satisfied by *consistent application* of what already
existed across every new surface (CMS, Analytics, bulk import, the two fixed
list endpoints), not a new abstraction.

### 10.6 Milestone 10 Validation — What Was Actually Run
Hit the same pre-existing Prisma migration-generator bug against the
hand-authored `search_vector` generated column as Milestones 8 and 9 (see
§9.6) — by now a recognized, quickly-fixed pattern (strip the spurious
`DROP COLUMN`/`ALTER COLUMN` statement from the generated migration SQL,
verify `search_vector`'s GIN index survives, reapply) rather than a fresh
investigation each time.

Validated directly against the real running stack:

| Check | Result |
|---|---|
| `GET /admin/analytics/dashboard?windowDays=365` | Real numbers from actual seed/test order data — revenue, AOV, orders-by-status, top 3 products by revenue, low-stock count, pending review count, new customers in window |
| `POST /admin/cms/banners` → `GET /cms/banners` | Created banner immediately visible on the public active-banners endpoint |
| `POST /admin/products/bulk-import` with a 3-row CSV (1 valid, 1 bad category, 1 bad metal) | `{totalRows: 3, succeeded: 1, failed: 2}` with row-numbered error messages; the imported row confirmed `DRAFT` status in Postgres directly, not published |
| CSV parser with a quoted, comma-containing description field | Parsed correctly, not split on the embedded comma |
| `GET /admin/orders` (post-fix) | Returns a real paginated envelope with `user.email` populated, confirmed against real order data |
| `GET /admin/products` (new) | Returns drafts and published products together — confirmed a `DRAFT` product from the bulk-import test appears alongside `PUBLISHED` ones |

---

## 11. How to Run

```bash
# Postgres (if not already running)
brew install postgresql@16 && brew services start postgresql@16
createdb jwel

# Elasticsearch (if not already running) — see §8.6 for the environment
# fixes this needed on this machine (Java, X-Pack ML, disk watermark)
brew install elastic/tap/elasticsearch-full
ES_JAVA_HOME=$(/usr/libexec/java_home -v 17) /opt/homebrew/opt/elasticsearch-full/bin/elasticsearch &

cd apps/api
cp .env.example .env        # set DATABASE_URL to your local Postgres; STRIPE_SECRET_KEY
                              # can stay a placeholder unless you need a real checkout success
npm install
npx prisma generate --schema=src/prisma/schema.prisma
npx prisma migrate deploy --schema=src/prisma/schema.prisma
npx nest start                # Swagger UI at http://localhost:4000/docs
# then, as an ADMIN:
#   POST /api/v1/admin/search/reindex                      — populate the search index
#   POST /api/v1/admin/recommendations/backfill-co-occurrence — populate Frequently Bought Together
#     from existing multi-item order history (see §9.5/§9.6 — this does nothing
#     useful until there's at least one order with 2+ distinct products in it)
```
