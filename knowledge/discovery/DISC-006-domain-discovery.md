---
id: DISC-006
title: Discovery — Domain Discovery
version: 1.0.0
status: Frozen
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-06
updated: 2026-08-06
milestone: M1
category: Discovery
priority: Critical
depends_on:
  - DISC-002
  - DISC-005
required_by:
  - DISC-007
related_domains:
  - DOM-NOTIFICATION
  - DOM-RISK
  - DOM-SHIPPING
related_decisions:
  - ADR-0006
  - ADR-0007
  - ADR-0008
  - ADR-0009
tags:
  - discovery
  - investigation
  - domain-discovery
risk: Medium
complexity: High
---

# DISC-006 — Discovery: Domain Discovery

Investigation 6 of 10, per `OV-001`. Evidence and claim ids refer to
`knowledge/discovery/evidence/README.md`.

**Priority is Critical**: `PRM-ARCHITECTURE` (M3) consumes this directly, and
`PRM-DOMAIN` (M5) runs once per bounded context declared here.

At intake this was the weakest area — KC-022 inferred contexts from NestJS
module *names* at 70% confidence. This investigation replaces that guess by
measuring coupling three independent ways: compile-time imports, runtime
events, and table access (`EVD-021`).

## Observed Facts

### Method

Three signals, because any one alone misleads. Module names suggest boundaries
that imports may contradict; imports miss runtime coupling through the event
bus; and both miss a module reaching directly into another's tables — which is
the coupling that actually breaks a boundary.

### Signal 1 — compile-time imports (KC-149)

A shallow graph. Ten of 22 modules import nothing from a sibling.

| Module | Imports |
| --- | --- |
| **orders** | audit-log, coupons, inventory, payments |
| **returns** | audit-log, inventory, payments |
| analytics | inventory |
| search | products |
| auth, payments | metrics |
| cms, collections, products, uploads | storage |
| inventory, users | audit-log |

**Orders is the hub.** Nothing imports orders.

### Signal 2 — the event map (KC-150)

Complete producer/consumer pairs, satisfying `OV-001`'s mandatory
domain-events check with measured wiring rather than a declared list:

| Event | Published by | Consumed by |
| --- | --- | --- |
| `payment.succeeded` | payments | **orders** |
| `order.confirmed` | orders | notifications, recommendations |
| `return.requested` | returns | notifications |
| `return.refunded` | returns | notifications |
| `product.upserted` | products, **reviews** | search |
| `product.deleted` | products | search |

The central chain is:
`payments → payment.succeeded → orders.confirmPayment → order.confirmed →
{notifications, recommendations}`.

### Signal 3 — table access (KC-153)

Seventeen modules touch Prisma. Eight own exactly one aggregate cleanly:
`audit-log`, `cms`, `inventory`, `payments`, `wishlist`, `auth`, `users`, and
`search` (read-only on product, for indexing).

The rest read across boundaries:

| Module | Tables touched | Crosses into |
| --- | --- | --- |
| **recommendations** | order, orderItem, product, productVariant, productView, productCoOccurrence | Ordering + Catalog |
| **reviews** | review, orderItem, **product (write)** | Ordering + Catalog |
| analytics | order, orderItem, review, user | everything (read-only) |
| orders | order, orderStatusHistory, productVariant | Catalog |
| coupons | coupon, couponRedemption, **order** | Ordering |
| returns | returnRequest, orderItem | Ordering |
| cart | cart, cartItem, productVariant | Catalog |

### The derived context map

