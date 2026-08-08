---
id: FEAT-RATING-OWNERSHIP
title: 'Jwel / ELYSIAN — Feature: Rating Aggregate Ownership and Reconciliation'
version: 0.1.0
status: Review
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-08
updated: 2026-08-08
milestone: M6
category: Features
priority: High
depends_on:
  - ADR-0008
  - ARCH-001
  - DOM-CATALOG
  - DOM-REVIEWS
required_by: []
related_documents:
  - DISC-005
  - DISC-006
  - STD-API
  - STD-DATABASE
related_domains:
  - DOM-CATALOG
  - DOM-REVIEWS
related_decisions:
  - ADR-0008
  - ADR-0010
tags:
  - feature
  - catalog
  - reviews
  - architecture
risk: Medium
complexity: Medium
---

# FEAT-RATING-OWNERSHIP

## 1. Overview

`ARCH-001` §1.3 records **exactly one boundary violation** in the system, and
this feature closes it. `reviews.service.ts` issues `prisma.product.update` to
maintain `Product.avgRating` and `ratingCount`, then emits `product.upserted`
so Search reindexes (KC-152) — a write into another context's table, and a
module publishing another context's event.

`ADR-0008` decided the fix a milestone ago. Until it is implemented, `ARCH-001`
§1.1's claim that Catalog owns rating aggregates is a **target**, not a
description, and the architecture document says so explicitly. This feature is
what makes that section true.

**Why it matters beyond tidiness.** The `avgRating` column is owned by Catalog
while its value is owned by Reviews, so no single context can guarantee the
number is correct (KC-142). The aggregate feeds search ranking's popularity
signal — `field_value_factor` on `ratingCount` — so the failure mode is not a
visibly wrong number on a page. It is **subtly wrong result ordering that
nobody notices**.

## 2. Owning Domain

**Owning domain: `DOM-CATALOG`.** That is the whole point: the aggregate gains
a single owner, and it is the context that owns the column.

**Dependencies** — checked against the initiating domain's Allowed list:

| Domain | Call | Allowed by |
| --- | --- | --- |
| Reviews → Catalog | **Command** — `recomputeRating(productId)` | `ADR-0008`, which sanctions exactly this direction. A new compile-time import `reviews → products`, with no cycle: Catalog's return path is the event, not a call back |

Reviews stops touching `prisma.product` and stops emitting `product.upserted`.

## 3. Acceptance Criteria

1. **Catalog owns the write.** No module outside Catalog issues
   `prisma.product.update` against rating fields.
2. **Catalog owns the emission.** No module outside Catalog emits
   `product.upserted` or `product.deleted`.
3. The recompute **derives** the aggregate from the approved review set rather
   than incrementing, which is what makes it idempotent and bulk-runnable
   (KC-159).
4. The recompute stays **synchronous** — a customer posting a review sees the
   rating move (`ADR-0008` rejected the eventually-consistent alternative
   deliberately).
5. Moderation and recompute are **one transaction**. A review approved without
   its rating updated is precisely the desync this exists to prevent.
6. A **bulk reconciliation path** exists and is runnable against the whole
   catalogue.
7. Reconciliation supports a **dry run** that reports drift without writing.
8. Reconciliation emits `product.upserted` **only for products it actually
   corrected**, not for every product scanned.

### On criterion 6, and why it is the half that matters

`ADR-0008` consequence 3 is unusually direct: *"If only one half of this ADR is
implemented, implement this half."* Ownership makes the value correct **by
construction**; reconciliation makes it **recoverable when construction is
bypassed**. This system has three live bypasses — `seed-demo.ts` writes the
aggregate directly, CSV bulk import exists (`ADR-0006`), and manual SQL
correction is a documented operational practice (`RUNBOOK` §11a).

Both halves are built here. The note is recorded because it should survive any
future decision to descope.

## 4. API Surface

**New** — admin only, role-guarded per `STD-API` r2:

- `POST /admin/products/ratings/reconcile` — recompute every product's rating
  aggregate from its approved reviews. Accepts `dryRun`.

Returns what it found and what it changed: products scanned, products drifted,
and the drifted products themselves with their stored and correct values. A
reconciliation that reports only "done" cannot answer the question an operator
actually has, which is *how wrong was it*.

**Unchanged** — the existing moderation endpoint stays the moderation surface.
The recompute moves behind it, not into a new endpoint.

## 5. Events

**Publishes** — `product.upserted`, now **from Catalog**, which is the point.
Emitted after the transaction commits, never inside it: an event announcing a
write that then rolls back is worse than no event.

**Consumes** — none.

Per `ARCH-001` §3.1 the bus is at-most-once, so a lost `product.upserted` means
Elasticsearch keeps a stale rating until the next reindex. Reconciliation is
itself the recovery path for that, which is `ADR-0010`'s preferred mitigation —
re-derivable effect over durable delivery.

## 6. Data Changes

**None.** `avgRating` and `ratingCount` already exist. This feature changes
**who writes them**, not what is stored.

