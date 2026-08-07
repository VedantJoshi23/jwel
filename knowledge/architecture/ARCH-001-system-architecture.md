---
id: ARCH-001
title: Jwel / ELYSIAN — System Architecture
version: 0.1.0
status: Review
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-07
milestone: M3
category: Architecture
priority: Critical
depends_on:
  - CONSTITUTION
  - DISC-005
  - DISC-006
  - DISC-007
required_by: []
related_documents:
  - DISC-002
  - DISC-008
related_decisions:
  - ADR-0006
  - ADR-0008
  - ADR-0010
tags:
  - architecture
  - bounded-contexts
risk: Medium
complexity: High
---

# ARCH-001 — System Architecture

Authored under `PRM-ARCHITECTURE` / `OV-003`, against a **Frozen Constitution**
(Architecture Ambition: Modular Monolith).

Per `OV-003`, every section states its **source**: `Adopted` (Discovery matches
the Constitution, carried forward), `Adapted` (Discovery revised to satisfy the
Constitution), or `Designed` (no Discovery findings, designed fresh).

**This document describes responsibility and ownership, not technology.** Which
framework or datastore implements a boundary is `OV-004`'s subject.

## Source summary

| § | Section | Source | Basis |
| --- | --- | --- | --- |
| 1 | Service Boundaries | **Adopted** | `DISC-006` (KC-149–157), measured three ways |
| 2 | Domain Model | **Adopted** | `DISC-005` (KC-131–145) |
| 3 | Event Flow | **Adopted** | `DISC-006` KC-150, measured producer/consumer pairs |
| 4 | Folder Structure | **Adopted** | `DISC-001` KC-018, KC-064 |
| 5 | Scalability Strategy | **Adapted** | `DISC-007` findings, revised by `ADR-0010` |

Four of five sections are Adopted, which is the expected outcome when
Discovery's findings already match the Constitution's ambition — this document
largely formalises what was measured rather than proposing something new. §5 is
Adapted because `PRODUCT.md`'s NFR-2 and NFR-3 conflicted with reality and were
restated by `ADR-0010`.

---

## 1. Service Boundaries

**Source: Adopted** — `DISC-006` derived fourteen contexts by measuring
compile-time imports, runtime events and table access independently (KC-149,
KC-150, KC-153). The groupings survived all three signals.

Constitution Law 5 governs interaction between every boundary below: **command
in, event out.** No context writes another's tables or emits another's events.

### 1.1 Contexts

| Context | Owns | Does NOT own |
| --- | --- | --- |
| **Identity & Access** | User, OAuthAccount, Address, Role assignment, authentication, session issuance | Order history semantics; anything about what a user bought |
| **Catalog** | Product, ProductVariant, ProductMedia, Category, Collection, publication state, **rating aggregates** | Review content; search indexing; stock levels |
| **Search** | The search index and query semantics | Product truth — it reads Catalog and owns no product state |
| **Shopping** | Cart, CartItem, Wishlist, WishlistItem, share tokens | Prices (reads Catalog); stock (reads Inventory); orders |
| **Pricing & Promotion** | Coupon, CouponRedemption, discount calculation, eligibility rules | Order totals; payment amounts |
| **Ordering** | Order, OrderItem, OrderStatusHistory, the order lifecycle state machine | Payment execution; stock arithmetic; refund execution |
| **Payments** | Payment, provider integration, payment lifecycle | Order status; refund policy |
| **Inventory** | Inventory records, reservation/release/commit arithmetic | Product identity; what an order contains |
| **Returns** | ReturnRequest, ReturnStatusHistory, return eligibility and lifecycle | Order status; refund execution (commands Payments) |
| **Reviews** | Review, moderation state, verified-purchase determination | **Product rating aggregates** — commands Catalog (`ADR-0008`) |
| **Recommendation** | ProductView, ProductCoOccurrence, ranking logic | Product truth; order truth — reads both |
| **Content** | Banner, homepage content scheduling | Product data; storefront copy in `brand.ts` |
| **Notification** | Message dispatch and channel adapters | Any business state — pure consumer, owns no tables |
| **Reporting** | Aggregated read models and dashboards | Any write. Reads across all contexts by design |

