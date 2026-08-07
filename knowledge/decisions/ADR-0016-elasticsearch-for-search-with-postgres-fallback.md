---
id: ADR-0016
title: Elasticsearch for search, with a Postgres fallback
version: 0.1.0
status: Accepted
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-07
milestone: M3
category: Decisions
priority: Medium
depends_on: []
required_by: []
related_documents:
  - ARCH-001
related_decisions:
  - ADR-0011
  - ADR-0014
tags:
  - technology
  - search
risk: Medium
complexity: Medium
---

# ADR-0016 — Elasticsearch for search, with a Postgres fallback

> **Retroactively recorded.** Taken pre-Oriveda and never written down.
> Authored 2026-08-07 under `OV-004` to close the gap Constitution **Law 2**
> exists to prevent. **The reasoning below is reconstructed from evidence**, not
> a contemporaneous record; where the original deliberation is unknown this
> document says so rather than inventing it.

## Context

`PRODUCT.md` FR-3 specifies full-text, typo-tolerant product search with
autosuggest, and NFR-1 sets a sub-300ms target. `ARCHITECTURE.md` records the
contemporaneous reasoning for isolating it:

> "Elasticsearch is a dedicated read path, isolated from PostgreSQL — search
> traffic spikes don't degrade transactional DB."

## Options Considered

- **Elasticsearch** — typo tolerance, relevance tuning, autosuggest, and a read
  path isolated from the transactional database. Costs an additional service to
  operate, memory-hungry on a single VM.
- **PostgreSQL full-text + `pg_trgm` alone** — no extra service, no extra
  memory, adequate for a small catalog. Weaker typo tolerance and relevance
  control, and search load lands on the transactional primary.
- **A hosted search service (Algolia, Typesense Cloud)** — best DX, least
  operational burden, and rejected on the constraint preferences in `ADR-0011`:
  vendor lock-in and recurring cost for a prelaunch store.

## Decision

**Elasticsearch as the primary search path, with PostgreSQL trigram/tsvector as
a documented fallback.** Both are real, and the fallback is exercised.

## Consequences

1. **Graceful degradation is a tested property, not a hope.** CI points
   `ELASTICSEARCH_NODE` at an unreachable port deliberately, so the whole test
   suite runs against the Postgres fallback path (KC-059). A fallback nobody
   exercises is a fallback that does not work.
2. **The search module reads Catalog and owns no product state** (`ARCH-001`
   §1.1) — it is a projection, kept in sync by `product.upserted` and
   `product.deleted` events (KC-150).
3. **Elasticsearch is independently composable** — its own compose file, so it
   can be stopped or moved without touching the API (KC-164).
4. **The storefront does not currently use it.** `DISC-004` found search
   queries go to `/products?q=`, the trigram fallback, and the Elasticsearch
   endpoints are never called (KC-116). The owner has decided search should
   move to the Elasticsearch path (KC-124) — **the fallback must remain working
   regardless**, because CI depends on it.
5. **NFR-1's sub-300ms target has never been measured** (KC-172).

## Revisit Criteria

- Catalog size and query volume stay small enough that Postgres alone meets
  relevance and latency needs — at which point Elasticsearch is operational
  cost without benefit, and the fallback becomes the primary.
- Single-VM memory pressure makes co-hosting Elasticsearch untenable.

## Cross References

- `DISC-004` KC-116, KC-124 — the storefront currently uses the fallback.
- `DISC-001` KC-059 — CI exercises the fallback deliberately.