## 7. Edge Cases & Validations

1. **A product with no approved reviews.** `avgRating` is `0` and `ratingCount`
   is `0` — not null. Matches the current behaviour and the column defaults.
2. **The last approved review is rejected.** The aggregate must fall back to
   zero rather than keeping its previous value. Deriving rather than
   incrementing gives this for free; incrementing would not.
3. **Recompute for a product that does not exist.** Reconciliation skips it; a
   single-product recompute for a deleted product must not create a row or
   throw into the moderation path.
4. **Soft-deleted products** (`deletedAt`) still carry aggregates. They are
   reconciled like any other — a product can be restored, and restoring one
   with a wrong rating would reintroduce the drift this feature removes.
5. **Rounding.** `avgRating` is a decimal column; the derived average must be
   compared at the column's precision, or every reconciliation run reports
   every product as drifted forever.
6. **Idempotence.** Running reconciliation twice must report zero drift on the
   second run. This is the criterion that proves the derivation is honest.
7. **A moderation decision that fails to recompute.** The whole transaction
   rolls back and the review stays as it was. Accepted and intended per
   `ADR-0008`'s trade-off section.
8. **`seed-demo.ts` writing the aggregate directly.** It is a seed script, not
   an application path, and it is exactly the bypass reconciliation exists for.
   Pointed at the same derivation so it cannot drift from it.

## 8. Non-Functional Considerations

| Standard | Bearing |
| --- | --- |
| **`STD-API`** | Reconciliation is admin-only (r2) and reports a result body rather than a bare 200. |
| **`STD-DATABASE`** | The aggregate is a **deliberate stored derivation** — the exception to r9, justified by avoiding an `AVG`/`COUNT` over reviews on every PLP and PDP read. Reconciliation is the price of that exception, and this feature is where it gets paid. |
| **`STD-TESTING`** | Idempotence and the fall-back-to-zero case are the two tests that would actually have caught KC-142. Every §7 edge case needs a test (r6). |
| **`STD-PERFORMANCE`** | Reconciliation is O(products). It is an admin action on a ~1,000-product catalogue, not a request-path concern. |
| **`STD-CODE`** | One derivation, used by the service, the bulk path and the seed — not three copies that drift. |

**Law 5 check.** This feature is Law 5 applied to the one place the codebase
breaks it: *context boundaries are crossed by command in, event out*. It is the
last known violation, so implementing it makes `ARCH-001` §1.3 empty.

## 9. Definition of Done

Verified end to end against a scratch Postgres with the API booted against it,
a real review, and a deliberately corrupted product row:

| Case | Result |
| --- | --- |
| Review posted (`PENDING`) | rating stays `0.00 / 0` — unapproved reviews do not count |
| Admin approves | `5.00 / 1` |
| Admin rejects the only approved review | `0.00 / 0` — falls back, does not strand the old value |
| Moderating an unknown review | 404, Catalog never called |
| `avg_rating` corrupted by hand to `1.50 / 42` | — |
| Reconcile as a customer | **403** |
| Reconcile `?dryRun=true` | reports `{scanned: 1, drifted: 1, corrected: 0}` with stored **and** correct values; row unchanged |
| Reconcile | `corrected: 1`, row now `5.00 / 1` |
| Reconcile again | `{drifted: 0, corrected: 0}` — idempotent against a real database, not just a mock |

- [x] Catalog owns `recomputeRating`, the write and the emission.
- [x] Reviews commands Catalog and touches neither `prisma.product` nor
      `product.upserted`.
- [x] Moderation and recompute share one transaction; the event is emitted
      after commit.
- [x] Bulk reconciliation runnable against the whole catalogue, with `dryRun`.
- [x] Reconciliation emits events only for corrected products.
- [x] Idempotence proven by test, and again against a live database.
- [x] `seed-demo.ts` uses the same derivation.
- [x] Every §7 edge case covered by a test (14 in `rating-aggregate.spec.ts`,
      16 in `rating-ownership.spec.ts`, 5 rewritten in `reviews.service.spec.ts`).
- [x] `ARCH-001` §1.3 amended — Amendment A3, v1.3.0.
- [x] `DOM-CATALOG` and `DOM-REVIEWS` updated (both v1.1.0).
- [x] `RUNBOOK` §11c — when to run reconciliation, and why it is not an §11a
      script.

## 10. The claim is enforced, not asserted

`ARCH-001` §1.3 now says there is **no known boundary violation outstanding**.
That is a strong claim for a document to make about code it cannot see, so it
is backed structurally rather than by inspection.

`common/architecture.spec.ts` reads the source tree and fails the build when a
module outside Catalog:

- writes the product row (`prisma.product.update`),
- emits `product.upserted` or `product.deleted`,
- or grows a second copy of the rating derivation.

A behavioural test would not have caught the original violation, because the
original behaviour was *correct* — Reviews updated the rating perfectly well.
What was wrong was **who** did it, and only reading the source sees that. The
next violation will not be a regression in Reviews; it will be a new module
doing the convenient thing.