### 1.2 Not contexts — shared infrastructure

`audit-log`, `metrics`, `storage` are **shared services**, not domains
(KC-156). They own no business concept and are imported by many contexts.
`health` is an operational probe. Treating them as contexts would imply
ownership they do not have.

### 1.3 The one boundary correction in flight

`DISC-006` found exactly one violation (KC-152): **Reviews writes
`Product.avgRating` and emits `product.upserted`.** `ADR-0008` resolves it —
Reviews will command Catalog, and Catalog will own the write and the emission.

The table above records the **target** state: Catalog owns rating aggregates.
Until `ADR-0008` is implemented, the system does not match this section, and
that is a known, recorded deviation rather than a discrepancy in this document.

### 1.4 What lies outside every boundary

Per Constitution §4, and repeated here because an architecture that does not
state its exclusions invites them being "fixed":

**Supplier relationships, inter-party settlement, commission calculation and
multi-vendor fulfilment are outside every context**, by decision (KC-087–089).
The software models `client + contracted shops = one client`. There is no
Seller context and there should not be one.

---

## 2. Domain Model

**Source: Adopted** — `DISC-005` read the full schema (KC-131–145) and rated it
the strongest artifact in the project.

### 2.1 Aggregate roots

| Aggregate | Root | Contains |
| --- | --- | --- |
| **User** | User | OAuthAccount, Address |
| **Product** | Product | ProductVariant, ProductMedia; rating aggregates |
| **Collection** | Collection | CollectionProduct membership |
| **Cart** | Cart | CartItem |
| **Wishlist** | Wishlist | WishlistItem |
| **Coupon** | Coupon | CouponRedemption (append-only) |
| **Order** | Order | OrderItem, OrderStatusHistory |
| **Payment** | Payment | — (1:1 with Order) |
| **ReturnRequest** | ReturnRequest | ReturnStatusHistory |
| **Review** | Review | — |
| **Inventory** | Inventory | — (1:1 with ProductVariant) |
| **Banner** | Banner | — |

`ProductView`, `ProductCoOccurrence` and `AuditLog` are **event records**, not
aggregates — append-only, no lifecycle.

### 2.2 Binding modelling rules

These are the conventions `DISC-005` found held without exception, and Law 4
("an invariant belongs at the lowest layer that can enforce it") makes them
binding rather than customary:

1. **Money is integer minor units.** Never float or decimal (KC-131).
2. **Historical boundaries take snapshots**, not references. `Order` stores a
   JSON shipping-address snapshot; `OrderItem` stores product name, variant and
   unit price at transaction time; `CartItem` stores a price snapshot
   (KC-132).
3. **Ledgers are append-only** where the record is history — CouponRedemption,
   OrderStatusHistory, ReturnStatusHistory, ProductView, AuditLog (KC-133).
4. **Invariants sit in the database where expressible** — five CHECK
   constraints today (KC-134). Where Prisma cannot express one, the limitation
   is documented and the enforcing service named (KC-143).
5. **Soft delete** on User, Product, Category, Coupon, so historical orders
   keep referential integrity.
6. **UUID primary keys**, to avoid enumeration on public URLs.

### 2.3 Known model work

Recorded so it is not rediscovered:

- **Settings store** (KC-187, KC-194) — does not exist; required by the
  admin-editable return window, and to be built as a general mechanism.
- **Cart share token** (KC-137) — required by the shareable cart;
  `Wishlist.shareToken` is the in-repo precedent.
- **Order-level REFUNDED condition** (KC-190, KC-191) — the rule making
  `OrderStatus.REFUNDED` reachable is undecided and belongs in `DOM-RETURNS`.

