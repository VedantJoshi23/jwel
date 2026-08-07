---
id: ADR-0008
title: Cross-context interaction is command in, event out
version: 0.1.0
status: Accepted
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-06
updated: 2026-08-06
milestone: M1
category: Decisions
priority: High
depends_on: []
required_by: []
related_documents:
  - DISC-005
  - DISC-006
related_decisions:
  - ADR-0007
tags:
  - architecture
  - bounded-contexts
  - events
risk: Low
complexity: Medium
---

# ADR-0008 — Cross-context interaction is command in, event out

## Context

`DISC-006` measured coupling between the 22 API modules three ways — imports,
events, and table access — and found the module structure is a genuine bounded
context map. It also found exactly one boundary breach.

**The breach**: `reviews.service.ts` issues `prisma.product.update` to maintain
`Product.avgRating` and `ratingCount`, then emits `product.upserted` so Search
reindexes (KC-152). Two problems in one path — a write into another context's
table, and a module publishing another context's event.

This is not a tidiness concern. It is the structural cause of `DISC-005`'s
KC-142: the `avgRating` **column** is owned by Catalog while its **value** is
owned by Reviews, so no single context can guarantee the number is correct.
Because the aggregate feeds search ranking's popularity signal, the failure
mode is not a visibly wrong number — it is subtly wrong result ordering that
nobody notices.

`DISC-006` also found the system already contains a well-designed answer to the
same shape of problem: the Orders ↔ Payments seam (KC-151). Orders imports
`PaymentsService` synchronously to *initiate* payment; Payments returns control
asynchronously by emitting `payment.succeeded`, which Orders consumes. The
bidirectional business relationship exists with no compile-time cycle, and
either side can be tested alone.

## Decision

**When one context must cause a change in another, it sends a command
synchronously and receives an event asynchronously. A context never writes
another context's tables, and never emits another context's events.**

Applied to the breach:

```text
Reviews ──command──► Catalog.recomputeRating(productId)
                          │  owns the write
                          └──event──► product.upserted ──► Search
```

Reviews calls a Catalog-owned service. **Catalog** performs the update and
emits its own event. Reviews stops touching `prisma.product` and stops emitting
`product.upserted`.

**The recompute stays synchronous and in-transaction** (KC-158) — see
Alternatives.

**The recompute is idempotent and bulk-runnable** (KC-159): it derives the
aggregate from the review set rather than incrementing, so the same function
reconciles one product or all of them.

## Consequences

1. **The aggregate gains a single owner.** Catalog owns both the column and its
   value, so correctness is a property one context can guarantee.
2. **The event name becomes honest.** `product.upserted` emitted by Catalog is
   accurate — Catalog did change the product row. It was only misleading
   because the wrong module emitted it.
3. **Bulk reconciliation is the durable fix**, and is independent of the
   boundary. Ownership makes the value correct *by construction*; reconciliation
   makes it recoverable when construction is bypassed — a seed script, a CSV
   bulk import (which this system has), or a manual SQL correction. **If only
   one half of this ADR is implemented, implement this half.**
4. **One pattern, not two.** Future cross-context work has a single reference
   shape rather than a choice between two.
5. **A new compile-time import** appears: reviews → products. Accepted — it is
   the same direction of dependency the pattern already sanctions, and it does
   not create a cycle because Catalog's return path is the event.

## Alternatives Considered

- **Leave it.** Rejected — it works, but it leaves an aggregate with no owner,
  which is precisely why KC-142's silent desync is possible.
- **Full event-driven: Reviews emits `review.approved`, Catalog subscribes and
  recomputes, Search reacts to Catalog.** Architecturally purest and rejected
  anyway. It makes rating updates **eventually consistent**: a customer posts a
  review and the rating does not move for an indeterminate window. That is a
  visible regression on a value read on every PDP and PLP, bought for an
  invisible architectural benefit. It also decouples the recompute from the
  review write's transaction, which is what makes the number trustworthy in the
  first place.
- **A database trigger.** Rejected — it would work and would be robust, but it
  moves business logic into a layer this codebase otherwise keeps free of it
  (no migration currently creates any trigger or function), and it is invisible
  to the application's tests.
- **Renaming `product.upserted` to something finer-grained.** Rejected as
  unnecessary once Catalog owns the emission — the name is then accurate.

## Trade-offs

The synchronous command couples Reviews to Catalog's availability: if the
recompute fails, the review write fails with it. That is the intended
behaviour — a review that is recorded without updating the rating is exactly
the desync this ADR exists to prevent — but it does mean Reviews cannot accept
writes while Catalog is unhealthy. Acceptable in a single-process modular
monolith where both are in the same deployable.

## Validation

- No module outside Catalog issues `prisma.product.update`.
- No module outside Catalog emits `product.upserted` or `product.deleted`.
- `recomputeRating` is idempotent: running it twice produces the same result.
- A bulk reconciliation path exists and is runnable against the whole catalog.

## Cross References

- `DISC-006` KC-151 (the Orders ↔ Payments pattern this generalises), KC-152
  (the breach), KC-158.
- `DISC-005` KC-142 (the desync fragility this resolves), KC-159.
- `ADR-0006` — the hybrid admin strategy is unaffected; bulk import is one of
  the paths that makes reconciliation necessary.
