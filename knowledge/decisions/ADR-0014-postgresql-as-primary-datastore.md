---
id: ADR-0014
title: PostgreSQL as the primary datastore
version: 0.1.0
status: Accepted
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-07
milestone: M3
category: Decisions
priority: Critical
depends_on: []
required_by: []
related_documents:
  - ARCH-001
related_decisions:
  - ADR-0011
  - ADR-0015
tags:
  - technology
  - database
risk: Low
complexity: Medium
---

# ADR-0014 — PostgreSQL as the primary datastore

> **Retroactively recorded.** Taken pre-Oriveda and never written down.
> Authored 2026-08-07 under `OV-004` to close the gap Constitution **Law 2**
> exists to prevent. **The reasoning below is reconstructed from evidence**, not
> a contemporaneous record; where the original deliberation is unknown this
> document says so rather than inventing it.

## Context

The system is transactional: orders reserve stock, redeem coupons and initiate
payment in one unit of work. `DISC-008` found the correctness of that path
depends on database-level guarantees — conditional `UPDATE`s carrying the
oversell invariant in their `WHERE` clause (KC-183), five CHECK constraints
(KC-134), and append-only ledgers enforcing coupon limits by `COUNT()` rather
than a mutable counter (KC-133).

## Options Considered

- **PostgreSQL** — ACID transactions, CHECK constraints, partial and expression
  indexes, BRIN and GIN index types, `pg_trgm` and full-text search as
  extensions, JSON columns for snapshots. Operationally unremarkable, which is
  the point.
- **MySQL / MariaDB** — comparable transactional guarantees; weaker on
  extension-backed full-text and trigram search and on index-type variety. The
  Postgres search fallback would not have existed as cheaply.
- **MongoDB** — rejected on the transactional requirement. The money path wants
  a relational engine with constraints, not a document store with them bolted
  on.

## Decision

**PostgreSQL**, with `pgcrypto` and `pg_trgm` extensions enabled.

## Consequences

1. **Invariants live where Law 4 wants them** — five CHECK constraints, immune
   to application bugs (KC-134).
2. **The oversell-safe reservation pattern is possible at all** (KC-183). The
   single best piece of engineering `DISC-008` found, and it is a database
   capability.
3. **Search degrades gracefully.** `Product.searchVector` (tsvector, GIN) plus a
   trigram index on `name` give a working fallback when Elasticsearch is
   unreachable — exercised in CI against a dead node (`ADR-0016`).
4. **Index variety is used deliberately** — BRIN on `Order.createdAt`, GIN
   trigram on product name (KC-135).
5. **Read replicas are the documented scaling path** for Reporting
   (`ARCH-001` §5.2), supported natively.
6. **Caveat**: `searchVector` and its GIN index live in a hand-authored raw-SQL
   migration, invisible to Prisma's model (KC-144).

## Revisit Criteria

- Write volume exceeds a single primary — the response is replicas and pooling
  first (`ARCH-001` §5.2), not a different engine.
- A workload appears that is genuinely document-shaped and separable.

## Cross References

- `DISC-005` KC-131–135; `DISC-008` KC-134, KC-183.