---

## 3. Event Flow

**Source: Adopted** — `DISC-006` KC-150 measured producers and consumers rather
than reading a declared list.

`OV-003` makes this section optional for a plain Monolith. It is included
because the event bus is real, measured, and confirmed working against live
traffic (KC-066, KC-100).

| Event | Produced by | Consumed by |
| --- | --- | --- |
| `payment.succeeded` | Payments | **Ordering** |
| `order.confirmed` | Ordering | Notification, Recommendation |
| `return.requested` | Returns | Notification |
| `return.refunded` | Returns | Notification |
| `product.upserted` | Catalog *(and Reviews — see §1.3)* | Search |
| `product.deleted` | Catalog | Search |

**The central chain:**

```text
Payments ──payment.succeeded──► Ordering.confirmPayment
                                      │
                                      └──order.confirmed──► Notification
                                                          └► Recommendation
```

### 3.1 Delivery semantics — a binding constraint

The bus is **in-process, fire-and-forget, at-most-once** (KC-165). No
persistence, no retry, no dead-letter path. An event emitted immediately before
a crash is lost and its handler never runs.

**Consequences for any future design:**

- **Correctness-critical work does not go on the bus.** `ADR-0008` keeps rating
  recomputation synchronous for exactly this reason.
- **Prefer re-derivable effects over durable delivery.** `ADR-0008`'s
  idempotent bulk recompute is the pattern; durability is deferred behind
  `ADR-0010`'s named triggers.
- **This is the first blocker on horizontal scaling**, not infrastructure.

---

## 4. Folder Structure (design level)

**Source: Adopted** — `DISC-001` KC-018, KC-064. This is a design artifact
describing the intended shape, not a scaffolding script.

```text
apps/
  api/src/
    modules/<context>/           one module per bounded context (§1)
      <context>.module.ts
      <context>.controller.ts    omitted for pure consumers (Notification)
      <context>.service.ts
      dto/
      *.spec.ts                  co-located with its subject
      ports/ providers/          only where an external vendor sits
    common/                      cross-cutting only; never business logic
      decorators/ dto/ enums/ event-bus/ filters/ guards/
      interceptors/ media/ middleware/
    prisma/
  web/
    app/(storefront)/            customer routes
    app/(admin)/                 admin routes, same deployment (ADR-0006)
    components/<feature>/        by feature, not by type
    lib/
```

**Structurally consistent with the Modular Monolith ambition**: one module per
context, not layered by technical concern.

**Deviations are permitted where structural**, and `DISC-001` found five, all
justified: `health` (controller-only probe), `metrics` and `uploads` (no DTOs),
`notifications` (no controller — event consumer), `storage` (ports/providers,
hexagonal). 17 of 22 modules conform exactly.

**`ports/` and `providers/` appear only at vendor boundaries** — payments and
storage (KC-155). This confinement is deliberate; abstracting elsewhere would
add indirection without portability benefit.

---

## 5. Scalability Strategy

**Source: Adapted** — `DISC-007` measured the deployed architecture and found
`PRODUCT.md`'s NFR-2 and NFR-3 described a system that does not exist.
`ADR-0010` restated both. This section carries the restated targets.

### 5.1 Current posture

One NestJS process, one Next.js app, one Postgres instance, on a single VM
behind Caddy, with Elasticsearch, Prometheus/Grafana and Metabase as
independently-composable services on the same host (KC-163, KC-164).

### 5.2 Growth path, in order

1. **Vertical scaling** — the first and, at expected volume, likely only
   response.
2. **Datastore tuning** — indexes are already chosen against stated access
   patterns (KC-135); Elasticsearch already carries search load with a
   documented Postgres fallback.
3. **Read replicas** — the schema anticipates this; Reporting is already a
   pure-read context (§1.1) and is the natural first consumer.