| Context | Modules | Owns | Boundary quality |
| --- | --- | --- | --- |
| **Identity & Access** | auth, users | User, OAuthAccount, Address, Role | Clean |
| **Catalog** | products, collections, uploads | Product, Variant, Media, Category, Collection | Clean internally |
| **Search** | search | index only; reads Product | Clean, read-only |
| **Shopping** | cart, wishlist | Cart, CartItem, Wishlist, WishlistItem | Clean; reads Variant |
| **Pricing & Promotion** | coupons | Coupon, CouponRedemption | Reads Order (KC-157) |
| **Ordering** | orders | Order, OrderItem, OrderStatusHistory | Hub; 4 imports |
| **Payments** | payments | Payment | Clean; ports/adapters |
| **Inventory** | inventory | Inventory | Clean |
| **Returns** | returns | ReturnRequest, ReturnStatusHistory | Reads OrderItem |
| **Reviews** | reviews | Review | **Writes Product** |
| **Recommendation** | recommendations | ProductView, ProductCoOccurrence | Widest reach |
| **Content** | cms | Banner | Clean |
| **Notification** | notifications | none — pure consumer | Clean |
| **Reporting** | analytics | none — reads across all | Read-only by design |

**Not domains** (KC-156): `audit-log`, `metrics`, `storage` are shared
infrastructure imported by many modules and owning no business concept;
`health` is an operational probe.

**Ports and adapters exist in exactly two modules** — `payments` and `storage`
(KC-155), each with `ports/` and `providers/`. These are precisely the two
boundaries where an external vendor sits.

## Interpretation

**The module structure is a genuine context map, not just a folder layout.**
KC-022's 70%-confidence guess from module names turns out to have been broadly
right, which is not guaranteed — the three signals mostly agree, and where they
disagree the disagreement is informative.

**Orders is the aggregate root of the transactional core, and it is correctly
shaped.** It imports four modules and nothing imports it. A hub that depends
downward and is depended on by nobody is the right shape for an orchestrator:
it composes inventory reservation, coupon redemption and payment initiation
into one transaction, and it is free to change without cascading.

**Orders ↔ Payments is the best-designed seam in the system** (KC-151). Orders
imports `PaymentsService` synchronously to *initiate* payment; Payments returns
control asynchronously by emitting `payment.succeeded`, which Orders consumes to
confirm. Command in, event out. The bidirectional business relationship exists
without a compile-time cycle, and either side can be tested alone. This is the
pattern the rest of the system should be measured against.

**Notifications is a textbook consumer context.** No controller, no tables, no
outbound dependency — three subscriptions and an email adapter. It cannot
corrupt anything upstream and can be removed without touching a caller.

**The one real boundary breach is Reviews → Product** (KC-152).
`reviews.service.ts` issues `prisma.product.update` to maintain `avgRating` and
`ratingCount`, then emits `product.upserted` so Search reindexes. Two
violations in one path: a cross-context **write**, and a module publishing
*another context's* event.

This matters beyond tidiness. It is the structural cause of `DISC-005`'s
KC-142 fragility: the `avgRating` column is owned by Catalog but its *value* is
owned by Reviews, so no single context can guarantee its correctness. And the
event name is misleading — nothing was upserted on the product; a review
changed a derived column. A future maintainer reading `product.upserted` in
`reviews.service.ts` has to reconstruct why.

The honest counter-argument: it works, it is one line, and the alternative
(Reviews emits `review.approved`; Catalog owns the recomputation; Search reacts
to Catalog) is three moving parts instead of one. That is a real trade-off, not
an obvious win — worth recording rather than reflexively "fixing".

**Recommendations is the widest-reaching context** (KC-154) — six models across
three contexts. That is inherent to what it does: co-occurrence is computed
from order history, and personalisation from view history joined to catalog. It
is read-mostly, and its one write target (`ProductCoOccurrence`) is its own. So
breadth here is a property of the domain rather than a design failure — but it
does mean Recommendations is the context most exposed to schema change
elsewhere.

**Analytics reads everything, which is correct.** A reporting context that
queries across boundaries is doing its job; the schema even names a read-replica
as its target. It writes nothing.

**Coupons reading Order is a genuine but minor smell** (KC-157). Counting a
user's prior orders to enforce `FIRST_ORDER` eligibility is Ordering knowledge
living in Pricing. Small, and the alternative — Ordering exposing an
"is-first-order" query — is arguably worse coupling in a different direction.

