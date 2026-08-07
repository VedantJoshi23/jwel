---
id: DOM-SEARCH
title: 'Jwel / ELYSIAN — Domain: Search'
version: 1.0.0
status: Frozen
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-07
milestone: M5
category: Domains
priority: Medium
depends_on:
  - ARCH-001
  - CONSTITUTION
required_by: []
related_documents:
  - DISC-006
related_decisions:
  - ADR-0016
tags:
  - domain
  - search
risk: Low
complexity: Low
---

# DOM-SEARCH

**Depth tier: Thin** — a read-only projection of Catalog with no independent
business rules.

**Thin justification, per `OV-006`:** `DISC-006` measured this context's table
access and found it reads `product` and owns no product state (KC-153). Its only
inbound dependency is Catalog's `product.upserted` / `product.deleted` events
(KC-150). It originates no data and decides no business rule — every fact it
serves is Catalog's, reshaped for retrieval.

## 1. Overview

Search owns the index and the query semantics over it. It answers "which
products match this text" and nothing else.

## 2. Ownership

**Owns** — the Elasticsearch index, its mapping, and relevance/ranking
configuration.

**Explicitly does NOT own** — product truth, publication state, pricing or
stock. All are Catalog's; Search reflects them.

## 3. Invariants

**N/A — derived from Catalog.** Search asserts no business rule of its own.

Two operational properties, which are consequences rather than invariants:

| # | Property | Source |
| --- | --- | --- |
| 1 | The index is eventually consistent with Catalog, converging on `product.upserted` / `product.deleted`. | KC-150 |
| 2 | When Elasticsearch is unavailable, search degrades to the PostgreSQL trigram/tsvector path rather than failing. | `ADR-0016`, KC-059 |

## 4. API Surface

`GET /search`, `GET /search/autocomplete`, `POST /admin/search/reindex`.

**None are called by the storefront today** — search queries go to
`/products?q=`, the Postgres fallback (KC-116). Moving to this path is agreed
(KC-124), and **the fallback must keep working regardless**: CI exercises it
deliberately by pointing at an unreachable node.

## 5. Events

**Publishes** — none.
**Consumes** — `product.upserted`, `product.deleted`, both from Catalog.

## 6. Data Ownership

No PostgreSQL tables. The Elasticsearch index is the only owned store, and it
is fully rebuildable from Catalog — which is what makes reindex safe and the
at-most-once bus tolerable here.

## 7. Dependencies

**Allowed** — Catalog (read, for indexing).

**Forbidden** — writing any table; emitting events; any dependency on Ordering,
Payments, Shopping, Reviews or Recommendation.

## 8. Edge Cases & Validations

1. **A missed `product.upserted`.** The index drifts silently. Recovery is the
   admin reindex endpoint — the re-derivable-effects mitigation `ADR-0010`
   prefers to durability.
2. **Elasticsearch unavailable.** Fallback path (property 2).
3. **Unpublished or soft-deleted products.** Must never appear in results,
   regardless of index state.
4. **Reindex during traffic.** Must not blank results mid-rebuild.
5. **Rating aggregates feed relevance** — `ratingCount` is a ranking signal, so
   the desync risk `ADR-0008` fixes surfaces here as subtly wrong ordering
   rather than a wrong number (KC-142).

## Constitution compliance

Law 1 — §4 states the storefront does not use this path. Law 2 — sourced.
Law 4 — not applicable; owns no relational invariant. Law 5 — consumes events,
writes nothing.

## Open items

- Storefront still uses the fallback (KC-116, KC-124).