4. **Horizontal scaling of the API** — **explicitly out of scope until traffic
   justifies it**, and **blocked first by the event bus** (§3.1), not by
   infrastructure. Adding instances before replacing the bus would produce
   correctness bugs, not capacity.

### 5.3 Reliability targets

Per `ADR-0010`, superseding `PRODUCT.md`:

- **Availability**: best-effort on a single node; planned downtime acceptable
  during deploys. **No numeric uptime percentage is claimed**, because no
  mechanism in this topology delivers one.
- **Recovery** relies on the documented backup and restore procedure rather
  than redundancy — and Constitution **Law 6** makes exercising that procedure
  non-optional. It has never been performed (KC-205).

### 5.4 Unmeasured

Stated plainly rather than assumed: NFR-1 performance, NFR-6 mobile-first and
NFR-10 locale-readiness have never been measured (KC-172). NFR-5 accessibility
is scheduled for `axe` coverage (KC-176). This section makes no claim about
them — per Law 1.

---

## Constitution compliance

`OV-003` requires that no section conflict with a Law.

| Law | Status |
| --- | --- |
| 1 — no surface asserts absent capability | **Satisfied.** §1.3 records the Reviews deviation as in-flight rather than describing target state as current; §5.4 states what is unmeasured rather than claiming it |
| 2 — knowledge beside the code, outlives it | **Satisfied.** Every section cites its Discovery source and claim ids |
| 3 — commitments change by explicit navigation | **Satisfied.** §5 carries `ADR-0010`'s restatement rather than silently adopting new targets |
| 4 — invariants at the lowest enforcing layer | **Satisfied.** §2.2 makes the modelling rules binding |
| 5 — command in, event out | **Satisfied.** §1 governs every boundary by it; §1.3 records the one known violation and its remedy |
| 6 — recovery must be exercised | **Surfaced, not satisfied.** §5.3 states the dependency; the restore has not been performed. This is a live non-compliance, correctly visible rather than hidden |

**Law 6 is not satisfied today.** Per `OV-003`'s rule that conflicts must be
surfaced rather than resolved in the architecture's favour, it is recorded here
as an open non-compliance, and it is the first item on `DISC-010`'s Improve
list.

## Technology decisions

`OV-004` covers *why each technology implementing this architecture was
chosen*, as a separate ADR series. Authored 2026-08-07:

| ADR | Layer | Note |
| --- | --- | --- |
| `ADR-0011` | Decision mode — **Hybrid** | Owner choice: compare, recommend, await approval |
| `ADR-0012` | Backend framework — NestJS | Module system is how §1's boundaries are enforced structurally |
| `ADR-0013` | Frontend framework — Next.js App Router | SSR for NFR-7; route groups implement `ADR-0006` |
| `ADR-0014` | Datastore — PostgreSQL | The engine Law 4's invariants depend on |
| `ADR-0015` | Data access — Prisma | With documented raw-SQL escape hatches |
| `ADR-0016` | Search — Elasticsearch + Postgres fallback | Fallback exercised in CI |
| `ADR-0017` | Hosting — self-hosted Docker Compose, single VM | The posture `ADR-0010` restated NFRs around |

`ADR-0012`–`ADR-0017` are **retroactive** — the decisions were taken
pre-Oriveda and never recorded. Each states that its reasoning is reconstructed
from evidence rather than contemporaneous, per Law 1.

**Not yet covered**, and recorded here so the gap is visible rather than
implied-complete: CI/CD (GitHub Actions) and transactional email (Resend) have
no ADR. Neither is contested; both are candidates when next touched.

## Confidence

**High (91%).** Four of five sections are Adopted from Frozen investigations
whose own confidence ranges 87–95%, and the boundary map was measured three
independent ways. §5 is Adapted and carries `ADR-0010`'s reasoning directly.

The cap: §1's context *names and groupings* remain interpretation (KC-149's own
limitation), and §2.3's known model work describes capabilities not yet
specified — the settings store and cart share token are named, not designed.