**Three documented domains do not correspond to implemented contexts.**
`DOM-SHIPPING`, `DOM-RISK` and `DOM-NOTIFICATION` are the only `DOM-` specs
that exist. Of these, only Notification is implemented; Shipping and Risk have
no code (KC-095, KC-096), and Risk is now closed as not-required (KC-110).
Meanwhile eleven implemented contexts have **no** `DOM-` specification at all.
The documented domain set is almost the inverse of the real one.

## Hidden Assumptions

- **Table access is measured from `*.service.ts` only.** Prisma calls in
  controllers, guards or helper files would be missed. The service layer is
  where this codebase puts data access, but it was not verified exhaustively.
- **Static analysis cannot see conditional coupling.** A module reached only at
  runtime through dependency injection of an interface would not appear in the
  import graph.
- **Context names are mine.** The codebase names modules, not contexts. The
  fourteen contexts above are a reading of module clustering, not labels anyone
  declared. `PRM-ARCHITECTURE` may reasonably draw different lines.
- **"Nothing imports orders" is treated as evidence of good shape**, but it may
  simply mean nothing needs to yet — shipping, the largest missing capability,
  would very likely import it.
- **The event map is complete as of this reading.** A subscription registered
  outside a service constructor would be missed.

## Strengths

- **Module boundaries are real boundaries.** Ten of 22 modules have no sibling
  imports at all, and eight own exactly one aggregate cleanly.
- **The Orders ↔ Payments seam** (KC-151) — synchronous command, asynchronous
  event — is a pattern worth codifying as a Standard.
- **The event bus carries real integration**, six events with measured
  producers and consumers, confirmed working against live traffic (KC-066).
- **Ports and adapters sit exactly where vendors are** (KC-155) — payments and
  storage, and nowhere else. NFR-9 implemented precisely, without
  over-abstraction elsewhere.
- **Notifications and Analytics are exemplary edge contexts** — one pure
  consumer, one pure reader, neither able to corrupt upstream state.
- **Infrastructure is separated from domain** (KC-156): audit-log, metrics and
  storage are shared services, not pretend domains.

## Weaknesses

- **Reviews writes Product and emits Catalog's event** (KC-152) — the only
  cross-context write in the system, and the structural cause of KC-142.
- **The `avgRating` aggregate has no single owner**, which is why it can
  desynchronise silently.
- **`product.upserted` is emitted for something that is not an upsert**,
  making the event name unreliable as documentation.
- **Coupons depends on Ordering's table** (KC-157) for first-order eligibility.
- **Eleven implemented contexts have no `DOM-` specification**, while two of the
  three that exist describe unimplemented capabilities.
- **Recommendations is maximally exposed to schema drift** elsewhere (KC-154) —
  inherent, but worth knowing before someone changes `OrderItem`.

## Questions

1. ~~Should Reviews stop writing Product directly?~~ → **RESOLVED** (KC-158),
   recorded as **`ADR-0008`**. Ownership moves to Catalog via a synchronous
   command; Catalog performs the write and emits its own event. Kept
   synchronous deliberately — an eventually-consistent rating would be a
   visible regression on a value read on every PDP and PLP.
2. ~~Which contexts get `DOM-` specs, and in what order?~~ → **RESOLVED**
   (KC-160, KC-161), recorded as **`ADR-0009`**. Specs follow work, not
   discovery: Shopping and Returns now, twelve contexts deferred.
3. ~~Should the Orders ↔ Payments pattern become a Standard?~~ → **RESOLVED**:
   generalised as `ADR-0008`'s rule — command in, event out — rather than
   waiting for M5.
4. ~~Should `DOM-SHIPPING` and `DOM-RISK` be annotated?~~ → **RESOLVED**
   (KC-162): both annotated in place, bodies unrewritten per `ADR-0007`.

**Still open:**

5. Is coupon first-order eligibility better served by an Ordering-exposed
   query? → `technical-architecture`. Left open deliberately — the alternative
   (Ordering exposing an is-first-order query) is arguably worse coupling in a
   different direction, and nothing currently depends on resolving it.

