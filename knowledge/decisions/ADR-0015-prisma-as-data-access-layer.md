---
id: ADR-0015
title: Prisma as the data access layer
version: 0.1.0
status: Accepted
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-07
milestone: M3
category: Decisions
priority: High
depends_on: []
required_by: []
related_documents:
  - ARCH-001
related_decisions:
  - ADR-0011
  - ADR-0014
tags:
  - technology
  - database
risk: Medium
complexity: Medium
---

# ADR-0015 — Prisma as the data access layer

> **Retroactively recorded.** Taken pre-Oriveda and never written down.
> Authored 2026-08-07 under `OV-004` to close the gap Constitution **Law 2**
> exists to prevent. **The reasoning below is reconstructed from evidence**, not
> a contemporaneous record; where the original deliberation is unknown this
> document says so rather than inventing it.

## Context

A TypeScript codebase with 27 models needed type-safe database access and a
migration history. `DISC-005` found the resulting schema is the strongest
artifact in the project (95% confidence), with conventions held across every
model without drift.

## Options Considered

- **Prisma** — schema-first, generated types, first-class migrations, strong
  DX. Trades away SQL expressiveness: no partial indexes, no portable CHECK
  constraints, no XOR constraints.
- **TypeORM** — decorator-based, closer to the entity-per-class model NestJS
  docs assume, more raw-SQL latitude. Weaker generated types, worse migration
  reputation.
- **Kysely / raw SQL** — full expressiveness, no schema abstraction. Would have
  meant hand-maintaining types across 27 models and losing the single readable
  `schema.prisma`.

## Decision

**Prisma**, with raw SQL used deliberately where Prisma cannot express what is
needed.

## Consequences

1. **The schema is one readable artifact** carrying its own design rationale
   (KC-132) — much of why `DISC-005` scored as high as it did.
2. **Its limits are real, and were worked around explicitly rather than
   silently**:
   - CHECK constraints added in hand-authored migrations (KC-134).
   - The oversell-safe reservation uses raw conditional `UPDATE`s, because the
     invariant must sit in the `WHERE` clause (KC-183).
   - `searchVector` is `Unsupported("tsvector")` with a raw-SQL GIN index — so
     **part of the schema is invisible to Prisma's drift detection** (KC-144).
   - `ProductView`'s XOR and `Coupon.value`'s type-dependent meaning are
     documented as application-layer-only (KC-143).
3. **A comment/implementation mismatch exists** — an index described as partial
   is a plain composite index, because Prisma cannot declare partial indexes
   (KC-145).
4. Prisma 5, one major behind (KC-200).

## Revisit Criteria

- Raw-SQL escape hatches accumulate to where Prisma obstructs rather than
  helps. The count is currently small and each is documented.
- Prisma's drift detection becomes load-bearing; today it cannot see the
  raw-SQL portion of the schema (KC-144).

## Cross References

- `DISC-005` KC-131–145; `ADR-0014`.