## Recommendations

- **Keep** — the module-per-context structure. It survived measurement, which
  is the strongest thing this investigation can say about it.
- **Keep** — the Orders ↔ Payments seam, and treat it as the reference pattern
  for any future cross-context interaction.
- **Keep** — ports and adapters confined to payments and storage. Resisting the
  urge to abstract everywhere is why this codebase is legible.
- **Keep** — Notifications as a pure consumer and Analytics as a pure reader.
- **Keep** — `product.upserted` as an event name. Once Catalog owns the
  emission (`ADR-0008`) the name is accurate; it was only misleading because
  the wrong module emitted it. No rename needed.
- **Improve** — implement `ADR-0008`: move rating recomputation into Catalog
  and make it idempotent and bulk-runnable. The bulk-reconciliation half
  matters more than the ownership half, because it is what survives a seed
  script or CSV import bypassing the service entirely.
- **Improve** — author `DOM-SHOPPING` and `DOM-RETURNS` per `ADR-0009` before
  the cart migration and returns UI are built.
- **Remove** — nothing structural.

## Architecture Review

- **Does it hold up?** Yes. Structural claims are measured three independent
  ways and mostly agree; where they disagree — Reviews writing Product — the
  disagreement was the finding.
- **Does it contradict another investigation?** No. It **explains**
  `DISC-005`'s KC-142: split ownership of `avgRating` is why the value can
  desync, so one root cause produced findings in two investigations.
- **Decisions taken.** `ADR-0008` (command in, event out) and `ADR-0009`
  (domain specs follow work) were both authored from this investigation's
  questions rather than deferred to M3, because implementation work reaches
  both areas first.
- **Scope discipline.** This investigation maps contexts and records decisions.
  It does not implement the Reviews refactor or author the two `DOM-` specs.

**Frozen 2026-08-06** by owner sign-off. Revision requires the full
Discussion → Review cycle (KC-054).

### Handed to M3 Architecture

The context map above is this investigation's primary deliverable and should be
`PRM-ARCHITECTURE`'s starting point — with three caveats it must not lose:

1. **KC-088's boundary belongs on the map as an explicit exclusion.** Supplier
   relationships, inter-party settlement and multi-vendor fulfilment lie
   outside *every* context, deliberately.
2. **Shipping has no context yet**, and when it arrives it will very likely be
   the first module to import Orders — changing the hub's "nothing depends on
   me" property.
3. **The Reviews → Catalog write is a known, recorded breach**, not an
   oversight to be re-discovered.

## Confidence Level

**High (90%).**

Every structural claim is measured rather than inferred, and the three signals
were chosen to cross-check each other — a boundary that survives imports,
events and table access simultaneously is well evidenced. KC-149–155 are all
direct observation at 95–100%.

The cap comes from two places. The **context names and groupings are mine**
(a reading of module clustering, not a declared taxonomy), so a reasonable
architect could draw different lines — the *couplings* are facts, the *contexts*
are interpretation. And table access was measured from `*.service.ts` only,
so a Prisma call elsewhere would be missed.

Per `OV-001` the investigation cannot exceed its weakest load-bearing claim,
and "these fourteen groupings are the right contexts" is inference-tier by
nature. It is the kind of claim M3 confirms by using it, not one more reading
would settle.

### Cross-cutting extraction check

- **Domain/integration events — found and mapped.** `OV-001` requires this
  investigation specifically to check for producer/consumer pairs. Six events,
  five publishers, four consumers, fully enumerated in KC-150. The check that
  three dry runs of the protocol previously missed is satisfied with measured
  wiring rather than a declared list.
- **Non-functional requirements** — owned by `business-vision` (done) and
  `technical-architecture` (pending). One contribution forwarded: KC-155's
  ports-and-adapters placement is NFR-9's no-vendor-lock-in requirement,
  implemented at exactly the two boundaries where it applies.
